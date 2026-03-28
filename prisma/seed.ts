import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding WorkPath database...\n");

  // =====================
  // 1. Clear existing data (FK-safe order)
  // =====================
  console.log("Clearing existing data...");
  await prisma.application.deleteMany();
  await prisma.jobSkill.deleteMany();
  await prisma.job.deleteMany();
  await prisma.upskillResource.deleteMany();
  await prisma.skillAlias.deleteMany();
  await prisma.userSkill.deleteMany();
  // Children first (self-referential FK), then parents
  await prisma.skillNode.deleteMany({ where: { parentId: { not: null } } });
  await prisma.skillNode.deleteMany();
  console.log("  Done.\n");

  // =====================
  // 2. Skill Graph Taxonomy
  // =====================
  const VERTICAL = "home_health_aide";

  // --- Parent nodes with their canonical children ---
  const parentDefs: {
    canonicalTerm: string;
    aiResistanceScore: number;
    children: { canonicalTerm: string; aiResistanceScore: number }[];
  }[] = [
    {
      canonicalTerm: "Caregiving",
      aiResistanceScore: 90,
      children: [
        { canonicalTerm: "Hygiene Assistance", aiResistanceScore: 92 },
        { canonicalTerm: "Mobility Assistance", aiResistanceScore: 90 },
        { canonicalTerm: "Medication Reminders", aiResistanceScore: 55 },
        { canonicalTerm: "Companionship", aiResistanceScore: 95 },
        { canonicalTerm: "Personal Care Assistance", aiResistanceScore: 88 },
      ],
    },
    {
      canonicalTerm: "Elderly Care",
      aiResistanceScore: 88,
      children: [
        { canonicalTerm: "Fall Prevention", aiResistanceScore: 85 },
        { canonicalTerm: "Dementia Care Awareness", aiResistanceScore: 90 },
        { canonicalTerm: "Transfer Assistance", aiResistanceScore: 88 },
        { canonicalTerm: "Vital Signs Monitoring", aiResistanceScore: 55 },
        { canonicalTerm: "Incontinence Care", aiResistanceScore: 87 },
      ],
    },
    {
      canonicalTerm: "Home Management",
      aiResistanceScore: 70,
      children: [
        { canonicalTerm: "Light Housekeeping", aiResistanceScore: 60 },
        { canonicalTerm: "Meal Preparation", aiResistanceScore: 65 },
        { canonicalTerm: "Grocery Shopping", aiResistanceScore: 55 },
        { canonicalTerm: "Laundry", aiResistanceScore: 50 },
        { canonicalTerm: "Errands", aiResistanceScore: 60 },
      ],
    },
    {
      canonicalTerm: "Health Monitoring",
      aiResistanceScore: 55,
      children: [
        // Note: Vital Signs Monitoring is already created under Elderly Care — skip duplicate
        { canonicalTerm: "Blood Pressure Monitoring", aiResistanceScore: 50 },
        { canonicalTerm: "Blood Glucose Monitoring", aiResistanceScore: 50 },
        { canonicalTerm: "Medication Administration", aiResistanceScore: 60 },
        { canonicalTerm: "Wound Care Basics", aiResistanceScore: 58 },
      ],
    },
    {
      canonicalTerm: "Transport",
      aiResistanceScore: 75,
      children: [
        { canonicalTerm: "Non-Emergency Medical Transport", aiResistanceScore: 75 },
        { canonicalTerm: "Wheelchair Van Operation", aiResistanceScore: 78 },
        { canonicalTerm: "Appointment Accompaniment", aiResistanceScore: 80 },
      ],
    },
  ];

  // --- Micro-skill canonical nodes with micro children ---
  const microDefs: {
    canonicalTerm: string;
    aiResistanceScore: number;
    children: { canonicalTerm: string; aiResistanceScore: number }[];
  }[] = [
    {
      canonicalTerm: "CPR",
      aiResistanceScore: 90,
      children: [
        { canonicalTerm: "CPR: Adult", aiResistanceScore: 90 },
        { canonicalTerm: "CPR: Pediatric", aiResistanceScore: 90 },
        { canonicalTerm: "CPR/AED Certified", aiResistanceScore: 90 },
      ],
    },
    {
      canonicalTerm: "Driving",
      aiResistanceScore: 75,
      children: [
        { canonicalTerm: "Driving: Personal Vehicle", aiResistanceScore: 75 },
        { canonicalTerm: "Driving: Wheelchair Van", aiResistanceScore: 78 },
        { canonicalTerm: "Driving: CDL Class B", aiResistanceScore: 80 },
      ],
    },
    {
      canonicalTerm: "Documentation",
      aiResistanceScore: 40,
      children: [
        { canonicalTerm: "Care Plan Documentation", aiResistanceScore: 40 },
        { canonicalTerm: "HIPAA-Compliant Record Keeping", aiResistanceScore: 45 },
        { canonicalTerm: "Incident Reporting", aiResistanceScore: 42 },
        { canonicalTerm: "Shift Handoff Notes", aiResistanceScore: 38 },
      ],
    },
  ];

  // Standalone canonical node referenced by alias
  const standaloneCanonicals = [
    { canonicalTerm: "First Aid", aiResistanceScore: 88 },
  ];

  // Track canonicalTerm -> SkillNode id
  const nodeMap = new Map<string, string>();

  // Create parent nodes first
  console.log("Creating parent skill nodes...");
  for (const p of parentDefs) {
    const node = await prisma.skillNode.create({
      data: {
        canonicalTerm: p.canonicalTerm,
        vertical: VERTICAL,
        layer: "parent",
        aiResistanceScore: p.aiResistanceScore,
      },
    });
    nodeMap.set(p.canonicalTerm, node.id);
  }

  // Create canonical children under parents
  console.log("Creating canonical skill nodes (under parents)...");
  for (const p of parentDefs) {
    const parentId = nodeMap.get(p.canonicalTerm)!;
    for (const c of p.children) {
      // Skip if already created (e.g. Vital Signs Monitoring appears under both Elderly Care and Health Monitoring)
      if (nodeMap.has(c.canonicalTerm)) continue;
      const node = await prisma.skillNode.create({
        data: {
          canonicalTerm: c.canonicalTerm,
          vertical: VERTICAL,
          layer: "canonical",
          aiResistanceScore: c.aiResistanceScore,
          parentId,
        },
      });
      nodeMap.set(c.canonicalTerm, node.id);
    }
  }

  // Create micro-skill canonical root nodes
  console.log("Creating micro-skill root nodes...");
  for (const m of microDefs) {
    const node = await prisma.skillNode.create({
      data: {
        canonicalTerm: m.canonicalTerm,
        vertical: VERTICAL,
        layer: "canonical",
        aiResistanceScore: m.aiResistanceScore,
      },
    });
    nodeMap.set(m.canonicalTerm, node.id);
  }

  // Create micro children
  console.log("Creating micro-skill children...");
  for (const m of microDefs) {
    const parentId = nodeMap.get(m.canonicalTerm)!;
    for (const c of m.children) {
      const node = await prisma.skillNode.create({
        data: {
          canonicalTerm: c.canonicalTerm,
          vertical: VERTICAL,
          layer: "micro",
          aiResistanceScore: c.aiResistanceScore,
          parentId,
        },
      });
      nodeMap.set(c.canonicalTerm, node.id);
    }
  }

  // Create standalone canonical nodes
  console.log("Creating standalone canonical nodes...");
  for (const s of standaloneCanonicals) {
    const node = await prisma.skillNode.create({
      data: {
        canonicalTerm: s.canonicalTerm,
        vertical: VERTICAL,
        layer: "canonical",
        aiResistanceScore: s.aiResistanceScore,
      },
    });
    nodeMap.set(s.canonicalTerm, node.id);
  }

  const skillNodeCount = await prisma.skillNode.count();
  console.log(`  Created ${skillNodeCount} skill nodes.\n`);

  // =====================
  // 3. Skill Aliases
  // =====================
  console.log("Creating skill aliases...");
  const aliasDefs: { rawTerm: string; canonicalTerm: string }[] = [
    { rawTerm: "cooking", canonicalTerm: "Meal Preparation" },
    { rawTerm: "helping old people", canonicalTerm: "Personal Care Assistance" },
    { rawTerm: "cleaning", canonicalTerm: "Light Housekeeping" },
    { rawTerm: "bathing", canonicalTerm: "Hygiene Assistance" },
    { rawTerm: "helping someone walk", canonicalTerm: "Mobility Assistance" },
    { rawTerm: "giving medicine", canonicalTerm: "Medication Reminders" },
    { rawTerm: "keeping company", canonicalTerm: "Companionship" },
    { rawTerm: "checking blood pressure", canonicalTerm: "Blood Pressure Monitoring" },
    { rawTerm: "driving patients", canonicalTerm: "Non-Emergency Medical Transport" },
    { rawTerm: "preventing falls", canonicalTerm: "Fall Prevention" },
    { rawTerm: "memory care", canonicalTerm: "Dementia Care Awareness" },
    { rawTerm: "lifting patients", canonicalTerm: "Transfer Assistance" },
    { rawTerm: "making food", canonicalTerm: "Meal Preparation" },
    { rawTerm: "housework", canonicalTerm: "Light Housekeeping" },
    { rawTerm: "taking care of people", canonicalTerm: "Personal Care Assistance" },
    { rawTerm: "first aid", canonicalTerm: "First Aid" },
    { rawTerm: "cpr", canonicalTerm: "CPR" },
  ];

  for (const a of aliasDefs) {
    const skillNodeId = nodeMap.get(a.canonicalTerm);
    if (!skillNodeId) {
      console.warn(`  WARNING: No SkillNode found for alias target "${a.canonicalTerm}"`);
      continue;
    }
    await prisma.skillAlias.create({
      data: {
        rawTerm: a.rawTerm,
        skillNodeId,
      },
    });
  }

  const aliasCount = await prisma.skillAlias.count();
  console.log(`  Created ${aliasCount} skill aliases.\n`);

  // =====================
  // 4. Jobs (12 Chicago HHA listings)
  // =====================
  console.log("Creating job listings...");

  type JobDef = {
    title: string;
    employer: string;
    location: string;
    description: string;
    payMin: number;
    payMax: number;
    shiftType: string;
    requiredSkills: { term: string; proficiency: string }[];
    optionalSkills?: { term: string; proficiency: string }[];
  };

  const jobDefs: JobDef[] = [
    {
      title: "Companion / Sitter",
      employer: "Comfort Keepers Chicago",
      location: "Chicago, IL 60614",
      description:
        "Provide companionship and light support to elderly clients in Lincoln Park and surrounding neighborhoods. Engage clients in conversation, activities, and ensure their safety and well-being during your shift.",
      payMin: 1700,
      payMax: 1900,
      shiftType: "part_time",
      requiredSkills: [
        { term: "Companionship", proficiency: "intermediate" },
        { term: "Light Housekeeping", proficiency: "beginner" },
      ],
    },
    {
      title: "Meal Prep Helper",
      employer: "Home Instead Senior Care",
      location: "Chicago, IL 60657",
      description:
        "Prepare nutritious meals for senior clients following dietary guidelines. Manage grocery lists, accommodate dietary restrictions, and maintain a clean kitchen environment in the Lakeview area.",
      payMin: 1600,
      payMax: 1800,
      shiftType: "part_time",
      requiredSkills: [
        { term: "Meal Preparation", proficiency: "intermediate" },
        { term: "Grocery Shopping", proficiency: "beginner" },
      ],
    },
    {
      title: "Home Health Companion",
      employer: "Addus HomeCare",
      location: "Chicago, IL 60623",
      description:
        "Support clients in the Lawndale community with daily living activities, companionship, and light housekeeping. Monitor client well-being and report any changes to the care coordinator.",
      payMin: 1800,
      payMax: 2100,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Companionship", proficiency: "intermediate" },
        { term: "Light Housekeeping", proficiency: "intermediate" },
        { term: "Meal Preparation", proficiency: "beginner" },
      ],
    },
    {
      title: "Personal Care Aide",
      employer: "BrightSpring Health Services",
      location: "Chicago, IL 60629",
      description:
        "Assist clients in Chicago Lawn with personal hygiene, dressing, mobility, and medication reminders. Maintain care documentation and communicate with the nursing team about client status.",
      payMin: 2000,
      payMax: 2300,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Personal Care Assistance", proficiency: "intermediate" },
        { term: "Hygiene Assistance", proficiency: "intermediate" },
        { term: "Mobility Assistance", proficiency: "intermediate" },
        { term: "Medication Reminders", proficiency: "beginner" },
      ],
    },
    {
      title: "Home Health Aide - Certified",
      employer: "Amedisys Home Health",
      location: "Chicago, IL 60640",
      description:
        "Provide comprehensive home health aide services in Uptown. Perform personal care, vital signs monitoring, mobility assistance, and maintain accurate care documentation. Must have valid HHA certification.",
      payMin: 2100,
      payMax: 2400,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Personal Care Assistance", proficiency: "advanced" },
        { term: "Vital Signs Monitoring", proficiency: "intermediate" },
        { term: "Mobility Assistance", proficiency: "intermediate" },
        { term: "Hygiene Assistance", proficiency: "advanced" },
        { term: "Care Plan Documentation", proficiency: "intermediate" },
      ],
    },
    {
      title: "Senior Care Specialist",
      employer: "Sunrise Senior Living",
      location: "Chicago, IL 60611",
      description:
        "Deliver specialized elder care in the Gold Coast area. Handle dementia care protocols, fall prevention, medication administration, and incontinence care. Previous senior care experience required.",
      payMin: 2200,
      payMax: 2600,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Dementia Care Awareness", proficiency: "advanced" },
        { term: "Fall Prevention", proficiency: "intermediate" },
        { term: "Medication Administration", proficiency: "intermediate" },
        { term: "Incontinence Care", proficiency: "intermediate" },
        { term: "Transfer Assistance", proficiency: "intermediate" },
      ],
    },
    {
      title: "Live-In Home Health Aide",
      employer: "Visiting Angels Chicago",
      location: "Chicago, IL 60615",
      description:
        "Provide 24-hour live-in care for elderly client in Hyde Park. Duties include personal care, meal preparation, medication management, light housekeeping, and companionship. Private room provided.",
      payMin: 2300,
      payMax: 2700,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Personal Care Assistance", proficiency: "advanced" },
        { term: "Meal Preparation", proficiency: "intermediate" },
        { term: "Medication Reminders", proficiency: "intermediate" },
        { term: "Light Housekeeping", proficiency: "intermediate" },
        { term: "Companionship", proficiency: "advanced" },
      ],
    },
    {
      title: "Pediatric Home Care Aide",
      employer: "Pediatric Home Service Chicago",
      location: "Chicago, IL 60618",
      description:
        "Provide in-home care for pediatric patients in the Avondale area. Assist with daily activities, medication administration, vital signs, and engage children in developmental activities. CPR certification required.",
      payMin: 2000,
      payMax: 2300,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Personal Care Assistance", proficiency: "intermediate" },
        { term: "Medication Administration", proficiency: "intermediate" },
        { term: "CPR", proficiency: "advanced" },
        { term: "Vital Signs Monitoring", proficiency: "intermediate" },
      ],
    },
    {
      title: "Weekend Home Health Aide",
      employer: "AccordantHealth Chicago",
      location: "Chicago, IL 60647",
      description:
        "Provide weekend home health aide services in Logan Square. Assist clients with personal care, mobility, and companionship. Ideal for students or those seeking supplemental income.",
      payMin: 1900,
      payMax: 2200,
      shiftType: "per_diem",
      requiredSkills: [
        { term: "Personal Care Assistance", proficiency: "intermediate" },
        { term: "Mobility Assistance", proficiency: "intermediate" },
        { term: "Companionship", proficiency: "beginner" },
      ],
    },
    {
      title: "Rehab Support Aide",
      employer: "Kindred at Home Chicago",
      location: "Chicago, IL 60608",
      description:
        "Support post-surgical and rehabilitation patients in Pilsen. Assist with mobility exercises, transfer techniques, wound care basics, and vital signs monitoring under RN supervision.",
      payMin: 2100,
      payMax: 2500,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Transfer Assistance", proficiency: "advanced" },
        { term: "Mobility Assistance", proficiency: "advanced" },
        { term: "Wound Care Basics", proficiency: "intermediate" },
        { term: "Vital Signs Monitoring", proficiency: "intermediate" },
      ],
    },
    {
      title: "Transport Companion",
      employer: "MedTransGo Chicago",
      location: "Chicago, IL 60622",
      description:
        "Drive clients to medical appointments in Wicker Park and surrounding areas. Provide companionship during transit and waiting periods. Must have clean driving record and reliable vehicle.",
      payMin: 1800,
      payMax: 2000,
      shiftType: "part_time",
      requiredSkills: [
        { term: "Non-Emergency Medical Transport", proficiency: "intermediate" },
        { term: "Appointment Accompaniment", proficiency: "beginner" },
      ],
      optionalSkills: [
        { term: "Wheelchair Van Operation", proficiency: "beginner" },
      ],
    },
    {
      title: "Memory Care Specialist",
      employer: "Alzheimer's Home Care Chicago",
      location: "Chicago, IL 60625",
      description:
        "Specialized memory care for Alzheimer's and dementia patients in Albany Park. Implement cognitive engagement activities, manage behavioral changes, ensure safety, and coordinate with care teams. Experience with dementia patients required.",
      payMin: 2400,
      payMax: 2800,
      shiftType: "full_time",
      requiredSkills: [
        { term: "Dementia Care Awareness", proficiency: "advanced" },
        { term: "Companionship", proficiency: "advanced" },
        { term: "Fall Prevention", proficiency: "intermediate" },
        { term: "Personal Care Assistance", proficiency: "advanced" },
        { term: "Incident Reporting", proficiency: "intermediate" },
      ],
    },
  ];

  for (const j of jobDefs) {
    const allSkills = [
      ...j.requiredSkills.map((s) => ({ ...s, isRequired: true })),
      ...(j.optionalSkills || []).map((s) => ({ ...s, isRequired: false })),
    ];

    await prisma.job.create({
      data: {
        title: j.title,
        employer: j.employer,
        location: j.location,
        vertical: VERTICAL,
        description: j.description,
        payMin: j.payMin,
        payMax: j.payMax,
        payType: "hourly",
        shiftType: j.shiftType,
        isActive: true,
        isAIReplaceable: false,
        requiredSkills: {
          create: allSkills.map((s) => ({
            normalizedTerm: s.term,
            proficiencyLevel: s.proficiency,
            isRequired: s.isRequired,
          })),
        },
      },
    });
  }

  const jobCount = await prisma.job.count();
  const jobSkillCount = await prisma.jobSkill.count();
  console.log(`  Created ${jobCount} jobs with ${jobSkillCount} job-skill links.\n`);

  // =====================
  // 5. Upskill Resources (20 resources for 15+ skills)
  // =====================
  console.log("Creating upskill resources...");

  const resources: {
    skillTerm: string;
    title: string;
    provider: string;
    url: string;
    isFree: boolean;
    durationHrs: number | null;
  }[] = [
    {
      skillTerm: "CPR",
      title: "Adult & Pediatric First Aid/CPR/AED Online",
      provider: "American Red Cross",
      url: "https://www.redcross.org/take-a-class/cpr/cpr-training/cpr-online",
      isFree: false,
      durationHrs: 4,
    },
    {
      skillTerm: "CPR",
      title: "Hands-Only CPR Training",
      provider: "American Heart Association",
      url: "https://www.heart.org/en/cpr",
      isFree: true,
      durationHrs: 0.5,
    },
    {
      skillTerm: "First Aid",
      title: "First Aid Certification Course",
      provider: "American Red Cross",
      url: "https://www.redcross.org/take-a-class/first-aid",
      isFree: false,
      durationHrs: 8,
    },
    {
      skillTerm: "Dementia Care Awareness",
      title: "Understanding Alzheimer's and Dementia",
      provider: "Alzheimer's Association",
      url: "https://training.alz.org/products/4001/understanding-alzheimers-and-dementia",
      isFree: true,
      durationHrs: 3,
    },
    {
      skillTerm: "Dementia Care Awareness",
      title: "Dementia Care Training for Home Health Aides",
      provider: "CareAcademy",
      url: "https://www.careacademy.com/dementia-care-training",
      isFree: false,
      durationHrs: 6,
    },
    {
      skillTerm: "Fall Prevention",
      title: "STEADI - Stopping Elderly Accidents, Deaths & Injuries",
      provider: "CDC",
      url: "https://www.cdc.gov/steadi/",
      isFree: true,
      durationHrs: 2,
    },
    {
      skillTerm: "Vital Signs Monitoring",
      title: "How to Take Vital Signs - Health & Medicine",
      provider: "Khan Academy",
      url: "https://www.khanacademy.org/science/health-and-medicine",
      isFree: true,
      durationHrs: 1.5,
    },
    {
      skillTerm: "Blood Pressure Monitoring",
      title: "How to Measure Blood Pressure Accurately",
      provider: "YouTube - Nursing Education",
      url: "https://www.youtube.com/results?search_query=how+to+measure+blood+pressure+accurately",
      isFree: true,
      durationHrs: 0.5,
    },
    {
      skillTerm: "Medication Administration",
      title: "Medication Administration for Home Health Aides",
      provider: "CareAcademy",
      url: "https://www.careacademy.com/medication-administration",
      isFree: false,
      durationHrs: 4,
    },
    {
      skillTerm: "Hygiene Assistance",
      title: "Personal Care & Hygiene Assistance Training",
      provider: "CareAcademy",
      url: "https://www.careacademy.com/personal-care-training",
      isFree: false,
      durationHrs: 3,
    },
    {
      skillTerm: "Mobility Assistance",
      title: "Safe Patient Handling & Mobility Training",
      provider: "American Red Cross",
      url: "https://www.redcross.org/take-a-class/nurse-assistant-training",
      isFree: false,
      durationHrs: 6,
    },
    {
      skillTerm: "Transfer Assistance",
      title: "Patient Transfer Techniques for Caregivers",
      provider: "YouTube - CNA Training",
      url: "https://www.youtube.com/results?search_query=patient+transfer+techniques+CNA",
      isFree: true,
      durationHrs: 1,
    },
    {
      skillTerm: "Wound Care Basics",
      title: "Basic Wound Care for Home Health Workers",
      provider: "CareAcademy",
      url: "https://www.careacademy.com/wound-care-basics",
      isFree: false,
      durationHrs: 3,
    },
    {
      skillTerm: "Care Plan Documentation",
      title: "Documenting Patient Care: Best Practices",
      provider: "CareAcademy",
      url: "https://www.careacademy.com/care-plan-documentation",
      isFree: false,
      durationHrs: 2,
    },
    {
      skillTerm: "HIPAA-Compliant Record Keeping",
      title: "HIPAA Training for Healthcare Workers",
      provider: "CDC",
      url: "https://www.hhs.gov/hipaa/for-professionals/training",
      isFree: true,
      durationHrs: 2,
    },
    {
      skillTerm: "Incontinence Care",
      title: "Incontinence Care Training for Home Aides",
      provider: "CareAcademy",
      url: "https://www.careacademy.com/incontinence-care",
      isFree: false,
      durationHrs: 2,
    },
    {
      skillTerm: "Meal Preparation",
      title: "Nutrition & Meal Planning for Seniors",
      provider: "Khan Academy",
      url: "https://www.khanacademy.org/science/health-and-medicine/nutrition",
      isFree: true,
      durationHrs: 2,
    },
    {
      skillTerm: "Companionship",
      title: "Building Meaningful Connections with Clients",
      provider: "Alzheimer's Association",
      url: "https://training.alz.org/products/4005/effective-communication",
      isFree: true,
      durationHrs: 1.5,
    },
    {
      skillTerm: "Non-Emergency Medical Transport",
      title: "Non-Emergency Medical Transport Driver Training",
      provider: "National Safety Council",
      url: "https://www.nsc.org/safety-training/driver-safety",
      isFree: false,
      durationHrs: 8,
    },
    {
      skillTerm: "Blood Glucose Monitoring",
      title: "Diabetes Care: Blood Glucose Monitoring",
      provider: "CDC",
      url: "https://www.cdc.gov/diabetes/managing/manage-blood-sugar.html",
      isFree: true,
      durationHrs: 1,
    },
  ];

  for (const r of resources) {
    await prisma.upskillResource.create({
      data: {
        skillTerm: r.skillTerm,
        title: r.title,
        provider: r.provider,
        url: r.url,
        isFree: r.isFree,
        durationHrs: r.durationHrs,
        vertical: VERTICAL,
      },
    });
  }

  const resourceCount = await prisma.upskillResource.count();
  console.log(`  Created ${resourceCount} upskill resources.\n`);

  // =====================
  // Summary
  // =====================
  console.log("=== Seed Summary ===");
  console.log(`  Skill Nodes:       ${skillNodeCount}`);
  console.log(`  Skill Aliases:     ${aliasCount}`);
  console.log(`  Jobs:              ${jobCount}`);
  console.log(`  Job Skills:        ${jobSkillCount}`);
  console.log(`  Upskill Resources: ${resourceCount}`);
  console.log("\nSeeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
