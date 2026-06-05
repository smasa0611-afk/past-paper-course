import { NextResponse } from "next/server";
import { findAdmissionScoreTemplate } from "@/lib/admission-score-templates";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const template = findAdmissionScoreTemplate({
    university: searchParams.get("university") ?? "",
    faculty: searchParams.get("faculty") ?? "",
    department: searchParams.get("department") ?? "",
    method: searchParams.get("method") ?? "前期日程",
  });

  if (!template) {
    return NextResponse.json({ template: null });
  }

  return NextResponse.json({ template });
}
