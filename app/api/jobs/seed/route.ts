import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed endpoint disabled in production" },
      { status: 403 }
    );
  }

  try {
    await prisma.application.deleteMany();
    await prisma.jobSkill.deleteMany();
    await prisma.job.deleteMany();
    await prisma.upskillResource.deleteMany();

    const jobs = [
      {
        title: "Home Health Companion",
        employer: "Senior Care Chicago",
        location: "Lincoln Park, Chicago, IL",
        vertical: "home_health_aide",
        description: "Provide companionship and daily living support to elderly clients in the Lincoln Park area.",
        payMin: 1800, payMax: 2100, payType: "hourly",
        skills: [
          { normalizedTerm: "personal care assistance", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "companionship", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "basic mobility assistance", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "light housekeeping", proficiencyLevel: "beginner", isRequired: false },
          { normalizedTerm: "medication reminders", proficiencyLevel: "beginner", isRequired: false },
        ],
      },
      {
        title: "Home Health Aide",
        employer: "BrightSpring Health",
        location: "Evanston, IL",
        vertical: "home_health_aide",
        description: "Full-time home health aide providing hands-on care including vital signs and medication management.",
        payMin: 2100, payMax: 2400, payType: "hourly",
        skills: [
          { normalizedTerm: "vital signs monitoring", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "medication reminders", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "personal hygiene assistance", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "documentation", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "cpr certification", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "wound care basics", proficiencyLevel: "beginner", isRequired: false },
        ],
      },
      {
        title: "Senior Care Specialist",
        employer: "Comfort Keepers Chicago",
        location: "Oak Park, IL",
        vertical: "home_health_aide",
        description: "Specialize in memory care and fall prevention for senior clients.",
        payMin: 2200, payMax: 2600, payType: "hourly",
        skills: [
          { normalizedTerm: "dementia care awareness", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "transfer assistance", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "fall prevention", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "medication management", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "companionship", proficiencyLevel: "beginner", isRequired: false },
          { normalizedTerm: "documentation", proficiencyLevel: "beginner", isRequired: false },
        ],
      },
      {
        title: "Pediatric Home Care Aide",
        employer: "Little Stars Home Health",
        location: "Naperville, IL",
        vertical: "home_health_aide",
        description: "Caring for children with special needs in their homes.",
        payMin: 2000, payMax: 2300, payType: "hourly",
        skills: [
          { normalizedTerm: "child development basics", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "personal care assistance", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "communication with families", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "first aid", proficiencyLevel: "intermediate", isRequired: true },
          { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: false },
        ],
      },
      {
        title: "Companion / Sitter",
        employer: "Chicago Companion Care",
        location: "Rogers Park, Chicago, IL",
        vertical: "home_health_aide",
        description: "Part-time companion role for seniors. Great entry-level position with flexible hours.",
        payMin: 1700, payMax: 1900, payType: "hourly",
        skills: [
          { normalizedTerm: "companionship", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "light housekeeping", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "transportation assistance", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "meal preparation", proficiencyLevel: "beginner", isRequired: true },
          { normalizedTerm: "basic mobility assistance", proficiencyLevel: "beginner", isRequired: false },
        ],
      },
    ];

    for (const { skills, ...jobData } of jobs) {
      await prisma.job.create({
        data: { ...jobData, requiredSkills: { create: skills } },
      });
    }

    const resources = [
      { skillTerm: "vital signs monitoring", title: "Taking Vital Signs — Free Online Course", provider: "American Red Cross", url: "https://www.redcross.org/take-a-class/classes/nurse-assistant-training", isFree: true, durationHrs: 3, vertical: "home_health_aide" },
      { skillTerm: "cpr certification", title: "CPR/AED/First Aid Certification", provider: "American Red Cross", url: "https://www.redcross.org/take-a-class/cpr", isFree: false, durationHrs: 4, vertical: "home_health_aide" },
      { skillTerm: "dementia care awareness", title: "Understanding Dementia — Free Training", provider: "Alzheimer's Association", url: "https://training.alz.org/", isFree: true, durationHrs: 5, vertical: "home_health_aide" },
      { skillTerm: "medication reminders", title: "Medication Administration Basics", provider: "CareAcademy", url: "https://www.careacademy.com", isFree: true, durationHrs: 2, vertical: "home_health_aide" },
      { skillTerm: "first aid", title: "First Aid Certification", provider: "American Red Cross", url: "https://www.redcross.org/take-a-class/first-aid", isFree: false, durationHrs: 4, vertical: "home_health_aide" },
      { skillTerm: "fall prevention", title: "Fall Prevention for Caregivers", provider: "CDC STEADI", url: "https://www.cdc.gov/steadi/", isFree: true, durationHrs: 2, vertical: "home_health_aide" },
    ];

    for (const resource of resources) {
      await prisma.upskillResource.create({ data: resource });
    }

    return NextResponse.json({ success: true, jobs: jobs.length, resources: resources.length });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
