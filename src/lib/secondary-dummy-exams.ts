import type { ExamMetadata } from "@/types/exam";

const YEARS = Array.from({ length: 10 }, (_, index) => 2026 - index);

type SecondaryExamSeed = {
  exam_type: string;
  universityName: string;
  subject: string;
  subjectName: string;
  course: string;
  time_minutes: number;
};

const examSeeds: SecondaryExamSeed[] = [
  { exam_type: "todai", universityName: "東京大学", subject: "english", subjectName: "英語", course: "common", time_minutes: 120 },
  { exam_type: "todai", universityName: "東京大学", subject: "math", subjectName: "文系数学", course: "humanities", time_minutes: 100 },
  { exam_type: "todai", universityName: "東京大学", subject: "math", subjectName: "理系数学", course: "science", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "japanese", subjectName: "国語", course: "humanities", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "japanese", subjectName: "国語", course: "science", time_minutes: 100 },
  { exam_type: "todai", universityName: "東京大学", subject: "physics", subjectName: "物理", course: "science", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "chemistry", subjectName: "化学", course: "science", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "biology", subjectName: "生物", course: "science", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "earth_science", subjectName: "地学", course: "science", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "world_history", subjectName: "世界史", course: "humanities", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "japanese_history", subjectName: "日本史", course: "humanities", time_minutes: 150 },
  { exam_type: "todai", universityName: "東京大学", subject: "geography", subjectName: "地理", course: "humanities", time_minutes: 150 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "english", subjectName: "英語", course: "common", time_minutes: 120 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "math", subjectName: "文系数学", course: "humanities", time_minutes: 120 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "math", subjectName: "理系数学", course: "science", time_minutes: 150 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "japanese", subjectName: "国語", course: "humanities", time_minutes: 120 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "japanese", subjectName: "国語", course: "science", time_minutes: 120 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "physics", subjectName: "物理", course: "science", time_minutes: 180 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "chemistry", subjectName: "化学", course: "science", time_minutes: 180 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "biology", subjectName: "生物", course: "science", time_minutes: 180 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "earth_science", subjectName: "地学", course: "science", time_minutes: 180 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "world_history", subjectName: "世界史", course: "humanities", time_minutes: 90 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "japanese_history", subjectName: "日本史", course: "humanities", time_minutes: 90 },
  { exam_type: "kyodai", universityName: "京都大学", subject: "geography", subjectName: "地理", course: "humanities", time_minutes: 90 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "english", subjectName: "英語", course: "common", time_minutes: 105 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "math", subjectName: "文系数学", course: "humanities", time_minutes: 150 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "math", subjectName: "理系数学", course: "science", time_minutes: 150 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "japanese", subjectName: "国語", course: "humanities", time_minutes: 105 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "physics", subjectName: "物理", course: "science", time_minutes: 75 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "chemistry", subjectName: "化学", course: "science", time_minutes: 75 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "biology", subjectName: "生物", course: "science", time_minutes: 75 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "earth_science", subjectName: "地学", course: "science", time_minutes: 75 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "world_history", subjectName: "世界史", course: "humanities", time_minutes: 105 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "japanese_history", subjectName: "日本史", course: "humanities", time_minutes: 105 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "geography", subjectName: "地理", course: "humanities", time_minutes: 105 },
  { exam_type: "nagoya", universityName: "名古屋大学", subject: "essay", subjectName: "小論文", course: "common", time_minutes: 90 },
  { exam_type: "hamamatsu_medical", universityName: "浜松医科大学", subject: "english", subjectName: "英語", course: "medicine", time_minutes: 90 },
  { exam_type: "hamamatsu_medical", universityName: "浜松医科大学", subject: "math", subjectName: "数学", course: "medicine", time_minutes: 90 },
  { exam_type: "hamamatsu_medical", universityName: "浜松医科大学", subject: "physics", subjectName: "物理", course: "medicine", time_minutes: 120 },
  { exam_type: "hamamatsu_medical", universityName: "浜松医科大学", subject: "chemistry", subjectName: "化学", course: "medicine", time_minutes: 120 },
  { exam_type: "hamamatsu_medical", universityName: "浜松医科大学", subject: "biology", subjectName: "生物", course: "medicine", time_minutes: 120 },
  { exam_type: "hamamatsu_medical", universityName: "浜松医科大学", subject: "essay", subjectName: "小論文", course: "medicine", time_minutes: 90 },
];

function buildSecondaryDummyExam(seed: SecondaryExamSeed, year: number): ExamMetadata {
  return {
    id: `${seed.exam_type}/${year}/${seed.subject}/${seed.course}`,
    exam_type: seed.exam_type,
    year,
    subject: seed.subject,
    course: seed.course,
    title: `${seed.universityName} ${seed.subjectName} ${year}`,
    time_minutes: seed.time_minutes,
    hasMarksheet: false,
    hasAnswer: false,
  };
}

export const secondaryDummyExams: ExamMetadata[] = examSeeds.flatMap((seed) =>
  YEARS.map((year) => buildSecondaryDummyExam(seed, year)),
);
