import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { conflict, notFound } from '../../common/errors';
import { EnvironmentVariables } from '../../config/env.validation';
import { User } from './user.entity';

@Injectable()
export class UserService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Creates the first admin from env on an empty database (USR-1). */
  async onApplicationBootstrap(): Promise<void> {
    if ((await this.users.count()) > 0) return;
    await this.create({
      email: this.env.get('ADMIN_EMAIL', { infer: true }),
      password: this.env.get('ADMIN_PASSWORD', { infer: true }),
      firstName: this.env.get('ADMIN_FIRST_NAME', { infer: true }) ?? 'Admin',
      lastName: this.env.get('ADMIN_LAST_NAME', { infer: true }) ?? '',
    });
    this.logger.log('Initial admin account created');
  }

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async create(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.existsBy({ email })) {
      throw conflict('A user with this email already exists');
    }
    return this.users.save(
      this.users.create({
        email,
        passwordHash: await this.hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
      }),
    );
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { firstName: 'ASC', lastName: 'ASC' } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.trim().toLowerCase() });
  }

  findByResetTokenHash(passwordResetTokenHash: string): Promise<User | null> {
    return this.users.findOneBy({ passwordResetTokenHash });
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw notFound('User');
    return user;
  }

  /** USR-3: deactivation ends sessions; never yourself or the last active admin. */
  async setActive(actor: User, id: string, isActive: boolean): Promise<User> {
    const user = await this.findById(id);
    if (!isActive) {
      if (user.id === actor.id)
        throw conflict('You cannot deactivate yourself');
      if (
        user.isActive &&
        (await this.users.countBy({ isActive: true })) <= 1
      ) {
        throw conflict('The last active admin cannot be deactivated');
      }
    }
    if (user.isActive === isActive) return user;
    return this.users.save({
      ...user,
      isActive,
      tokenVersion: user.tokenVersion + (isActive ? 0 : 1),
    });
  }

  save(user: User): Promise<User> {
    return this.users.save(user);
  }
}
