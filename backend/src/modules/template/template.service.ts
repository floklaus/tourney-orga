import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  conflict,
  isUniqueViolation,
  notFound,
  unprocessable,
} from '../../common/errors';
import { EDITABLE_STEP_STATUSES, EmailStep } from '../email/email-step.entity';
import { htmlToText } from '../mail/mail-layout';
import { findInvalidPlaceholders, sanitizeBody } from './domain/placeholders';
import { EmailTemplate } from './email-template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './template.dto';

/** Throws 422 naming every unsupported placeholder (TPL-3). */
export function assertValidPlaceholders(
  subject: string,
  bodyHtml: string,
): void {
  const invalid = [
    ...new Set([
      ...findInvalidPlaceholders(subject),
      ...findInvalidPlaceholders(bodyHtml),
    ]),
  ];
  if (invalid.length > 0) {
    throw unprocessable(
      `Unknown placeholder(s): ${invalid.map((p) => `{{${p}}}`).join(', ')}`,
      { invalid },
    );
  }
}

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templates: Repository<EmailTemplate>,
    @InjectRepository(EmailStep)
    private readonly steps: Repository<EmailStep>,
  ) {}

  findAll(): Promise<EmailTemplate[]> {
    return this.templates.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<EmailTemplate> {
    const template = await this.templates.findOneBy({ id });
    if (!template) throw notFound('Template');
    return template;
  }

  async create(dto: CreateTemplateDto): Promise<EmailTemplate> {
    return this.saveUnique(
      this.templates.create(this.prepare(dto.name, dto.subject, dto.bodyHtml)),
    );
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<EmailTemplate> {
    const current = await this.findOne(id);
    const next = this.prepare(
      dto.name ?? current.name,
      dto.subject ?? current.subject,
      dto.bodyHtml ?? current.bodyHtml,
    );
    return this.saveUnique({ ...current, ...next });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const inUse = await this.steps.exists({
      where: { template: { id }, status: In(EDITABLE_STEP_STATUSES) },
    });
    if (inUse)
      throw conflict(
        'This template is used by a step that has not been sent yet',
      );
    await this.templates.delete(id);
  }

  async duplicate(id: string): Promise<EmailTemplate> {
    const source = await this.findOne(id);
    const base = `${source.name} (copy)`;
    let name = base;
    for (let i = 2; await this.templates.existsBy({ name }); i++)
      name = `${base} ${i}`;
    return this.templates.save(
      this.templates.create({
        name,
        subject: source.subject,
        bodyHtml: source.bodyHtml,
        bodyText: source.bodyText,
      }),
    );
  }

  private prepare(name: string, subject: string, rawBody: string) {
    assertValidPlaceholders(subject, rawBody);
    const bodyHtml = sanitizeBody(rawBody);
    return {
      name: name.trim(),
      subject: subject.trim(),
      bodyHtml,
      bodyText: htmlToText(bodyHtml),
    };
  }

  private async saveUnique(template: EmailTemplate): Promise<EmailTemplate> {
    try {
      return await this.templates.save(template);
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict('A template with this name already exists');
      throw error;
    }
  }
}
