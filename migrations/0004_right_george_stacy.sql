CREATE TYPE "public"."flow_status" AS ENUM('draft', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."flow_trigger_type" AS ENUM('keyword', 'first_message', 'button_click', 'scheduled', 'api_call', 'manual');--> statement-breakpoint
CREATE TYPE "public"."message_template_category" AS ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION');--> statement-breakpoint
CREATE TYPE "public"."message_template_status_meta" AS ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'DRAFT');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_connection_status" AS ENUM('disconnected', 'connecting', 'connected', 'qr_code_needed', 'auth_failure', 'error', 'loading');--> statement-breakpoint
CREATE TABLE "whatsapp_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "whatsapp_connection_status" DEFAULT 'disconnected' NOT NULL,
	"qr_code_data" text,
	"session_path" text,
	"connected_phone_number" text,
	"last_connected_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_flow_user_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"contact_jid" text NOT NULL,
	"active_flow_id" integer,
	"current_node_id" text,
	"flow_variables" jsonb DEFAULT '{}'::jsonb,
	"last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" "flow_trigger_type" NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb,
	"status" "flow_status" DEFAULT 'draft' NOT NULL,
	"elements" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"template_name" text NOT NULL,
	"category" "message_template_category",
	"language_code" text NOT NULL,
	"components" jsonb NOT NULL,
	"meta_status" "message_template_status_meta" DEFAULT 'DRAFT',
	"meta_template_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "flow_id" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "message_id_baileys" text;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_flow_user_states" ADD CONSTRAINT "whatsapp_flow_user_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_flow_user_states" ADD CONSTRAINT "whatsapp_flow_user_states_active_flow_id_whatsapp_flows_id_fk" FOREIGN KEY ("active_flow_id") REFERENCES "public"."whatsapp_flows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_flows" ADD CONSTRAINT "whatsapp_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_templates" ADD CONSTRAINT "whatsapp_message_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_user_id_idx" ON "whatsapp_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_flow_user_contact_flow_idx" ON "whatsapp_flow_user_states" USING btree ("user_id","contact_jid");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_template_user_name_idx" ON "whatsapp_message_templates" USING btree ("user_id","template_name");--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_flow_id_whatsapp_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."whatsapp_flows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_message_id_baileys_unique" UNIQUE("message_id_baileys");