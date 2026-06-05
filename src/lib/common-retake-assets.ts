import type { ExamMetadata } from "@/types/exam";

export type PracticeVariant = "main" | "reinforcement";
export type RetakeAssetStatus = "registered" | "pending" | "needsReview";
export type RetakeAssetKind = "problem" | "answer" | "listeningAudio" | "script" | "marksheet";

export type RetakeAsset = {
  kind: RetakeAssetKind;
  label: string;
  status: RetakeAssetStatus;
  url?: string;
  note: string;
};

export type RetakeRegistration = {
  year: number;
  reiwa: string;
  subject: string;
  subjectLabel: string;
  baseExamId: string;
  reinforcementExamId: string;
  hasRetakeExam: boolean;
  officialYearUrl: string;
  problemUrl?: string;
  answerUrl: string;
  assets: RetakeAsset[];
};

export const retakeYears = [2026, 2025, 2024, 2023, 2022];

export const commonSubjectLabels: Record<string, string> = {
  english: "英語リーディング",
  english_listening: "英語リスニング",
  japanese: "国語",
  math_ia: "数学I・A",
  math_iibc: "数学II・B・C",
  math_iib: "数学II・B",
  japanese_history: "歴史総合・日本史探究",
  japanese_history_b: "日本史B",
  world_history: "歴史総合・世界史探究",
  world_history_b: "世界史B",
  geography: "地理総合・地理探究",
  geography_b: "地理B",
  public_ethics: "公共、倫理",
  public_politics_economy: "公共、政治・経済",
  integrated_history_public: "地理総合・歴史総合・公共",
  ethics: "倫理",
  politics_economy: "政治・経済",
  ethics_politics_economy: "倫理，政治・経済",
  science_basics: "理科基礎",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  earth_science: "地学",
  physics_basics: "物理基礎",
  chemistry_basics: "化学基礎",
  biology_basics: "生物基礎",
  earth_science_basics: "地学基礎",
  information_i: "情報I",
};

const reiwaByYear: Record<number, string> = {
  2026: "令和8年度",
  2025: "令和7年度",
  2024: "令和6年度",
  2023: "令和5年度",
  2022: "令和4年度",
};

const yearUrls: Record<number, string> = {
  2026: "https://www.dnc.ac.jp/kyotsu/shiken_jouhou/r8/index.html",
  2025: "https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r7/index.html",
  2024: "https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r6/index.html",
  2023: "https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r5/",
  2022: "https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r4/",
};

const problemUrls: Partial<Record<number, string>> = {
  2025: "https://www.dnc.ac.jp/kyotsu/kakomondai/r7/r7_tuisaishiken_mondai.html",
  2024: "https://www.dnc.ac.jp/kyotsu/kakomondai/r6/r6_tuisaishiken_mondai.html",
  2023: "https://www.dnc.ac.jp/kyotsu/kakomondai/r5/r5_tuisaishiken_mondai.html",
  2022: "https://www.dnc.ac.jp/kyotsu/kakomondai/r4/r4_tuisaishiken_mondai.html",
};

const answerUrls: Record<number, string> = {
  2026: "https://www.dnc.ac.jp/kyotsu/shiken_jouhou/r8/r8_tuisaisiken_seikai.html",
  2025: "https://www.dnc.ac.jp/kyotsu/kakomondai/r7/r7_tuisaisiken_seikai.html",
  2024: "https://www.dnc.ac.jp/kyotsu/kakomondai/r6/r6_tuisaisiken_seikai.html",
  2023: "https://www.dnc.ac.jp/kyotsu/kakomondai/r5/r5_tuisaisiken_seikai.html",
  2022: "https://www.dnc.ac.jp/kyotsu/kakomondai/r4/r4_tuisaisiken_seika.html",
};

function hasListening(subject: string) {
  return subject === "english_listening";
}

