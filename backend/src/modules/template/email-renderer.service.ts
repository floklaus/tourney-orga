import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { formatInZone } from '../email/domain/send-time';
import {
  brandLogoUrl,
  copyableBody,
  htmlToText,
  wrapInLayout,
} from '../mail/mail-layout';
import { Setting } from '../settings/setting.entity';
import { Team } from '../team/team.entity';
import {
  RenderContext,
  renderTemplate,
  sanitizeBody,
} from './domain/placeholders';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
  /** For manual sending: body + footer without the email layout. */
  copyHtml: string;
  copyText: string;
}

type TeamLike = Pick<Team, 'name' | 'contactName' | 'unsubscribeToken'>;

/** What an email is about: the tournament (with effective variables) and the team's age group. */
export interface EmailContext {
  tournament: {
    name: string;
    startDate: string;
    endDate: string;
    url: string | null;
  };
  variables: Record<string, string>;
  ageGroup: string | null;
  /** Days the team plays on (YYYY-MM-DD). */
  days: string[];
}

export const SAMPLE_TEAM: TeamLike = {
  name: 'FC Example',
  contactName: 'Alex Sample',
  unsubscribeToken: 'preview',
};

@Injectable()
export class EmailRendererService {
  constructor(
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  render(
    source: { subject: string; bodyHtml: string },
    team: TeamLike,
    context: EmailContext | null,
    settings: Setting,
  ): RenderedEmail {
    const unsubscribeUrl = `${this.env.get('APP_URL', { infer: true })}/unsubscribe/${team.unsubscribeToken}`;
    const oneClickUnsubscribeUrl = `${this.env.get('API_PUBLIC_URL', { infer: true })}/api/v1/public/unsubscribe/${team.unsubscribeToken}`;
    const ctx: RenderContext = {
      team: { name: team.name, contactName: team.contactName },
      tournament: {
        name: context?.tournament.name ?? '',
        startDate: context
          ? formatInZone(context.tournament.startDate, settings.timezone)
          : '',
        endDate: context
          ? formatInZone(context.tournament.endDate, settings.timezone)
          : '',
        url: context?.tournament.url ?? '',
        vars: context?.variables ?? {},
      },
      participation: {
        ageGroup: context?.ageGroup ?? '',
        days: (context?.days ?? [])
          .map((d) => formatInZone(d, settings.timezone))
          .join(', '),
      },
      organizer: { name: settings.organizerName },
      unsubscribeUrl,
    };
    // Sanitize again after rendering: values are escaped, but this keeps
    // the guarantee even if a stored body predates a sanitizer change.
    const body = sanitizeBody(renderTemplate(source.bodyHtml, ctx, 'html'));
    const html = wrapInLayout({
      bodyHtml: body,
      logoUrl: brandLogoUrl(
        settings.logoUrl,
        this.env.get('APP_URL', { infer: true }),
      ),
      footerHtml: settings.footerHtml,
      unsubscribeUrl,
    });
    const copyHtml = copyableBody({
      bodyHtml: body,
      footerHtml: settings.footerHtml,
      unsubscribeUrl,
    });
    return {
      subject: renderTemplate(source.subject, ctx, 'text').trim(),
      html,
      text: htmlToText(html),
      copyHtml,
      copyText: htmlToText(copyHtml),
      unsubscribeUrl,
      oneClickUnsubscribeUrl,
    };
  }
}
