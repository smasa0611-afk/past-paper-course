import type { CommonSubject, SecondSubject } from "@/types/score-template";

export type AdmissionScoreTemplate = {
  id: string;
  sourceYear: 2026;
  university: string;
  faculty: string;
  departments: string[];
  method: string;
  commonSubjects: Omit<CommonSubject, "id">[];
  secondSubjects: Omit<SecondSubject, "id">[];
  sourceName: string;
  sourceUrl: string;
  note?: string;
};

const TOKYO_SOURCE = {
  sourceName: "東京大学 令和8（2026）年度 入学者選抜要項",
  sourceUrl: "https://www.u-tokyo.ac.jp/content/400243934.pdf",
};

const KYOTO_SOURCE = {
  sourceName: "京都大学 令和8年度 一般選抜学生募集要項",
  sourceUrl:
    "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/ippanbosyuyokoR8_all-52cb31b1c0bbdc1bcd0b0a9bb4c2e70f.pdf",
};

const NAGOYA_SOURCE = {
  sourceName: "名古屋大学 令和8（2026）年度 入学者選抜要項",
  sourceUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/r8_senbatsuyoko.pdf",
};

const HAMAMATSU_MED_SOURCE = {
  sourceName: "浜松医科大学 令和8年度 入学者選抜要項",
  sourceUrl: "https://www.hama-med.ac.jp/admission/24640813717ddc004cc63aa32a01f5cb.pdf",
};

function required(
  category: string,
  subject: string,
  rawScore: number,
  weightedScore: number,
): Omit<CommonSubject, "id"> {
  return { category, subject, rawScore, weightedScore, requirement: "必須" };
}

function optional(
  category: string,
  subject: string,
  rawScore: number,
  weightedScore: number,
): Omit<CommonSubject, "id"> {
  return { category, subject, rawScore, weightedScore, requirement: "選択" };
}

function second(
  subject: string,
  points: number,
  format: SecondSubject["format"] = "記述",
): Omit<SecondSubject, "id"> {
  return { subject, points, weightedScore: points, format };
}

const todaiHumanitiesCommon: Omit<CommonSubject, "id">[] = [
  required("国語", "国語", 200, 22),
  required("地歴・公民", "地歴・公民から2科目", 200, 22),
  required("数学", "数学ⅠA・数学ⅡBC", 200, 22),
  required("理科", "基礎2分野または理科1科目", 100, 11),
  required("外国語", "英語などから1", 200, 22),
  required("情報", "情報Ⅰ", 100, 11),
];

const todaiSciencesCommon: Omit<CommonSubject, "id">[] = [
  required("国語", "国語", 200, 22),
  required("地歴・公民", "地歴・公民から1科目", 100, 11),
  required("数学", "数学ⅠA・数学ⅡBC", 200, 22),
  required("理科", "理科2科目", 200, 22),
  required("外国語", "英語などから1", 200, 22),
  required("情報", "情報Ⅰ", 100, 11),
];

const kyotoEconomicsDepartments = ["経済経営学科", "経済経営学科（文系）", "経済経営学科（理系）"];

