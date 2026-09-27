import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTeamGroups1790531630261 implements MigrationInterface {
  name = 'RemoveTeamGroups1790531630261';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Groups are removed from the app: drop the memberships, then the groups.
    await queryRunner.query(`DROP TABLE "team_group_members"`);
    await queryRunner.query(`DROP TABLE "team_groups"`);
  }

  /** Restores the schema only; group data is gone. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "team_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" text, CONSTRAINT "UQ_aee0db3f20bb5f542d279b5f5fc" UNIQUE ("name"), CONSTRAINT "PK_710026c3d666684d1e32a86c4b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_group_members" ("team_id" uuid NOT NULL, "group_id" uuid NOT NULL, CONSTRAINT "PK_3b0ed9210b546816b94f118268d" PRIMARY KEY ("team_id", "group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ea843dd0575c58c0487d816f72" ON "team_group_members" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d9bc957dd2fc2987ec76990e1" ON "team_group_members" ("group_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "team_group_members" ADD CONSTRAINT "FK_ea843dd0575c58c0487d816f721" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_group_members" ADD CONSTRAINT "FK_5d9bc957dd2fc2987ec76990e17" FOREIGN KEY ("group_id") REFERENCES "team_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
