export const CORRIDOR_CURRENCIES = [
  { value: "PKR", label: "PKR — Pakistani Rupee (₨)", symbol: "₨" },
  { value: "IRR", label: "IRR / Toman — Iranian Rial (تومان / ریال)", symbol: "﷼" },
  { value: "AFN", label: "AFN — Afghan Afghani (؋)", symbol: "؋" },
  { value: "CNY", label: "CNY — Chinese Yuan / RMB (¥)", symbol: "¥" },
  { value: "USD", label: "USD — US Dollar ($)", symbol: "$" },
];

export const BORDER_COUNTRIES = [
  { value: "Pakistan", label: "Pakistan (PK)" },
  { value: "Iran", label: "Iran (IR)" },
  { value: "Afghanistan", label: "Afghanistan (AF)" },
  { value: "China", label: "China (CN — Khunjerab/Kashgar)" },
];

export const CORRIDOR_CITIES = [
  // Pakistan
  { value: "Quetta", label: "Quetta (Balochistan, PK)" },
  { value: "Chaman", label: "Chaman (Border Hub, PK)" },
  { value: "Taftan", label: "Taftan (Border Post, PK)" },
  { value: "Gwadar", label: "Gwadar (Port, PK)" },
  { value: "Karachi", label: "Karachi (Commercial Port, PK)" },
  { value: "Peshawar", label: "Peshawar (KPK Hub, PK)" },
  { value: "Sust", label: "Sust (Khunjerab Border, PK)" },
  { value: "Islamabad", label: "Islamabad (Capital, PK)" },
  { value: "Lahore", label: "Lahore (Punjab Hub, PK)" },

  // Iran
  { value: "Zahedan", label: "Zahedan (Sistan-Baluchestan, IR)" },
  { value: "Mirjaveh", label: "Mirjaveh (Border Crossing, IR)" },
  { value: "Chabahar", label: "Chabahar (Free Trade Port, IR)" },
  { value: "Mashhad", label: "Mashhad (Khorasan Hub, IR)" },
  { value: "Tehran", label: "Tehran (Capital, IR)" },

  // Afghanistan
  { value: "Kandahar", label: "Kandahar (Southern Hub, AF)" },
  { value: "Spin Boldak", label: "Spin Boldak (Border Gate, AF)" },
  { value: "Kabul", label: "Kabul (Capital, AF)" },
  { value: "Herat", label: "Herat (Western Hub, AF)" },
  { value: "Nimroz", label: "Zaranj (Nimroz Border, AF)" },

  // China
  { value: "Kashgar", label: "Kashgar (Xinjiang Trade Hub, CN)" },
  { value: "Urumqi", label: "Urumqi (Xinjiang Logistics, CN)" },
  { value: "Tashkurgan", label: "Tashkurgan (Khunjerab Pass, CN)" },
];

export const TRADE_CATEGORIES = [
  { value: "Agricultural", label: "Agricultural & Fresh Produce" },
  { value: "Dry Fruits", label: "Dry Fruits, Dates & Nuts" },
  { value: "Minerals", label: "Minerals, Ores & Gypsum" },
  { value: "Petroleum & Fuel", label: "Petroleum, Bitumen & Fuel" },
  { value: "Textiles", label: "Textiles, Garments & Yarns" },
  { value: "Chemicals", label: "Chemicals & Fertilizers" },
  { value: "Construction", label: "Construction & Cement" },
  { value: "Machinery", label: "Machinery & Auto Parts" },
];

export const TRADE_UNITS = [
  { value: "Metric Tons", label: "Metric Tons (MT)" },
  { value: "Bags", label: "Bags (50 kg)" },
  { value: "Kilograms", label: "Kilograms (kg)" },
  { value: "Barrels", label: "Barrels / Drums" },
  { value: "Liters", label: "Liters" },
  { value: "Pallets", label: "Pallets" },
  { value: "Containers", label: "Containers (TEU / 20ft / 40ft)" },
];

export const VERIFICATION_DOC_TYPES = [
  { value: "cnic_passport", label: "National ID (CNIC) / Passport" },
  { value: "business_license", label: "Business Registration / SECP / Trade License" },
  { value: "tax_certificate", label: "Tax Registration / NTN / FBR / Iranian TIN" },
  { value: "chamber_certificate", label: "Chamber of Commerce (FPCCI / ICCIMA) Membership" },
  { value: "driving_license", label: "Heavy Vehicle (HTV/TIR) Driving License" },
  { value: "vehicle_registration", label: "Vehicle Registration & Route Permit Book" },
  { value: "fitness_certificate", label: "Vehicle Fitness / Inspection Certificate" },
  { value: "business_location_proof", label: "Business Location / Physical Address Proof / Utility Bill" },
  { value: "person_photo", label: "Owner / Director / Driver Photo" },
];
