export type TargetConversionScore = {
  studentId: string;
  year: number;
  university: string;
  faculty: string;
  label: string;
  common: {
    score: number;
    maxScore: number;
  };
  secondary: {
    score: number;
    maxScore: number;
  };
  total: {
    score: number;
    maxScore: number;
  };
  admittedAverage: {
    score: number;
    maxScore: number;
  };
  gapToAverage: number;
  commonSubjects: Record<string, number>;
  secondarySubjects: Record<string, number>;
};

export type TargetConversionConfig = {
  targetKey: "todai" | "kyodai" | "nagoya" | "hamamatsu_medical";
  commonMaxScore: number;
  secondaryMaxScore: number;
  totalMaxScore: number;
  admittedAverageScore: number;
  commonWeights: Record<string, number>;
};

export const commonConversionSubjectMax: Record<string, number> = {
  english: 100,
  english_listening: 100,
  math_ia: 100,
  math_iibc: 100,
  japanese: 200,
  science_1: 100,
  science_2: 100,
  social_1: 100,
  social_2: 100,
  information_i: 100,
};

const targetConversionConfigs: Record<TargetConversionConfig["targetKey"], TargetConversionConfig> = {
  todai: {
    targetKey: "todai",
    commonMaxScore: 110,
    secondaryMaxScore: 440,
    totalMaxScore: 550,
    admittedAverageScore: 348,
    commonWeights: {
      english: 11,
      english_listening: 11,
      math_ia: 11,
      math_iibc: 11,
      japanese: 22,
      science_1: 11,
      science_2: 11,
      social_1: 11,
      information_i: 11,
    },
  },
  kyodai: {
    targetKey: "kyodai",
    commonMaxScore: 250,
    secondaryMaxScore: 700,
    totalMaxScore: 950,
    admittedAverageScore: 690,
    commonWeights: {
      english: 25,
      english_listening: 25,
      math_ia: 25,
      math_iibc: 25,
      japanese: 50,
      science_1: 25,
      science_2: 25,
      social_1: 25,
      information_i: 25,
    },
  },
  nagoya: {
    targetKey: "nagoya",
    commonMaxScore: 635,
    secondaryMaxScore: 1300,
    totalMaxScore: 1935,
    admittedAverageScore: 1180,
    commonWeights: {
      english: 50,
      english_listening: 50,
      math_ia: 50,
      math_iibc: 50,
      japanese: 200,
      science_1: 50,
      science_2: 50,
      social_1: 100,
      information_i: 35,
    },
  },
  hamamatsu_medical: {
    targetKey: "hamamatsu_medical",
    commonMaxScore: 475,
    secondaryMaxScore: 700,
    totalMaxScore: 1175,
    admittedAverageScore: 875,
    commonWeights: {
      english: 47.5,
      english_listening: 47.5,
      math_ia: 47.5,
      math_iibc: 47.5,
      japanese: 95,
      science_1: 47.5,
      science_2: 47.5,
      social_1: 47.5,
      information_i: 47.5,
    },
  },
};

const demoTargetConversionScores: TargetConversionScore[] = [
  {
    studentId: "10000003",
    year: 2025,
    university: "名古屋大学",
    faculty: "工学部",
    label: "名古屋大学 工学部 総合換算スコア",
    common: { score: 380, maxScore: 635 },
    secondary: { score: 720, maxScore: 1300 },
    total: { score: 1100, maxScore: 1935 },
    admittedAverage: { score: 1180, maxScore: 1935 },
    gapToAverage: 80,
    commonSubjects: {
      english: 72,
      english_listening: 68,
      math_ia: 58,
      math_iibc: 57,
      japanese: 120,
      science_1: 64,
      science_2: 66,
      social_1: 60,
      social_2: 42,
      information_i: 20,
    },
    secondarySubjects: {
      english: 160,
      math: 280,
      physics: 140,
      chemistry: 140,
    },
  },
  {
    studentId: "10000002",
    year: 2025,
    university: "東京大学",
    faculty: "理科一類",
    label: "東京大学 理科一類 総合換算スコア",
    common: { score: 73, maxScore: 110 },
    secondary: { score: 190, maxScore: 440 },
    total: { score: 263, maxScore: 550 },
    admittedAverage: { score: 348, maxScore: 550 },
    gapToAverage: 85,
    commonSubjects: {
      english: 68,
      english_listening: 65,
      math_ia: 66,
      math_iibc: 62,
      japanese: 125,
      science_1: 70,
      science_2: 68,
      social_1: 72,
      information_i: 64,
    },
    secondarySubjects: {
      english: 50,
      math: 42,
      japanese: 30,
      physics: 34,
      chemistry: 34,
    },
  },
  {
    studentId: "10000004",
    year: 2025,
    university: "京都大学",
    faculty: "工学部",
    label: "京都大学 工学部 総合換算スコア",
    common: { score: 205, maxScore: 250 },
    secondary: { score: 455, maxScore: 700 },
    total: { score: 660, maxScore: 950 },
    admittedAverage: { score: 690, maxScore: 950 },
    gapToAverage: 30,
    commonSubjects: {
      english: 82,
      english_listening: 80,
      math_ia: 83,
      math_iibc: 82,
      japanese: 160,
      science_1: 82,
      science_2: 84,
      social_1: 82,
      social_2: 80,
      information_i: 85,
    },
    secondarySubjects: {
      english: 100,
      math: 130,
      japanese: 95,
      science: 130,
    },
  },
  {
    studentId: "10000005",
    year: 2025,
    university: "浜松医科大学",
    faculty: "医学部",
    label: "浜松医科大学 医学部 総合換算スコア",
    common: { score: 385, maxScore: 475 },
    secondary: { score: 455, maxScore: 700 },
    total: { score: 840, maxScore: 1175 },
    admittedAverage: { score: 875, maxScore: 1175 },
    gapToAverage: 35,
    commonSubjects: {
      english: 82,
      english_listening: 80,
      math_ia: 81,
      math_iibc: 80,
      japanese: 160,
      science_1: 82,
      science_2: 82,
      social_1: 82,
      social_2: 80,
      information_i: 81,
    },
    secondarySubjects: {
      english: 130,
      math: 125,
      science: 200,
    },
  },
];

export function findTargetConversionScore(params: { studentId?: string | null; year?: number | string | null }) {
  const year = Number(params.year);
  if (!params.studentId || !Number.isFinite(year)) return null;

  return (
    demoTargetConversionScores.find((score) => score.studentId === params.studentId && score.year === year) ?? null
  );
}

export function getTargetConversionConfig(targetKey?: string | null) {
  if (!targetKey) return null;
  return targetConversionConfigs[targetKey as TargetConversionConfig["targetKey"]] ?? null;
}

export function calculateCommonConvertedScore(
  subjectScores: Record<string, number>,
  config: TargetConversionConfig,
) {
  const total = Object.entries(config.commonWeights).reduce((sum, [subject, weight]) => {
    const rawScore = subjectScores[subject];
    const rawMax = commonConversionSubjectMax[subject];
    if (typeof rawScore !== "number" || typeof rawMax !== "number" || rawMax <= 0) return sum;
    return sum + (rawScore / rawMax) * weight;
  }, 0);

  return Math.round(total);
}
