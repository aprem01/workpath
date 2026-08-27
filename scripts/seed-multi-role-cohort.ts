/**
 * Caroline 8/26 Round 8: multi-role synthetic test cohort.
 *
 * 6 roles × 5 candidates = 30 test users covering realistic skill
 * baskets across the roles Skilmatch launches with for Chicago:
 *
 *   1. Home Health Aide
 *   2. Retail Sales Associate
 *   3. Customer Service Representative
 *   4. Logistics / Operations Manager
 *   5. Construction / Skilled Trades
 *   6. Hospitality
 *
 * Each role includes:
 *   - one Top Candidate (all required skills matched)
 *   - one Close Match (missing 1 required skill)
 *   - one Wrong-Vertical candidate (only generic-skill overlap)
 *   - one Wrong-Domain candidate (medical/legal/etc., truly unrelated)
 *   - one bonus candidate (partial overlap for edge-case testing)
 *
 * Handles labelled with `test_r8_<role>_<slot>` so we can filter them
 * out of production dashboards and never confuse them with real users.
 *
 * Run with:  npx tsx scripts/seed-multi-role-cohort.ts
 * Repeatable — skips users whose handle already exists.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Slot = "top" | "close" | "wrong_vertical" | "wrong_domain" | "bonus";

interface Seed {
  role: string;
  zip: string;
  candidates: Array<{
    slot: Slot;
    skills: string[];
  }>;
}

const SEEDS: Seed[] = [
  {
    role: "hha",
    zip: "60660",
    candidates: [
      {
        slot: "top",
        skills: ["Personal Care Assistance", "Vital Signs Monitoring", "HHA Certification", "Medication Reminders", "Companionship"],
      },
      {
        slot: "close",
        skills: ["Personal Care Assistance", "Vital Signs Monitoring", "Medication Reminders", "Companionship"], // missing HHA Certification
      },
      {
        slot: "wrong_vertical",
        // Only generic skills — must NOT show as Top for HHA even though
        // "Customer Service" is a common HHA suggested skill.
        skills: ["Customer Service", "Communication", "Problem Solving", "Time Management"],
      },
      {
        slot: "wrong_domain",
        // Nurse practitioner — over-qualified / regulated credential mismatch.
        skills: ["Patient Diagnosis", "Prescription Writing", "Nurse Practitioner License", "Medical Chart Review"],
      },
      {
        slot: "bonus",
        skills: ["Companionship", "Meal Preparation", "Mobility Assistance", "Transportation Assistance"],
      },
    ],
  },
  {
    role: "retail",
    zip: "60614",
    candidates: [
      {
        slot: "top",
        skills: ["Retail Sales", "Cash Handling", "POS Systems", "Visual Merchandising", "Inventory Management"],
      },
      {
        slot: "close",
        skills: ["Retail Sales", "Cash Handling", "POS Systems", "Inventory Management"], // missing Visual Merchandising
      },
      {
        slot: "wrong_vertical",
        skills: ["Customer Service", "Communication", "Training", "Team Management"],
      },
      {
        slot: "wrong_domain",
        skills: ["HVAC Installation", "Refrigeration Repair", "EPA 608 Certification"],
      },
      {
        slot: "bonus",
        skills: ["Sales", "Clienteling", "VIP Experience", "Product Knowledge"],
      },
    ],
  },
  {
    role: "cs_rep",
    zip: "60640",
    candidates: [
      {
        slot: "top",
        skills: ["Customer Service", "Call Handling", "CRM Systems", "Conflict Resolution", "Data Entry"],
      },
      {
        slot: "close",
        skills: ["Customer Service", "Call Handling", "Conflict Resolution", "Data Entry"], // missing CRM Systems
      },
      {
        slot: "wrong_vertical",
        skills: ["Communication", "Problem Solving", "Team Management"],
      },
      {
        slot: "wrong_domain",
        skills: ["Physical Therapy", "Manual Therapy", "PT License"],
      },
      {
        slot: "bonus",
        skills: ["Customer Service", "Email Support", "Chat Support", "Zendesk"],
      },
    ],
  },
  {
    role: "logistics_ops",
    zip: "60632",
    candidates: [
      {
        slot: "top",
        skills: ["Warehouse Management", "Inventory Management", "Forklift Certification", "Route Planning", "Team Leadership"],
      },
      {
        slot: "close",
        skills: ["Warehouse Management", "Inventory Management", "Route Planning", "Team Leadership"], // missing Forklift Certification
      },
      {
        slot: "wrong_vertical",
        skills: ["Management", "Communication", "Problem Solving"],
      },
      {
        slot: "wrong_domain",
        skills: ["Elementary Teaching", "Lesson Planning", "Teaching License"],
      },
      {
        slot: "bonus",
        skills: ["Dispatch Coordination", "Fleet Management", "OSHA-10", "Shipping / Receiving"],
      },
    ],
  },
  {
    role: "trades",
    zip: "60618",
    candidates: [
      {
        slot: "top",
        skills: ["Electrical Systems", "Journeyman Electrician License", "Blueprint Reading", "OSHA-30", "Conduit Bending"],
      },
      {
        slot: "close",
        skills: ["Electrical Systems", "Blueprint Reading", "OSHA-30", "Conduit Bending"], // missing Journeyman License
      },
      {
        slot: "wrong_vertical",
        skills: ["Problem Solving", "Time Management", "Communication"],
      },
      {
        slot: "wrong_domain",
        skills: ["Data Entry", "Microsoft Excel", "Bookkeeping"],
      },
      {
        slot: "bonus",
        skills: ["HVAC Installation", "EPA 608 Certification", "Refrigeration Repair"],
      },
    ],
  },
  {
    role: "hospitality",
    zip: "60611",
    candidates: [
      {
        slot: "top",
        skills: ["Guest Services", "Food & Beverage", "Front Desk Operations", "Reservations Systems", "Concierge Skills"],
      },
      {
        slot: "close",
        skills: ["Guest Services", "Food & Beverage", "Front Desk Operations", "Reservations Systems"], // missing Concierge Skills
      },
      {
        slot: "wrong_vertical",
        skills: ["Customer Service", "Communication", "Time Management"],
      },
      {
        slot: "wrong_domain",
        skills: ["Software Engineering", "Python", "System Design"],
      },
      {
        slot: "bonus",
        skills: ["Housekeeping", "Room Turnover", "Laundry Handling", "Guest Services"],
      },
    ],
  },
];

async function main() {
  console.log("Seeding Round 8 multi-role test cohort…\n");
  let created = 0;
  let skipped = 0;
  for (const seed of SEEDS) {
    for (const c of seed.candidates) {
      const handle = `test_r8_${seed.role}_${c.slot}_${seed.zip}`;
      const existing = await prisma.user.findUnique({
        where: { anonymousHandle: handle },
      });
      if (existing) {
        console.log(`  [skip] ${handle}`);
        skipped++;
        continue;
      }
      const user = await prisma.user.create({
        data: {
          anonymousHandle: handle,
          zipCode: seed.zip,
          profileComplete: true,
        },
      });
      await prisma.userSkill.createMany({
        data: c.skills.map((s) => ({
          userId: user.id,
          rawInput: s,
          normalizedTerm: s,
          category: "other",
          proficiencyLevel: "intermediate",
        })),
      });
      console.log(`  [ok]   ${handle} (${c.skills.length} skills)`);
      created++;
    }
  }
  console.log(`\nDone. Created ${created} users, skipped ${skipped}.`);
  console.log("Query with: SELECT anonymousHandle FROM \"User\" WHERE anonymousHandle LIKE 'test_r8_%';");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
