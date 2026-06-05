export type VideoQuizChoice = {
  id: string;
  label: string;
};

export type VideoQuizQuestion = {
  id: string;
  number: number;
  prompt: string;
  choices: VideoQuizChoice[];
  correctChoiceId: string;
  explanationImageUrl?: string;
};

export type VideoQuizSettings = {
  showResultImmediately: boolean;
  explanationMode: "optional" | "always" | "disabled";
  allowExplanationBeforeAnswer: boolean;
  recordExplanationViewed: boolean;
};

export type VideoQuiz = {
  id: string;
  lessonId: string;
  sourceFolder: string;
  title: string;
  targetPoint: number;
  settings: VideoQuizSettings;
  questions: VideoQuizQuestion[];
};

export type PublicVideoQuizQuestion = Omit<VideoQuizQuestion, "correctChoiceId" | "explanationImageUrl"> & {
  explanationImageUrl?: string;
};

export type PublicVideoQuiz = Omit<VideoQuiz, "questions"> & {
  questions: PublicVideoQuizQuestion[];
};

export type VideoQuizSubmission = {
  id: string;
  userId: string;
  lessonId: string;
  quizId: string;
  answers: Record<string, string>;
  correctAnswers: Record<string, string>;
  results: Record<string, boolean>;
  score: number;
  maxScore: number;
  passed: boolean;
  submittedAt: string;
  explanationViewed: boolean;
  explanationViewedAt?: string;
};
