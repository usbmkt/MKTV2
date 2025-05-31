CREATE TYPE &quot;public&quot;.&quot;campaign_status&quot; IF NOT EXISTS AS ENUM(&#39;active&#39;, &#39;paused&#39;, &#39;completed&#39;, &#39;draft&#39;);
--&gt; statement-breakpoint
CREATE TYPE &quot;public&quot;.&quot;chat_sender&quot; IF NOT EXISTS AS ENUM(&#39;user&#39;, &#39;agent&#39;);
--&gt; statement-breakpoint
CREATE TYPE &quot;public&quot;.&quot;launch_phase&quot; IF NOT EXISTS AS ENUM(&#39;pre_launch&#39;, &#39;launch&#39;, &#39;post_launch&#39;);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;alerts&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;campaign_id&quot; integer,
	&quot;type&quot; text NOT NULL,
	&quot;title&quot; text NOT NULL,
	&quot;message&quot; text NOT NULL,
	&quot;is_read&quot; boolean DEFAULT false NOT NULL,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;budgets&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;campaign_id&quot; integer,
	&quot;total_budget&quot; numeric(10, 2) NOT NULL,
	&quot;spent_amount&quot; numeric(10, 2) DEFAULT &#39;0&#39; NOT NULL,
	&quot;period&quot; text NOT NULL,
	&quot;start_date&quot; timestamp with time zone NOT NULL,
	&quot;end_date&quot; timestamp with time zone,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;campaigns&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;name&quot; text NOT NULL,
	&quot;description&quot; text,
	&quot;status&quot; &quot;public&quot;.&quot;campaign_status&quot; DEFAULT &#39;draft&#39; NOT NULL,
	&quot;platforms&quot; jsonb DEFAULT &#39;[]&#39;::jsonb NOT NULL,
	&quot;objectives&quot; jsonb DEFAULT &#39;[]&#39;::jsonb NOT NULL,
	&quot;budget&quot; numeric(10, 2),
	&quot;daily_budget&quot; numeric(10, 2),
	&quot;start_date&quot; timestamp with time zone,
	&quot;end_date&quot; timestamp with time zone,
	&quot;target_audience&quot; text,
	&quot;industry&quot; text,
	&quot;avg_ticket&quot; numeric(10, 2),
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;chat_messages&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;session_id&quot; integer NOT NULL,
	&quot;sender&quot; &quot;public&quot;.&quot;chat_sender&quot; NOT NULL,
	&quot;text&quot; text NOT NULL,
	&quot;attachment_url&quot; text,
	&quot;timestamp&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;chat_sessions&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;title&quot; text DEFAULT &#39;Nova Conversa&#39; NOT NULL,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;copies&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;campaign_id&quot; integer,
	&quot;title&quot; text NOT NULL,
	&quot;content&quot; text NOT NULL,
	&quot;purpose_key&quot; text NOT NULL,
	&quot;launch_phase&quot; &quot;public&quot;.&quot;launch_phase&quot; NOT NULL,
	&quot;details&quot; jsonb DEFAULT &#39;{}&#39;::jsonb,
	&quot;base_info&quot; jsonb DEFAULT &#39;{}&#39;::jsonb,
	&quot;full_generated_response&quot; jsonb DEFAULT &#39;{}&#39;::jsonb,
	&quot;platform&quot; text,
	&quot;is_favorite&quot; boolean DEFAULT false NOT NULL,
	&quot;tags&quot; jsonb DEFAULT &#39;[]&#39;::jsonb,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;last_updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;creatives&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;campaign_id&quot; integer,
	&quot;name&quot; text NOT NULL,
	&quot;type&quot; text NOT NULL,
	&quot;file_url&quot; text,
	&quot;content&quot; text,
	&quot;status&quot; text DEFAULT &#39;pending&#39; NOT NULL,
	&quot;platforms&quot; jsonb DEFAULT &#39;[]&#39;::jsonb NOT NULL,
	&quot;thumbnail_url&quot; text,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;funnel_stages&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;funnel_id&quot; integer NOT NULL,
	&quot;name&quot; text NOT NULL,
	&quot;description&quot; text,
	&quot;order&quot; integer DEFAULT 0 NOT NULL,
	&quot;config&quot; jsonb,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;funnels&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;campaign_id&quot; integer,
	&quot;name&quot; text NOT NULL,
	&quot;description&quot; text,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;landing_pages&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;name&quot; text NOT NULL,
	&quot;studio_project_id&quot; varchar(255),
	&quot;slug&quot; varchar(255) NOT NULL,
	&quot;description&quot; text,
	&quot;grapes_js_data&quot; jsonb,
	&quot;status&quot; text DEFAULT &#39;draft&#39; NOT NULL,
	&quot;public_url&quot; text,
	&quot;published_at&quot; timestamp with time zone,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT &quot;landing_pages_studio_project_id_unique&quot; UNIQUE(&quot;studio_project_id&quot;),
	CONSTRAINT &quot;landing_pages_slug_unique&quot; UNIQUE(&quot;slug&quot;)
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;metrics&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;campaign_id&quot; integer NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;date&quot; timestamp with time zone NOT NULL,
	&quot;impressions&quot; integer DEFAULT 0 NOT NULL,
	&quot;clicks&quot; integer DEFAULT 0 NOT NULL,
	&quot;conversions&quot; integer DEFAULT 0 NOT NULL,
	&quot;cost&quot; numeric(10, 2) DEFAULT &#39;0&#39; NOT NULL,
	&quot;revenue&quot; numeric(10, 2) DEFAULT &#39;0&#39; NOT NULL,
	&quot;leads&quot; integer DEFAULT 0 NOT NULL,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;users&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;username&quot; text NOT NULL,
	&quot;email&quot; text NOT NULL,
	&quot;password&quot; text NOT NULL,
	&quot;created_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;updated_at&quot; timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT &quot;users_username_unique&quot; UNIQUE(&quot;username&quot;),
	CONSTRAINT &quot;users_email_unique&quot; UNIQUE(&quot;email&quot;)
);
--&gt; statement-breakpoint
CREATE TABLE IF NOT EXISTS &quot;whatsapp_messages&quot; (
	&quot;id&quot; serial PRIMARY KEY NOT NULL,
	&quot;user_id&quot; integer NOT NULL,
	&quot;contact_number&quot; text NOT NULL,
	&quot;contact_name&quot; text,
	&quot;message&quot; text NOT NULL,
	&quot;direction&quot; text NOT NULL,
	&quot;timestamp&quot; timestamp with time zone DEFAULT now() NOT NULL,
	&quot;is_read&quot; boolean DEFAULT false NOT NULL
);
--&gt; statement-breakpoint
ALTER TABLE &quot;alerts&quot; ADD CONSTRAINT &quot;alerts_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;alerts&quot; ADD CONSTRAINT &quot;alerts_campaign_id_campaigns_id_fk&quot; FOREIGN KEY (&quot;campaign_id&quot;) REFERENCES &quot;public&quot;.&quot;campaigns&quot;(&quot;id&quot;) ON DELETE set null ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;budgets&quot; ADD CONSTRAINT &quot;budgets_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;budgets&quot; ADD CONSTRAINT &quot;budgets_campaign_id_campaigns_id_fk&quot; FOREIGN KEY (&quot;campaign_id&quot;) REFERENCES &quot;public&quot;.&quot;campaigns&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;campaigns&quot; ADD CONSTRAINT &quot;campaigns_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;chat_messages&quot; ADD CONSTRAINT &quot;chat_messages_session_id_chat_sessions_id_fk&quot; FOREIGN KEY (&quot;session_id&quot;) REFERENCES &quot;public&quot;.&quot;chat_sessions&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;chat_sessions&quot; ADD CONSTRAINT &quot;chat_sessions_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;copies&quot; ADD CONSTRAINT &quot;copies_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;copies&quot; ADD CONSTRAINT &quot;copies_campaign_id_campaigns_id_fk&quot; FOREIGN KEY (&quot;campaign_id&quot;) REFERENCES &quot;public&quot;.&quot;campaigns&quot;(&quot;id&quot;) ON DELETE set null ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;creatives&quot; ADD CONSTRAINT &quot;creatives_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;creatives&quot; ADD CONSTRAINT &quot;creatives_campaign_id_campaigns_id_fk&quot; FOREIGN KEY (&quot;campaign_id&quot;) REFERENCES &quot;public&quot;.&quot;campaigns&quot;(&quot;id&quot;) ON DELETE set null ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;funnel_stages&quot; ADD CONSTRAINT &quot;funnel_stages_funnel_id_funnels_id_fk&quot; FOREIGN KEY (&quot;funnel_id&quot;) REFERENCES &quot;public&quot;.&quot;funnels&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;funnels&quot; ADD CONSTRAINT &quot;funnels_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;funnels&quot; ADD CONSTRAINT &quot;funnels_campaign_id_campaigns_id_fk&quot; FOREIGN KEY (&quot;campaign_id&quot;) REFERENCES &quot;public&quot;.&quot;campaigns&quot;(&quot;id&quot;) ON DELETE set null ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;landing_pages&quot; ADD CONSTRAINT &quot;landing_pages_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;metrics&quot; ADD CONSTRAINT &quot;metrics_campaign_id_campaigns_id_fk&quot; FOREIGN KEY (&quot;campaign_id&quot;) REFERENCES &quot;public&quot;.&quot;campaigns&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;metrics&quot; ADD CONSTRAINT &quot;metrics_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;
--&gt; statement-breakpoint
ALTER TABLE &quot;whatsapp_messages&quot; ADD CONSTRAINT &quot;whatsapp_messages_user_id_users_id_fk&quot; FOREIGN KEY (&quot;user_id&quot;) REFERENCES &quot;public&quot;.&quot;users&quot;(&quot;id&quot;) ON DELETE cascade ON UPDATE no action;