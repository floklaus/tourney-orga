import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790523685201 implements MigrationInterface {
  name = 'InitialSchema1790523685201';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, "token_version" integer NOT NULL DEFAULT '0', "password_reset_token_hash" character varying, "password_reset_expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fed7c6bd316b83a0b8580cd1cad" UNIQUE ("password_reset_token_hash"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "accepted_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "invited_by_id" uuid, CONSTRAINT "UQ_872ac94a64b3d44fc4b554780cd" UNIQUE ("token_hash"), CONSTRAINT "PK_5dec98cfdfd562e4ad3648bbb07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" text, CONSTRAINT "UQ_aee0db3f20bb5f542d279b5f5fc" UNIQUE ("name"), CONSTRAINT "PK_710026c3d666684d1e32a86c4b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "contact_name" character varying NOT NULL, "email" character varying NOT NULL, "cc_emails" text array NOT NULL DEFAULT '{}', "graduation_year" integer, "notes" text, "is_archived" boolean NOT NULL DEFAULT false, "unsubscribed_at" TIMESTAMP WITH TIME ZONE, "unsubscribe_token" character varying NOT NULL, CONSTRAINT "UQ_48c0c32e6247a2de155baeaf980" UNIQUE ("name"), CONSTRAINT "UQ_a19124972b69e026611919ccd5d" UNIQUE ("unsubscribe_token"), CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."participations_status_enum" AS ENUM('SIGNED_UP', 'PAID', 'ADDED_TO_SPORTSENGINE', 'ADDED_TO_STAFF_CALENDAR', 'ROSTER_CONFIRMED', 'WAIVER_REQUESTED', 'WAIVER_CONFIRMED', 'PARTICIPATED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "participations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "age_group" character varying, "status" "public"."participations_status_enum" NOT NULL DEFAULT 'SIGNED_UP', "notes" text, "variables" jsonb NOT NULL DEFAULT '{}', "withdrawn_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "tournament_id" uuid NOT NULL, "team_id" uuid NOT NULL, CONSTRAINT "uq_participation_tournament_team" UNIQUE ("tournament_id", "team_id"), CONSTRAINT "PK_7aa63b8dcd3d6f8aef8a98bb14a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."participation_status_changes_from_status_enum" AS ENUM('SIGNED_UP', 'PAID', 'ADDED_TO_SPORTSENGINE', 'ADDED_TO_STAFF_CALENDAR', 'ROSTER_CONFIRMED', 'WAIVER_REQUESTED', 'WAIVER_CONFIRMED', 'PARTICIPATED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."participation_status_changes_to_status_enum" AS ENUM('SIGNED_UP', 'PAID', 'ADDED_TO_SPORTSENGINE', 'ADDED_TO_STAFF_CALENDAR', 'ROSTER_CONFIRMED', 'WAIVER_REQUESTED', 'WAIVER_CONFIRMED', 'PARTICIPATED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "participation_status_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "from_status" "public"."participation_status_changes_from_status_enum", "to_status" "public"."participation_status_changes_to_status_enum" NOT NULL, "note" text, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "participation_id" uuid NOT NULL, "changed_by_id" uuid, CONSTRAINT "PK_4556b2732df1a2c29226743edad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tournaments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "url" character varying, "start_date" date NOT NULL, "end_date" date NOT NULL, "description" text, "age_groups" text array NOT NULL DEFAULT '{}', "milestones" jsonb NOT NULL, "variables" jsonb NOT NULL DEFAULT '{}', "email_plan" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "chk_tournament_dates" CHECK (end_date >= start_date), CONSTRAINT "PK_6d5d129da7a80cf99e8ad4833a9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "subject" character varying NOT NULL, "body_html" text NOT NULL, "body_text" text NOT NULL, CONSTRAINT "UQ_e832fef7d0d7dd4da2792eddbf7" UNIQUE ("name"), CONSTRAINT "PK_06c564c515d8cdb40b6f3bfbbb4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."settings_sending_mode_enum" AS ENUM('AUTOMATIC', 'MANUAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "settings" ("id" integer NOT NULL DEFAULT '1', "organizer_name" character varying NOT NULL DEFAULT '', "sender_name" character varying NOT NULL DEFAULT '', "reply_to_email" character varying, "timezone" character varying NOT NULL DEFAULT 'Europe/Berlin', "season_start_month" integer NOT NULL DEFAULT '9', "footer_html" text, "logo_url" character varying, "sending_mode" "public"."settings_sending_mode_enum" NOT NULL DEFAULT 'AUTOMATIC', "rate_per_minute" integer NOT NULL DEFAULT '20', "daily_recipient_cap" integer NOT NULL DEFAULT '1000', "participation_defaults" jsonb, "paused_until" TIMESTAMP WITH TIME ZONE, "pause_reason" character varying, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."communication_steps_timing_type_enum" AS ENUM('ABSOLUTE', 'RELATIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."communication_steps_status_enum" AS ENUM('DRAFT', 'SCHEDULED', 'PAUSED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "communication_steps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "plan_item_id" uuid, "name" character varying NOT NULL, "subject_override" character varying, "timing_type" "public"."communication_steps_timing_type_enum" NOT NULL, "send_at" TIMESTAMP WITH TIME ZONE, "offset_days" integer, "time_of_day" character varying(5), "anchor" character varying(5) NOT NULL DEFAULT 'START', "resolved_send_at" TIMESTAMP WITH TIME ZONE, "status" "public"."communication_steps_status_enum" NOT NULL DEFAULT 'SCHEDULED', "requires_decision" boolean NOT NULL DEFAULT false, "sent_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "participation_id" uuid NOT NULL, "template_id" uuid, "triggered_by_id" uuid, "created_by_id" uuid, "updated_by_id" uuid, CONSTRAINT "chk_step_absolute" CHECK (timing_type <> 'ABSOLUTE' OR send_at IS NOT NULL), CONSTRAINT "chk_step_relative" CHECK (timing_type <> 'RELATIVE' OR (offset_days IS NOT NULL AND time_of_day IS NOT NULL)), CONSTRAINT "PK_f59114218a7aabaae48e633c99c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_964e1c2dbd1828bb98a72c3dbb" ON "communication_steps" ("resolved_send_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."email_deliveries_status_enum" AS ENUM('QUEUED', 'READY', 'SENT', 'FAILED', 'SKIPPED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "to_email" character varying NOT NULL, "cc_emails" text array NOT NULL DEFAULT '{}', "rendered_subject" character varying NOT NULL DEFAULT '', "rendered_body_html" text NOT NULL DEFAULT '', "status" "public"."email_deliveries_status_enum" NOT NULL DEFAULT 'QUEUED', "skip_reason" character varying, "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "queued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "locked_at" TIMESTAMP WITH TIME ZONE, "sent_at" TIMESTAMP WITH TIME ZONE, "provider_message_id" character varying, "recipient_count" integer NOT NULL DEFAULT '1', "sent_manually" boolean NOT NULL DEFAULT false, "step_id" uuid NOT NULL, "team_id" uuid, "triggered_by_id" uuid, "marked_sent_by_id" uuid, CONSTRAINT "uq_delivery_step_team" UNIQUE ("step_id", "team_id"), CONSTRAINT "PK_aa4e94683dafee7c55aaeb9f59d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_delivery_due" ON "email_deliveries" ("status", "next_attempt_at") `,
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
      `ALTER TABLE "invitations" ADD CONSTRAINT "FK_d4de0403dd012cf87b430af70ef" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participations" ADD CONSTRAINT "FK_d0086284bb31d1a2cf79d56b11d" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participations" ADD CONSTRAINT "FK_e47575503ad8437f11e72346f64" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participation_status_changes" ADD CONSTRAINT "FK_d0ce6927b523f57bc5b953fecb6" FOREIGN KEY ("participation_id") REFERENCES "participations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participation_status_changes" ADD CONSTRAINT "FK_6121f2efe6f74ad10c5b41053f0" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" ADD CONSTRAINT "FK_97d354887dc75e1de379780781f" FOREIGN KEY ("participation_id") REFERENCES "participations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" ADD CONSTRAINT "FK_89e678628f339ea4896aa659e98" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" ADD CONSTRAINT "FK_b6b958afb37f752cdd030031ccc" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" ADD CONSTRAINT "FK_df102a8418b055608b0bef23bd0" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" ADD CONSTRAINT "FK_59e646f70aca3ca270308833db6" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" ADD CONSTRAINT "FK_b269e78f6743187431b817b48b1" FOREIGN KEY ("step_id") REFERENCES "communication_steps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" ADD CONSTRAINT "FK_e6c85b82ad25dca6090b0ffe887" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" ADD CONSTRAINT "FK_4e6cf529db628dcf295557bcaaa" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" ADD CONSTRAINT "FK_7cfc02964a18bb015de8ce73d27" FOREIGN KEY ("marked_sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_group_members" ADD CONSTRAINT "FK_ea843dd0575c58c0487d816f721" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_group_members" ADD CONSTRAINT "FK_5d9bc957dd2fc2987ec76990e17" FOREIGN KEY ("group_id") REFERENCES "team_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_group_members" DROP CONSTRAINT "FK_5d9bc957dd2fc2987ec76990e17"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_group_members" DROP CONSTRAINT "FK_ea843dd0575c58c0487d816f721"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" DROP CONSTRAINT "FK_7cfc02964a18bb015de8ce73d27"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" DROP CONSTRAINT "FK_4e6cf529db628dcf295557bcaaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" DROP CONSTRAINT "FK_e6c85b82ad25dca6090b0ffe887"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_deliveries" DROP CONSTRAINT "FK_b269e78f6743187431b817b48b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" DROP CONSTRAINT "FK_59e646f70aca3ca270308833db6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" DROP CONSTRAINT "FK_df102a8418b055608b0bef23bd0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" DROP CONSTRAINT "FK_b6b958afb37f752cdd030031ccc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" DROP CONSTRAINT "FK_89e678628f339ea4896aa659e98"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_steps" DROP CONSTRAINT "FK_97d354887dc75e1de379780781f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participation_status_changes" DROP CONSTRAINT "FK_6121f2efe6f74ad10c5b41053f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participation_status_changes" DROP CONSTRAINT "FK_d0ce6927b523f57bc5b953fecb6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participations" DROP CONSTRAINT "FK_e47575503ad8437f11e72346f64"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participations" DROP CONSTRAINT "FK_d0086284bb31d1a2cf79d56b11d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "FK_d4de0403dd012cf87b430af70ef"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5d9bc957dd2fc2987ec76990e1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ea843dd0575c58c0487d816f72"`,
    );
    await queryRunner.query(`DROP TABLE "team_group_members"`);
    await queryRunner.query(`DROP INDEX "public"."idx_delivery_due"`);
    await queryRunner.query(`DROP TABLE "email_deliveries"`);
    await queryRunner.query(
      `DROP TYPE "public"."email_deliveries_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_964e1c2dbd1828bb98a72c3dbb"`,
    );
    await queryRunner.query(`DROP TABLE "communication_steps"`);
    await queryRunner.query(
      `DROP TYPE "public"."communication_steps_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."communication_steps_timing_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP TYPE "public"."settings_sending_mode_enum"`);
    await queryRunner.query(`DROP TABLE "email_templates"`);
    await queryRunner.query(`DROP TABLE "tournaments"`);
    await queryRunner.query(`DROP TABLE "participation_status_changes"`);
    await queryRunner.query(
      `DROP TYPE "public"."participation_status_changes_to_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."participation_status_changes_from_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "participations"`);
    await queryRunner.query(`DROP TYPE "public"."participations_status_enum"`);
    await queryRunner.query(`DROP TABLE "teams"`);
    await queryRunner.query(`DROP TABLE "team_groups"`);
    await queryRunner.query(`DROP TABLE "invitations"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
