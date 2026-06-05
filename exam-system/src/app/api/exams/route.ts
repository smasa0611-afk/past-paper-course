import { NextResponse } from 'next/server';
import type { ExamMetadata } from '@/types/exam';
import { secondaryDummyExams } from '@/lib/secondary-dummy-exams';
import exams from '@/generated/exams-index.json';

type ExamListItem = ExamMetadata & {
  id: string;
};

export async function GET() {
  const existingIds = new Set((exams as ExamListItem[]).map((exam) => exam.id));
  const dummyExams = secondaryDummyExams.filter((exam) => !existingIds.has(exam.id));
  return NextResponse.json([...(exams as ExamListItem[]), ...dummyExams]);
}
