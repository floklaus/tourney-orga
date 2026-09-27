import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { conflict, isUniqueViolation, notFound } from '../../common/errors';
import { TeamGroup } from './team-group.entity';
import { CreateGroupDto, UpdateGroupDto } from './team.dto';

export interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  teamCount: number;
}

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(TeamGroup) private readonly groups: Repository<TeamGroup>,
  ) {}

  async findAll(): Promise<GroupResponse[]> {
    const rows = await this.groups
      .createQueryBuilder('g')
      .leftJoin('g.teams', 't', 't.is_archived = false')
      .select(['g.id AS id', 'g.name AS name', 'g.description AS description'])
      .addSelect('COUNT(t.id)::int', 'teamCount')
      .groupBy('g.id')
      .orderBy('g.name', 'ASC')
      .getRawMany<GroupResponse>();
    return rows;
  }

  async findOne(id: string): Promise<GroupResponse> {
    const group = (await this.findAll()).find((g) => g.id === id);
    if (!group) throw notFound('Group');
    return group;
  }

  async findByIds(ids: string[] = []): Promise<TeamGroup[]> {
    if (ids.length === 0) return [];
    const found = await this.groups.findBy({ id: In(ids) });
    if (found.length !== new Set(ids).size) throw notFound('Group');
    return found;
  }

  /** Finds groups by name, creating missing ones (CSV import). */
  async findOrCreateByNames(names: string[]): Promise<TeamGroup[]> {
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (unique.length === 0) return [];
    const existing = await this.groups.findBy({ name: In(unique) });
    const missing = unique.filter((n) => !existing.some((g) => g.name === n));
    const created =
      missing.length > 0
        ? await this.groups.save(
            missing.map((name) => this.groups.create({ name })),
          )
        : [];
    return [...existing, ...created];
  }

  async create(dto: CreateGroupDto): Promise<GroupResponse> {
    const group = await this.saveUnique(
      this.groups.create({
        name: dto.name,
        description: dto.description ?? null,
      }),
    );
    return this.findOne(group.id);
  }

  async update(id: string, dto: UpdateGroupDto): Promise<GroupResponse> {
    const group = await this.groups.findOneBy({ id });
    if (!group) throw notFound('Group');
    await this.saveUnique({ ...group, ...dto });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.groups.delete(id);
    if (!affected) throw notFound('Group');
  }

  private async saveUnique(group: TeamGroup): Promise<TeamGroup> {
    try {
      return await this.groups.save(group);
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict('A group with this name already exists');
      throw error;
    }
  }
}
