/**
 * Background domains — anchors the user's identity early in onboarding so
 * skills get interpreted with the right context.
 *
 * Caroline's note (5/18): a user's *primary background* is what they think
 * of when describing themselves ("I'm in logistics"). It's not permanent —
 * users can pivot — but it grounds the matching engine.
 *
 * Each domain maps to:
 *  - vertical: the internal canonical vertical for our match algorithm
 *  - examples: example role titles shown in the dropdown helper text
 *  - suggestedSkills: skills to surface FIRST on /skills
 *  - adzunaQuery: the *known-good* Adzuna search term for this domain.
 *    Caroline's round-2 testing (5/22) found that joining skill names as
 *    the Adzuna search produces zero matches for sales/customer-service
 *    because Adzuna's job descriptions don't echo back "Clienteling".
 *    So we anchor search by domain identity, then rank by skills.
 *  - adzunaBroadQuery: a *wider* term used for Tab B (gap jobs)
 */

export interface Domain {
  id: string;
  label: string;
  vertical: string;
  examples: string;
  suggestedSkills: string[];
  adzunaQuery: string;
  adzunaBroadQuery: string;
}

export const DOMAINS: Domain[] = [
  {
    id: "retail_sales",
    label: "Retail Sales",
    vertical: "retail",
    examples: "Store Associate, Cashier, Sales Floor Lead",
    suggestedSkills: ["Customer Service", "Cash Handling", "POS Systems", "Visual Merchandising", "Inventory Management"],
    adzunaQuery: "retail sales associate",
    adzunaBroadQuery: "sales",
  },
  {
    id: "customer_service",
    label: "Customer Service",
    vertical: "admin",
    examples: "Call Center Rep, Help Desk, Client Support",
    suggestedSkills: ["Phone Etiquette", "Conflict Resolution", "CRM Software", "Data Entry", "Multitasking"],
    adzunaQuery: "customer service representative",
    adzunaBroadQuery: "customer service",
  },
  {
    id: "logistics",
    label: "Logistics & Transportation",
    vertical: "transport",
    examples: "Driver, Warehouse Associate, Dispatcher",
    suggestedSkills: ["Forklift Operation", "Route Planning", "Inventory Management", "OSHA Safety", "Shipping & Receiving"],
    adzunaQuery: "warehouse driver logistics",
    adzunaBroadQuery: "logistics",
  },
  {
    id: "healthcare_support",
    label: "Healthcare Support",
    vertical: "healthcare",
    examples: "Home Health Aide, CNA, Medical Assistant",
    suggestedSkills: ["Personal Care Assistance", "Vital Signs Monitoring", "Medication Reminders", "Companionship", "CPR/First Aid"],
    adzunaQuery: "home health aide caregiver",
    adzunaBroadQuery: "health aide",
  },
  {
    id: "hospitality",
    label: "Hospitality",
    vertical: "food_service",
    examples: "Hotel Front Desk, Housekeeper, Event Staff",
    suggestedSkills: ["Guest Services", "Reservation Systems", "Housekeeping", "Food & Beverage Service", "Conflict Resolution"],
    adzunaQuery: "hospitality hotel guest",
    adzunaBroadQuery: "hospitality",
  },
  {
    id: "construction",
    label: "Construction",
    vertical: "trades",
    examples: "General Laborer, Carpenter Helper, Site Foreman",
    suggestedSkills: ["Hand & Power Tools", "Blueprint Reading", "OSHA-10 Certification", "Heavy Lifting", "Job Site Safety"],
    adzunaQuery: "construction laborer",
    adzunaBroadQuery: "construction",
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    vertical: "trades",
    examples: "Assembly Line, Machine Operator, Quality Inspector",
    suggestedSkills: ["Quality Control", "Machine Operation", "Assembly Line Work", "Lean Manufacturing", "Safety Compliance"],
    adzunaQuery: "manufacturing assembly operator",
    adzunaBroadQuery: "manufacturing",
  },
  {
    id: "admin_office",
    label: "Administrative & Office",
    vertical: "admin",
    examples: "Receptionist, Office Coordinator, Executive Assistant",
    suggestedSkills: ["Microsoft Office", "Scheduling", "Email Management", "Filing & Records", "Phone Etiquette"],
    adzunaQuery: "administrative assistant office",
    adzunaBroadQuery: "administrative",
  },
  {
    id: "skilled_trades",
    label: "Skilled Trades",
    vertical: "trades",
    examples: "Electrician, Plumber, HVAC Technician",
    suggestedSkills: ["Electrical Wiring", "Plumbing Repair", "HVAC Installation", "Troubleshooting", "Trade License"],
    adzunaQuery: "electrician plumber hvac",
    adzunaBroadQuery: "technician",
  },
  {
    id: "technology_it",
    label: "Technology / IT",
    vertical: "tech",
    examples: "Help Desk, Junior Developer, IT Support",
    suggestedSkills: ["Technical Troubleshooting", "Windows / macOS Support", "Networking Basics", "Ticketing Systems", "Hardware Setup"],
    adzunaQuery: "IT support technician",
    adzunaBroadQuery: "technology",
  },
  {
    id: "education",
    label: "Education",
    vertical: "education",
    examples: "Teacher's Aide, Tutor, Childcare Worker",
    suggestedSkills: ["Classroom Management", "Lesson Planning", "Child Development", "Communication with Parents", "Patience & Empathy"],
    adzunaQuery: "teacher assistant aide",
    adzunaBroadQuery: "education",
  },
  {
    id: "food_service",
    label: "Food Service",
    vertical: "food_service",
    examples: "Line Cook, Barista, Server",
    suggestedSkills: ["Food Safety", "Customer Service", "Cash Handling", "Multitasking", "Fast-Paced Work"],
    adzunaQuery: "line cook server barista",
    adzunaBroadQuery: "food service",
  },
  {
    id: "other",
    label: "Other / Not Sure Yet",
    vertical: "other",
    examples: "Pick this if your background doesn't fit above",
    suggestedSkills: [],
    adzunaQuery: "",
    adzunaBroadQuery: "",
  },
];

/** Look up Adzuna search queries by domain id (used by the match API). */
export function getDomainQueries(domainId: string | null | undefined): {
  primary: string;
  broad: string;
} | null {
  const d = getDomainById(domainId);
  if (!d || !d.adzunaQuery) return null;
  return { primary: d.adzunaQuery, broad: d.adzunaBroadQuery };
}

export function getDomainById(id: string | null | undefined): Domain | null {
  if (!id) return null;
  return DOMAINS.find((d) => d.id === id) || null;
}
