import { NextResponse } from "next/server";
import { BLS_OCCUPATIONS, getVerticals } from "@/lib/bls-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vertical = searchParams.get("vertical");
  const skill = searchParams.get("skill");
  const sortBy = searchParams.get("sort"); // "pay", "growth", "ai_exposure", "employment"
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  let filtered = BLS_OCCUPATIONS;

  if (vertical) {
    filtered = filtered.filter((o) => o.vertical === vertical);
  }

  if (skill) {
    const s = skill.toLowerCase();
    filtered = filtered.filter((o) =>
      o.relatedSkills.some((rs) => rs.toLowerCase().includes(s)),
    );
  }

  // Optional sorting
  if (sortBy) {
    const sortKey =
      sortBy === "pay"
        ? "medianHourly"
        : sortBy === "growth"
          ? "growthPercent"
          : sortBy === "ai_exposure"
            ? "aiExposureScore"
            : sortBy === "employment"
              ? "totalEmployment"
              : null;

    if (sortKey) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortKey as keyof typeof a] as number;
        const bVal = b[sortKey as keyof typeof b] as number;
        return order === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
  }

  return NextResponse.json({
    total: filtered.length,
    verticals: getVerticals(),
    occupations: filtered,
  });
}
