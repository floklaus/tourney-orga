import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { conflict, notFound } from '../../common/errors';
import { DeliverySchedulerService } from '../delivery/delivery-scheduler.service';
import { EmailDelivery } from '../delivery/email-delivery.entity';
import { SettingsService } from '../settings/settings.service';
import { TemplateService } from '../template/template.service';
import { assertValidPlaceholders } from '../template/template.service';
import { ParticipationStatus } from '../tournament/domain/participation-process';
import { Participation } from '../tournament/participation.entity';
import { User } from '../user/user.entity';
import { checkTiming, scheduleFields } from './email-plan';
import {
  EDITABLE_STEP_STATUSES,
  EmailStep,
  StepStatus,
} from './email-step.entity';
import {
  EmailStepFieldsDto,
  StepAction,
  UpdateEmailStepDto,
} from './email-step.dto';
import { toEmailStepResponse } from './email-step.mapper';
import {
  effectiveVariables,
  missingVariablesError,
  missingVariablesOf,
} from './variables';

type StepChanges = QueryDeepPartialEntity<EmailStep>;

export const STEP_RELATIONS = {
  template: true,
  participation: { tournament: true, team: true },
  createdBy: true,
  updatedBy: true,
} as const;

const DELETABLE = [StepStatus.DRAFT, StepStatus.PAUSED, StepStatus.CANCELLED];
const STALE_MESSAGE =
  'This email was changed in the meantime. Reload to see the latest version.';

/** Effective variables of the step's participation (requires participation.tournament loaded). */
export const variablesOfStep = (step: EmailStep) =>
  effectiveVariables(
    step.participation.tournament.variables,
    step.participation.variables,
  );

@Injectable()
export class EmailStepService {
  constructor(
    @InjectRepository(EmailStep) private readonly steps: Repository<EmailStep>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly templates: TemplateService,
    private readonly settings: SettingsService,
    private readonly scheduler: DeliverySchedulerService,
  ) {}

  async findOne(id: string): Promise<EmailStep> {
    const step = await this.steps.findOne({
      where: { id },
      relations: STEP_RELATIONS,
    });
    if (!step) throw notFound('Email');
    return step;
  }

  async findForParticipation(participationId: string): Promise<EmailStep[]> {
    if (
      !(await this.dataSource
        .getRepository(Participation)
        .existsBy({ id: participationId }))
    ) {
      throw notFound('Participation');
    }
    return this.steps.find({
      where: { participation: { id: participationId } },
      relations: STEP_RELATIONS,
      order: {
        resolvedSendAt: { direction: 'ASC', nulls: 'LAST' },
        createdAt: 'ASC',
      },
    });
  }

  /** API responses including each step's (single) delivery. */
  async toResponses(steps: EmailStep[]) {
    const deliveries = steps.length
      ? await this.dataSource
          .getRepository(EmailDelivery)
          .find({ where: { step: { id: In(steps.map((s) => s.id)) } } })
      : [];
    const byStep = new Map(deliveries.map((d) => [d.stepId, d]));
    return steps.map((s) =>
      toEmailStepResponse(s, variablesOfStep(s), byStep.get(s.id)),
    );
  }

  async toResponse(step: EmailStep) {
    return (await this.toResponses([step]))[0];
  }

  async create(
    user: User,
    participationId: string,
    dto: EmailStepFieldsDto,
  ): Promise<EmailStep> {
    const participation = await this.dataSource
      .getRepository(Participation)
      .findOne({
        where: { id: participationId },
        relations: { tournament: true },
      });
    if (!participation) throw notFound('Participation');
    if (dto.subjectOverride) assertValidPlaceholders(dto.subjectOverride, '');
    const { timezone } = await this.settings.get();
    const step = this.steps.create({
      participation,
      planItemId: null,
      name: dto.name.trim(),
      template: await this.templates.findOne(dto.templateId),
      subjectOverride: dto.subjectOverride || null,
      ...checkTiming(dto),
      status: StepStatus.SCHEDULED,
      createdBy: user,
      updatedBy: user,
    });
    Object.assign(
      step,
      scheduleFields(step, participation.tournament, timezone),
    );
    return this.findOne((await this.steps.save(step)).id);
  }

