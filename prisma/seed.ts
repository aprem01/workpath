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
  // 6. Tech vertical jobs (so non-HHA users see relevant results)
  // =====================
  console.log("Creating tech vertical jobs...");

  const techJobs = [
    {
      title: "Junior Python Developer",
      employer: "DataTech Solutions",
      location: "Chicago, IL (Remote)",
      vertical: "tech",
      description: "Build data pipelines and automation scripts. Work with a senior team on ETL processes, API integrations, and internal tools. Great entry point for career changers with Python basics.",
      payMin: 3500, payMax: 4500, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Python Programming", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "SQL", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Version Control (Git)", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "API Integration", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Data Analyst",
      employer: "Midwest Analytics Corp",
      location: "Chicago, IL",
      vertical: "tech",
      description: "Analyze business data, create dashboards, and present insights to stakeholders. SQL and Excel required, Python a plus.",
      payMin: 3200, payMax: 4200, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "SQL", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Data Analysis", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Excel / Spreadsheets", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Python Programming", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "Business Intelligence", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Frontend Developer",
      employer: "StartupHub Chicago",
      location: "Chicago, IL (Hybrid)",
      vertical: "tech",
      description: "Build responsive web interfaces using React and TypeScript. Collaborate with designers on user-facing features. Fast-paced startup environment.",
      payMin: 4000, payMax: 5500, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "JavaScript", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "React", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "TypeScript", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "CSS / Tailwind", proficiencyLevel: "intermediate", isRequired: false },
        { normalizedTerm: "Version Control (Git)", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "QA / Test Engineer",
      employer: "Reliable Software Inc",
      location: "Chicago, IL (Remote)",
      vertical: "tech",
      description: "Write and maintain automated tests. Manual and automated testing of web applications. Great for detail-oriented people transitioning into tech.",
      payMin: 3000, payMax: 4000, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Quality Assurance Testing", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Python Programming", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "SQL", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "API Integration", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "IT Support Specialist",
      employer: "CityTech Services",
      location: "Chicago, IL",
      vertical: "tech",
      description: "Provide technical support to office staff. Troubleshoot hardware, software, and network issues. No degree required — certifications valued.",
      payMin: 2200, payMax: 2800, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Technical Troubleshooting", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Customer Service", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Networking Basics", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "Documentation", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "DevOps Engineer",
      employer: "CloudFirst Chicago",
      location: "Chicago, IL (Remote)",
      vertical: "tech",
      description: "Manage CI/CD pipelines, cloud infrastructure, and deployment automation. AWS or GCP experience required.",
      payMin: 5500, payMax: 7500, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "DevOps Engineering", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Cloud Infrastructure Design", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Python Programming", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Version Control (Git)", proficiencyLevel: "intermediate", isRequired: false },
        { normalizedTerm: "Cybersecurity Analysis", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Project Manager — Tech",
      employer: "Agile Works LLC",
      location: "Chicago, IL (Hybrid)",
      vertical: "tech",
      description: "Lead cross-functional engineering teams. Manage sprint planning, stakeholder communication, and delivery timelines. PMP or Scrum certification preferred.",
      payMin: 5000, payMax: 6500, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Project Management", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Technical Team Leadership", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Client Requirements Analysis", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Product Management", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Cybersecurity Analyst",
      employer: "SecureNet Chicago",
      location: "Chicago, IL",
      vertical: "tech",
      description: "Monitor security systems, investigate incidents, and implement security controls. Entry level — training provided for strong analytical thinkers.",
      payMin: 4000, payMax: 5000, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Cybersecurity Analysis", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Networking Basics", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Technical Troubleshooting", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "Documentation", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
  ];

  for (const { skills: jobSkills, ...jobData } of techJobs) {
    await prisma.job.create({
      data: { ...jobData, requiredSkills: { create: jobSkills } },
    });
  }

  const techJobCount = await prisma.job.count({ where: { vertical: "tech" } });
  console.log(`  Created ${techJobCount} tech jobs.\n`);

  // =====================
  // 7. Trades vertical jobs
  // =====================
  console.log("Creating trades vertical jobs...");

  const tradesJobs = [
    {
      title: "Electrician Apprentice",
      employer: "Windy City Electric",
      location: "Chicago, IL 60616",
      vertical: "trades",
      description: "Join our apprenticeship program and learn commercial and residential electrical work under licensed journeymen. You will assist with wiring installations, panel upgrades, and troubleshooting while studying for your state license. No prior experience required — strong work ethic and willingness to learn are essential.",
      payMin: 2200, payMax: 2800, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Electrical Wiring", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Safety Compliance", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Blueprint Reading", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "HVAC Technician",
      employer: "Midwest Climate Control",
      location: "Chicago, IL 60618",
      vertical: "trades",
      description: "Install, maintain, and repair heating, ventilation, and air conditioning systems in residential and light commercial buildings across the Chicagoland area. Diagnose system malfunctions, perform refrigerant recovery, and ensure all work meets local code requirements. EPA 608 certification preferred.",
      payMin: 2400, payMax: 3200, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "HVAC Systems", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Refrigeration", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Troubleshooting", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Plumber Helper",
      employer: "Reliable Plumbing Chicago",
      location: "Chicago, IL 60609",
      vertical: "trades",
      description: "Assist licensed plumbers with residential service calls including drain cleaning, fixture installation, and basic pipe repair. Learn the trade on the job while providing excellent customer service. Must be comfortable working in tight spaces and lifting up to 50 lbs.",
      payMin: 1800, payMax: 2200, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Plumbing Basics", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Pipe Fitting", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Customer Service", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Welder",
      employer: "Lakefront Steel Fabricators",
      location: "Chicago, IL 60617",
      vertical: "trades",
      description: "Perform MIG and stick welding on structural steel and custom fabrication projects. Read blueprints and shop drawings, set up welding equipment, and inspect welds for quality. AWS certification is a plus. Steady overtime available.",
      payMin: 2500, payMax: 3500, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "MIG Welding", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Blueprint Reading", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Metal Fabrication", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Carpenter",
      employer: "Prairie Construction Group",
      location: "Chicago, IL 60622",
      vertical: "trades",
      description: "Handle rough and finish carpentry on residential remodel and new construction projects throughout Chicago. Frame walls, install trim, hang doors, and build custom cabinetry. Must own basic hand tools and have reliable transportation.",
      payMin: 2200, payMax: 3000, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Framing", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Finish Carpentry", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Power Tool Operation", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Auto Mechanic",
      employer: "South Side Auto Works",
      location: "Chicago, IL 60620",
      vertical: "trades",
      description: "Diagnose and repair domestic and import vehicles in a busy independent shop. Perform brake jobs, engine diagnostics, suspension work, and routine maintenance. ASE certification preferred but not required — we value hands-on skill and reliability.",
      payMin: 2000, payMax: 2800, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Automotive Diagnostics", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Engine Repair", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Brake Systems", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Construction Laborer",
      employer: "Lakewood General Contractors",
      location: "Chicago, IL 60632",
      vertical: "trades",
      description: "Perform general labor on commercial construction sites including material handling, site cleanup, concrete work, and equipment operation. Follow all OSHA safety protocols. No experience necessary — on-the-job training provided for motivated individuals.",
      payMin: 1800, payMax: 2400, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Physical Stamina", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Safety Compliance", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Equipment Operation", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Solar Panel Installer",
      employer: "Great Lakes Solar Co.",
      location: "Chicago, IL 60641",
      vertical: "trades",
      description: "Install residential and commercial solar panel systems on rooftops across the Chicago metro area. Run conduit, wire inverters, and ensure proper panel orientation for maximum energy output. Must be comfortable working at heights and in varying weather conditions.",
      payMin: 2200, payMax: 3000, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Solar Panel Installation", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Electrical Wiring", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Roofing Safety", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
  ];

  for (const { skills: jobSkills, ...jobData } of tradesJobs) {
    await prisma.job.create({
      data: { ...jobData, requiredSkills: { create: jobSkills } },
    });
  }

  const tradesJobCount = await prisma.job.count({ where: { vertical: "trades" } });
  console.log(`  Created ${tradesJobCount} trades jobs.\n`);

  // =====================
  // 8. Admin/Office vertical jobs
  // =====================
  console.log("Creating admin/office vertical jobs...");

  const adminJobs = [
    {
      title: "Administrative Assistant",
      employer: "Loop Business Services",
      location: "Chicago, IL 60601",
      vertical: "admin_office",
      description: "Provide day-to-day administrative support for a busy downtown office. Manage calendars, coordinate meetings, handle correspondence, and maintain filing systems. Ideal for organized individuals who thrive in a fast-paced professional environment.",
      payMin: 1800, payMax: 2200, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Microsoft Office", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Scheduling", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Communication", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Receptionist",
      employer: "Lakeside Medical Group",
      location: "Chicago, IL 60657",
      vertical: "admin_office",
      description: "Greet patients and visitors, answer multi-line phones, schedule appointments, and manage front-desk operations for a busy medical practice. Friendly demeanor and attention to detail are essential. Both full-time and part-time shifts available.",
      payMin: 1600, payMax: 1900, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Customer Service", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Phone Etiquette", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Data Entry", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Bookkeeper",
      employer: "Northshore Accounting Partners",
      location: "Chicago, IL 60613",
      vertical: "admin_office",
      description: "Manage accounts payable and receivable, reconcile bank statements, process payroll, and prepare monthly financial reports for small business clients. QuickBooks proficiency required. CPA supervision provided — great stepping stone for accounting careers.",
      payMin: 2200, payMax: 2800, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "QuickBooks", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Accounts Payable/Receivable", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Excel / Spreadsheets", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Office Manager",
      employer: "West Loop Creative Agency",
      location: "Chicago, IL 60607",
      vertical: "admin_office",
      description: "Oversee daily office operations for a 40-person creative agency. Manage vendor relationships, coordinate team schedules, handle supply ordering, and support onboarding of new hires. Strong organizational and interpersonal skills required.",
      payMin: 2500, payMax: 3200, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Office Management", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Scheduling", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Microsoft Office", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Team Coordination", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Data Entry Clerk",
      employer: "Precision Data Services",
      location: "Chicago, IL 60604",
      vertical: "admin_office",
      description: "Enter and verify data from paper and digital sources into company databases. Maintain accuracy standards of 99%+ while meeting daily volume targets. Flexible part-time hours — ideal for students or as a second job.",
      payMin: 1600, payMax: 2000, payType: "hourly", shiftType: "part_time",
      skills: [
        { normalizedTerm: "Data Entry", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Typing Speed", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Attention to Detail", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "HR Coordinator",
      employer: "Chicago Staffing Solutions",
      location: "Chicago, IL 60606",
      vertical: "admin_office",
      description: "Support the human resources team with new hire onboarding, benefits administration, employee records management, and compliance tracking. Assist with recruiting events and employee engagement initiatives. Knowledge of employment law basics preferred.",
      payMin: 2400, payMax: 3000, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Human Resources", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Onboarding", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Employment Law Basics", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Communication", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
  ];

  for (const { skills: jobSkills, ...jobData } of adminJobs) {
    await prisma.job.create({
      data: { ...jobData, requiredSkills: { create: jobSkills } },
    });
  }

  const adminJobCount = await prisma.job.count({ where: { vertical: "admin_office" } });
  console.log(`  Created ${adminJobCount} admin/office jobs.\n`);

  // =====================
  // 9. Food Service vertical jobs
  // =====================
  console.log("Creating food service vertical jobs...");

  const foodJobs = [
    {
      title: "Line Cook",
      employer: "The Publican Restaurant",
      location: "Chicago, IL 60607",
      vertical: "food_service",
      description: "Prepare dishes according to recipes and chef instructions on a fast-paced kitchen line. Handle prep work, maintain station cleanliness, and follow all food safety protocols. Prior kitchen experience helpful but not required — we train the right attitude.",
      payMin: 1600, payMax: 2000, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Meal Preparation", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Food Safety and Sanitation", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Kitchen Equipment Operation", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Restaurant Server",
      employer: "Frontera Grill",
      location: "Chicago, IL 60654",
      vertical: "food_service",
      description: "Deliver an outstanding dining experience to guests in a high-volume restaurant. Take orders, serve food and beverages, handle payments, and ensure guest satisfaction. Earning potential of $14-18/hr base plus tips. Evening and weekend availability required.",
      payMin: 1400, payMax: 1800, payType: "hourly", shiftType: "part_time",
      skills: [
        { normalizedTerm: "Customer Service", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Food Service", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Communication", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Multitasking", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Catering Assistant",
      employer: "Entertaining Company Chicago",
      location: "Chicago, IL 60611",
      vertical: "food_service",
      description: "Assist with food preparation, event setup, and service for corporate and private catering events throughout the Chicago metro area. Work varies from intimate dinners to large-scale galas. Flexible per-diem schedule — pick the events that fit your availability.",
      payMin: 1700, payMax: 2100, payType: "hourly", shiftType: "per_diem",
      skills: [
        { normalizedTerm: "Meal Preparation", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Event Setup", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Food Safety and Sanitation", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Kitchen Manager",
      employer: "Big Star Wicker Park",
      location: "Chicago, IL 60622",
      vertical: "food_service",
      description: "Oversee all kitchen operations including staff scheduling, food ordering, inventory management, and quality control. Ensure health code compliance, manage food costs, and mentor junior cooks. At least two years of kitchen leadership experience required.",
      payMin: 2200, payMax: 2800, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Kitchen Management", proficiencyLevel: "advanced", isRequired: true },
        { normalizedTerm: "Inventory Control", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Staff Supervision", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Food Safety and Sanitation", proficiencyLevel: "advanced", isRequired: false },
      ],
    },
    {
      title: "Barista",
      employer: "Intelligentsia Coffee",
      location: "Chicago, IL 60614",
      vertical: "food_service",
      description: "Craft espresso drinks, pour-overs, and specialty beverages in a high-traffic specialty coffee shop. Provide friendly customer service, maintain a clean workspace, and handle cash and card transactions. Coffee knowledge a plus but full training provided.",
      payMin: 1500, payMax: 1800, payType: "hourly", shiftType: "part_time",
      skills: [
        { normalizedTerm: "Beverage Preparation", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Customer Service", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Cash Handling", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Food Truck Operator",
      employer: "Chi-Town Bites Mobile",
      location: "Chicago, IL 60608",
      vertical: "food_service",
      description: "Run daily food truck operations including food preparation, customer service, cash handling, and driving the truck to designated locations. Manage inventory, maintain health department standards, and build a loyal customer base. Must have a valid driver's license and clean driving record.",
      payMin: 2000, payMax: 2600, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Meal Preparation", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Customer Service", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Cash Handling", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Vehicle Operation", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
  ];

  for (const { skills: jobSkills, ...jobData } of foodJobs) {
    await prisma.job.create({
      data: { ...jobData, requiredSkills: { create: jobSkills } },
    });
  }

  const foodJobCount = await prisma.job.count({ where: { vertical: "food_service" } });
  console.log(`  Created ${foodJobCount} food service jobs.\n`);

  // =====================
  // 10. Transport/Logistics vertical jobs
  // =====================
  console.log("Creating transport/logistics vertical jobs...");

  const transportJobs = [
    {
      title: "Delivery Driver",
      employer: "GoGo Logistics Chicago",
      location: "Chicago, IL 60639",
      vertical: "transport_logistics",
      description: "Deliver packages and goods to residential and commercial addresses across the Chicagoland area. Use navigation apps to optimize routes, maintain delivery schedules, and provide proof of delivery. Must have a valid driver's license and personal vehicle.",
      payMin: 1800, payMax: 2400, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Driving: Personal Vehicle", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Navigation", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Time Management", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Warehouse Associate",
      employer: "Central Distribution Co.",
      location: "Chicago, IL 60638",
      vertical: "transport_logistics",
      description: "Pick, pack, and ship orders in a climate-controlled warehouse facility near Midway Airport. Operate forklifts and pallet jacks, maintain accurate inventory counts, and meet daily productivity targets. Standing and lifting up to 50 lbs required throughout the shift.",
      payMin: 1700, payMax: 2100, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Inventory Management", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Forklift Operation", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Physical Stamina", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "CDL Truck Driver",
      employer: "Heartland Freight Lines",
      location: "Chicago, IL 60628",
      vertical: "transport_logistics",
      description: "Drive Class B commercial vehicles for regional delivery routes originating from Chicago. Perform pre-trip inspections, maintain DOT logbooks, and ensure safe on-time delivery of freight. CDL Class B license required. Home daily — no overnight routes.",
      payMin: 2500, payMax: 3500, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Driving: CDL Class B", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Safety Compliance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Route Planning", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Rideshare / Medical Transport",
      employer: "CareRide Chicago",
      location: "Chicago, IL 60612",
      vertical: "transport_logistics",
      description: "Provide non-emergency medical transportation and rideshare services for elderly and disabled clients throughout the Chicago area. Assist passengers in and out of the vehicle, ensure comfort during transit, and maintain a clean, safe vehicle. Contract position with flexible scheduling.",
      payMin: 1900, payMax: 2500, payType: "hourly", shiftType: "contract",
      skills: [
        { normalizedTerm: "Driving: Personal Vehicle", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Customer Service", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Navigation", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Logistics Coordinator",
      employer: "Midwest Supply Chain Solutions",
      location: "Chicago, IL 60606",
      vertical: "transport_logistics",
      description: "Coordinate inbound and outbound shipments, track deliveries, and communicate with carriers and warehouse teams. Maintain shipping records in Excel and the company TMS. Strong problem-solving skills needed to handle delays and routing changes.",
      payMin: 2200, payMax: 2800, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Supply Chain Management", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Excel / Spreadsheets", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Communication", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Package Handler",
      employer: "Windy City Parcel Hub",
      location: "Chicago, IL 60633",
      vertical: "transport_logistics",
      description: "Sort and load packages onto delivery vehicles during early morning or evening shifts. Scan barcodes, organize parcels by route, and maintain a clean loading dock. Physical role requiring standing, bending, and lifting up to 70 lbs. Part-time shifts available with opportunity for full-time.",
      payMin: 1600, payMax: 2000, payType: "hourly", shiftType: "part_time",
      skills: [
        { normalizedTerm: "Physical Stamina", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Time Management", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Attention to Detail", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
  ];

  for (const { skills: jobSkills, ...jobData } of transportJobs) {
    await prisma.job.create({
      data: { ...jobData, requiredSkills: { create: jobSkills } },
    });
  }

  const transportJobCount = await prisma.job.count({ where: { vertical: "transport_logistics" } });
  console.log(`  Created ${transportJobCount} transport/logistics jobs.\n`);

  // =====================
  // 11. Retail vertical jobs
  // =====================
  console.log("Creating retail vertical jobs...");

  const retailJobs = [
    {
      title: "Retail Sales Associate",
      employer: "Andersonville Boutique Collective",
      location: "Chicago, IL 60640",
      vertical: "retail",
      description: "Assist customers in a curated neighborhood boutique. Help shoppers find products, process sales transactions, restock merchandise, and maintain an inviting store environment. Part-time position with flexible scheduling including weekends.",
      payMin: 1500, payMax: 1800, payType: "hourly", shiftType: "part_time",
      skills: [
        { normalizedTerm: "Customer Service", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Cash Handling", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Product Knowledge", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Store Manager",
      employer: "Michigan Avenue Retail Group",
      location: "Chicago, IL 60611",
      vertical: "retail",
      description: "Lead all aspects of store operations for a high-traffic retail location on the Magnificent Mile. Hire, train, and supervise a team of 12+ associates. Drive sales performance, manage inventory, handle customer escalations, and ensure visual merchandising standards are met.",
      payMin: 2200, payMax: 2800, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Retail Management", proficiencyLevel: "advanced", isRequired: true },
        { normalizedTerm: "Staff Supervision", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Inventory Control", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Customer Service", proficiencyLevel: "advanced", isRequired: false },
      ],
    },
    {
      title: "Visual Merchandiser",
      employer: "State Street Style Co.",
      location: "Chicago, IL 60602",
      vertical: "retail",
      description: "Design and implement eye-catching product displays, window installations, and in-store layouts that drive customer engagement and sales. Collaborate with marketing on seasonal campaigns and maintain brand visual standards across all store touchpoints.",
      payMin: 1800, payMax: 2400, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Visual Display Design", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Retail Experience", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Creativity", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "E-commerce Fulfillment",
      employer: "ChicagoShip Direct",
      location: "Chicago, IL 60642",
      vertical: "retail",
      description: "Process online orders in a fast-paced fulfillment center. Pick items from shelves, pack orders securely, print shipping labels, and manage inventory counts. Accuracy and speed are critical — we ship hundreds of orders daily and pride ourselves on same-day processing.",
      payMin: 1700, payMax: 2100, payType: "hourly", shiftType: "full_time",
      skills: [
        { normalizedTerm: "Order Processing", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "Inventory Management", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "Attention to Detail", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
  ];

  for (const { skills: jobSkills, ...jobData } of retailJobs) {
    await prisma.job.create({
      data: { ...jobData, requiredSkills: { create: jobSkills } },
    });
  }

  const retailJobCount = await prisma.job.count({ where: { vertical: "retail" } });
  console.log(`  Created ${retailJobCount} retail jobs.\n`);

  // =====================
  // Summary
  // =====================
  const totalJobs = await prisma.job.count();
  const totalJobSkills = await prisma.jobSkill.count();

  console.log("=== Seed Summary ===");
  console.log(`  Skill Nodes:       ${skillNodeCount}`);
  console.log(`  Skill Aliases:     ${aliasCount}`);
  console.log(`  HHA Jobs:          ${jobCount}`);
  console.log(`  Tech Jobs:         ${techJobCount}`);
  console.log(`  Trades Jobs:       ${tradesJobCount}`);
  console.log(`  Admin/Office Jobs: ${adminJobCount}`);
  console.log(`  Food Service Jobs: ${foodJobCount}`);
  console.log(`  Transport Jobs:    ${transportJobCount}`);
  console.log(`  Retail Jobs:       ${retailJobCount}`);
  console.log(`  Total Jobs:        ${totalJobs}`);
  console.log(`  Total Job Skills:  ${totalJobSkills}`);
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
