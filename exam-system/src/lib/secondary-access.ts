import fs from "fs";
import path from "path";
import { readStudentCourseEnrollments, type StudentCourseEnrollment } from "@/lib/course-management-store";
import { readMasterStudentCourseEnrollmentsForProfile, readMasterStudentCourseEnrollmentsForProfileAsync } from "@/lib/master-data";
import type { SecondaryEnrollment, SecondaryTargetKey } from "@/types/secondary";

const enrollmentPath = path.resolve(process.cwd(), "..", "data", "secondary_enrollments.json");

export const secondaryTargetLabels: Record<SecondaryTargetKey, string> = {
  todai: "東京大学",
  kyodai: "京都大学",
  nagoya: "名古屋大学",
  hamamatsu_medical: "浜松医科大学",
};

const targetByCourseCode: Record<string, SecondaryTargetKey | undefined> = {
  "10": "todai",
  "15": "todai",
  "20": "kyodai",
  "25": "kyodai",
  "26": "kyodai",
  "27": "kyodai",
  "30": "nagoya",
  "31": "nagoya",
  "35": "nagoya",
  "36": "nagoya",
  "37": "nagoya",
  "40": "hamamatsu_medical",
  "101": "todai",
  "102": "kyodai",
  "103": "nagoya",
  "104": "hamamatsu_medical",
};

function normalize(value: string | undefined) {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function getSecondaryTargetFromCourse(
  enrollment: Pick<StudentCourseEnrollment, "courseCode" | "courseName" | "courseCategory" | "goalUniversity">,
) {
  const byCode = targetByCourseCode[enrollment.courseCode];
  if (byCode) return byCode;

  const text = normalize(`${enrollment.courseName ?? ""} ${enrollment.courseCategory ?? ""} ${enrollment.goalUniversity ?? ""}`);
  if (text.includes("東大") || text.includes("東京大学")) return "todai";
  if (text.includes("京大") || text.includes("京都大学")) return "kyodai";
  if (text.includes("名大") || text.includes("名古屋大学")) return "nagoya";
  if (text.includes("浜医") || text.includes("浜松医科大学")) return "hamamatsu_medical";
  return null;
}

export function isSecondaryCourseEnrollment(
  enrollment: Pick<StudentCourseEnrollment, "courseCode" | "courseName" | "courseCategory" | "goalUniversity">,
) {
  return Boolean(getSecondaryTargetFromCourse(enrollment));
}

export function readSecondaryEnrollments(): SecondaryEnrollment[] {
  if (!fs.existsSync(enrollmentPath)) return [];
  return JSON.parse(fs.readFileSync(enrollmentPath, "utf-8")) as SecondaryEnrollment[];
}

function readEffectiveStudentCourseEnrollments(studentId?: string) {
  const masterEnrollments = readMasterStudentCourseEnrollmentsForProfile(studentId);
  if (masterEnrollments && masterEnrollments.length > 0) return masterEnrollments;
  return readStudentCourseEnrollments().filter((item) => !studentId || item.studentId === studentId);
}

async function readEffectiveStudentCourseEnrollmentsAsync(studentId?: string) {
  const masterEnrollments = await readMasterStudentCourseEnrollmentsForProfileAsync(studentId);
  if (masterEnrollments && masterEnrollments.length > 0) return masterEnrollments;
  return readStudentCourseEnrollments().filter((item) => !studentId || item.studentId === studentId);
}

export function getSubscribedSecondaryTargets(studentId: string | null | undefined) {
  const targets = new Set<SecondaryTargetKey>();
  if (!studentId) return targets;

  readEffectiveStudentCourseEnrollments(studentId).forEach((item) => {
      const target = getSecondaryTargetFromCourse(item);
      if (target) targets.add(target);
    });

  readSecondaryEnrollments()
    .filter((item) => item.studentId === studentId && item.subscribed)
    .forEach((item) => targets.add(item.targetKey));

  return targets;
}

export async function getSubscribedSecondaryTargetsAsync(studentId: string | null | undefined) {
  const targets = new Set<SecondaryTargetKey>();
  if (!studentId) return targets;

  (await readEffectiveStudentCourseEnrollmentsAsync(studentId)).forEach((item) => {
      const target = getSecondaryTargetFromCourse(item);
      if (target) targets.add(target);
    });

  readSecondaryEnrollments()
    .filter((item) => item.studentId === studentId && item.subscribed)
    .forEach((item) => targets.add(item.targetKey));

  return targets;
}

export function getSecondaryEnrollmentsFromCourses(studentId?: string) {
  return readEffectiveStudentCourseEnrollments(studentId).reduce<SecondaryEnrollment[]>((items, item) => {
    const targetKey = getSecondaryTargetFromCourse(item);
    if (!targetKey) return items;
    items.push({
      studentId: item.studentId,
      targetKey,
      targetName: secondaryTargetLabels[targetKey],
      subscribed: true,
      note: `${item.courseCode} ${item.courseName}`,
    });
    return items;
  }, []);
}

export async function getSecondaryEnrollmentsFromCoursesAsync(studentId?: string) {
  return (await readEffectiveStudentCourseEnrollmentsAsync(studentId)).reduce<SecondaryEnrollment[]>((items, item) => {
    const targetKey = getSecondaryTargetFromCourse(item);
    if (!targetKey) return items;
    items.push({
      studentId: item.studentId,
      targetKey,
      targetName: secondaryTargetLabels[targetKey],
      subscribed: true,
      note: `${item.courseCode} ${item.courseName}`,
    });
    return items;
  }, []);
}
