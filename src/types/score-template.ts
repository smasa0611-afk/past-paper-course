export type CommonSubject = {
  id: number;
  category: string;
  subject: string;
  rawScore: number;
  weightedScore: number;
  requirement: "必須" | "選択";
};

export type SecondSubject = {
  id: number;
  subject: string;
  points: number;
  weightedScore: number;
  format: "記述" | "論述" | "面接" | "その他";
};
