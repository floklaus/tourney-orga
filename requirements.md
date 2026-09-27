Here is the updated architecture and technical requirements document migrating the data layer to TypeORM and configuring the frontend to use the core Tailwind CSS v4 engine.
------------------------------
## Product Requirements Document (PRD): Tournament Platform## 1. Executive Summary
This platform is a multi-tenant tournament management and communication system built to streamline sports or competitive event coordination. The application utilizes a decoupled architecture with a Next.js frontend and a NestJS backend, optimized for self-hosted deployment via Coolify.
------------------------------
## 2. Technical Templates & Boilerplates
To fast-track development, initialize the project repositories using these production-ready starter templates that align with your specified constraints:

* 
* Backend (NestJS + TypeORM): Use the [Awesome NestJS Boilerplate](https://github.com/NarHakobyan/awesome-nest-boilerplate) or [nest-rest-typeorm-boilerplate](https://github.com/msanvarov/nest-rest-typeorm-boilerplate). Both templates come out-of-the-box with TypeORM, PostgreSQL configurations, JWT authentication guards, dynamic database migrations, and clean architectural domain separation (modules/auth, modules/user). [1, 2, 3] 
* Frontend (Next.js + Tailwind v4): Use the community favorite [ixartz Next-js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate). It is built for Next.js and fully integrates the new Tailwind CSS v4 CSS-first engine configuration, complete with linting rules for class sorting, strict TypeScript, and absolute path alias configurations out of the box. [4, 5] 
* 

------------------------------
## 3. Database Schema Design (TypeORM Entities)
Below is the database structure modeled via TypeORM decoratored entity syntax for structural generation into PostgreSQL.
## 3.1 User Entity (src/modules/user/user.entity.ts)

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';import { Team } from '../team/team.entity';
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  TEAM_CAPTAIN = 'TEAM_CAPTAIN'
}

@Entity('users')export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ type: 'enum', enum: Role, default: Role.ORG_ADMIN })
  role: Role;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @OneToMany(() => Team, (team) => team.captain)
  teamsCaptained: Team[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

## 3.2 Tournament Entity (src/modules/tournament/tournament.entity.ts)

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';import { Match } from '../match/match.entity';
export enum TournamentType {
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN'
}
export enum TournamentStatus {
  DRAFT = 'DRAFT',
  REGISTRATION_OPEN = 'REGISTRATION_OPEN',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}

@Entity('tournaments')export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TournamentType })
  type: TournamentType;

  @Column({ type: 'enum', enum: TournamentStatus, default: TournamentStatus.DRAFT })
  status: TournamentStatus;

  @Column({ name: 'start_date' })
  startDate: Date;

  @Column({ name: 'end_date' })
  endDate: Date;

  @Column({ name: 'max_teams' })
  maxTeams: number;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @OneToMany(() => Match, (match) => match.tournament)
  matches: Match[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

## 3.3 Match Entity (src/modules/match/match.entity.ts)

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';import { Tournament } from '../tournament/tournament.entity';import { Team } from '../team/team.entity';
export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

@Entity('matches')export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tournament, (tournament) => tournament.matches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'round_number' })
  roundNumber: number;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_a_id' })
  teamA: Team;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_b_id' })
  teamB: Team;

  @Column({ name: 'score_a', default: 0 })
  scoreA: number;

  @Column({ name: 'score_b', default: 0 })
  scoreB: number;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'winner_id' })
  winner: Team;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.SCHEDULED })
  status: MatchStatus;

  @Column({ name: 'scheduled_at' })
  scheduledAt: Date;
}

------------------------------
## 4. Frontend Styling Configuration: Tailwind CSS v4
Tailwind v4 removes the legacy tailwind.config.js completely, moving entirely to a CSS-first approach using @theme syntax inside your global stylesheet.
## 4.1 Global Stylesheet Configuration (src/app/globals.css)

@import "tailwindcss";
@theme {
  --color-brand-primary: #1e3a8a;
  --color-brand-secondary: #0d9488;
  --color-background-card: #f8fafc;
  
  --font-display: "Inter", sans-serif;
  
  --breakpoint-3xl: 1920px;
}
/* Custom theme utility adjustments */@layer base {
  body {
    @apply bg-slate-50 text-slate-900 font-display;
  }
}

------------------------------
## 5. Deployment Strategy via Coolify
Because TypeORM is compiled down during build workflows, its configurations use explicit migrations setups rather than auto-sync behaviors for multi-tenant safety.
## 5.1 NestJS Production Dockerfile

FROM node:20-alpine AS distWORKDIR /usr/src/appCOPY package*.json ./RUN npm ciCOPY . .RUN npm run build
FROM node:20-alpine AS runnerWORKDIR /usr/src/appENV NODE_ENV=productionCOPY package*.json ./RUN npm ci --only=productionCOPY --from=dist /usr/src/app/dist ./dist
EXPOSE 4000# Run production TypeORM migrations dynamically on launch before spawning node instanceCMD ["sh", "-c", "npm run migration:run && node dist/main.js"]

