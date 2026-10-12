CREATE TABLE "buyer_demands" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"specifications" text NOT NULL,
	"quantity_required" numeric NOT NULL,
	"unit" text DEFAULT 'Metric Tons' NOT NULL,
	"target_price" numeric,
	"currency" text DEFAULT 'USD' NOT NULL,
	"preferred_origin" text,
	"destination_country" text NOT NULL,
	"destination_city" text NOT NULL,
	"delivery_deadline" text,
	"packaging_requirements" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role_in_deal" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"deal_subject_type" text DEFAULT 'general',
	"product_id" integer,
	"demand_id" integer,
	"transport_offer_id" integer,
	"deal_status" text DEFAULT 'inquiry' NOT NULL,
	"agreed_price" numeric,
	"agreed_quantity" numeric,
	"currency" text DEFAULT 'USD',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"content" text NOT NULL,
	"attachment_name" text,
	"attachment_url" text,
	"attachment_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"location_corridor" text NOT NULL,
	"summary" text NOT NULL,
	"details" text NOT NULL,
	"source_type" text DEFAULT 'community_report' NOT NULL,
	"source_name" text,
	"price_details" text,
	"waiting_time_hours" integer,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"exporter_id" integer NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"quality_grade" text DEFAULT 'Grade A',
	"quantity_available" numeric NOT NULL,
	"unit" text DEFAULT 'Metric Tons' NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"origin_country" text NOT NULL,
	"origin_city" text NOT NULL,
	"destination_markets" text,
	"image_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracking_number" text NOT NULL,
	"conversation_id" integer,
	"exporter_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"vehicle_id" integer,
	"cargo_description" text NOT NULL,
	"cargo_weight_tons" numeric NOT NULL,
	"pickup_location" text NOT NULL,
	"border_crossing" text NOT NULL,
	"destination_location" text NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"current_latitude" numeric,
	"current_longitude" numeric,
	"location_sharing_active" boolean DEFAULT false NOT NULL,
	"last_checkpoint" text DEFAULT 'Pickup Location',
	"last_location_update" timestamp,
	"scheduled_pickup_date" text,
	"estimated_delivery_date" text,
	"actual_delivery_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_tracking_number_unique" UNIQUE("tracking_number")
);
--> statement-breakpoint
CREATE TABLE "transport_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"vehicle_id" integer,
	"title" text NOT NULL,
	"origin_corridor" text NOT NULL,
	"destination_corridor" text NOT NULL,
	"available_capacity_tons" numeric NOT NULL,
	"cargo_category" text NOT NULL,
	"rate_per_km_or_trip" numeric NOT NULL,
	"pricing_unit" text DEFAULT 'Per Trip' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"available_from" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"special_conditions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"business_name" text,
	"role" text NOT NULL,
	"country" text DEFAULT 'Pakistan' NOT NULL,
	"city" text DEFAULT 'Karachi' NOT NULL,
	"phone" text,
	"bio" text,
	"avatar_url" text,
	"cnic_number" text,
	"person_address" text,
	"business_address" text,
	"driving_license_number" text,
	"license_expiry_date" text,
	"plate_number" text,
	"verification_status" text DEFAULT 'not_submitted' NOT NULL,
	"verification_notes" text,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"vehicle_type" text NOT NULL,
	"make_model" text NOT NULL,
	"registration_country" text NOT NULL,
	"plate_number_masked" text NOT NULL,
	"plate_number_full" text NOT NULL,
	"capacity_tons" numeric NOT NULL,
	"supported_cargo" text NOT NULL,
	"supported_corridors" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"verification_status" text DEFAULT 'pending_review' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"document_number" text,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"reviewer_notes" text,
	"expires_at" timestamp,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "buyer_demands" ADD CONSTRAINT "buyer_demands_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_demand_id_buyer_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."buyer_demands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_transport_offer_id_transport_offers_id_fk" FOREIGN KEY ("transport_offer_id") REFERENCES "public"."transport_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reports" ADD CONSTRAINT "news_reports_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_exporter_id_users_id_fk" FOREIGN KEY ("exporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_exporter_id_users_id_fk" FOREIGN KEY ("exporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_offers" ADD CONSTRAINT "transport_offers_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_offers" ADD CONSTRAINT "transport_offers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;