export const admissionScoreTemplates: AdmissionScoreTemplate[] = [
  {
    id: "2026-tokyo-humanities-front",
    sourceYear: 2026,
    university: "東京大学",
    faculty: "文科各類",
    departments: ["文科一類", "文科二類", "文科三類"],
    method: "前期日程",
    commonSubjects: todaiHumanitiesCommon,
    secondSubjects: [
      second("国語", 120),
      second("地理歴史", 120, "論述"),
      second("数学", 80),
      second("外国語", 120),
    ],
    ...TOKYO_SOURCE,
    note: "大学入学共通テスト1000点を110点に換算し、2次試験440点と合算。",
  },
  {
    id: "2026-tokyo-sciences-front",
    sourceYear: 2026,
    university: "東京大学",
    faculty: "理科各類",
    departments: ["理科一類", "理科二類", "理科三類"],
    method: "前期日程",
    commonSubjects: todaiSciencesCommon,
    secondSubjects: [
      second("国語", 80),
      second("数学", 120),
      second("理科", 120),
      second("外国語", 120),
    ],
    ...TOKYO_SOURCE,
    note: "大学入学共通テスト1000点を110点に換算し、2次試験440点と合算。",
  },
  {
    id: "2026-kyoto-integrated-human-studies-humanities-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "総合人間学部",
    departments: ["総合人間学科（文系）", "総合人間学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 125),
      optional("地歴・公民", "地歴・公民から2", 200, 100),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 100),
      required("理科", "基礎2分野または理科2科目", 100, 100),
      required("外国語", "英語などから1", 200, 100),
      required("情報", "情報Ⅰ", 100, 25),
    ],
    secondSubjects: [second("国語", 150), second("地理歴史", 100, "論述"), second("数学", 150), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "総合人間学部 文系。共通テスト550点、個別学力検査600点。",
  },
  {
    id: "2026-kyoto-integrated-human-studies-science-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "総合人間学部",
    departments: ["総合人間学科（理系）"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 125),
      optional("地歴・公民", "地歴・公民から1", 100, 100),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 100),
      required("理科", "理科2科目", 200, 100),
      required("外国語", "英語などから1", 200, 100),
      required("情報", "情報Ⅰ", 100, 25),
    ],
    secondSubjects: [second("国語", 150), second("数学", 200), second("理科", 200), second("外国語", 150)],
    ...KYOTO_SOURCE,
    note: "総合人間学部 理系。共通テスト550点、個別学力検査700点。",
  },
  {
    id: "2026-kyoto-letters-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "文学部",
    departments: ["人文学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から2", 200, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "基礎2分野または理科2科目", 100, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 15),
    ],
    secondSubjects: [second("国語", 150), second("地理歴史", 100, "論述"), second("数学", 100), second("外国語", 150)],
    ...KYOTO_SOURCE,
    note: "共通テスト265点を250点に換算し、個別学力検査500点と合算。",
  },
  {
    id: "2026-kyoto-education-humanities-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "教育学部",
    departments: ["教育科学科（文系）", "教育科学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から2", 200, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "基礎2分野または理科2科目", 100, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 15),
    ],
    secondSubjects: [second("国語", 200), second("地理歴史", 100, "論述"), second("数学", 150), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "教育学部 文系。共通テスト265点、個別学力検査650点。",
  },
  {
    id: "2026-kyoto-education-science-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "教育学部",
    departments: ["教育科学科（理系）"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から1", 100, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "理科2科目", 200, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 15),
    ],
    secondSubjects: [second("国語", 150), second("数学", 200), second("理科", 100), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "教育学部 理系。共通テスト265点、個別学力検査650点。",
  },
  {
    id: "2026-kyoto-law-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "法学部",
    departments: ["法学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 60),
      optional("地歴・公民", "地歴・公民から2", 200, 60),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 60),
      required("理科", "基礎2分野または理科2科目", 100, 30),
      required("外国語", "英語などから1", 200, 60),
      required("情報", "情報Ⅰ", 100, 15),
    ],
    secondSubjects: [second("国語", 150), second("地理歴史", 100, "論述"), second("数学", 150), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "共通テスト950点を285点に換算し、個別学力検査600点と合算。",
  },
  {
    id: "2026-kyoto-economics-humanities-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "経済学部",
    departments: kyotoEconomicsDepartments,
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から2", 200, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "基礎2分野または理科2科目", 100, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 50),
    ],
    secondSubjects: [second("国語", 150), second("地理歴史", 100, "論述"), second("数学", 150), second("外国語", 150)],
    ...KYOTO_SOURCE,
    note: "経済学部 文系。共通テスト300点、個別学力検査550点。デモ生徒はこのテンプレートを適用。",
  },
  {
    id: "2026-kyoto-economics-science-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "経済学部",
    departments: ["経済経営学科（理系）"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から1", 100, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "理科2科目", 200, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 50),
    ],
    secondSubjects: [second("国語", 150), second("数学", 300), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "経済学部 理系。共通テスト300点、個別学力検査650点。",
  },
  {
    id: "2026-kyoto-science-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "理学部",
    departments: ["理学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から1", 100, 25),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "理科2科目", 200, 50),
      required("外国語", "英語", 200, 50),
      required("情報", "情報Ⅰ", 100, 25),
    ],
    secondSubjects: [second("国語", 150), second("数学", 300), second("理科", 300), second("外国語", 225)],
    ...KYOTO_SOURCE,
    note: "共通テスト250点、個別学力検査975点。",
  },
  {
    id: "2026-kyoto-medicine-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "医学部",
    departments: ["医学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から1", 100, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "理科2科目", 200, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 25),
    ],
    secondSubjects: [second("国語", 150), second("数学", 250), second("理科", 300), second("外国語", 300), second("面接", 0, "面接")],
    ...KYOTO_SOURCE,
    note: "医学科。共通テスト275点、個別学力検査1000点。面接は適性評価で点数化なし。",
  },
  {
    id: "2026-kyoto-human-health-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "医学部",
    departments: ["人間健康科学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 50),
      optional("地歴・公民", "地歴・公民から1", 100, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "理科2科目", 200, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 25),
    ],
    secondSubjects: [second("国語", 150), second("数学", 200), second("理科", 200), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "共通テスト275点、個別学力検査750点。",
  },
  {
    id: "2026-kyoto-pharmaceutical-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "薬学部",
    departments: ["薬科学科", "薬学科", "薬科学科・薬学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 40),
      optional("地歴・公民", "地歴・公民から1", 100, 40),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 40),
      required("理科", "理科2科目", 200, 40),
      required("外国語", "英語などから1", 200, 40),
      required("情報", "情報Ⅰ", 100, 20),
    ],
    secondSubjects: [second("国語", 100), second("数学", 200), second("理科", 200), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "薬学部一括募集。共通テスト220点、個別学力検査700点。",
  },
  {
    id: "2026-kyoto-engineering-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "工学部",
    departments: ["地球工学科", "建築学科", "物理工学科", "電気電子工学科", "情報学科", "理工化学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 25),
      optional("地歴・公民", "地歴・公民から1", 100, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 25),
      required("理科", "物理必須、化学または生物", 200, 25),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 50),
    ],
    secondSubjects: [second("国語", 100), second("数学", 250), second("理科", 250), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "工学部全学科共通。共通テスト225点、個別学力検査800点。",
  },
  {
    id: "2026-kyoto-agriculture-front",
    sourceYear: 2026,
    university: "京都大学",
    faculty: "農学部",
    departments: ["資源生物科学科", "応用生命科学科", "地域環境工学科", "食料・環境経済学科", "森林科学科", "食品生物科学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 70),
      optional("地歴・公民", "地歴・公民から1", 100, 100),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 50),
      required("理科", "理科2科目", 200, 50),
      required("外国語", "英語などから1", 200, 50),
      required("情報", "情報Ⅰ", 100, 30),
    ],
    secondSubjects: [second("国語", 100), second("数学", 200), second("理科", 200), second("外国語", 200)],
    ...KYOTO_SOURCE,
    note: "農学部全学科共通。共通テスト350点、個別学力検査700点。",
  },
  {
    id: "2026-nagoya-engineering-front",
    sourceYear: 2026,
    university: "名古屋大学",
    faculty: "工学部",
    departments: [
      "化学生命工学科",
      "物理工学科",
      "マテリアル工学科",
      "電気電子情報工学科",
      "機械・航空宇宙工学科",
      "エネルギー理工学科",
      "環境土木・建築学科",
    ],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 200),
      required("社会①", "地歴・公民から1", 100, 100),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 100),
      required("理科", "物理・化学", 200, 100),
      required("外国語", "英語などから1", 200, 100),
      required("情報", "情報Ⅰ", 100, 35),
    ],
    secondSubjects: [second("数学", 500), second("理科", 500), second("英語", 300)],
    ...NAGOYA_SOURCE,
    note: "工学部前期の全学科共通配点。大学入学共通テスト635点、個別学力検査1300点。",
  },
  {
    id: "2026-hamamatsu-medical-medicine-front",
    sourceYear: 2026,
    university: "浜松医科大学",
    faculty: "医学部",
    departments: ["医学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 100),
      optional("地歴・公民", "地歴・公民から1", 100, 50),
      required("数学", "数学ⅠA・数学ⅡBC", 200, 100),
      required("理科", "理科2科目", 200, 100),
      required("外国語", "英語", 200, 100),
      required("情報", "情報Ⅰ", 100, 25),
    ],
    secondSubjects: [second("数学", 200), second("理科", 200), second("英語", 200), second("面接", 100, "面接")],
    ...HAMAMATSU_MED_SOURCE,
    note: "医学科前期。共通テストは情報を除き1/2、情報は1/4換算で475点。個別テスト等700点。",
  },
  {
    id: "2026-hamamatsu-medical-nursing-front",
    sourceYear: 2026,
    university: "浜松医科大学",
    faculty: "医学部",
    departments: ["看護学科"],
    method: "前期日程",
    commonSubjects: [
      required("国語", "国語", 200, 200),
      optional("地歴・公民", "地歴・公民から1", 100, 100),
      required("数学", "数学から1", 200, 100),
      required("理科", "理科または基礎2分野", 100, 100),
      required("外国語", "英語", 200, 200),
      required("情報", "情報Ⅰ", 100, 50),
    ],
    secondSubjects: [second("小論文", 200, "論述"), second("面接", 50, "面接")],
    ...HAMAMATSU_MED_SOURCE,
    note: "看護学科前期。共通テスト750点、個別テスト等250点。",
  },
];

function normalize(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function facultyAlias(university: string, faculty: string, department: string) {
  if (university === "東京大学" && ["文科一類", "文科二類", "文科三類"].includes(faculty)) {
    return "文科各類";
  }
  if (university === "東京大学" && ["理科一類", "理科二類", "理科三類"].includes(faculty)) {
    return "理科各類";
  }
  if (university === "東京大学" && !department) {
    return faculty;
  }
  return faculty;
}

export function findAdmissionScoreTemplate(params: {
  university?: string;
  faculty?: string;
  department?: string;
  method?: string;
}) {
  const rawUniversity = params.university ?? "";
  const rawFaculty = params.faculty ?? "";
  const rawDepartment = params.department || rawFaculty;
  const university = normalize(rawUniversity);
  const faculty = normalize(facultyAlias(rawUniversity, rawFaculty, rawDepartment));
  const department = normalize(rawDepartment);
  const method = normalize(params.method || "前期日程");

  return (
    admissionScoreTemplates.find((template) => {
      if (normalize(template.university) !== university) return false;
      if (normalize(template.faculty) !== faculty) return false;
      if (method && normalize(template.method) !== method) return false;
      return template.departments.some((item) => normalize(item) === department);
    }) ?? null
  );
}
