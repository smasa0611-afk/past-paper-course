export type SectionGrade = {
  id: string;
  title: string;
  score: number;
  maxScore: number;
  feedback: string;
  retryRecommended: boolean;
};

export type GradeData = {
  examId: string;
  submissionId: string;
  score: number;
  maxScore: number;
  feedback: string;
  gradedAt: string;
  sections: SectionGrade[];
};
