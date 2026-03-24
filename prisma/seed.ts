import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.application.deleteMany();
  await prisma.jobSkill.deleteMany();
  await prisma.job.deleteMany();
  await prisma.upskillResource.deleteMany();

  // Seed Jobs
  const jobs = [
    {
      title: "Home Health Companion",
      employer: "Senior Care Chicago",
      location: "Lincoln Park, Chicago, IL",
      vertical: "home_health_aide",
      description:
        "Provide companionship and daily living support to elderly clients in the Lincoln Park area. Help with meal prep, light cleaning, and social engagement. No medical certifications required.",
      payMin: 1800,
      payMax: 2100,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "personal care assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "companionship", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "basic mobility assistance", proficiencyLevel: "beginner", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "light housekeeping", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "medication reminders", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "transportation assistance", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Home Health Aide",
      employer: "BrightSpring Health",
      location: "Evanston, IL",
      vertical: "home_health_aide",
      description:
        "Full-time home health aide position providing hands-on care including vital signs monitoring, personal hygiene, and medication management. CPR certification required. Competitive pay with benefits.",
      payMin: 2100,
      payMax: 2400,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "vital signs monitoring", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "medication reminders", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "personal hygiene assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "documentation", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "cpr certification", proficiencyLevel: "intermediate", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "wound care basics", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "physical therapy assistance", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Senior Care Specialist",
      employer: "Comfort Keepers Chicago",
      location: "Oak Park, IL",
      vertical: "home_health_aide",
      description:
        "Specialize in memory care and fall prevention for senior clients. Work with families and care teams to provide safe, dignified support. Training provided for qualified candidates.",
      payMin: 2200,
      payMax: 2600,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "dementia care awareness", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "transfer assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "fall prevention", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "medication management", proficiencyLevel: "intermediate", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "companionship", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "documentation", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "communication with families", proficiencyLevel: "intermediate", isRequired: false },
      ],
    },
    {
      title: "Pediatric Home Care Aide",
      employer: "Little Stars Home Health",
      location: "Naperville, IL",
      vertical: "home_health_aide",
      description:
        "Caring for children with special needs in their homes. Must be patient, reliable, and experienced working with kids. First aid certification preferred.",
      payMin: 2000,
      payMax: 2300,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "child development basics", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "personal care assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "communication with families", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "first aid", proficiencyLevel: "intermediate", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "documentation", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Companion / Sitter",
      employer: "Chicago Companion Care",
      location: "Rogers Park, Chicago, IL",
      vertical: "home_health_aide",
      description:
        "Part-time companion role for seniors who need social interaction and light daily help. Great entry-level position. Flexible hours, weekdays and weekends available.",
      payMin: 1700,
      payMax: 1900,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "companionship", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "light housekeeping", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "transportation assistance", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "basic mobility assistance", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "personal care assistance", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Live-In Home Health Aide",
      employer: "Assured Home Care",
      location: "Skokie, IL",
      vertical: "home_health_aide",
      description:
        "Live-in aide position providing 24/7 care for an elderly client. Room and board included. Must have experience with medication administration and mobility support.",
      payMin: 2300,
      payMax: 2700,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "personal care assistance", proficiencyLevel: "advanced", isRequired: true },
        { normalizedTerm: "medication management", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "basic mobility assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "meal preparation", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "vital signs monitoring", proficiencyLevel: "intermediate", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "dementia care awareness", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "cpr certification", proficiencyLevel: "intermediate", isRequired: false },
        { normalizedTerm: "light housekeeping", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Weekend Home Health Aide",
      employer: "Heartland Health Services",
      location: "Cicero, IL",
      vertical: "home_health_aide",
      description:
        "Weekend shifts providing personal care and companionship. Perfect for those with weekday commitments. Experience with elderly clients preferred.",
      payMin: 1900,
      payMax: 2200,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "personal care assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "companionship", proficiencyLevel: "beginner", isRequired: true },
        { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "medication reminders", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "documentation", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "basic mobility assistance", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
    {
      title: "Home Health Aide — Rehab Support",
      employer: "Recovery Path Chicago",
      location: "Hyde Park, Chicago, IL",
      vertical: "home_health_aide",
      description:
        "Support patients recovering from surgery or injury in their homes. Work alongside physical therapists. Must be comfortable with transfer assistance and exercise routines.",
      payMin: 2100,
      payMax: 2500,
      payType: "hourly",
      requiredSkills: [
        { normalizedTerm: "transfer assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "physical therapy assistance", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "documentation", proficiencyLevel: "intermediate", isRequired: true },
        { normalizedTerm: "personal care assistance", proficiencyLevel: "intermediate", isRequired: true },
      ],
      optionalSkills: [
        { normalizedTerm: "vital signs monitoring", proficiencyLevel: "beginner", isRequired: false },
        { normalizedTerm: "cpr certification", proficiencyLevel: "beginner", isRequired: false },
      ],
    },
  ];

  for (const job of jobs) {
    const { requiredSkills, optionalSkills, ...jobData } = job;
    await prisma.job.create({
      data: {
        ...jobData,
        requiredSkills: {
          create: [...requiredSkills, ...optionalSkills],
        },
      },
    });
  }

  // Seed Upskill Resources
  const resources = [
    {
      skillTerm: "vital signs monitoring",
      title: "Taking Vital Signs — Free Online Course",
      provider: "American Red Cross",
      url: "https://www.redcross.org/take-a-class/classes/nurse-assistant-training",
      isFree: true,
      durationHrs: 3,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "cpr certification",
      title: "CPR/AED/First Aid Certification",
      provider: "American Red Cross",
      url: "https://www.redcross.org/take-a-class/cpr",
      isFree: false,
      durationHrs: 4,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "dementia care awareness",
      title: "Understanding Dementia — Free Training",
      provider: "Alzheimer's Association",
      url: "https://training.alz.org/",
      isFree: true,
      durationHrs: 5,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "medication reminders",
      title: "Medication Administration Basics",
      provider: "YouTube / CareAcademy",
      url: "https://www.careacademy.com",
      isFree: true,
      durationHrs: 2,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "first aid",
      title: "First Aid Certification Course",
      provider: "American Red Cross",
      url: "https://www.redcross.org/take-a-class/first-aid",
      isFree: false,
      durationHrs: 4,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "fall prevention",
      title: "Fall Prevention Strategies for Caregivers",
      provider: "CDC / STEADI Program",
      url: "https://www.cdc.gov/steadi/",
      isFree: true,
      durationHrs: 2,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "transfer assistance",
      title: "Safe Patient Handling and Transfer Techniques",
      provider: "YouTube",
      url: "https://www.youtube.com/results?search_query=safe+patient+transfer+techniques",
      isFree: true,
      durationHrs: 1.5,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "documentation",
      title: "Healthcare Documentation Basics",
      provider: "CareAcademy",
      url: "https://www.careacademy.com",
      isFree: true,
      durationHrs: 2,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "physical therapy assistance",
      title: "PT Aide Training — Assisting with Exercises",
      provider: "YouTube / Khan Academy",
      url: "https://www.khanacademy.org/science/health-and-medicine",
      isFree: true,
      durationHrs: 3,
      vertical: "home_health_aide",
    },
    {
      skillTerm: "wound care basics",
      title: "Basic Wound Care for Home Health Aides",
      provider: "Nurse.com",
      url: "https://www.nurse.com",
      isFree: true,
      durationHrs: 2,
      vertical: "home_health_aide",
    },
  ];

  for (const resource of resources) {
    await prisma.upskillResource.create({ data: resource });
  }

  console.log("Seeded 8 jobs and 10 upskill resources.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
