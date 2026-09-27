import { MigrationInterface, QueryRunner } from 'typeorm';

export class ParticipationDays1790525519094 implements MigrationInterface {
  name = 'ParticipationDays1790525519094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participations" ADD "days" text array NOT NULL DEFAULT '{}'`,
    );
    // Existing participations play on every day of their tournament.
    await queryRunner.query(
      `UPDATE "participations" p SET "days" = ARRAY(
        SELECT to_char(d, 'YYYY-MM-DD')
        FROM generate_series(t."start_date", t."end_date", interval '1 day') d
        ORDER BY d
      ) FROM "tournaments" t WHERE t."id" = p."tournament_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "participations" DROP COLUMN "days"`);
  }
}
