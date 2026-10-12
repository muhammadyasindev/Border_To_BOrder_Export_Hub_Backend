import { pgTable, serial, text, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";

// Users table supporting exporter, importer, driver, admin
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  businessName: text("business_name"),
  role: text("role").notNull(), // 'exporter' | 'importer' | 'driver' | 'admin'
  country: text("country").notNull().default("Pakistan"), // Pakistan, Iran, Afghanistan
  city: text("city").notNull().default("Karachi"),
  phone: text("phone"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  cnicNumber: text("cnic_number"),
  personAddress: text("person_address"),
  businessAddress: text("business_address"),
  drivingLicenseNumber: text("driving_license_number"),
  licenseExpiryDate: text("license_expiry_date"),
  plateNumber: text("plate_number"),
  verificationStatus: text("verification_status").notNull().default("not_submitted"), // not_submitted, submitted, pending_review, changes_required, verified, rejected, expired
  verificationNotes: text("verification_notes"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  sessionsRevokedAt: timestamp("sessions_revoked_at"),
});

// Verification documents submitted by users for admin review
export const verificationDocuments = pgTable("verification_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // cnic_passport, business_license, tax_certificate, driving_license, vehicle_registration, fitness_certificate
  documentNumber: text("document_number"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: text("file_size"),
  status: text("status").notNull().default("pending_review"), // pending_review, approved, rejected, changes_required
  reviewerNotes: text("reviewer_notes"),
  expiresAt: timestamp("expires_at"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

// Products for Sale (Exporters)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  exporterId: integer("exporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(), // Agricultural, Textiles, Minerals, Dry Fruits, Chemicals, Construction, Machinery
  description: text("description").notNull(),
  qualityGrade: text("quality_grade").default("Grade A"), // Premium, Grade A, Commercial
  quantityAvailable: numeric("quantity_available").notNull(),
  unit: text("unit").notNull().default("Metric Tons"), // Metric Tons, Bags, Pallets, Kilograms, Barrels
  pricePerUnit: numeric("price_per_unit").notNull(),
  currency: text("currency").notNull().default("USD"), // USD, PKR, IRR, AFN
  originCountry: text("origin_country").notNull(), // Pakistan, Iran, Afghanistan
  originCity: text("origin_city").notNull(),
  destinationMarkets: text("destination_markets"), // JSON or comma list
  imageUrl: text("image_url"),
  status: text("status").notNull().default("active"), // active, paused, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Buyer Demands (Importers)
export const buyerDemands = pgTable("buyer_demands", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  specifications: text("specifications").notNull(),
  quantityRequired: numeric("quantity_required").notNull(),
  unit: text("unit").notNull().default("Metric Tons"),
  targetPrice: numeric("target_price"),
  currency: text("currency").notNull().default("USD"),
  preferredOrigin: text("preferred_origin"), // Pakistan, Iran, Afghanistan, Any
  destinationCountry: text("destination_country").notNull(),
  destinationCity: text("destination_city").notNull(),
  deliveryDeadline: text("delivery_deadline"),
  packagingRequirements: text("packaging_requirements"),
  status: text("status").notNull().default("active"), // active, fulfilled, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vehicles (Drivers/Transporters)
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type").notNull(), // Heavy Flatbed, Refrigerated Reefer, Curtain-sider, Tanker, Container Carrier
  makeModel: text("make_model").notNull(),
  registrationCountry: text("registration_country").notNull(),
  plateNumberMasked: text("plate_number_masked").notNull(), // e.g. PK-***-8824 for public privacy
  plateNumberFull: text("plate_number_full").notNull(), // for authorized review
  capacityTons: numeric("capacity_tons").notNull(),
  supportedCargo: text("supported_cargo").notNull(), // Perishables, Dry bulk, Steel, Containers, Hazardous
  supportedCorridors: text("supported_corridors").notNull(), // Taftan-Mirjaveh, Chaman-Spin Boldak, Rimdan-Gabd
  isAvailable: boolean("is_available").notNull().default(true),
  verificationStatus: text("verification_status").notNull().default("pending_review"), // pending_review, verified, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transport Offers published by drivers
export const transportOffers = pgTable("transport_offers", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  originCorridor: text("origin_corridor").notNull(), // Taftan, Rimdan, Chaman, Quetta, Zahedan, Kandahar
  destinationCorridor: text("destination_corridor").notNull(),
  availableCapacityTons: numeric("available_capacity_tons").notNull(),
  cargoCategory: text("cargo_category").notNull(),
  ratePerKmOrTrip: numeric("rate_per_km_or_trip").notNull(),
  pricingUnit: text("pricing_unit").notNull().default("Per Trip"), // Per Trip, Per Ton-Km
  currency: text("currency").notNull().default("USD"),
  availableFrom: text("available_from").notNull(),
  status: text("status").notNull().default("active"), // active, booked, paused
  specialConditions: text("special_conditions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Private Conversations / Deal Rooms
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  dealSubjectType: text("deal_subject_type").default("general"), // product, demand, transport, deal
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  demandId: integer("demand_id").references(() => buyerDemands.id, { onDelete: "set null" }),
  transportOfferId: integer("transport_offer_id").references(() => transportOffers.id, { onDelete: "set null" }),
  dealStatus: text("deal_status").notNull().default("inquiry"), // inquiry, quotation_exchanged, terms_agreed, transporter_invited, booked, in_transit, completed, cancelled
  agreedPrice: numeric("agreed_price"),
  agreedQuantity: numeric("agreed_quantity"),
  currency: text("currency").default("USD"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conversation Participants (supports 2-person and 3-person tripartite trade deals)
export const conversationParticipants = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleInDeal: text("role_in_deal").notNull(), // exporter, buyer, transporter
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Messages in Conversation Room
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderRole: text("sender_role"), // exporter, importer, driver
  content: text("content").notNull(),
  attachmentName: text("attachment_name"),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // doc, quotation, proforma, bol, voice_note, image, pdf
  attachments: text("attachments"), // JSON stringified array of multiple attachments [{ name, url, type, size }]
  voiceDuration: numeric("voice_duration"), // duration in seconds for voice notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Password Resets with Cryptographically Secure Single-Use OTP
export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transport Bookings and Shipments
export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  trackingNumber: text("tracking_number").notNull().unique(),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  exporterId: integer("exporter_id").notNull().references(() => users.id),
  buyerId: integer("buyer_id").notNull().references(() => users.id),
  driverId: integer("driver_id").notNull().references(() => users.id),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  cargoDescription: text("cargo_description").notNull(),
  cargoWeightTons: numeric("cargo_weight_tons").notNull(),
  pickupLocation: text("pickup_location").notNull(),
  borderCrossing: text("border_crossing").notNull(), // Taftan/Mirjaveh, Chaman/Spin Boldak, Rimdan/Gabd
  destinationLocation: text("destination_location").notNull(),
  status: text("status").notNull().default("booked"), // booked, pickup_pending, in_transit_to_border, border_clearance, crossed_border, in_transit_to_destination, delivered, cancelled
  currentLatitude: numeric("current_latitude"),
  currentLongitude: numeric("current_longitude"),
  locationSharingActive: boolean("location_sharing_active").notNull().default(false),
  lastCheckpoint: text("last_checkpoint").default("Pickup Location"),
  lastLocationUpdate: timestamp("last_location_update"),
  scheduledPickupDate: text("scheduled_pickup_date"),
  estimatedDeliveryDate: text("estimated_delivery_date"),
  actualDeliveryDate: text("actual_delivery_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// BorderPulse & Trade / Road News
export const newsReports = pgTable("news_reports", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(), // border_crossing, road_condition, market_prices, regulation_update
  targetAudience: text("target_audience").notNull().default("all"), // all, drivers, exporters, importers
  locationCorridor: text("location_corridor").notNull(), // Taftan, Chaman, Rimdan, Quetta-Zahedan, Kabul-Peshawar
  summary: text("summary").notNull(),
  details: text("details").notNull(),
  sourceType: text("source_type").notNull().default("community_report"), // official_source, community_confirmed, community_report
  sourceName: text("source_name"),
  priceDetails: text("price_details"), // Optional: "Apples Grade A: $850/ton observed at Quetta mandi"
  waitingTimeHours: integer("waiting_time_hours"), // e.g., 6 hours at customs
  status: text("status").notNull().default("published"), // published, under_review, flagged
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Durable Compliance Audit Trail for Restricted Deal Room Access
export const complianceAuditLogs = pgTable("compliance_audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  caseReference: text("case_reference").notNull(),
  justification: text("justification").notNull(),
  authorizedBy: text("authorized_by").notNull(),
  action: text("action").notNull().default("inspection_access"),
  ipAddress: text("ip_address"),
  grantTokenHash: text("grant_token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

