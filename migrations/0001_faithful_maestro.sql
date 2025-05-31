-- migrations/0001_faithful_maestro.sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'launch_phase') THEN
        CREATE TYPE "public"."launch_phase" AS ENUM('pre_launch', 'launch', 'post_launch');
    END IF;
END$$;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "purpose_key" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "launch_phase" "public"."launch_phase" NOT NULL;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "details" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "base_info" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "full_generated_response" jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "is_favorite" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN IF NOT EXISTS "last_updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
-- Só remove a coluna 'type' se ela existir, para evitar erro se a migração rodar mais de uma vez
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'copies' AND column_name = 'type') THEN
        ALTER TABLE "public"."copies" DROP COLUMN "type";
    END IF;
END$$;

