import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { UniversityDepartmentRecord } from "@/types/admissions";

const dataPath = path.resolve(process.cwd(), "..", "data", "universities", "2026_mext_universities.json");

function readUniversities(): UniversityDepartmentRecord[] {
  if (!fs.existsSync(dataPath)) return [];
  return JSON.parse(fs.readFileSync(dataPath, "utf-8")) as UniversityDepartmentRecord[];
}

function toHiragana(text: string) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeJapaneseText(text: string) {
  return toHiragana(text.normalize("NFKC").replace(/\s+/g, "").toLowerCase());
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const university = (searchParams.get("university") ?? "").trim();
    const faculty = (searchParams.get("faculty") ?? "").trim();
    const distinct = (searchParams.get("distinct") ?? "").trim();
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), distinct ? 2000 : 500);
    const normalizedQuery = normalizeJapaneseText(q);

    const filtered = readUniversities().filter((record) => {
      if (university && record.university !== university) return false;
      if (faculty && record.faculty !== faculty) return false;
      if (!normalizedQuery) return true;
      return normalizeJapaneseText(record.searchText).includes(normalizedQuery);
    });

    if (distinct === "university") {
      return NextResponse.json(uniqueSorted(filtered.map((record) => record.university)));
    }

    if (distinct === "faculty") {
      return NextResponse.json(uniqueSorted(filtered.map((record) => record.faculty)));
    }

    if (distinct === "department") {
      return NextResponse.json(uniqueSorted(filtered.map((record) => record.department)));
    }

    return NextResponse.json(
      filtered.slice(0, limit).map((record) => ({
        ...record,
        label: [record.university, record.faculty, record.department].filter(Boolean).join(" / "),
      })),
    );
  } catch (error) {
    console.error("Universities read error:", error);
    return NextResponse.json({ error: "大学マスタの読み込みに失敗しました。" }, { status: 500 });
  }
}
