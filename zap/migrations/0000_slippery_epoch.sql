DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_connection_status" AS ENUM('disconnected', 'connecting', 'connected', 'qr_code_needed', 'auth_failure', 'error', 'loading');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_flow_status" AS ENUM('draft', 'active', 'inactive', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_flow_trigger_type" AS ENUM('keyword', 'first_message', 'button_click', 'api_call', 'scheduled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_message_direction" AS ENUM('incoming', 'outgoing');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_message_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'played', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_message_type" AS ENUM('text', 'image', 'video', 'audio', 'document', 'sticker', 'reaction', 'location', 'contact', 'template', 'unsupported');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_template_category" AS ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."whatsapp_template_meta_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zap_whatsapp_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"mktv2_user_id" integer NOT NULL,
	"status" "whatsapp_connection_status" DEFAULT 'disconnected' NOT NULL,
	"qr_code_data" text,
	"session_data" jsonb,
	"connected_phone_number" text,
	"last_connected_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zap_whatsapp_connections_mktv2_user_id_unique" UNIQUE("mktv2_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zap_whatsapp_flow_user_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"mktv2_user_id" integer NOT NULL,
	"contact_jid" text NOT NULL,
	"active_flow_id" integer,
	"current_node_id" text,
	"flow_variables" jsonb DEFAULT '{}',
	"last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zap_whatsapp_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"mktv2_user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" "whatsapp_flow_trigger_type" NOT NULL,
	"trigger_config" jsonb DEFAULT '{}',
	"status" "whatsapp_flow_status" DEFAULT 'draft' NOT NULL,
	"elements" jsonb DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zap_whatsapp_message_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"mktv2_user_id" integer NOT NULL,
	"template_name" text NOT NULL,
	"category" "whatsapp_template_category",
	"language_code" text NOT NULL,
	"components" jsonb NOT NULL,
	"meta_template_id" text,
	"meta_status" "whatsapp_template_meta_status" DEFAULT 'PENDING',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zap_whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"mktv2_user_id" integer NOT NULL,
	"baileys_message_id" text,
	"contact_jid" text NOT NULL,
	"flow_id" integer,
	"message_type" "whatsapp_message_type" NOT NULL,
	"content" jsonb NOT NULL,
	"direction" "whatsapp_message_direction" NOT NULL,
	"status" "whatsapp_message_status",
	"timestamp" timestamp with time zone NOT NULL,
	"is_read_by_zap_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quoted_message_id" text,
	"quoted_message_content" jsonb,
	"quoted_message_sender_jid" text,
	CONSTRAINT "zap_whatsapp_messages_baileys_message_id_unique" UNIQUE("baileys_message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zap_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"mktv2_user_id" integer,
	"email" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zap_users_mktv2_user_id_unique" UNIQUE("mktv2_user_id"),
	CONSTRAINT "zap_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zap_whatsapp_flow_user_states" ADD CONSTRAINT "zap_whatsapp_flow_user_states_active_flow_id_zap_whatsapp_flows_id_fk" FOREIGN KEY ("active_flow_id") REFERENCES "public"."zap_whatsapp_flows"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zap_whatsapp_messages" ADD CONSTRAINT "zap_whatsapp_messages_flow_id_zap_whatsapp_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."zap_whatsapp_flows"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zap_contact_flow_user_unique_idx" ON "zap_whatsapp_flow_user_states" USING btree ("mktv2_user_id","contact_jid","active_flow_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zap_template_name_user_lang_unique_idx" ON "zap_whatsapp_message_templates" USING btree ("mktv2_user_id","template_name","language_code");