  /** Optimistic locking: applied only if version and status are unchanged since the client loaded the step. */
  async update(
    user: User,
    id: string,
    dto: UpdateEmailStepDto,
  ): Promise<EmailStep> {
    const step = await this.findOne(id);
    if (step.version !== dto.version) throw conflict(STALE_MESSAGE);
    this.assertStatus(step, EDITABLE_STEP_STATUSES, 'edited');
    if (dto.subjectOverride) assertValidPlaceholders(dto.subjectOverride, '');
    const timing = checkTiming({
      timingType: dto.timingType ?? step.timingType,
      sendAt: dto.sendAt === undefined ? step.sendAt : dto.sendAt,
      offsetDays:
        dto.offsetDays === undefined ? step.offsetDays : dto.offsetDays,
      timeOfDay: dto.timeOfDay === undefined ? step.timeOfDay : dto.timeOfDay,
      anchor: dto.anchor ?? step.anchor,
    });
    const template = dto.templateId
      ? await this.templates.findOne(dto.templateId)
      : step.template;
    const { timezone } = await this.settings.get();
    await this.conditionalUpdate(this.dataSource.manager, step, [step.status], {
      name: dto.name?.trim() ?? step.name,
      template: template ? { id: template.id } : null,
      subjectOverride:
        dto.subjectOverride === undefined
          ? step.subjectOverride
          : dto.subjectOverride || null,
      ...timing,
      ...scheduleFields(
        { ...timing, status: step.status },
        step.participation.tournament,
        timezone,
      ),
      updatedBy: { id: user.id },
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const step = await this.findOne(id);
    this.assertStatus(step, DELETABLE, 'deleted');
    const { affected } = await this.steps.delete({ id, status: In(DELETABLE) });
    if (!affected) throw conflict(STALE_MESSAGE);
  }

  action(user: User, id: string, action: StepAction): Promise<EmailStep> {
    switch (action) {
      case 'pause':
        return this.transition(
          user,
          id,
          [StepStatus.SCHEDULED],
          'paused',
          () => ({
            status: StepStatus.PAUSED,
            requiresDecision: false,
          }),
        );
      case 'resume':
        return this.transition(
          user,
          id,
          [StepStatus.PAUSED],
          'resumed',
          async (step) => ({
            status: StepStatus.SCHEDULED,
            ...scheduleFields(
              { ...step, status: StepStatus.SCHEDULED },
              step.participation.tournament,
              await this.timezone(),
            ),
          }),
        );
      case 'cancel':
        return this.transition(
          user,
          id,
          EDITABLE_STEP_STATUSES,
          'cancelled',
          () => ({
            status: StepStatus.CANCELLED,
            requiresDecision: false,
          }),
        );
      case 'skip':
        return this.transition(
          user,
          id,
          EDITABLE_STEP_STATUSES,
          'skipped',
          (step) => {
            if (!step.requiresDecision)
              throw conflict('Only past-due emails can be skipped');
            return { status: StepStatus.CANCELLED, requiresDecision: false };
          },
        );
      case 'send-now':
        return this.sendNow(user, id);
    }
  }

  async bulk(user: User, ids: string[], action: StepAction) {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        await this.action(user, id, action);
        results.push({ id, ok: true });
      } catch (error) {
        results.push({ id, ok: false, error: (error as Error).message });
      }
    }
    return results;
  }

  private async sendNow(user: User, id: string): Promise<EmailStep> {
    const updated = await this.transition(
      user,
      id,
      [StepStatus.SCHEDULED, StepStatus.PAUSED],
      'sent now',
      (step) => {
        if (step.participation.status === ParticipationStatus.WITHDRAWN) {
          throw conflict('The team has withdrawn from this tournament');
        }
        const missing = missingVariablesOf(step, variablesOfStep(step));
        if (missing.length > 0) throw missingVariablesError(missing);
        return {
          status: StepStatus.SCHEDULED,
          resolvedSendAt: new Date(),
          requiresDecision: false,
          triggeredBy: { id: user.id },
        };
      },
    );
    this.scheduler.triggerSoon();
    return updated;
  }

  private async timezone(): Promise<string> {
    return (await this.settings.get()).timezone;
  }

  private async transition(
    user: User,
    id: string,
    allowed: StepStatus[],
    action: string,
    changes: (step: EmailStep) => StepChanges | Promise<StepChanges>,
  ): Promise<EmailStep> {
    const step = await this.findOne(id);
    this.assertStatus(step, allowed, action);
    await this.conditionalUpdate(this.dataSource.manager, step, allowed, {
      ...(await changes(step)),
      updatedBy: { id: user.id },
    });
    return this.findOne(id);
  }

  /** Writes only if the row still has the version and an allowed status (no lost updates). */
  private async conditionalUpdate(
    em: EntityManager,
    step: EmailStep,
    allowed: StepStatus[],
    changes: StepChanges,
  ) {
    const { affected } = await em
      .createQueryBuilder()
      .update(EmailStep)
      .set(changes)
      .where('id = :id AND version = :version AND status IN (:...allowed)', {
        id: step.id,
        version: step.version,
        allowed,
      })
      .execute();
    if (!affected) throw conflict(STALE_MESSAGE);
  }

  private assertStatus(
    step: EmailStep,
    allowed: StepStatus[],
    action: string,
  ): void {
    if (!allowed.includes(step.status))
      throw conflict(
        `A ${step.status.toLowerCase()} email cannot be ${action}`,
      );
  }
}
