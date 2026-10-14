import User from "../models/User.js";
import VerificationDocument from "../models/VerificationDocument.js";
import Product from "../models/Product.js";
import BuyerDemand from "../models/BuyerDemand.js";
import Vehicle from "../models/Vehicle.js";
import TransportOffer from "../models/TransportOffer.js";
import Conversation from "../models/Conversation.js";
import ConversationParticipant from "../models/ConversationParticipant.js";
import Message from "../models/Message.js";
import Shipment from "../models/Shipment.js";
import NewsReport from "../models/NewsReport.js";
import { hashPassword } from "../utils/crypto.js";

export async function seedDatabase() {
  const existingSeedUser = await User.findOne({ email: "yasinsasoli186@gmail.com" });
  if (existingSeedUser) {
    return { status: "already_seeded", message: "Database already contains seed persona records." };
  }

  const defaultPassword = await hashPassword("BorderGlow2025!");

  // 1. Create realistic core persona users for the trade corridor (Pakistan, Iran, Afghanistan)
  const exporter1 = await User.create({
    email: "tariq.agri@borderglow.trade",
    passwordHash: defaultPassword,
    fullName: "Tariq Mahmood",
    businessName: "Indus Agri Exports Ltd",
    role: "exporter",
    country: "Pakistan",
    city: "Quetta",
    phone: "+92 300 8392100",
    bio: "Leading Balochistan fresh produce exporter specializing in Kinnow oranges, dry fruits, and red pomegranates for Iran and Central Asian corridors.",
    verificationStatus: "verified",
    verificationNotes: "Verified via SECP Company Registration #0093821 and FPCCI Trade License.",
    verifiedAt: new Date(),
  });

  const exporter2 = await User.create({
    email: "reza.minerals@borderglow.trade",
    passwordHash: defaultPassword,
    fullName: "Reza Hosseini",
    businessName: "Zagros Mineral & Petrochem",
    role: "exporter",
    country: "Iran",
    city: "Zahedan",
    phone: "+98 54 33214500",
    bio: "Direct source producer of Bitumen 60/70, Gypsum, and industrial sulfur with direct transit clearance at Mirjaveh/Taftan.",
    verificationStatus: "verified",
    verificationNotes: "Verified via Iran Chamber of Commerce Commercial Card #882194.",
    verifiedAt: new Date(),
  });

  const buyer1 = await User.create({
    email: "farhad.impex@borderglow.trade",
    passwordHash: defaultPassword,
    fullName: "Farhad Rahimi",
    businessName: "Ariana Wholesale Impex",
    role: "importer",
    country: "Afghanistan",
    city: "Kandahar",
    phone: "+93 700 452100",
    bio: "Licensed bulk importer of agricultural produce, edible oils, and building supplies distributing across Kandahar, Helmand, and Kabul.",
    verificationStatus: "verified",
    verificationNotes: "Verified with Afghanistan Chamber of Commerce & Investment license.",
    verifiedAt: new Date(),
  });

  const buyer2 = await User.create({
    email: "kaveh.traders@borderglow.trade",
    passwordHash: defaultPassword,
    fullName: "Kaveh Soltani",
    businessName: "Alborz Food Distribution LLC",
    role: "importer",
    country: "Iran",
    city: "Tehran",
    phone: "+98 21 88451120",
    bio: "Tehran-based central market distributor sourcing seasonal fruits, Pakistani basmati rice, and spices.",
    verificationStatus: "verified",
    verificationNotes: "Verified with Trade Promotion Organization of Iran registration.",
    verifiedAt: new Date(),
  });

  const driver1 = await User.create({
    email: "gul.khan.transport@borderglow.trade",
    passwordHash: defaultPassword,
    fullName: "Gul Khan Achakzai",
    businessName: "Chaman & Taftan Cargo Haulers",
    role: "driver",
    country: "Pakistan",
    city: "Chaman",
    phone: "+92 333 7819200",
    bio: "Owner-operator with 14 years cross-border transit experience across Quetta-Taftan-Mirjaveh and Chaman-Spin Boldak routes with TIR customs carnets.",
    verificationStatus: "verified",
    verificationNotes: "Commercial Heavy Transport License verified, Vehicle Registration valid until 2026.",
    verifiedAt: new Date(),
  });

  const driver2 = await User.create({
    email: "morteza.transit@borderglow.trade",
    passwordHash: defaultPassword,
    fullName: "Morteza Moradi",
    businessName: "Sistan Reefer Logistics",
    role: "driver",
    country: "Iran",
    city: "Mirjaveh",
    phone: "+98 912 3456789",
    bio: "Refrigerated trailer specialist handling temperature-controlled perishables across Taftan and Rimdan corridors.",
    verificationStatus: "pending_review",
    verificationNotes: "Documents submitted for 2025 road permit renewal.",
  });

  const adminUser = await User.create({
    email: "compliance.admin@borderglow.trade",
    passwordHash: defaultPassword,
    fullName: "Sarah Al-Husseini",
    businessName: "Border Export Hub Trade Compliance",
    role: "admin",
    country: "Pakistan",
    city: "Islamabad",
    phone: "+92 51 9876543",
    bio: "Chief Compliance Officer & Verification Reviewer for Border Export Hub cross-border corridors.",
    verificationStatus: "verified",
    verifiedAt: new Date(),
  });

  const yasinUser = await User.create({
    email: "yasinsasoli186@gmail.com",
    passwordHash: defaultPassword,
    fullName: "Muhammad Yasin",
    businessName: "Yasin Petroleum & Trade",
    role: "importer",
    country: "Pakistan",
    city: "Quetta",
    phone: "+92 332 4042186",
    bio: "Importer & cross-border merchant dealing in transit transport, dates, and trade supplies.",
    cnicNumber: "54401-1234567-1",
    personAddress: "Customs Samungli Road, Quetta",
    businessAddress: "Jinnah Road Commercial Center, Quetta",
    verificationStatus: "verified",
    verificationNotes: "Verified via FPCCI and National Trade Registry.",
    verifiedAt: new Date(),
  });

  // 2. Insert Verification Documents
  await VerificationDocument.create([
    {
      userId: exporter1._id,
      documentType: "business_license",
      documentNumber: "SECP-CORP-0093821",
      fileName: "SECP_Incorporation_IndusAgri.pdf",
      fileUrl: "/docs/secp_indus.pdf",
      fileSize: "1.8 MB",
      status: "approved",
      reviewerNotes: "Confirmed active with national SECP database.",
    },
    {
      userId: exporter1._id,
      documentType: "cnic_passport",
      documentNumber: "54401-******-3",
      fileName: "Tariq_CNIC_Encrypted.pdf",
      fileUrl: "/docs/cnic_tariq.pdf",
      fileSize: "920 KB",
      status: "approved",
      reviewerNotes: "Government CNIC verification passed.",
    },
    {
      userId: driver1._id,
      documentType: "driving_license",
      documentNumber: "HTV-BLN-99410",
      fileName: "GulKhan_HTV_License.pdf",
      fileUrl: "/docs/htv_gulkhan.pdf",
      fileSize: "1.2 MB",
      status: "approved",
      reviewerNotes: "Heavy Transport Vehicle permit verified by Balochistan Traffic Police.",
    },
    {
      userId: driver2._id,
      documentType: "driving_license",
      documentNumber: "IR-TRN-481920",
      fileName: "Moradi_Transit_License.pdf",
      fileUrl: "/docs/moradi_license.pdf",
      fileSize: "1.4 MB",
      status: "pending_review",
      reviewerNotes: "Awaiting cross-check with Sistan transport bureau.",
    },
  ]);

  // 3. Products
  const prod1 = await Product.create({
    exporterId: exporter1._id,
    title: "Fresh Kinnow Mandarins (Export Grade)",
    category: "Agricultural",
    description: "Export grade juicy Kinnow mandarins sorted and packed in 10kg export cartons. Waxed, treated, and compliant with plant health standards.",
    qualityGrade: "Grade A Export",
    quantityAvailable: 120,
    unit: "Metric Tons",
    pricePerUnit: 620,
    currency: "USD",
    originCountry: "Pakistan",
    originCity: "Bhalwal / Quetta Transit",
    destinationMarkets: "Iran, Afghanistan, Central Asia",
    imageUrl: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=800&q=80",
    status: "active",
  });

  const prod2 = await Product.create({
    exporterId: exporter1._id,
    title: "Balochistan Premium Dried Figs & Almonds",
    category: "Dry Fruits",
    description: "Sun-dried natural figs (Injeer) and soft-shell Badam from Ziarat valley. Packed in vacuum 25kg bulk bags.",
    qualityGrade: "Select Grade",
    quantityAvailable: 45,
    unit: "Metric Tons",
    pricePerUnit: 3800,
    currency: "USD",
    originCountry: "Pakistan",
    originCity: "Quetta",
    destinationMarkets: "Iran, UAE, Afghanistan",
    imageUrl: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    status: "active",
  });

  const prod3 = await Product.create({
    exporterId: exporter2._id,
    title: "Industrial Grade Bitumen Penetration 60/70",
    category: "Chemicals & Minerals",
    description: "High quality road grade asphalt bitumen 60/70 delivered in new 180kg steel drums or heated tankers at Taftan / Rimdan border.",
    qualityGrade: "ASTM Compliant",
    quantityAvailable: 500,
    unit: "Metric Tons",
    pricePerUnit: 390,
    currency: "USD",
    originCountry: "Iran",
    originCity: "Zahedan",
    destinationMarkets: "Pakistan, Afghanistan",
    imageUrl: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80",
    status: "active",
  });

  // 4. Buyer Demands
  const dem1 = await BuyerDemand.create({
    buyerId: buyer1._id,
    title: "Requirement: 250 MT White Basmati Rice 1121",
    category: "Agricultural",
    specifications: "1121 Steam Basmati Rice, max 1% broken, grain length 8.35mm+, packaged in 50kg PP woven export bags.",
    quantityRequired: 250,
    unit: "Metric Tons",
    targetPrice: 980,
    currency: "USD",
    preferredOrigin: "Pakistan",
    destinationCountry: "Afghanistan",
    destinationCity: "Kandahar",
    deliveryDeadline: "Within 25 days",
    packagingRequirements: "50kg marked sacks with bilingual labels",
    status: "active",
  });

  const dem2 = await BuyerDemand.create({
    buyerId: buyer2._id,
    title: "Requirement: Organic Pakistani Red Pomegranates",
    category: "Agricultural",
    specifications: "Fresh harvest red pomegranates (Kandahari/Quetta variety), minimum fruit diameter 80mm, chilled reefer transit.",
    quantityRequired: 80,
    unit: "Metric Tons",
    targetPrice: 1150,
    currency: "USD",
    preferredOrigin: "Pakistan",
    destinationCountry: "Iran",
    destinationCity: "Tehran Wholesale Market",
    deliveryDeadline: "Immediate / 14 days",
    packagingRequirements: "Cushioned 8kg plastic crates",
    status: "active",
  });

  // 5. Vehicles
  const veh1 = await Vehicle.create({
    driverId: driver1._id,
    vehicleType: "Heavy Flatbed (3-Axle)",
    makeModel: "Hino 700 Series 480HP",
    registrationCountry: "Pakistan",
    plateNumberMasked: "BLN-***-9921",
    plateNumberFull: "BLN-849-9921",
    capacityTons: 38,
    supportedCargo: "Steel, Containers, Dry Agricultural Bulk, Machinery",
    supportedCorridors: "Quetta - Taftan (Iran Border), Chaman - Spin Boldak (Afghan Border)",
    isAvailable: true,
    verificationStatus: "verified",
  });

  const veh2 = await Vehicle.create({
    driverId: driver2._id,
    vehicleType: "Refrigerated Reefer Trailer (-20°C to +15°C)",
    makeModel: "Volvo FH16 540",
    registrationCountry: "Iran",
    plateNumberMasked: "IR-85-***-12",
    plateNumberFull: "IR-85-392-12",
    capacityTons: 26,
    supportedCargo: "Perishable Fruits, Meat, Pharmaceuticals",
    supportedCorridors: "Taftan - Zahedan - Tehran, Rimdan - Chabahar",
    isAvailable: true,
    verificationStatus: "verified",
  });

  // 6. Transport Offers
  const off1 = await TransportOffer.create({
    driverId: driver1._id,
    vehicleId: veh1._id,
    title: "Direct Flatbed Cargo Service: Quetta to Taftan Border",
    originCorridor: "Quetta, Pakistan",
    destinationCorridor: "Taftan / Mirjaveh Border",
    availableCapacityTons: 38,
    cargoCategory: "General Freight & Dry Bulk",
    ratePerKmOrTrip: 1650,
    pricingUnit: "Per Trip",
    currency: "USD",
    availableFrom: "Immediate / Weekly Scheduled",
    status: "active",
    specialConditions: "Customs declaration assistance included at Taftan NLC terminal.",
  });

  const off2 = await TransportOffer.create({
    driverId: driver2._id,
    vehicleId: veh2._id,
    title: "Chilled Reefer Transit: Taftan Border to Tehran Central",
    originCorridor: "Mirjaveh / Taftan Border",
    destinationCorridor: "Tehran, Iran",
    availableCapacityTons: 25,
    cargoCategory: "Temperature Controlled Produce",
    ratePerKmOrTrip: 2100,
    pricingUnit: "Per Trip",
    currency: "USD",
    availableFrom: "Every Tuesday & Friday",
    status: "active",
    specialConditions: "Continuous GPS temperature logging provided upon bill of lading.",
  });

  // 7. Deal Room / Conversation (Tripartite workflow: Exporter, Buyer, Transporter)
  const deal1 = await Conversation.create({
    title: "Export Deal: 80 MT Kinnow Mandarins to Tehran",
    dealSubjectType: "deal",
    productId: prod1._id,
    demandId: dem2._id,
    transportOfferId: off1._id,
    dealStatus: "in_transit",
    agreedPrice: 610,
    agreedQuantity: 80,
    currency: "USD",
  });

  await ConversationParticipant.create([
    { conversationId: deal1._id, userId: exporter1._id, roleInDeal: "exporter" },
    { conversationId: deal1._id, userId: buyer2._id, roleInDeal: "importer" },
    { conversationId: deal1._id, userId: driver1._id, roleInDeal: "driver" },
  ]);

  await Message.create([
    {
      conversationId: deal1._id,
      senderId: buyer2._id,
      senderRole: "importer",
      content: "Salam Tariq sahib, we reviewed your Kinnow listing. We need 80 Metric Tons delivered to Tehran via Taftan/Mirjaveh crossing. Can you provide phytosanitary certificate?",
    },
    {
      conversationId: deal1._id,
      senderId: exporter1._id,
      senderRole: "exporter",
      content: "Wa Alaikum Assalam Kaveh sahib. Yes, all citrus has government DPP phytosanitary clearance and cold-treatment certs. We agreed on $610/ton CIF border.",
    },
    {
      conversationId: deal1._id,
      senderId: exporter1._id,
      senderRole: "exporter",
      content: "I have added Gul Khan from Chaman & Taftan Cargo to coordinate the heavy transport directly.",
    },
    {
      conversationId: deal1._id,
      senderId: driver1._id,
      senderRole: "driver",
      content: "Greetings to both parties. My flatbed and container trailers are inspected and loaded at Quetta terminal. Border transit clearance documents are staged for Taftan.",
    },
    {
      conversationId: deal1._id,
      senderId: exporter1._id,
      senderRole: "exporter",
      content: "Proforma Invoice & Consignment Waybill attached. Shipment BG-TRK-9842 is now registered on Border Export Hub with active GPS tracking.",
      attachmentName: "Proforma_Invoice_BG-9842.pdf",
      attachmentType: "proforma",
    },
  ]);

  // Bilateral Transport Deal Room: Yasin (Importer) & Morteza Moradi (Driver)
  const dealYasin = await Conversation.create({
    title: "Transport Booking: Chilled Reefer Transit to Tehran Central",
    dealSubjectType: "transport",
    transportOfferId: off2._id,
    dealStatus: "inquiry",
    agreedPrice: 2100,
    currency: "USD",
  });

  await ConversationParticipant.create([
    { conversationId: dealYasin._id, userId: yasinUser._id, roleInDeal: "importer" },
    { conversationId: dealYasin._id, userId: driver2._id, roleInDeal: "driver" },
  ]);

  await Message.create([
    {
      conversationId: dealYasin._id,
      senderId: yasinUser._id,
      senderRole: "importer",
      content: "Hello! I would like to get an offer and book vehicle for: 'Chilled Reefer Transit: Taftan Border to Tehran Central'. Please share rates and available dispatch schedule.",
    },
    {
      conversationId: dealYasin._id,
      senderId: driver2._id,
      senderRole: "driver",
      content: "Wa Alaikum Assalam Yasin sahib. The Volvo FH16 refrigerated reefer trailer is stationed at Mirjaveh / Taftan border ready for transit. Rate is $2,100 per trip with complete temperature logging.",
    },
  ]);

  // 8. Active Shipment
  await Shipment.create({
    trackingNumber: "BG-TRK-9842",
    conversationId: deal1._id,
    exporterId: exporter1._id,
    buyerId: buyer2._id,
    driverId: driver1._id,
    vehicleId: veh1._id,
    cargoDescription: "80 MT Export Grade Kinnow Mandarins (8,000 standard 10kg cartons)",
    cargoWeightTons: 80,
    pickupLocation: "Quetta Dry Port, Balochistan",
    borderCrossing: "Taftan / Mirjaveh Border Terminal",
    destinationLocation: "Tehran Wholesale Central Market",
    status: "in_transit_to_border",
    currentLatitude: 29.0044,
    currentLongitude: 64.4082,
    locationSharingActive: true,
    lastCheckpoint: "Dalbandin Customs Checkpoint, N-40 Highway",
    lastLocationUpdate: new Date(),
    scheduledPickupDate: "2025-05-10",
    estimatedDeliveryDate: "2025-05-15",
  });

  // 9. BorderPulse & News Reports
  await NewsReport.create([
    {
      authorId: driver1._id,
      title: "Taftan-Mirjaveh Border Crossing: Commercial Customs Queue Moving Smoothly",
      category: "border_crossing",
      targetAudience: "all",
      locationCorridor: "Taftan / Mirjaveh",
      summary: "Border terminal gate 2 is operating with an average turnaround time of 4 hours for reefer and flatbed consignments.",
      details: "Commercial clearance at Taftan NLC terminal is currently processing cross-border shipments with minimal delay. Scanning lanes 1 and 2 are fully operational. Iranian customs (Mirjaveh) accepts online e-CMR manifests.",
      sourceType: "community_confirmed",
      sourceName: "Quetta-Taftan Transporters Association",
      waitingTimeHours: 4,
      status: "published",
    },
    {
      authorId: exporter1._id,
      title: "Quetta Mandi Fresh Kinnow & Citrus Price Index Update",
      category: "market_prices",
      targetAudience: "importers",
      locationCorridor: "Balochistan Corridor",
      summary: "Grade A Export Kinnows trading at $600-$630/MT; steady inquiries from Iranian importers for post-harvest stock.",
      details: "Citrus wholesale rates remain firm as transit corridors via Taftan remain stable. Demand in regional wholesale hubs in Zahedan and Tehran is rising for high-brix Kinnow crates.",
      sourceType: "community_confirmed",
      sourceName: "Fruit & Vegetable Exporters Alliance",
      priceDetails: "Kinnow Mandarins Grade A: $615/MT average (FOB Quetta)",
      status: "published",
    },
    {
      authorId: adminUser._id,
      title: "Official Advisory: Revised Bilateral Commercial Transit Documentation for Chaman-Spin Boldak",
      category: "regulation_update",
      targetAudience: "all",
      locationCorridor: "Chaman / Spin Boldak",
      summary: "Pakistan Customs and Afghanistan Ministry of Industry announce unified electronic gate passes for goods vehicles.",
      details: "All commercial vehicles crossing Chaman must carry the digitized customs declaration barcode issued through WebOC / ASYCUDA. Manual stamping is being phased out across secondary gates.",
      sourceType: "official_source",
      sourceName: "Federal Board of Revenue & Ministry of Commerce",
      waitingTimeHours: 7,
      status: "published",
    },
    {
      authorId: driver2._id,
      title: "N-40 Highway Weather & Road Surface Advisory: Dalbandin to Nok Kundi",
      category: "road_condition",
      targetAudience: "drivers",
      locationCorridor: "N-40 Quetta-Taftan",
      summary: "High winds and minor sand accumulation between Nok Kundi and Taftan; convoy speed advised at 60 km/h.",
      details: "Drivers operating laden 3-axle trailers should exercise caution near Nok Kundi section due to localized sand drifts on the highway shoulders. National Highway Authority patrol is active.",
      sourceType: "community_report",
      sourceName: "Independent Drivers Network",
      status: "published",
    },
  ]);

  return { status: "success", message: "Database seeded successfully with authentic trade corridor personas, listings, and deal rooms!" };
}
