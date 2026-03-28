import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SKILL_GRAPH = [
  // Parent layer
  {
    canonicalTerm: "personal care",
    vertical: "home_health_aide",
    layer: "parent",
    aiResistanceScore: 90,
    aliases: ["personal care", "caregiving", "caretaking"],
    children: [
      { canonicalTerm: "personal care assistance", layer: "canonical", aiResistanceScore: 90, aliases: ["personal care assistance", "care assistance", "hands-on care"] },
      { canonicalTerm: "personal hygiene assistance", layer: "canonical", aiResistanceScore: 92, aliases: ["personal hygiene assistance", "bathing", "hygiene", "grooming", "dressing assistance"] },
      { canonicalTerm: "basic mobility assistance", layer: "canonical", aiResistanceScore: 88, aliases: ["basic mobility assistance", "mobility", "walking assistance", "movement help", "mobility support"] },
      { canonicalTerm: "transfer assistance", layer: "canonical", aiResistanceScore: 90, aliases: ["transfer assistance", "transfers", "lifting", "patient transfer", "moving patients"] },
    ],
  },
  {
    canonicalTerm: "health monitoring",
    vertical: "home_health_aide",
    layer: "parent",
    aiResistanceScore: 55,
    aliases: ["health monitoring", "medical monitoring"],
    children: [
      { canonicalTerm: "vital signs monitoring", layer: "canonical", aiResistanceScore: 55, aliases: ["vital signs monitoring", "blood pressure", "vital signs", "vitals", "temperature check"] },
      { canonicalTerm: "medication reminders", layer: "canonical", aiResistanceScore: 45, aliases: ["medication reminders", "medicine reminders", "pill reminders", "med reminders"] },
      { canonicalTerm: "medication management", layer: "canonical", aiResistanceScore: 50, aliases: ["medication management", "medicine management", "med management", "prescriptions"] },
      { canonicalTerm: "wound care basics", layer: "canonical", aiResistanceScore: 80, aliases: ["wound care basics", "wound care", "bandaging", "wound treatment"] },
    ],
  },
  {
    canonicalTerm: "daily living support",
    vertical: "home_health_aide",
    layer: "parent",
    aiResistanceScore: 70,
    aliases: ["daily living support", "adl support", "daily living"],
    children: [
      { canonicalTerm: "meal preparation", layer: "canonical", aiResistanceScore: 65, aliases: ["meal preparation", "cooking", "food preparation", "food prep", "cook", "making food", "making meals"] },
      { canonicalTerm: "light housekeeping", layer: "canonical", aiResistanceScore: 60, aliases: ["light housekeeping", "cleaning", "housework", "tidying", "house cleaning", "housekeeping"] },
      { canonicalTerm: "companionship", layer: "canonical", aiResistanceScore: 85, aliases: ["companionship", "companion", "social support", "keeping company", "friendly visiting"] },
      { canonicalTerm: "transportation assistance", layer: "canonical", aiResistanceScore: 75, aliases: ["transportation assistance", "driving", "transport", "rides", "chauffeur", "driver"] },
    ],
  },
  {
    canonicalTerm: "safety and emergency",
    vertical: "home_health_aide",
    layer: "parent",
    aiResistanceScore: 80,
    aliases: ["safety and emergency", "safety", "emergency care"],
    children: [
      { canonicalTerm: "cpr certification", layer: "canonical", aiResistanceScore: 85, aliases: ["cpr certification", "cpr", "cardiopulmonary", "cpr certified", "cpr/aed"] },
      { canonicalTerm: "first aid", layer: "canonical", aiResistanceScore: 82, aliases: ["first aid", "emergency care", "basic medical"] },
      { canonicalTerm: "fall prevention", layer: "canonical", aiResistanceScore: 78, aliases: ["fall prevention", "fall risk", "falls", "preventing falls", "balance safety"] },
    ],
  },
  {
    canonicalTerm: "specialized care",
    vertical: "home_health_aide",
    layer: "parent",
    aiResistanceScore: 82,
    aliases: ["specialized care", "specialty care"],
    children: [
      { canonicalTerm: "dementia care awareness", layer: "canonical", aiResistanceScore: 85, aliases: ["dementia care awareness", "dementia", "alzheimer", "memory care", "cognitive care"] },
      { canonicalTerm: "physical therapy assistance", layer: "canonical", aiResistanceScore: 80, aliases: ["physical therapy assistance", "physical therapy", "pt assistance", "exercise assistance", "rehab"] },
      { canonicalTerm: "child development basics", layer: "canonical", aiResistanceScore: 82, aliases: ["child development basics", "child care", "child development", "pediatric", "working with children"] },
    ],
  },
  {
    canonicalTerm: "professional skills",
    vertical: "home_health_aide",
    layer: "parent",
    aiResistanceScore: 40,
    aliases: ["professional skills", "soft skills"],
    children: [
      { canonicalTerm: "documentation", layer: "canonical", aiResistanceScore: 40, aliases: ["documentation", "paperwork", "record keeping", "charting", "documenting", "reports"] },
      { canonicalTerm: "communication with families", layer: "canonical", aiResistanceScore: 82, aliases: ["communication with families", "family communication", "talking with families", "family liaison"] },
    ],
  },
];

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed endpoint is dev-only" }, { status: 403 });
  }

  try {
    // Clear existing skill graph data
    await prisma.skillAlias.deleteMany();
    await prisma.skillNode.deleteMany();

    let nodeCount = 0;
    let aliasCount = 0;

    for (const parent of SKILL_GRAPH) {
      // Create parent node
      const parentNode = await prisma.skillNode.create({
        data: {
          canonicalTerm: parent.canonicalTerm,
          vertical: parent.vertical,
          layer: parent.layer,
          aiResistanceScore: parent.aiResistanceScore,
        },
      });
      nodeCount++;

      // Create parent aliases
      for (const alias of parent.aliases) {
        await prisma.skillAlias.create({
          data: { rawTerm: alias.toLowerCase().trim(), skillNodeId: parentNode.id },
        });
        aliasCount++;
      }

      // Create children
      for (const child of parent.children) {
        const childNode = await prisma.skillNode.create({
          data: {
            canonicalTerm: child.canonicalTerm,
            vertical: parent.vertical,
            layer: child.layer,
            aiResistanceScore: child.aiResistanceScore,
            parentId: parentNode.id,
          },
        });
        nodeCount++;

        for (const alias of child.aliases) {
          try {
            await prisma.skillAlias.create({
              data: { rawTerm: alias.toLowerCase().trim(), skillNodeId: childNode.id },
            });
            aliasCount++;
          } catch {
            // Skip duplicate aliases (same rawTerm mapped to different nodes)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      nodesCreated: nodeCount,
      aliasesCreated: aliasCount,
    });
  } catch (error) {
    console.error("Seed graph error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to seed graph", detail: message }, { status: 500 });
  }
}
