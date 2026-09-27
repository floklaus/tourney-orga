import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { randomToken, sha256 } from '../../common/crypto';
import { conflict, notFound } from '../../common/errors';
import { EnvironmentVariables } from '../../config/env.validation';
import { SystemMailService } from '../mail/system-mail.service';
import { Invitation } from './invitation.entity';
import { AcceptInvitationDto } from './user.dto';
import { User } from './user.entity';
import { UserService } from './user.service';

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

export interface IssuedInvitation {
  invitation: Invitation;
  inviteUrl: string;
}

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    @InjectRepository(Invitation)
    private readonly invitations: Repository<Invitation>,
    private readonly users: UserService,
    private readonly mail: SystemMailService,
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  findPending(): Promise<Invitation[]> {
    return this.invitations.find({
      where: { acceptedAt: IsNull(), revokedAt: IsNull() },
      relations: { invitedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async invite(actor: User, email: string): Promise<IssuedInvitation> {
    if (await this.users.findByEmail(email))
      throw conflict('A user with this email already exists');
    await this.invitations.update(
      { email, acceptedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return this.issue(actor, email);
  }

  async resend(actor: User, id: string): Promise<IssuedInvitation> {
    const existing = await this.findOpen(id);
    await this.invitations.update(existing.id, { revokedAt: new Date() });
    return this.issue(actor, existing.email);
  }

  async revoke(id: string): Promise<void> {
    const existing = await this.findOpen(id);
    await this.invitations.update(existing.id, { revokedAt: new Date() });
  }

  async validate(token: string): Promise<Invitation> {
    const invitation = await this.invitations.findOneBy({
      tokenHash: sha256(token),
    });
    if (!invitation || invitation.revokedAt) throw notFound('Invitation');
    if (invitation.acceptedAt)
      throw conflict('This invitation was already used');
    if (invitation.expiresAt < new Date())
      throw conflict('This invitation has expired');
    return invitation;
  }

  async accept(dto: AcceptInvitationDto): Promise<User> {
    const invitation = await this.validate(dto.token);
    // Mark as used first so a double submit cannot create two accounts.
    const { affected } = await this.invitations.update(
      {
        id: invitation.id,
        acceptedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      { acceptedAt: new Date() },
    );
    if (!affected) throw conflict('This invitation was already used');
    return this.users.create({
      email: invitation.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }

  private async findOpen(id: string): Promise<Invitation> {
    const invitation = await this.invitations.findOneBy({
      id,
      acceptedAt: IsNull(),
      revokedAt: IsNull(),
    });
    if (!invitation) throw notFound('Invitation');
    return invitation;
  }

  /**
   * Creates the invitation and emails the link when a mailbox is configured.
   * The link is always returned so the admin can share it directly.
   */
  private async issue(actor: User, email: string): Promise<IssuedInvitation> {
    const token = randomToken();
    const invitation = await this.invitations.save(
      this.invitations.create({
        email,
        tokenHash: sha256(token),
        invitedBy: actor,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      }),
    );
    const inviteUrl = `${this.env.get('APP_URL', { infer: true })}/invite/${token}`;
    if (this.mail.isAvailable) {
      try {
        await this.mail.send(
          email,
          'You have been invited to Team Communication Planner',
          `<p>${escape(actor.firstName)} ${escape(actor.lastName)} invited you as a co-organizer.</p>
           <p><a href="${inviteUrl}">Accept the invitation</a></p>
           <p>The link is valid for 72 hours.</p>`,
        );
      } catch (error) {
        // The admin still gets the link and can share it another way.
        this.logger.warn(
          `Invitation email to ${email} failed: ${(error as Error).message}`,
        );
      }
    }
    return { invitation, inviteUrl };
  }
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
