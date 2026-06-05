import type { SectionGrade } from "@/types/grading";

const STORAGE_KEY = "exam-system-demo-submissions";

export type DemoSubmission = {
  id: string;
  examId: string;
  studentId: string;
  content: string;
  images?: string[];
  timestamp: string;
  status: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
  gradedAt?: string;
  sections?: SectionGrade[];
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadDemoSubmissions(): DemoSubmission[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoSubmission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDemoSubmissions(submissions: DemoSubmission[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

export function upsertDemoSubmission(submission: DemoSubmission) {
  const current = loadDemoSubmissions();
  const index = current.findIndex((item) => item.id === submission.id);
  if (index >= 0) {
    current[index] = submission;
  } else {
    current.unshift(submission);
  }
  saveDemoSubmissions(current);
}

export function getDemoSubmission(submissionId: string, examId?: string) {
  return loadDemoSubmissions().find(
    (item) => item.id === submissionId && (!examId || item.examId === examId),
  ) ?? null;
}

export function mergeDemoSubmissions<T extends DemoSubmission>(serverSubmissions: T[]): T[] {
  const merged = new Map<string, T>();

  serverSubmissions.forEach((submission) => {
    merged.set(submission.id, submission);
  });

  loadDemoSubmissions().forEach((submission) => {
    const existing = merged.get(submission.id);
    merged.set(submission.id, { ...(existing ?? {}), ...submission } as T);
  });

  return [...merged.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
