export interface ExamMetadata {
  id: string; // The relative path, e.g. "todai/2026/math/humanities"
  exam_type: string;
  year: number;
  subject: string;
  course: string;
  title: string;
  time_minutes: number;
  problem_files?: { label: string; path: string }[];
  answer_files?: { label: string; path: string }[];
  listening_audio?: { label: string; url: string; kind?: "audio" | "link" }[];
  hasMarksheet?: boolean;
  hasAnswer?: boolean;
}

export type MarksheetChoice = {
  value: string;
  label: string;
};

export type MarksheetQuestion = {
  id: string;
  number: number;
  displayLabel?: string;
  prompt?: string;
  sectionId?: string;
  sectionTitle?: string;
  choices?: MarksheetChoice[];
  correctAnswer?: string;
  points?: number;
};

export type MarksheetScoringRule = {
  id: string;
  title?: string;
  questionIds: string[];
  acceptedVariants: string[][];
  points: number;
  sectionId?: string;
  orderMatters?: boolean;
  partialCredit?: { acceptedVariants: string[][]; points: number; orderMatters?: boolean }[];
  requires?: { questionId: string; value: string }[];
};

export type MarksheetSelectionGroup = {
  id: string;
  title: string;
  sectionIds: string[];
  minSelect?: number;
  maxSelect?: number;
};

export type MarksheetSchema = {
  title?: string;
  instructions?: string;
  defaultChoices?: MarksheetChoice[];
  choicesPerRow?: number;
  questions: MarksheetQuestion[];
  scoringRules?: MarksheetScoringRule[];
  selectionGroups?: MarksheetSelectionGroup[];
};