function buildAssets(year: number, subject: string, retakeExam?: ExamMetadata): RetakeAsset[] {
  const problemPublished = year !== 2026;
  const hasRetakeExam = Boolean(retakeExam);
  const source = (retakeExam as ExamMetadata & { source?: { kind?: string; problem_url?: string | null; answer_url?: string | null; marksheet_status?: string } } | undefined)?.source;
  const hasLocalProblem = hasRetakeExam && Boolean(retakeExam?.problem_files?.length);
  const hasLocalAnswer = hasRetakeExam && Boolean(retakeExam?.hasAnswer);
  const hasOfficialProblem = hasLocalProblem || source?.kind !== "placeholder" && Boolean(source?.problem_url);
  const hasOfficialAnswer = hasLocalAnswer || source?.kind !== "placeholder" && Boolean(source?.answer_url);
  const hasGeneratedMarksheet =
    hasRetakeExam &&
    Boolean(retakeExam?.hasMarksheet) &&
    !String(source?.marksheet_status ?? "").startsWith("not_generated") &&
    !String(source?.marksheet_status ?? "").startsWith("needs_review");
  const assets: RetakeAsset[] = [
    {
      kind: "problem",
      label: "問題PDF",
      status: hasRetakeExam && hasOfficialProblem ? "registered" : problemPublished ? "needsReview" : "pending",
      url: problemPublished ? problemUrls[year] : yearUrls[year],
      note: problemPublished
        ? "公式の問題ページから科目別PDFを回収し、登録済みPDFとの差し替え確認を行ってください。"
        : "公式年度ページでは著作権等の処理終了後に掲載される扱いです。",
    },
    {
      kind: "answer",
      label: "正解PDF",
      status: hasRetakeExam && hasOfficialAnswer ? "registered" : "needsReview",
      url: answerUrls[year],
      note: "公式の追・再試験正解ページを回収元として登録します。",
    },
    {
      kind: "marksheet",
      label: "マークシート定義",
      status: hasGeneratedMarksheet ? "registered" : "needsReview",
      note: "同年度・同科目の本試験定義を初期値にして、弱点補強演習用に確認します。",
    },
  ];

  if (hasListening(subject)) {
    assets.splice(
      2,
      0,
      {
        kind: "listeningAudio",
        label: "英語リスニング音声",
        status: "registered",
        url: year === 2026 ? answerUrls[year] : "https://www.dnc.ac.jp/kyotsu/listening.html",
        note: "音量調整用音声と問題音声を登録対象に含めます。",
      },
      {
        kind: "script",
        label: "スクリプト",
        status: "registered",
        url: answerUrls[year],
        note: "公式の正解ページに掲載されるスクリプトを登録対象に含めます。",
      },
    );
  }

  return assets;
}

export function buildRetakeRegistrations(exams: ExamMetadata[]): RetakeRegistration[] {
  const retakeByKey = new Map(
    exams
      .filter((exam) => exam.exam_type === "common_retake" || exam.id.startsWith("common_retake/"))
      .map((exam) => [`${exam.year}/${exam.subject}`, exam]),
  );

  return exams
    .filter((exam) => exam.exam_type === "common" && retakeYears.includes(exam.year))
    .map((exam) => {
      const retakeExam = retakeByKey.get(`${exam.year}/${exam.subject}`);
      return {
        year: exam.year,
        reiwa: reiwaByYear[exam.year] ?? `${exam.year}年度`,
        subject: exam.subject,
        subjectLabel: commonSubjectLabels[exam.subject] ?? exam.subject,
        baseExamId: exam.id,
        reinforcementExamId: retakeExam?.id ?? `${exam.id}?mode=reinforcement`,
        hasRetakeExam: Boolean(retakeExam),
        officialYearUrl: yearUrls[exam.year],
        problemUrl: problemUrls[exam.year],
        answerUrl: answerUrls[exam.year],
        assets: buildAssets(exam.year, exam.subject, retakeExam),
      };
    })
    .filter((registration) => {
      const answer = registration.assets.find((asset) => asset.kind === "answer");
      const marksheet = registration.assets.find((asset) => asset.kind === "marksheet");
      return registration.hasRetakeExam && answer?.status === "registered" && marksheet?.status === "registered";
    })
    .sort(
      (left, right) =>
        right.year - left.year ||
        left.subjectLabel.localeCompare(right.subjectLabel, "ja"),
    );
}

export function getRetakeAssetSummary(registration: RetakeRegistration) {
  const registered = registration.assets.filter((asset) => asset.status === "registered").length;
  const pending = registration.assets.filter((asset) => asset.status === "pending").length;
  const needsReview = registration.assets.filter((asset) => asset.status === "needsReview").length;
  return { registered, pending, needsReview, total: registration.assets.length };
}
