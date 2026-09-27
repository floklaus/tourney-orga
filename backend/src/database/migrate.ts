import 'reflect-metadata';
import dataSource from './data-source';

/** Distinct from the scheduler's lock: only one process migrates at a time. */
const MIGRATION_LOCK_ID = 72_410_001;

/**
 * Runs pending migrations while holding a Postgres advisory lock, so containers
 * starting at the same time (e.g. during a rolling deploy) cannot race.
 * Used by the container entrypoint when RUN_MIGRATIONS=true.
 */
async function main(): Promise<void> {
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    const executed = await dataSource.runMigrations();
    console.log(
      executed.length > 0
        ? `Migrations executed: ${executed.map((m) => m.name).join(', ')}`
        : 'No pending migrations',
    );
  } finally {
    await runner.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    await runner.release();
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
