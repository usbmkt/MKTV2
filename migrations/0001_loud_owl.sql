ALTER TABLE "whatsapp_messages" ADD COLUMN "flow_id" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "message_id_baileys" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_flow_id_whatsapp_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."whatsapp_flows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_message_id_baileys_unique" UNIQUE("message_id_baileys");