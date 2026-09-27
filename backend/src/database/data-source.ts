import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm.options';

/** Used by the TypeORM CLI (migration:generate / migration:run). */
export default new DataSource(
  buildDataSourceOptions(
    process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5544/app',
  ),
);
