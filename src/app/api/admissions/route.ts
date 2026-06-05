import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { AdmissionRecord } from "@/types/admissions";

const dataPath = path.resolve(process.cwd(), "data", "admissions", "2026_common_admissions.json");

function readAdmissions(): AdmissionRecord[] {
  if (!fs.existsSync(dataPath)) return [];
  return JSON.parse(fs.readFileSync(dataPath, "utf-8")) as AdmissionRecord[];
}

function toHiragana(text: string) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60)
  );
}

function normalizeJapaneseText(text: string) {
  return toHiragana(
    text
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .replace(/大學/g, "大学")
      .toLowerCase()
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const university = (searchParams.get("university") ?? "").trim();
    const faculty = (searchParams.get("faculty") ?? "").trim();
    const department = (searchParams.get("department") ?? "").trim();
    const distinct = (searchParams.get("distinct") ?? "").trim();
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), distinct ? 1000 : 100);
    const normalizedQuery = normalizeJapaneseText(q);
    const admissions = readAdmissions();

    const filtered = admissions.filter((record) => {
      if (university && record.university !== university) return false;
      if (faculty && record.faculty !== faculty) return false;
      if (department && record.department !== department) return false;
      if (!normalizedQuery) return true;

      const searchableText = normalizeJapaneseText(
        [
          record.searchText,
          record.university,
          record.faculty,
          record.department,
          record.method,
          record.schedule,
        ]
          .filter(Boolean)
          .join(" ")
      );

      if (!searchableText.includes(normalizedQuery)) {
        return false;
      }
      return true;
    });

    if (distinct === "university") {
      return NextResponse.json([...new Set(filtered.map((record) => record.university).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja")));
    }

    if (distinct === "faculty") {
      return NextResponse.json([...new Set(filtered.map((record) => record.faculty).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja")));
    }

    if (distinct === "department") {
      return NextResponse.json([...new Set(filtered.map((record) => record.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja")));
    }

    return NextResponse.json(
      filtered.slice(0, limit).map((record) => ({
        ...record,
        label: [record.university, record.faculty, record.department, record.method, record.schedule]
          .filter(Boolean)
          .join(" / "),
      }))
    );
  } catch (error) {
    console.error("Admissions read error:", error);
    return NextResponse.json({ error: "合格判定基準の読込に失敗しました。" }, { status: 500 });
  }
}
