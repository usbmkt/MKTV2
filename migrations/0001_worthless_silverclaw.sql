CREATE TABLE IF NOT EXISTS "funnel_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnel_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"campaign_id" integer,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "total_budget" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "spent_amount" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "budget" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "daily_budget" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "avg_ticket" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "funnel_stages" ADD CONSTRAINT "funnel_stages_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;