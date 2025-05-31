CREATE TYPE "public"."launch_phase" AS ENUM('pre_launch', 'launch', 'post_launch');--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "purpose_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "launch_phase" "launch_phase" NOT NULL;--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "base_info" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "full_generated_response" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "last_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "copies" DROP COLUMN "type";