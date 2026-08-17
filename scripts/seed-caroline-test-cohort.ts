/**
 * Caroline 7/28 Round 7 request: controlled ZIP-code test.
 *
 *   PayRanker: ~10 test jobseekers with Home Health / Senior Care skills,
 *              all labeled "(test)" and pinned to Edgewater (ZIP 60660).
 *   Skilmatch: 3 test job postings from a hypothetical Home Health
 *              Agency in the same ZIP code:
 *                - Caregiver (test)
 *                - Home Health Aide (test)
 *                - In-Home Companion (test)
 *
 * Result should let us verify:
 *   1. Skilmatch job postings surface in PayRanker /api/jobs/match.
 *   2. PayRanker candidates surface in Skilmatch /api/candidates.
 *   3. Top Match vs Close Match categorization is correct.
 *
 * Run with:  npx tsx scripts/seed-caroline-test-cohort.ts
 * Repeatable — reads existing rows first and only inserts missing ones.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EDGEWATER = { city: "Chicago", zip: "60660", location: "Edgewater, Chicago, IL" };
const RECRUITER_EMAIL = "recruiter@edgewatertesthomecare.test";
const EMPLOYER_NAME = "Edgewater Home Care (test)";

const SKILMATCH_JOBS = [
  {
    title: "Caregiver (test)",
    payMinCents: 1700,
    payMaxCents: 2000,
    description: "Provide compassionate in-home care to seniors in the Edgewater area. Assist with daily living activities.",
    required: [
      "Personal Care Assistance",
      "Meal Preparation",
      "Companionship",
      "Mobility Assistance",
    ],
  },
  {
    title: "Home Health Aide (test)",
    payMinCents: 1900,
    payMaxCents: 2300,
    description: "Certified HHA needed for in-home elder care in Edgewater. Vital sign monitoring and medication reminders required.",
    required: [
      "Personal Care Assistance",
      "Vital Signs Monitoring",
      "HHA Certification",
      "Medication Reminders",
      "Companionship",
    ],
  },
  {
    title: "In-Home Companion (test)",
    payMinCents: 1600,
    payMaxCents: 1900,
    description: "Companion for elderly clients in Edgewater. Light housekeeping and meal prep.",
    required: [
      "Companionship",
      "Meal Preparation",
      "Light Housekeeping",
      "Transportation Assistance",
    ],
  },
];

/**
 * 10 PayRanker jobseekers with realistic HHA-adjacent baskets.
 * Skill overlap with Skilmatch jobs is intentional and varied:
 *   - #1-3: full match on Caregiver / In-Home Companion (Top Matches)
 *   - #4-6: 4/5 match on Home Health Aide (Close Matches — missing HHA cert or Vitals)
 *   - #7-10: partial matches across multiple postings
 */
const PAYRANKER_USERS = [
  {
    handle: "test_anna_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Personal Care Assistance",
      "Meal Preparation",
      "Companionship",
      "Mobility Assistance",
      "Light Housekeeping",
    ],
  },
  {
    handle: "test_bob_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Personal Care Assistance",
      "Vital Signs Monitoring",
      "HHA Certification",
      "Medication Reminders",
      "Companionship",
    ],
  },
  {
    handle: "test_carol_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Personal Care Assistance",
      "Vital Signs Monitoring",
      "Medication Reminders",
      "Mobility Assistance",
      "Meal Preparation",
    ],
  },
  {
    handle: "test_dan_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Personal Care Assistance",
      "Vital Signs Monitoring",
      "Medication Reminders",
      "Companionship",
      // missing HHA Certification → Close Match on HHA posting
    ],
  },
  {
    handle: "test_eve_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Personal Care Assistance",
      "HHA Certification",
      "Medication Reminders",
      "Companionship",
      // missing Vital Signs Monitoring → Close Match
    ],
  },
  {
    handle: "test_faith_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Personal Care Assistance",
      "Vital Signs Monitoring",
      "HHA Certification",
      "Meal Preparation",
      // missing Medication Reminders + Companionship → Close Match
    ],
  },
  {
    handle: "test_gina_60640",
    zip: "60640", // second Edgewater ZIP
    skills: [
      "Companionship",
      "Meal Preparation",
      "Light Housekeeping",
      "Transportation Assistance",
    ],
  },
  {
    handle: "test_hank_60640",
    zip: "60640",
    skills: [
      "Personal Care Assistance",
      "Meal Preparation",
      "Companionship",
      "Mobility Assistance",
    ],
  },
  {
    handle: "test_iris_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Companionship",
      "Meal Preparation",
      "Transportation Assistance",
      "Light Housekeeping",
    ],
  },
  {
    handle: "test_jose_60660",
    zip: EDGEWATER.zip,
    skills: [
      "Personal Care Assistance",
      "Vital Signs Monitoring",
      "HHA Certification",
      "Medication Reminders",
      "Companionship",
      "Meal Preparation",
      "Mobility Assistance",
    ],
  },
];

async function main() {
  console.log("Seeding Caroline test cohort into shared DB…\n");

  // ── 1) Skilmatch jobs ──
  for (const j of SKILMATCH_JOBS) {
    const existing = await prisma.job.findFirst({
      where: { title: j.title, recruiterEmail: RECRUITER_EMAIL },
    });
    if (existing) {
      console.log(`  [skip] Job "${j.title}" already exists (${existing.id})`);
      continue;
    }
    const created = await prisma.job.create({
      data: {
        title: j.title,
        employer: EMPLOYER_NAME,
        location: EDGEWATER.location,
        vertical: "healthcare",
        description: j.description,
        payMin: j.payMinCents,
        payMax: j.payMaxCents,
        payType: "hourly",
        shiftType: "full_time",
        isActive: true,
        recruiterEmail: RECRUITER_EMAIL,
        optionalSkills: [],
      },
    });
    await prisma.jobSkill.createMany({
      data: j.required.map((term) => ({
        jobId: created.id,
        normalizedTerm: term,
        proficiencyLevel: "intermediate",
        isRequired: true,
      })),
    });
    console.log(`  [ok]   Job "${j.title}" (${created.id}) → ${j.required.length} required skills`);
  }

  // ── 2) PayRanker jobseekers ──
  for (const u of PAYRANKER_USERS) {
    const existing = await prisma.user.findUnique({
      where: { anonymousHandle: u.handle },
    });
    if (existing) {
      console.log(`  [skip] User ${u.handle} already exists`);
      continue;
    }
    const user = await prisma.user.create({
      data: {
        anonymousHandle: u.handle,
        zipCode: u.zip,
        profileComplete: true,
      },
    });
    await prisma.userSkill.createMany({
      data: u.skills.map((s) => ({
        userId: user.id,
        rawInput: s,
        normalizedTerm: s,
        category: "healthcare",
        proficiencyLevel: "intermediate",
      })),
    });
    console.log(`  [ok]   User ${u.handle} (zip ${u.zip}) → ${u.skills.length} skills`);
  }

  console.log("\nDone. Verify via:");
  console.log("  1. PayRanker: /api/jobs/match with any test user's basket + Chicago metro");
  console.log("     → should surface Skilmatch DB jobs above (id starts with 'db_')");
  console.log(`  2. Skilmatch: /api/candidates?email=${RECRUITER_EMAIL}`);
  console.log(`     → should list the 10 test_* handles ranked by skill overlap`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
