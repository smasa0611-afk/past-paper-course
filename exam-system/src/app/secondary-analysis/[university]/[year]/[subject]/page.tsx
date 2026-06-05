"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileBarChart2,
  FolderOpen,
  GraduationCap,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { ExamMetadata } from "@/types/exam";
import type { StoredSubmission } from "@/lib/submission-storage";
import {
  calculateCommonConvertedScore,
  commonConversionSubjectMax,
  getTargetConversionConfig,
} from "@/lib/target-conversion-demo";

type User = { id: string; name: string; role: "student" | "teacher" };
type CourseProfile = {
  goal?: { university?: string; faculty?: string; department?: string } | null;
  secondaryCourses?: { targetKey: string; targetName: string; goalFaculty?: string; goalDepartment?: string }[];
};
type SubjectConfig = { label: string; max: number; aliases: string[]; feature: string; advice: string };
type CommonSubjectConfig = { slug: string; aliases: string[] };
type AdmissionRow = {
  faculty: string;
  department: string;
  capacity?: number;
  applicants?: number;
  examinees?: number;
  passed?: number;
  min?: number;
  average?: number;
  high?: number;
  total?: number;
  note?: string;
};
type SourceLink = { label: string; url: string; note: string };
type AdmissionDataset = {
  sourceLabel: string;
  sourceUrl: string;
  verifiedOn: string;
  rows: AdmissionRow[];
  note?: string;
};
type ExamSubjectAnalysis = {
  subject: string;
  label: string;
  difficulty: "難化" | "やや難化" | "昨年並" | "やや易化" | "易化" | "未判定";
  volume: "増加" | "やや増加" | "昨年並" | "やや減少" | "減少" | "未判定";
  impact: number;
  summary: string;
  strategy: string;
  topics: string[];
  sourceLabel: string;
  sourceUrl: string;
};
type ExamAnalysisDataset = {
  sourceLabel: string;
  sourceUrl: string;
  verifiedOn: string;
  note: string;
  subjects: ExamSubjectAnalysis[];
};

const YEARS = Array.from({ length: 10 }, (_, index) => 2026 - index);
const DEMO_RESTART_STUDENT_ID = "10000002";
const DEMO_RATES = [68, 63, 56, 47, 42, 28];
const DEMO_RESTART_RATES = [64, 58, 52, 45, 43, 52, 45, 38, 36, 36, 59, 51, 44, 62, 56, 48];
const DEMO_TARGET_ENGLISH_SCORE_RATES: Record<string, number[]> = {
  "10000002": [64, 42, 59, 48, 54, 50, 46, 51, 44, 57],
  "10000003": [62, 53, 58, 55, 60, 57, 52, 56, 54, 61],
  "10000004": [70, 67, 64, 62, 68, 65, 61, 66, 63, 69],
  "10000005": [68, 65, 62, 60, 66, 63, 59, 64, 61, 67],
};

const UNIVERSITY_LABELS: Record<string, string> = {
  todai: "東京大学",
  kyodai: "京都大学",
  nagoya: "名古屋大学",
  hamamatsu_medical: "浜松医科大学",
};

const DEFAULT_FACULTIES: Record<string, string[]> = {
  todai: ["文科一類", "文科二類", "文科三類", "理科一類", "理科二類", "理科三類"],
  kyodai: ["総合人間学部", "文学部", "教育学部", "法学部", "経済学部", "理学部", "医学部医学科", "工学部"],
  nagoya: ["文学部", "教育学部", "法学部", "経済学部", "情報学部", "理学部", "医学部医学科", "工学部"],
  hamamatsu_medical: ["医学部医学科", "医学部看護学科"],
};

const SUBJECTS: Record<string, Record<string, SubjectConfig>> = {
  todai: {
    english: {
      label: "英語",
      max: 120,
      aliases: ["english"],
      feature: "長文読解、要約、英作文、リスニングを横断する処理力が問われます。",
      advice: "読解速度を落とさず、要約・英作文・リスニングを毎回セットで確認しましょう。",
    },
    math: {
      label: "数学",
      max: 120,
      aliases: ["math"],
      feature: "完答しにくい大問で、方針設定と途中点の回収が差になります。",
      advice: "典型処理の精度を上げ、部分点を取り切る答案設計を優先しましょう。",
    },
    japanese: {
      label: "国語",
      max: 80,
      aliases: ["japanese"],
      feature: "本文根拠を短く正確にまとめる記述力が重要です。",
      advice: "設問要求ごとに根拠を本文から拾い、答案の骨格を先に作りましょう。",
    },
    physics: {
      label: "物理",
      max: 60,
      aliases: ["physics", "science"],
      feature: "標準処理から応用まで、状況整理と式変形の正確さが問われます。",
      advice: "力学・電磁気の設定を図式化し、後半設問まで見通す練習を増やしましょう。",
    },
    chemistry: {
      label: "化学",
      max: 60,
      aliases: ["chemistry", "science"],
      feature: "理論・無機・有機を横断し、計算と知識の抜け漏れが差になります。",
      advice: "構造決定と理論計算を軸に、未知題材でも条件を整理して説明しましょう。",
    },
  },
  kyodai: {
    english: {
      label: "英語",
      max: 150,
      aliases: ["english"],
      feature: "和訳・英作文の比重が高く、精密な読解と自然な表現が必要です。",
      advice: "構文把握、和訳の日本語化、英作文の型を答案単位で復習しましょう。",
    },
    math: {
      label: "数学",
      max: 200,
      aliases: ["math"],
      feature: "証明・論述を含む重い問題が多く、答案の筋道が評価されます。",
      advice: "完答できる問題の見極めと、論理の省略を減らす演習を続けましょう。",
    },
    japanese: {
      label: "国語",
      max: 150,
      aliases: ["japanese"],
      feature: "記述量が多く、本文の論理を崩さず説明する力が求められます。",
      advice: "答案の骨子を先に作り、設問ごとの根拠を明確にしましょう。",
    },
    science: {
      label: "理科",
      max: 200,
      aliases: ["science", "physics", "chemistry", "biology"],
      feature: "分野横断の応用問題があり、基礎事項の運用力が重要です。",
      advice: "苦手分野を特定し、標準問題から応用問題へ段階的に戻しましょう。",
    },
  },
  nagoya: {
    english: {
      label: "英語",
      max: 300,
      aliases: ["english"],
      feature: "読解量が多く、内容把握と記述説明のバランスが必要です。",
      advice: "時間配分を固定し、根拠を本文から素早く拾う練習をしましょう。",
    },
    math: {
      label: "数学",
      max: 500,
      aliases: ["math"],
      feature: "配点が大きく、標準問題を確実に取ることが総合点に直結します。",
      advice: "典型問題の完答率を上げ、計算ミスの記録を残しましょう。",
    },
    physics: {
      label: "物理",
      max: 250,
      aliases: ["physics", "science"],
      feature: "標準的ながら計算量があり、処理速度で差がつきます。",
      advice: "問題設定を図示し、式の立て方を短時間で再現しましょう。",
    },
    chemistry: {
      label: "化学",
      max: 250,
      aliases: ["chemistry", "science"],
      feature: "知識と計算がバランスよく問われ、正確な処理が必要です。",
      advice: "理論計算と有機構造決定の演習を厚めにしましょう。",
    },
  },
  hamamatsu_medical: {
    english: {
      label: "英語",
      max: 200,
      aliases: ["english"],
      feature: "医学部らしい英文読解と、正確な内容把握が中心です。",
      advice: "医学・科学系テーマの語彙と要旨把握を強化しましょう。",
    },
    math: {
      label: "数学",
      max: 200,
      aliases: ["math"],
      feature: "標準問題の完答力が重要で、ミスの少なさが合否を左右します。",
      advice: "典型分野を広く戻し、途中計算の検算手順を作りましょう。",
    },
    science: {
      label: "理科",
      max: 300,
      aliases: ["science", "physics", "chemistry", "biology"],
      feature: "理科の配点が高く、複数科目で安定して積む必要があります。",
      advice: "物理・化学・生物の弱い単元を優先順位化しましょう。",
    },
  },
};

const COMMON_SUBJECTS: CommonSubjectConfig[] = [
  { slug: "english", aliases: ["english", "english_r", "reading"] },
  { slug: "english_listening", aliases: ["english_listening", "listening"] },
  { slug: "math_ia", aliases: ["math_ia"] },
  { slug: "math_iibc", aliases: ["math_iibc", "math_iib"] },
  { slug: "japanese", aliases: ["japanese"] },
  { slug: "science_1", aliases: ["physics", "biology", "earth_science", "science_1"] },
  { slug: "science_2", aliases: ["chemistry", "science_2"] },
  { slug: "social_1", aliases: ["japanese_history", "japanese_history_b", "world_history", "world_history_b", "geography", "geography_b", "social_1"] },
  { slug: "social_2", aliases: ["public", "politics_economy", "ethics", "ethics_politics_economy", "modern_society", "social_2"] },
  { slug: "information_i", aliases: ["information_i", "information", "information_related_basics"] },
];

const SOURCE_LINKS: Record<string, SourceLink[]> = {
  todai: [
    {
      label: "代々木ゼミナール 東京大学 2026年度入試結果",
      url: "https://www.yozemi.ac.jp/nyushi/data/todai/2026.html",
      note: "2026年度の科類別合格者成績と第1段階選抜の得点を確認。",
    },
    {
      label: "代々木ゼミナール 東京大学 第1段階選抜・合格最低点推移",
      url: "https://www.yozemi.ac.jp/nyushi/major_university_data/todai/todai_jokyo_2.html",
      note: "2025年から2026年の第1段階選抜最低点率の変化を確認。",
    },
  ],
  kyodai: [
    {
      label: "京都大学 入学者選抜実施状況",
      url: "https://www.kyoto-u.ac.jp/ja/admissions/undergrad/jisshijokyo",
      note: "令和8年度から平成29年度までの実施状況PDFが公開されています。",
    },
    {
      label: "京都大学 一般選抜出願状況と選考結果",
      url: "https://www.kyoto-u.ac.jp/ja/admissions/undergrad/statistics",
      note: "2026年3月10日現在の前期日程合格者数を確認。",
    },
  ],
  nagoya: [
    {
      label: "名古屋大学 入学者選抜状況・成績開示",
      url: "https://www.nagoya-u.ac.jp/admissions/exam/data/exam-data/",
      note: "令和8年度から令和4年度までの選抜状況・合格者成績PDFが公開されています。",
    },
    {
      label: "名古屋大学 令和8年度 合格最高・最低点及び平均点",
      url: "https://www.nagoya-u.ac.jp/admissions/exam/upload/R8.tokuten.pdf",
      note: "2026年度の学部・学科別の最高点、最低点、平均点を確認。",
    },
  ],
  hamamatsu_medical: [
    {
      label: "浜松医科大学 入学者選抜状況",
      url: "https://www.hama-med.ac.jp/admission/senbatsu.html",
      note: "2026年度・2025年度の共通テスト、2次、総合得点を確認。",
    },
  ],
};

const EXAM_ANALYSIS_DATA: Record<string, Record<number, ExamAnalysisDataset>> = {
  todai: {
    2026: {
      sourceLabel: "駿台 2026年度 東京大学 入試問題分析シート",
      sourceUrl: "https://www2.sundai.ac.jp/sokuhou/",
      verifiedOn: "2026-05-22",
      note: "駿台の分析シートで科目別の難易度・分量・設問別レベルを確認。科目ごとの表示は出典が確認できたものだけを反映します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "難化",
          volume: "増加",
          impact: 96,
          summary: "読解・英作文・リスニングを横断する構成は維持された一方、読解語数が増え、要約や小説読解など処理負荷の高い設問が目立つセットです。",
          strategy: "長文の速度維持に加え、要約、和訳、自由英作文、リスニングを分断せずに毎回セットで確認する必要があります。",
          topics: ["読解語数が増加", "要約の書き出し指定", "6年ぶりの小説出題", "下線部訳と文脈補充の負荷"],
          sourceLabel: "駿台 東京大学 英語 分析シート",
          sourceUrl: "https://www2.sundai.ac.jp/sokuhou/assets/pdf/tky1_eig_2.pdf",
        },
        {
          subject: "math",
          label: "数学（理科）",
          difficulty: "昨年並",
          volume: "昨年並",
          impact: 94,
          summary: "近年の高い水準を維持し、設問ごとの難易差が明確です。取捨選択、発想、記述化の負荷が大きく、高得点は容易ではないセットです。",
          strategy: "完答狙いだけでなく、解くべき大問を見極め、方針を答案に残して部分点を確実に回収する練習が重要です。",
          topics: ["微積分", "確率", "平面座標・複素数平面", "整数", "文理共通問題の復活"],
          sourceLabel: "駿台 東京大学 数学（理科）分析シート",
          sourceUrl: "https://www2.sundai.ac.jp/sokuhou/assets/pdf/tky1_suu2_2.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "昨年並",
          volume: "昨年並",
          impact: 78,
          summary: "基本的な設問を中心に、試験時間に対して適切な分量です。ただし設定の読み取りと物理的な考察が必要で、基礎が弱いと失点しやすい構成です。",
          strategy: "図を描く、文章を正確に読む、基本式を現象に結び付けて説明する訓練を優先します。",
          topics: ["力学・剛体", "電磁誘導", "レンズと光の干渉", "基本設問中心"],
          sourceLabel: "駿台 東京大学 物理 分析シート",
          sourceUrl: "https://www2.sundai.ac.jp/sokuhou/assets/pdf/tky1_but_2.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "易化",
          volume: "減少",
          impact: 82,
          summary: "理論・無機・有機の3題構成で、前年より難易度と分量が下がりました。第1問・第3問は取りやすく、第2問は実験条件の検討が必要です。",
          strategy: "標準問題を落とさず高得点を狙い、初見の実験条件や選択問題で止まらない処理力を磨きます。",
          topics: ["正誤選択の増加", "ゼオライト", "有機構造決定", "軸不斉"],
          sourceLabel: "駿台 東京大学 化学 分析シート",
          sourceUrl: "https://www2.sundai.ac.jp/sokuhou/assets/pdf/tky1_kag_2.pdf",
        },
      ],
    },
    2025: {
      sourceLabel: "河合塾 2025年度 東京大学 前期 入試問題分析",
      sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/t01/",
      verifiedOn: "2026-05-22",
      note: "河合塾の2025年度東京大学前期・科目別分析PDFを確認。抽出上、全体難易の選択表示が明確に読めない科目は、本文で確認できる分量・特徴だけを表示します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "未判定",
          impact: 88,
          summary: "読解総合、英作文、聞き取り、文法・語法、英文解釈の各分野から出題。5の記述式で和訳が出題され、共通選択肢の空所補充・語句整序が姿を消しました。",
          strategy: "形式変化に備え、要約、読解総合、英作文、リスニング、英文和訳を年度別に横断して戻します。",
          topics: ["和訳問題が出題", "共通選択肢型が消滅", "エッセイ色の強い素材", "文脈把握力"],
          sourceLabel: "河合塾 東京大学 英語 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/t01-11c.pdf",
        },
        {
          subject: "math",
          label: "数学（理科）",
          difficulty: "昨年並",
          volume: "やや増加",
          impact: 94,
          summary: "全問記述式6題。難易は前年と大差なく、若干分量が増えたとされています。複素数平面が2021年以来出題され、確率は出題されませんでした。",
          strategy: "整数・数列・図形問題を中心に、数学IIIの計算力と答案化の精度を上げます。",
          topics: ["複素数平面", "確率なし", "整数", "数列", "数学III計算"],
          sourceLabel: "河合塾 東京大学 数学（理科）2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/t01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "未判定",
          volume: "減少",
          impact: 74,
          summary: "設問数と必要計算量が前年より減少。近年の目新しい題材や複雑な設定は出題されず、グラフの概形を描く問題が出題されました。",
          strategy: "標準的な力学・電磁気・熱を基本法則から説明できるようにし、誘導を正確に追う練習を行います。",
          topics: ["設問数減少", "計算量減少", "剛体", "相互誘導", "熱力学"],
          sourceLabel: "河合塾 東京大学 物理 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/t01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "昨年並",
          volume: "昨年並",
          impact: 82,
          summary: "総設問数はほぼ同じで、思考力・判断力を要する設問を含み、全体として同程度の難易度。第1問が理論、第3問が有機に入れ替わりました。",
          strategy: "初見題材の情報を読み取り、知識や原理法則と組み合わせて判断する演習と論述対策を積みます。",
          topics: ["理論化学", "火山ガス", "ペプチド", "構成アミノ酸", "論述"],
          sourceLabel: "河合塾 東京大学 化学 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/t01-42c.pdf",
        },
      ],
    },
    2024: {
      sourceLabel: "河合塾 2024年度 東京大学 前期 入試問題分析",
      sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/24/t01/",
      verifiedOn: "2026-05-22",
      note: "河合塾の2024年度東京大学前期・科目別分析PDFを確認。本文で難易変化が明記されている科目は判定に反映します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "増加",
          impact: 90,
          summary: "2Aで主張選択型の意見論述が出題。2Bの英訳分量がかなり増え、5は2023年度より長い例年規模の読解に戻りました。",
          strategy: "多様な設問形式に触れ、読解速度、要約、意見論述、和文英訳を同じ制限時間内で処理します。",
          topics: ["意見論述", "和文英訳増加", "長文読解", "正誤問題"],
          sourceLabel: "河合塾 東京大学 英語 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/t01-11c.pdf",
        },
        {
          subject: "math",
          label: "数学（理科）",
          difficulty: "やや易化",
          volume: "昨年並",
          impact: 88,
          summary: "全問記述式6題。前年が難しかったことを踏まえ、やや易化。分野・難易ともにバランスよく、複素数平面は出題されませんでした。",
          strategy: "標準問題を落とさず、確率・数列・微積分・空間座標を答案として仕上げる練習を重視します。",
          topics: ["やや易化", "確率と数列", "空間座標", "微分積分", "複素数平面なし"],
          sourceLabel: "河合塾 東京大学 数学（理科）2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/t01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "易化",
          volume: "未判定",
          impact: 72,
          summary: "空所補充・選択式がなくなり、目新しい題材や複雑な設定もなくなったため易化と分析されています。",
          strategy: "標準的な力学・電磁気・熱を、基本法則から論述できる状態に戻します。",
          topics: ["易化", "空所補充なし", "力学", "電磁気", "熱"],
          sourceLabel: "河合塾 東京大学 物理 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/t01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "やや易化",
          volume: "昨年並",
          impact: 78,
          summary: "総設問数はほぼ同じながら、得点しやすい設問が増加し、全体としてやや易しくなったとされています。",
          strategy: "図表・グラフ読解を伴う思考問題と、有機・理論の標準処理を高精度で固めます。",
          topics: ["やや易化", "有機", "理論", "図表読解", "ディーン・スターク装置"],
          sourceLabel: "河合塾 東京大学 化学 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/t01-42c.pdf",
        },
      ],
    },
  },
  kyodai: {
    2026: {
      sourceLabel: "駿台・代々木ゼミナール 2026年度 京都大学 入試問題分析",
      sourceUrl: "https://www2.sundai.ac.jp/sokuhou/",
      verifiedOn: "2026-05-22",
      note: "駿台の分析シートと代ゼミの概評PDFの所在を確認。PDF文字抽出が崩れる科目は、出典リンクと確認済みの要点だけを表示します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "昨年並",
          volume: "増加",
          impact: 88,
          summary: "大問構成はおおむね維持されつつ、読解の総語数が増え、下線部内容説明や和訳で答案作成の負荷が高い年度です。",
          strategy: "抽象度の高い英文を精密に読み、和訳だけでなく説明問題として答案化する練習を増やします。",
          topics: ["下線部内容説明", "和訳", "条件英作文", "読解量増加"],
          sourceLabel: "駿台 京都大学 英語 分析シート",
          sourceUrl: "https://www2.sundai.ac.jp/sokuhou/assets/pdf/kyd1_eig_2.pdf",
        },
        {
          subject: "math",
          label: "数学（理系）",
          difficulty: "未判定",
          volume: "昨年並",
          impact: 90,
          summary: "河合塾分析では例年同様に誘導小問がなく、微分法・空間ベクトル・数列・三角関数・積分法・確率数列の6題構成です。大問別難度は標準2題、難1題、やや難2題、やや易1題です。",
          strategy: "誘導なしで方針を立てる力と、論理的でわかりやすい答案を作る力を鍛えます。難しめの問題は添削で答案の筋道を確認します。",
          topics: ["誘導小問なし", "微分法", "空間ベクトル", "数列", "確率・数列"],
          sourceLabel: "河合塾 京都大学 数学（理系）分析コメント",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/26/k01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "昨年並",
          volume: "増加",
          impact: 86,
          summary: "河合塾分析では長文の問題文が増加し、難易度自体は変化なしながらかなり取り組みにくいセットです。力学・電磁気・熱はいずれも状況把握の負荷があります。",
          strategy: "題意を正しく把握する読解力、図で状況を整理する習慣、正確で迅速な計算力を優先します。",
          topics: ["長文問題文が増加", "力学・電磁気", "電磁誘導・交流", "熱", "状況把握"],
          sourceLabel: "河合塾 京都大学 物理 分析コメント",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/26/k01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "未判定",
          volume: "昨年並",
          impact: 82,
          summary: "河合塾分析では記述・選択・計算形式で、今年度は論述問題と計算過程を書かせる問題がありません。化学平衡、脂肪族・芳香族、糖・脂肪酸など幅広い出題です。",
          strategy: "理論・無機・有機をまんべんなく戻し、化学平衡を深め、実験的な設定にも対応できるよう演習量を確保します。",
          topics: ["論述問題なし", "計算過程記述なし", "化学平衡", "有機構造", "糖・脂肪酸"],
          sourceLabel: "河合塾 京都大学 化学 分析コメント",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/26/k01-42c.pdf",
        },
      ],
    },
    2025: {
      sourceLabel: "河合塾 2025年度 京都大学 前期 入試問題分析",
      sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/k01/",
      verifiedOn: "2026-05-22",
      note: "河合塾の2025年度京都大学前期・科目別分析PDFを確認。全体難易の選択表示が抽出できない科目は、本文で確認できる分量・大問別難易を優先します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "未判定",
          impact: 86,
          summary: "読解では2024年度の空欄補充がなくなり、3年ぶりに内容説明問題が出題。自由英作文は独立大問として戻り、80〜100語で論証を含める形式でした。",
          strategy: "和訳に偏らず内容説明と自由英作文を戻し、指示条件を満たす答案構成を練習します。",
          topics: ["内容説明問題", "自由英作文独立", "和文英訳", "AIと想像力"],
          sourceLabel: "河合塾 京都大学 英語 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/k01-11c.pdf",
        },
        {
          subject: "math",
          label: "数学（理系）",
          difficulty: "未判定",
          volume: "昨年並",
          impact: 90,
          summary: "例年同様に誘導小問なし。複素数平面、積分法、整数、微分法、空間ベクトル、確率・数列など6題構成で、最終大問は難とされています。",
          strategy: "誘導なしで方針を立て、論理的に読みやすい答案を書く力を鍛えます。難しめの問題は添削で答案の筋を確認します。",
          topics: ["誘導小問なし", "複素数平面", "空間ベクトル", "確率", "数列"],
          sourceLabel: "河合塾 京都大学 数学（理系）2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/k01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "未判定",
          volume: "昨年並",
          impact: 84,
          summary: "空所補充中心で、一部に問形式を含む構成。目新しいテーマを誘導に従って解く必要があり、電磁気と熱はやや難の大問でした。",
          strategy: "題意把握、図示、誘導の利用、正確で速い計算をセットで訓練します。",
          topics: ["空所補充", "円運動", "自己誘導", "熱", "誘導利用"],
          sourceLabel: "河合塾 京都大学 物理 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/k01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "やや易化",
          volume: "昨年並",
          impact: 80,
          summary: "近年難度の高かった理論化学が取り組みやすい内容。字数制限のある論述や計算過程を記述させる問題が出題されました。",
          strategy: "理論・無機・有機をまんべんなく戻し、化学平衡と論述答案を重点的に練習します。",
          topics: ["理論化学が取り組みやすい", "論述", "計算過程記述", "化学平衡", "構造決定"],
          sourceLabel: "河合塾 京都大学 化学 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/k01-42c.pdf",
        },
      ],
    },
    2024: {
      sourceLabel: "河合塾 2024年度 京都大学 前期 入試問題分析",
      sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/24/k01/",
      verifiedOn: "2026-05-22",
      note: "河合塾の2024年度京都大学前期・科目別分析PDFを確認。大問別難易と本文コメントをもとに表示します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "未判定",
          impact: 86,
          summary: "読解で英文和訳に加え、2019年度以来の空欄補充が出題。自由英作文は大問IIに組み込まれ、80〜100語指定でした。",
          strategy: "和訳、空欄補充、意見論述型自由英作文を並行して戻し、形式変化に対応します。",
          topics: ["空欄補充復活", "自由英作文", "和文英訳", "内容説明なし"],
          sourceLabel: "河合塾 京都大学 英語 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/k01-11c.pdf",
        },
        {
          subject: "math",
          label: "数学（理系）",
          difficulty: "未判定",
          volume: "やや増加",
          impact: 92,
          summary: "数IIIの比重が前年にも増して大きく、誘導が増加。確率、複素数平面、空間ベクトル、数列、積分法などで、やや難の大問も含む構成です。",
          strategy: "誘導があっても本質的な難しさが残るため、誘導なしで解法を組み立てる訓練と答案添削を行います。",
          topics: ["数III比重大", "誘導増加", "極限", "空間ベクトル", "整数"],
          sourceLabel: "河合塾 京都大学 数学（理系）2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/k01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "未判定",
          volume: "増加",
          impact: 86,
          summary: "設問数は変わらないものの、例年通り解答時間に対して問題量が多い構成。目新しい問題を誘導に従って解く必要があります。",
          strategy: "空所補充型の誘導を正確に追い、図示と計算を止めずに進める練習を重視します。",
          topics: ["問題量多い", "単振動", "電磁気", "描図", "誘導処理"],
          sourceLabel: "河合塾 京都大学 物理 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/k01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "未判定",
          volume: "増加",
          impact: 88,
          summary: "Ⅰ・Ⅲ・Ⅳが中問に分かれ、問題量が増加。論述問題や計算過程記述はなく、結晶、気体、反応速度、有機構造など幅広い出題でした。",
          strategy: "理論・有機の処理量に耐えるため、計算と構造決定を時間制限つきで演習します。",
          topics: ["問題量増加", "結晶", "気体", "反応速度", "有機構造決定"],
          sourceLabel: "河合塾 京都大学 化学 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/k01-42c.pdf",
        },
      ],
    },
  },
  nagoya: {
    2026: {
      sourceLabel: "駿台・代々木ゼミナール 2026年度 名古屋大学 入試問題分析",
      sourceUrl: "https://www2.sundai.ac.jp/sokuhou/",
      verifiedOn: "2026-05-22",
      note: "駿台の分析シートと代ゼミ概評PDF、河合塾Kei-Net学習アドバイスを照合対象にしています。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "昨年並",
          volume: "減少",
          impact: 84,
          summary: "長文総合読解、会話文、自由英作文という構成を維持。課題英文量はやや減ったものの、記述・選択を併用する処理が必要です。",
          strategy: "読解量だけでなく、本文根拠を使った記述説明と自由英作文を同じ時間枠で処理する練習が必要です。",
          topics: ["長文総合読解", "会話文", "自由英作文", "記述説明"],
          sourceLabel: "駿台 名古屋大学 英語 分析シート",
          sourceUrl: "https://www2.sundai.ac.jp/sokuhou/assets/pdf/mei1_eig_2.pdf",
        },
        {
          subject: "math",
          label: "数学（理系）",
          difficulty: "昨年並",
          volume: "昨年並",
          impact: 92,
          summary: "河合塾分析では全問論述式の4題構成で、全大問が標準。共通問題があり、確率漸化式が6年ぶりに出題されました。",
          strategy: "標準問題の解法を確実にし、微積分・確率・整数・数列・図形を重点的に戻します。煩雑な計算にも耐える練習が必要です。",
          topics: ["全問論述式", "確率漸化式", "微分法・積分法", "空間ベクトル", "場合の数・整数"],
          sourceLabel: "河合塾 名古屋大学 数学（理系）分析コメント",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/26/n01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "昨年並",
          volume: "昨年並",
          impact: 78,
          summary: "河合塾分析では大問3題はいずれも標準。典型的な題材を掘り下げる構成で、選択問題がなくなり、グラフ全体を描図する問題が出題されました。",
          strategy: "標準問題を確実に解き、設定把握、法則適用、数値計算、時間内の取捨選択まで練習します。",
          topics: ["保存則・斜方投射・衝突", "コンデンサー", "波・ドップラー効果・干渉", "描図問題"],
          sourceLabel: "河合塾 名古屋大学 物理 分析コメント",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/26/n01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "やや難化",
          volume: "昨年並",
          impact: 84,
          summary: "河合塾分析では分量は変化なし、難易はやや難化。正答数が示されない正誤判定が増え、酸化還元や有機構造、アミノ酸の電離平衡などで悩みやすい構成です。",
          strategy: "計算を素早くまとめる練習に加え、論述、正誤判定、工業製法、有機反応条件を綿密に確認します。",
          topics: ["正誤判定増加", "無機・触媒", "酸化還元", "有機構造決定", "アミノ酸"],
          sourceLabel: "河合塾 名古屋大学 化学 分析コメント",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/26/n01-42c.pdf",
        },
      ],
    },
    2025: {
      sourceLabel: "河合塾 2025年度 名古屋大学 前期 入試問題分析",
      sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/n01/",
      verifiedOn: "2026-05-22",
      note: "河合塾の2025年度名古屋大学前期・科目別分析PDFを確認。本文で明示された語数・設問変化・大問別難易を表示します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "増加",
          impact: 86,
          summary: "本文語数は2,006語から2,290語へ増加。読解総合2題、対話文1題、英作文1題の構成は同じで、理由説明型の新設問が出題されました。",
          strategy: "増えた読解量に対応し、理由説明、和訳、自由英作文を時間内に処理する練習を行います。",
          topics: ["語数増加", "理由説明問題", "読解総合", "対話文", "自由英作文"],
          sourceLabel: "河合塾 名古屋大学 英語 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/n01-11c.pdf",
        },
        {
          subject: "math",
          label: "数学（理系）",
          difficulty: "未判定",
          volume: "昨年並",
          impact: 86,
          summary: "全問論述式4題。共通問題が出題され、複素数平面は出題なし。関数の極限、整数、積分法、確率が中心で、全体に標準〜やや易の大問構成です。",
          strategy: "標準解法を確実にし、微分積分・確率・整数・図形を重点的に戻します。",
          topics: ["全問論述式", "共通問題", "複素数平面なし", "関数の極限", "確率"],
          sourceLabel: "河合塾 名古屋大学 数学（理系）2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/n01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "昨年並",
          volume: "昨年並",
          impact: 78,
          summary: "基礎的な力量を問う典型問題が多い一方、文字指定や設定がやや煩雑な設問もありました。ここ3年の難易度は大きく変わらないとされています。",
          strategy: "標準問題を確実に解き、設定把握、法則適用、数値計算、時間内の取捨選択を練習します。",
          topics: ["標準問題中心", "設定が煩雑", "交流回路", "荷電粒子", "気体"],
          sourceLabel: "河合塾 名古屋大学 物理 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/n01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "未判定",
          volume: "やや増加",
          impact: 84,
          summary: "大問数は前年同様3題、実質4題構成。計算問題が増え、煩雑な数値計算もあり、時間的に苦しい受験生がいたと分析されています。",
          strategy: "計算を素早くまとめ、論述、無機知識、有機構造、天然高分子を時間制限つきで演習します。",
          topics: ["計算問題増加", "中和滴定", "無機", "有機構造", "天然高分子"],
          sourceLabel: "河合塾 名古屋大学 化学 2025分析",
          sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/25/n01-42c.pdf",
        },
      ],
    },
    2024: {
      sourceLabel: "河合塾 2024年度 名古屋大学 前期 入試問題分析",
      sourceUrl: "https://www.kawai-juku.ac.jp/nyushi/honshi/24/n01/",
      verifiedOn: "2026-05-22",
      note: "河合塾の2024年度名古屋大学前期・科目別分析PDFを確認。公式ページから辿れるPDFとkaisoku側PDFを照合しています。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "減少",
          impact: 78,
          summary: "本文語数は2,255語から2,006語へ減少。構成は読解総合2題、対話文1題、英作文1題で同じ。和文英訳は出題されませんでした。",
          strategy: "読解量は減ったものの、空所補充・適文補充・説明・英作文を安定して処理します。",
          topics: ["語数減少", "和文英訳なし", "読解総合", "図の説明", "自由英作文"],
          sourceLabel: "河合塾 名古屋大学 英語 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/n01-11c.pdf",
        },
        {
          subject: "math",
          label: "数学（理系）",
          difficulty: "未判定",
          volume: "昨年並",
          impact: 88,
          summary: "全問論述式4題。数学IIIからの出題が多く、3年連続で複素数平面が出題。融合問題が多い構成です。",
          strategy: "標準解法を土台に、条件や目標を意識して式を扱う論述力を鍛えます。",
          topics: ["数学III多め", "複素数平面", "融合問題", "確率", "数列"],
          sourceLabel: "河合塾 名古屋大学 数学（理系）2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/n01-21c.pdf",
        },
        {
          subject: "physics",
          label: "物理",
          difficulty: "未判定",
          volume: "やや減少",
          impact: 78,
          summary: "典型問題が多く、計算過程を記述する設問が減少。年度による難易度差が大きい点に注意とされています。",
          strategy: "典型処理を確実にしつつ、単振動、電磁誘導、交流回路、光を標準問題で固めます。",
          topics: ["典型問題中心", "計算過程記述減少", "単振動", "電磁誘導", "光"],
          sourceLabel: "河合塾 名古屋大学 物理 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/n01-41c.pdf",
        },
        {
          subject: "chemistry",
          label: "化学",
          difficulty: "易化",
          volume: "減少",
          impact: 76,
          summary: "計算過程を書かせる問題がなくなり、計算問題数もさらに減少。煩雑な計算がなく、難易度は前年より下がった印象と分析されています。",
          strategy: "標準計算を落とさず、教科書細部知識、正誤判定、有機構造を確認します。",
          topics: ["易化", "計算問題減少", "論述2問", "正誤判定", "クリックケミストリー"],
          sourceLabel: "河合塾 名古屋大学 化学 2024分析",
          sourceUrl: "https://kaisoku.kawai-juku.ac.jp/nyushi/honshi/24/n01-42c.pdf",
        },
      ],
    },
  },
  hamamatsu_medical: {
    2026: {
      sourceLabel: "浜松医科大学 公式資料・医学部予備校 傾向分析",
      sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
      verifiedOn: "2026-05-22",
      note: "浜松医科大は東大・京大・名大のような大手予備校の年度別詳細分析が薄いため、公式の入試資料と医学部予備校の傾向分析を分けて扱います。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "未判定",
          impact: 76,
          summary: "年度別の大手予備校分析は未確認です。医学部予備校系では、長文読解と医学・科学系テーマへの対応が対策の中心として扱われています。",
          strategy: "公式過去問で文章量と設問形式を確認し、医療・科学系語彙と内容説明を優先して補強します。",
          topics: ["公式過去問確認", "医学・科学系英文", "内容把握", "年度別分析は追加調査"],
          sourceLabel: "浜松医科大学 入試情報",
          sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
        },
        {
          subject: "math",
          label: "数学",
          difficulty: "未判定",
          volume: "未判定",
          impact: 82,
          summary: "年度別の分析シートは未確認です。医学部入試としては標準問題の完答力と計算精度が合否に直結します。",
          strategy: "典型分野を広く戻し、時間内に完答できる問題を取り切ることを優先します。",
          topics: ["公式過去問確認", "標準問題", "計算精度", "年度別分析は追加調査"],
          sourceLabel: "浜松医科大学 過去の入試問題",
          sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
        },
        {
          subject: "science",
          label: "理科",
          difficulty: "未判定",
          volume: "未判定",
          impact: 86,
          summary: "理科は医学科で重要度が高い領域です。年度別分析は追加調査対象ですが、物理・化学・生物の弱点単元を早期に切り分ける必要があります。",
          strategy: "得意科目で稼ぐ前提を作り、苦手単元は標準問題から再構成します。",
          topics: ["理科配点重視", "物理・化学・生物", "標準問題", "年度別分析は追加調査"],
          sourceLabel: "浜松医科大学 入試情報",
          sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
        },
      ],
    },
    2025: {
      sourceLabel: "浜松医科大学 公式資料・医学部予備校 傾向分析",
      sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
      verifiedOn: "2026-05-22",
      note: "浜松医科大2025年度は、東大・京大・名大のような大手予備校の年度別科目分析PDFを確認できていません。公式の入試情報・過去問・選抜状況を根拠に、難易度は未判定で表示します。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "未判定",
          impact: 74,
          summary: "2025年度の年度別大手予備校分析は未確認です。医学部入試としては、長文読解、内容把握、医療・科学系テーマへの対応を優先して扱います。",
          strategy: "公式過去問で設問形式を確認し、医療・科学系語彙と内容説明、要旨把握を中心に戻します。",
          topics: ["公式過去問確認", "長文読解", "医療・科学系英文", "年度別難易度は未判定"],
          sourceLabel: "浜松医科大学 入試情報",
          sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
        },
        {
          subject: "math",
          label: "数学",
          difficulty: "未判定",
          volume: "未判定",
          impact: 80,
          summary: "2025年度の科目別難易度分析は未確認です。医学部入試として、標準問題の完答力、計算精度、時間内の取捨選択を重視します。",
          strategy: "典型分野を広く戻し、完答可能な問題を取り切る練習を優先します。",
          topics: ["公式過去問確認", "標準問題", "計算精度", "年度別難易度は未判定"],
          sourceLabel: "浜松医科大学 過去の入試問題",
          sourceUrl: "https://www.hama-med.ac.jp/admission/past.html",
        },
        {
          subject: "science",
          label: "理科",
          difficulty: "未判定",
          volume: "未判定",
          impact: 84,
          summary: "2025年度の理科年度別分析は未確認です。医学科では理科の安定得点が重要なため、物理・化学・生物の弱点単元を早期に切り分けます。",
          strategy: "得意科目で稼ぐ前提を作り、苦手単元は標準問題から再構成します。",
          topics: ["理科配点重視", "物理・化学・生物", "標準問題", "年度別難易度は未判定"],
          sourceLabel: "浜松医科大学 入試情報",
          sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
        },
      ],
    },
    2024: {
      sourceLabel: "浜松医科大学 公式資料・医学部予備校 傾向分析",
      sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
      verifiedOn: "2026-05-22",
      note: "浜松医科大2024年度も、信頼できる年度別・科目別の難易度分析を確認できていません。公式資料を優先し、難易度は未判定のまま扱います。",
      subjects: [
        {
          subject: "english",
          label: "英語",
          difficulty: "未判定",
          volume: "未判定",
          impact: 74,
          summary: "2024年度の年度別大手予備校分析は未確認です。公式過去問を基準に、読解量、内容説明、医学・科学系テーマの有無を確認対象にします。",
          strategy: "過去問で本文量と設問形式を確認し、内容把握と説明答案を優先して補強します。",
          topics: ["公式過去問確認", "長文読解", "内容説明", "年度別難易度は未判定"],
          sourceLabel: "浜松医科大学 過去の入試問題",
          sourceUrl: "https://www.hama-med.ac.jp/admission/past.html",
        },
        {
          subject: "math",
          label: "数学",
          difficulty: "未判定",
          volume: "未判定",
          impact: 80,
          summary: "2024年度の年度別数学分析は未確認です。公式過去問で大問構成と処理量を確認し、推測で難化・易化は表示しません。",
          strategy: "標準典型を完答し、計算の検算手順を固定します。",
          topics: ["公式過去問確認", "標準問題", "完答力", "年度別難易度は未判定"],
          sourceLabel: "浜松医科大学 過去の入試問題",
          sourceUrl: "https://www.hama-med.ac.jp/admission/past.html",
        },
        {
          subject: "science",
          label: "理科",
          difficulty: "未判定",
          volume: "未判定",
          impact: 84,
          summary: "2024年度の年度別理科分析は未確認です。物理・化学・生物の選択別に、公式過去問で単元と計算量を確認する扱いです。",
          strategy: "標準問題をベースに、選択科目ごとの弱点単元を絞り込みます。",
          topics: ["公式過去問確認", "理科配点重視", "選択科目別確認", "年度別難易度は未判定"],
          sourceLabel: "浜松医科大学 入試情報",
          sourceUrl: "https://www.hama-med.ac.jp/admission/index.html",
        },
      ],
    },
  },
};

const ADMISSION_DATA: Record<string, Record<number, AdmissionDataset>> = {
  todai: {
    2026: {
      sourceLabel: "代々木ゼミナール 東京大学 2026年度入試結果",
      sourceUrl: "https://www.yozemi.ac.jp/nyushi/data/todai/2026.html",
      verifiedOn: "2026-05-22",
      note: "共通テストを110点に圧縮、2次は440点、総合550点満点。",
      rows: [
        { faculty: "文科一類", department: "前期日程", capacity: 401, applicants: 1229, examinees: 985, passed: 403, high: 430.13, min: 325.01, average: 352.7684, total: 550 },
        { faculty: "文科二類", department: "前期日程", capacity: 353, applicants: 996, examinees: 875, passed: 355, high: 420.85, min: 330.47, average: 353.9396, total: 550 },
        { faculty: "文科三類", department: "前期日程", capacity: 469, applicants: 1281, examinees: 1161, passed: 470, high: 434.96, min: 316.32, average: 339.1589, total: 550 },
        { faculty: "理科一類", department: "前期日程", capacity: 1108, applicants: 2736, examinees: 2522, passed: 1121, high: 443.28, min: 303.39, average: 332.1105, total: 550 },
        { faculty: "理科二類", department: "前期日程", capacity: 532, applicants: 1710, examinees: 1572, passed: 542, high: 396.85, min: 305, average: 326.4965, total: 550 },
        { faculty: "理科三類", department: "前期日程", capacity: 97, applicants: 377, examinees: 266, passed: 99, high: 453.6, min: 346.09, average: 377.7881, total: 550 },
      ],
    },
    2025: {
      sourceLabel: "駿台・東京大学 2025年度入試結果掲載値",
      sourceUrl: "https://www2.sundai.ac.jp/yobi/sv/sundai/scontents_P/news_PD/1337479388507.html",
      verifiedOn: "2026-05-22",
      note: "共通テストを110点に圧縮、2次は440点、総合550点満点。",
      rows: [
        { faculty: "文科一類", department: "前期日程", capacity: 401, applicants: 1139, examinees: 999, passed: 406, high: 438.54, min: 336.29, average: 359.7405, total: 550 },
        { faculty: "文科二類", department: "前期日程", capacity: 353, applicants: 986, examinees: 877, passed: 358, high: 418.42, min: 332.24, average: 355.8092, total: 550 },
        { faculty: "文科三類", department: "前期日程", capacity: 469, applicants: 1305, examinees: 1165, passed: 469, high: 420.03, min: 321.93, average: 344.1164, total: 550 },
        { faculty: "理科一類", department: "前期日程", capacity: 1108, applicants: 2727, examinees: 2515, passed: 1121, high: 444.05, min: 321, average: 348.8619, total: 550 },
        { faculty: "理科二類", department: "前期日程", capacity: 532, applicants: 1876, examinees: 1577, passed: 545, high: 423.86, min: 313.15, average: 333.2541, total: 550 },
        { faculty: "理科三類", department: "前期日程", capacity: 97, applicants: 388, examinees: 285, passed: 98, high: 473.06, min: 368.67, average: 395.2677, total: 550 },
      ],
    },
  },
  kyodai: {
    2026: {
      sourceLabel: "京都大学 一般選抜出願状況と選考結果",
      sourceUrl: "https://www.kyoto-u.ac.jp/ja/admissions/undergrad/statistics",
      verifiedOn: "2026-05-22",
      note: "2026年3月10日現在の前期日程合格者数。合格最低点は入学者選抜実施状況PDFで確認対象。",
      rows: [
        { faculty: "総合人間学部", department: "前期日程", capacity: 116, passed: 118 },
        { faculty: "文学部", department: "前期日程", capacity: 211, passed: 214 },
        { faculty: "教育学部", department: "前期日程", capacity: 57, passed: 58 },
        { faculty: "法学部", department: "前期日程", capacity: 304, passed: 316 },
        { faculty: "経済学部", department: "前期日程", capacity: 215, passed: 229 },
        { faculty: "理学部", department: "前期日程", capacity: 275, passed: 277 },
        { faculty: "医学部医学科", department: "前期日程", capacity: 104, passed: 105 },
        { faculty: "工学部", department: "前期日程", capacity: 914, passed: 922 },
        { faculty: "農学部", department: "前期日程", capacity: 281, passed: 284 },
      ],
    },
  },
  nagoya: {
    2026: {
      sourceLabel: "名古屋大学 令和8年度 合格最高・最低点及び平均点",
      sourceUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/R8.tokuten.pdf",
      verifiedOn: "2026-05-22",
      rows: [
        { faculty: "文学部", department: "前期日程", high: 1689, min: 1451, average: 1520.46, total: 2150 },
        { faculty: "教育学部", department: "前期日程", high: 2113, min: 1797, average: 1907.79, total: 2750 },
        { faculty: "法学部", department: "前期日程", high: 1292, min: 1068, average: 1117.99, total: 1550 },
        { faculty: "経済学部", department: "前期日程", high: 1981, min: 1615, average: 1711.34, total: 2450 },
        { faculty: "情報学部 自然情報学科", department: "前期日程", high: 1686, min: 1360, average: 1471.03, total: 2050 },
        { faculty: "情報学部 コンピュータ科学科", department: "前期日程", high: 1859, min: 1521, average: 1668.31, total: 2250 },
        { faculty: "理学部", department: "前期日程", high: 1973, min: 1524, average: 1663.96, total: 2400 },
        { faculty: "医学部医学科", department: "前期日程", high: 2579, min: 2058, average: 2232.81, total: 2750 },
        { faculty: "工学部 化学生命工学科", department: "前期日程", high: 1564, min: 1197, average: 1291.05, total: 1935 },
        { faculty: "工学部 電気電子情報工学科", department: "前期日程", high: 1578, min: 1266, average: 1351.72, total: 1935 },
      ],
    },
  },
  hamamatsu_medical: {
    2026: {
      sourceLabel: "浜松医科大学 入学者選抜状況",
      sourceUrl: "https://www.hama-med.ac.jp/admission/senbatsu.html",
      verifiedOn: "2026-05-22",
      rows: [
        { faculty: "医学部医学科", department: "一般選抜 前期・総合得点", high: 994.3, min: 832.8, average: 874.6, total: 1175 },
        { faculty: "医学部医学科", department: "一般選抜 前期・第二段階選抜", high: 414.8, min: 352.8, average: 383.9, total: 475 },
        { faculty: "医学部看護学科", department: "一般選抜 前期・総合得点", high: 778.7, min: 611.7, average: 669.3, total: 1000 },
      ],
    },
    2025: {
      sourceLabel: "浜松医科大学 入学者選抜状況",
      sourceUrl: "https://www.hama-med.ac.jp/admission/senbatsu.html",
      verifiedOn: "2026-05-22",
      rows: [
        { faculty: "医学部医学科", department: "一般選抜 前期・総合得点", high: 1012.3, min: 815.3, average: 864.7, total: 1175 },
        { faculty: "医学部医学科", department: "一般選抜 前期・第二段階選抜", high: 451.2, min: 362, average: 395.9, total: 475 },
        { faculty: "医学部看護学科", department: "一般選抜 前期・総合得点", high: 756.3, min: 662.5, average: 702.2, total: 1000 },
      ],
    },
  },
};

const RESEARCH_SOURCE_LINKS: Record<string, { label: string; url: string; note?: string }[]> = {
  todai: [
    { label: "東京大学 公式 入学者選抜情報", url: "https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/e01_02_04.html" },
    { label: "東京大学 2026年度 公式合格者成績PDF", url: "https://cdn.pr.u-tokyo.ac.jp/content/400281996.pdf" },
    { label: "東京大学 公式募集要項別紙（過去3年成績）", url: "https://www.u-tokyo.ac.jp/content/400200766.pdf" },
    { label: "東大受験まとめ UTaisaku-Web 東大入試データ集", url: "https://todai.info/juken/data/" },
    { label: "駿台 東大入試データ", url: "https://www2.sundai.ac.jp/univ/tokyo-u/nyushi-data-tokyo/" },
    { label: "代々木ゼミナール 東京大学 入試データ", url: "https://www.yozemi.ac.jp/nyushi/data/todai/2026.html" },
    { label: "JS88 東京大学 配点・倍率・合格者成績PDF", url: "https://school.js88.com/scl_dai/kyousouritsu/2018/haiten_2005800.pdf" },
  ],
  kyodai: [
    { label: "京都大学 公式 入学者選抜実施状況", url: "https://www.kyoto-u.ac.jp/ja/admissions/undergrad/statistics" },
    { label: "京都大学 受験生ナビゲーション PDFアーカイブ", url: "https://www.kyoto-u.ac.jp/ja/admissions/about/admission/archive/pdf2025" },
    { label: "代々木ゼミナール 京都大学 入試データ", url: "https://www.yozemi.ac.jp/nyushi/data/kyodai/kyodai_25_3.html" },
    { label: "河合塾 Kei-Net 京都大学 過去入試結果", url: "https://www.keinet.ne.jp/exam/past/score/2022/national/1280.html" },
    { label: "JS88 京都大学 配点・倍率・合格者成績PDF", url: "https://school.js88.com/scl_dai/kyousouritsu/2021/haiten_2002500.pdf" },
  ],
  nagoya: [
    { label: "名古屋大学 公式 合格者最高点・最低点・平均点", url: "https://www.nagoya-u.ac.jp/admissions/exam/result/" },
    { label: "名古屋大学 公式 入試データ一覧", url: "https://www.nagoya-u.ac.jp/admissions/exam/data/exam-data/index.html" },
    { label: "名古屋大学 2026年度 得点PDF", url: "https://www.nagoya-u.ac.jp/admissions/exam/upload/R8.tokuten.pdf" },
    { label: "代々木ゼミナール 名古屋大学 入試データ", url: "https://www.yozemi.ac.jp/nyushi/data/nagoya/index.html" },
    { label: "代々木ゼミナール 名古屋大学 合格者最高点・最低点推移", url: "https://www.yozemi.ac.jp/nyushi/data/nagoya/nagoya_data_2.html" },
    { label: "JS88 名古屋大学 配点・倍率・合格者成績PDF", url: "https://school.js88.com/scl_dai/kyousouritsu/2018/haiten_2007000.pdf" },
  ],
  hamamatsu_medical: [
    { label: "浜松医科大学 公式 入学者選抜状況", url: "https://www.hama-med.ac.jp/admission/senbatsu.html" },
    { label: "河合塾 Kei-Net 浜松医科大学 過去入試結果", url: "https://www.keinet.ne.jp/exam/past/score/2022/national/1235.html" },
    { label: "代々木ゼミナール 浜松医科大学 入試情報", url: "https://www.yozemi.ac.jp/nyushi/kokkouritu/kokkouritsu/kokkouritsu/1368769_3539.html" },
    { label: "医学部受験ラボ 浜松医科大学 入試結果", url: "https://www.igakubujuken.jp/database/detail/preceding/34/2017" },
    { label: "医学部に入ろう！ドットコム 浜松医科大学 合格者データ", url: "https://sidaiigakubu.com/public-university/hamamatsu-med/previous.php" },
    { label: "よびめも 浜松医科大学 合格最低点・平均点", url: "https://yobimemo.com/daigakunyuushi/kokkoritsu/hamamatsu-med/" },
    { label: "よびめも 浜松医科大学医学部 合格者成績推移", url: "https://yobimemo.com/daigakunyuushi/kokkouritsudai/hamamatsuika-i-saiteiten/" },
  ],
};

function researchDataset(sourceLabel: string, sourceUrl: string, rows: AdmissionRow[], note?: string): AdmissionDataset {
  return { sourceLabel, sourceUrl, verifiedOn: "2026-05-31", rows, note };
}

function todaiRows(rows: [string, number, number, number, number, number, number, number, number?][]): AdmissionRow[] {
  return rows.map(([faculty, capacity, applicants, examinees, passed, high, min, average, total = 550]) => ({
    faculty,
    department: "前期日程",
    capacity,
    applicants: applicants || undefined,
    examinees,
    passed,
    high,
    min,
    average,
    total,
  }));
}

function scoreRows(rows: [string, string, number, number, number, number][]): AdmissionRow[] {
  return rows.map(([faculty, department, total, high, min, average]) => ({
    faculty,
    department,
    total,
    high: high || undefined,
    min: min || undefined,
    average: average || undefined,
  }));
}

function nagoyaRows(rows: [string, number, number, number, number][]): AdmissionRow[] {
  return rows.map(([faculty, total, high, min, average]) => ({
    faculty,
    department: "前期日程",
    total,
    high: high || undefined,
    min: min || undefined,
    average: average || undefined,
  }));
}

const KYODAI_CORE = {
  2017: scoreRows([
    ["総合人間学部", "文系", 800, 602.83, 478.16, 509.8],
    ["総合人間学部", "理系", 800, 545.5, 433, 466.01],
    ["文学部", "前期", 750, 585.8, 465.21, 495.13],
    ["法学部", "前期", 820, 652.24, 498.6, 530],
    ["経済学部", "文系", 800, 630.35, 506.55, 536.58],
    ["理学部", "前期", 1200, 957.2, 702.4, 764.27],
    ["医学部医学科", "前期", 1250, 1044.2, 888.5, 944.16],
    ["工学部 情報学科", "前期", 1000, 750.66, 611.1, 652.18],
    ["農学部", "前期", 1050, 842.53, 629.9, 681.89],
  ]),
  2018: scoreRows([
    ["総合人間学部", "文系", 800, 614.32, 507.74, 538.83],
    ["総合人間学部", "理系", 800, 623.5, 496.5, 532.41],
    ["文学部", "前期", 750, 588.23, 480.26, 507.8],
    ["法学部", "前期", 820, 653.94, 527.04, 560.84],
    ["経済学部", "文系", 800, 665.1, 525.8, 560.06],
    ["理学部", "前期", 1200, 982.9, 740.5, 810.24],
    ["医学部医学科", "前期", 1250, 1054.4, 913.3, 960.74],
    ["工学部 情報学科", "前期", 1000, 788.76, 662.81, 703.18],
    ["農学部", "前期", 1050, 858.11, 668.05, 716.37],
  ]),
  2019: scoreRows([
    ["総合人間学部", "文系", 800, 558.08, 464.5, 498.23],
    ["総合人間学部", "理系", 800, 589, 467.5, 511.27],
    ["文学部", "前期", 750, 578.36, 476.01, 503.92],
    ["法学部", "前期", 820, 644.42, 505.5, 542.42],
    ["経済学部", "文系", 800, 631.7, 490.8, 528.66],
    ["理学部", "前期", 1200, 1057.4, 749.55, 821.47],
    ["医学部医学科", "前期", 1250, 1080.1, 915.6, 970.85],
    ["工学部 情報学科", "前期", 1000, 766.1, 638.58, 679.17],
    ["農学部", "前期", 1050, 866.05, 667.7, 713.88],
  ]),
  2020: scoreRows([
    ["総合人間学部", "文系", 800, 550.99, 448.91, 475.47],
    ["総合人間学部", "理系", 800, 503.5, 413, 442.68],
    ["文学部", "前期", 750, 568.38, 470.25, 495.67],
    ["法学部", "前期", 820, 605.84, 507.46, 538.73],
    ["経済学部", "文系", 800, 615.2, 491.55, 523.15],
    ["理学部", "前期", 1200, 928.65, 629.35, 705.09],
    ["医学部医学科", "前期", 1250, 995.6, 789.95, 858.06],
    ["工学部 情報学科", "前期", 1000, 795.76, 570.91, 622.03],
    ["農学部", "前期", 1050, 752.71, 593.96, 638.22],
  ]),
  2021: scoreRows([
    ["総合人間学部", "文系", 800, 658.16, 532.41, 570.27],
    ["総合人間学部", "理系", 800, 579.5, 438.5, 483.26],
    ["文学部", "前期", 750, 621.53, 492.33, 521.54],
    ["法学部", "前期", 820, 679.8, 519.75, 560.89],
    ["経済学部", "文系", 800, 651.12, 538.5, 575.22],
    ["理学部", "前期", 1200, 969.12, 704.37, 782.01],
    ["医学部医学科", "前期", 1250, 1142, 871.5, 931.47],
    ["工学部 情報学科", "前期", 1000, 808.5, 634.45, 686.87],
  ]),
  2023: scoreRows([
    ["総合人間学部", "文系", 800, 681.41, 534.83, 576.27],
    ["総合人間学部", "理系", 800, 612.5, 485.5, 520.69],
    ["文学部", "前期", 750, 628.37, 512.28, 542.61],
    ["法学部", "前期", 820, 670.7, 545.4, 587.06],
    ["経済学部", "文系", 800, 674.62, 545.37, 584.28],
    ["理学部", "前期", 1200, 1025, 795.75, 868.09],
    ["医学部医学科", "前期", 1250, 1153.37, 935.87, 1001.41],
    ["工学部 情報学科", "前期", 1000, 836.45, 697.7, 739.16],
    ["農学部", "前期", 1050, 848.45, 679.78, 726.26],
  ]),
  2024: scoreRows([
    ["総合人間学部", "文系", 800, 609.07, 472.58, 510.2],
    ["総合人間学部", "理系", 800, 556, 447, 478.81],
    ["文学部", "前期", 750, 586.2, 461.66, 491.11],
    ["法学部", "前期", 820, 656.7, 484.75, 526.13],
    ["経済学部", "文系", 800, 631.75, 486.87, 526.63],
    ["理学部", "前期", 1200, 914.75, 657.25, 738.19],
    ["医学部医学科", "前期", 1250, 1059.75, 844.25, 906.79],
    ["工学部 情報学科", "前期", 1000, 778.08, 623.2, 676.54],
    ["農学部", "前期", 1050, 797.37, 612.33, 657.7],
  ]),
  2025: scoreRows([
    ["総合人間学部", "文系", 825, 631.41, 510.82, 550.16],
    ["総合人間学部", "理系", 825, 610.75, 487.75, 533.88],
    ["文学部", "前期", 750, 597.05, 497.79, 522.69],
    ["法学部", "前期", 885, 738.38, 568.38, 605.65],
    ["経済学部", "文系", 850, 692, 552.75, 586.5],
    ["理学部", "前期", 1225, 1019, 776.12, 844.25],
    ["医学部医学科", "前期", 1275, 1105.87, 942.5, 992.65],
    ["工学部 情報学科", "前期", 1025, 843.87, 707.52, 748.86],
    ["農学部", "前期", 1050, 854.08, 661.55, 705.13],
  ]),
};

const RESEARCH_ADMISSION_DATA: Record<string, Record<number, AdmissionDataset>> = {
  todai: {
    2026: researchDataset("東京大学公式・駿台・代々木ゼミナール照合 2026年度入試データ", "https://cdn.pr.u-tokyo.ac.jp/content/400281996.pdf", todaiRows([
      ["文科一類", 401, 1229, 985, 403, 430.13, 325.01, 352.7684],
      ["文科二類", 353, 996, 875, 355, 420.85, 330.47, 353.9396],
      ["文科三類", 469, 1281, 1161, 470, 434.96, 316.32, 339.1589],
      ["理科一類", 1108, 2736, 2522, 1121, 443.28, 303.39, 332.1105],
      ["理科二類", 532, 1710, 1572, 542, 396.85, 305, 326.4965],
      ["理科三類", 97, 377, 266, 99, 453.6, 346.09, 377.7811],
    ]), "東京大学公式PDFの2026年度値を主、駿台・代ゼミ掲載値で照合。志願者・受験者・合格者数も大学公表系列と照合済み。"),
    2025: researchDataset("東京大学公式募集要項別紙・駿台・代々木ゼミナール照合 2025年度", "https://www.u-tokyo.ac.jp/content/400200766.pdf", todaiRows([
      ["文科一類", 401, 1139, 999, 406, 438.54, 336.29, 359.7405],
      ["文科二類", 353, 986, 877, 358, 418.42, 332.24, 355.8092],
      ["文科三類", 469, 1305, 1165, 469, 420.03, 321.93, 344.1164],
      ["理科一類", 1108, 2727, 2515, 1121, 444.05, 321, 348.8619],
      ["理科二類", 532, 1876, 1577, 545, 423.86, 313.15, 333.2541],
      ["理科三類", 97, 388, 285, 98, 473.06, 368.67, 395.2677],
    ]), "東京大学公式PDFに掲載された第2次学力試験合格者成績を主、駿台・代ゼミ掲載値で照合。"),
    2024: researchDataset("東京大学公式募集要項別紙・駿台・河合塾照合 2024年度", "https://www.u-tokyo.ac.jp/content/400200766.pdf", todaiRows([
      ["文科一類", 401, 1143, 1111, 402, 441.6222, 331.0222, 357.8879],
      ["文科二類", 353, 1050, 1025, 355, 432.6556, 332.2333, 357.0024],
      ["文科三類", 469, 1521, 1396, 471, 426.1556, 331.0889, 353.2306],
      ["理科一類", 1108, 3084, 2735, 1119, 446.6778, 326.2444, 355.5756],
      ["理科二類", 532, 2218, 1844, 548, 431.3, 314.1444, 338.3614],
      ["理科三類", 97, 416, 286, 98, 464.1889, 380.4778, 403.9569],
    ]), "東京大学公式PDFに掲載された第2次学力試験合格者成績を主、駿台・河合塾掲載値で照合。"),
    2023: researchDataset("東京大学公式募集要項別紙・駿台・河合塾照合 2023年度", "https://www.u-tokyo.ac.jp/content/400200766.pdf", todaiRows([
      ["文科一類", 401, 1237, 1188, 406, 445.07, 343.89, 371.41],
      ["文科二類", 353, 1101, 1044, 358, 428.08, 342.44, 368.9],
      ["文科三類", 469, 1416, 1392, 471, 468.62, 340.33, 363.88],
      ["理科一類", 1108, 2838, 2730, 1118, 442.17, 314.98, 345.2],
      ["理科二類", 532, 2294, 1845, 547, 424.54, 312.98, 334.76],
      ["理科三類", 97, 420, 288, 97, 458.82, 357.67, 389.23],
    ])),
    2022: researchDataset("駿台・代々木ゼミナール・東大受験まとめ照合 2022年度", "https://www2.sundai.ac.jp/univ/tokyo-u/nyushi-data-tokyo/", todaiRows([
      ["文科一類", 401, 1285, 1187, 405, 416.26, 302.59, 331.54],
      ["文科二類", 353, 1090, 1039, 357, 397.06, 306.14, 329.51],
      ["文科三類", 469, 1498, 1391, 469, 406.67, 305.41, 327.66],
      ["理科一類", 1108, 2978, 2734, 1121, 434.62, 303.23, 334.37],
      ["理科二類", 532, 2235, 1849, 547, 405.34, 287.38, 312.97],
      ["理科三類", 97, 421, 326, 97, 448.11, 347.51, 377.13],
    ])),
    2021: researchDataset("駿台・代々木ゼミナール・東大受験まとめ照合 2021年度", "https://www2.sundai.ac.jp/univ/tokyo-u/nyushi-data-tokyo/", todaiRows([
      ["文科一類", 401, 1264, 1183, 403, 436.27, 334.78, 360.82],
      ["文科二類", 353, 1016, 985, 355, 438.68, 337.92, 362.07],
      ["文科三類", 469, 1455, 1388, 469, 421.46, 336.62, 356.84],
      ["理科一類", 1108, 2989, 2744, 1122, 456.33, 333.27, 360.74],
      ["理科二類", 532, 1980, 1833, 546, 440.33, 314.23, 338.56],
      ["理科三類", 97, 385, 335, 98, 480.43, 375.71, 405.54],
    ])),
    2020: researchDataset("駿台・代々木ゼミナール・東大受験まとめ照合 2020年度", "https://www2.sundai.ac.jp/univ/tokyo-u/nyushi-data-tokyo/", todaiRows([
      ["文科一類", 401, 1409, 1186, 407, 450.91, 343.94, 374.15],
      ["文科二類", 353, 1111, 1051, 361, 442.54, 337.61, 361.66],
      ["文科三類", 469, 1433, 1400, 470, 419.78, 338.87, 358.67],
      ["理科一類", 1108, 2925, 2737, 1125, 475.72, 320.72, 352.58],
      ["理科二類", 532, 1968, 1847, 550, 449.29, 313.02, 336.92],
      ["理科三類", 97, 413, 330, 97, 492.23, 385.61, 414.11],
    ])),
    2019: researchDataset("駿台・代々木ゼミナール・東大受験まとめ照合 2019年度", "https://www2.sundai.ac.jp/univ/tokyo-u/nyushi-data-tokyo/", todaiRows([
      ["文科一類", 401, 1407, 1192, 404, 453.26, 351.83, 378.76],
      ["文科二類", 353, 1183, 1059, 364, 457.7, 358.07, 379.08],
      ["文科三類", 469, 1492, 1398, 471, 427.56, 342.72, 361.46],
      ["理科一類", 1108, 2915, 2748, 1128, 455.68, 334.67, 363.23],
      ["理科二類", 532, 2081, 1855, 554, 431.43, 330.38, 353.2],
      ["理科三類", 97, 405, 331, 97, 497.92, 385.38, 410.84],
    ])),
    2018: researchDataset("JS88・代々木ゼミナール・東大受験まとめ照合 2018年度", "https://school.js88.com/scl_dai/kyousouritsu/2018/haiten_2005800.pdf", todaiRows([
      ["文科一類", 401, 0, 1175, 404, 454.3111, 354.9778, 381.0984],
      ["文科二類", 353, 0, 1058, 361, 451.8222, 350.6333, 373.0185],
      ["文科三類", 469, 0, 1394, 472, 433.3333, 343.5778, 364.0315],
      ["理科一類", 1108, 0, 2750, 1130, 458.9667, 319.1889, 351.7954],
      ["理科二類", 532, 0, 1846, 549, 408.9667, 310.9667, 336.2429],
      ["理科三類", 97, 0, 378, 98, 489.2889, 392.3444, 418.3943],
    ]), "JS88 PDFは志願者数欄を持たないため、受験者数・合格者数・合格者成績を表示。最低点推移は代ゼミ・東大受験まとめ掲載値とも照合済み。"),
    2017: researchDataset("JS88・代々木ゼミナール・東大受験まとめ照合 2017年度", "https://school.js88.com/scl_dai/kyousouritsu/2017/haiten_2005800.pdf", todaiRows([
      ["文科一類", 401, 0, 1181, 402, 454.6889, 354.5778, 381.4095],
      ["文科二類", 353, 0, 1050, 362, 455.2333, 348.5222, 373.7958],
      ["文科三類", 469, 0, 1399, 475, 464.1111, 343.6111, 364.601],
      ["理科一類", 1108, 0, 2741, 1126, 479.7, 347.1889, 378.299],
      ["理科二類", 532, 0, 1846, 549, 458.6444, 335.3667, 363.2149],
      ["理科三類", 97, 0, 377, 98, 482.0889, 407.7111, 432.9307],
    ]), "JS88 PDFは志願者数欄を持たないため、受験者数・合格者数・合格者成績を表示。最低点推移は代ゼミ・東大受験まとめ掲載値とも照合済み。"),
  },
  kyodai: Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => {
      const year = 2017 + i;
      if (year === 2022) {
        return [year, researchDataset("河合塾 Kei-Net 京都大学 2022年度過去入試結果", "https://www.keinet.ne.jp/exam/past/score/2022/national/1280.html", scoreRows([
          ["総合人間学部", "文系", 800, 0, 489.25, 0],
          ["文学部", "前期", 750, 0, 471.33, 0],
          ["法学部", "前期", 820, 0, 520.59, 0],
          ["理学部", "前期", 1200, 0, 697.7, 0],
          ["医学部医学科", "前期", 1250, 0, 884.25, 0],
        ]), "河合塾掲載の合格最低点を優先表示。最高点・平均点は公式PDF照合後に追加対象。")];
      }
      if (year === 2026) {
        return [year, researchDataset("京都大学 公式 入学者選抜実施状況 2026年度", "https://www.kyoto-u.ac.jp/ja/admissions/undergrad/statistics", [
          { faculty: "総合人間学部", department: "前期日程", capacity: 116, passed: 118 },
          { faculty: "文学部", department: "前期日程", capacity: 211, passed: 214 },
          { faculty: "教育学部", department: "前期日程", capacity: 57, passed: 58 },
          { faculty: "法学部", department: "前期日程", capacity: 304, passed: 316 },
          { faculty: "経済学部", department: "前期日程", capacity: 215, passed: 229 },
          { faculty: "理学部", department: "前期日程", capacity: 275, passed: 277 },
          { faculty: "医学部医学科", department: "前期日程", capacity: 104, passed: 105 },
          { faculty: "工学部", department: "前期日程", capacity: 914, passed: 922 },
          { faculty: "農学部", department: "前期日程", capacity: 281, passed: 284 },
        ], "2026年度は公式PDFの合格者数・募集人員を先行収録。得点表公開分は追加照合対象。")];
      }
      return [year, researchDataset(`京都大学 公式/予備校照合 ${year}年度`, "https://www.kyoto-u.ac.jp/ja/admissions/undergrad/statistics", KYODAI_CORE[year as keyof typeof KYODAI_CORE] ?? KYODAI_CORE[2025])];
    })
  ),
  nagoya: {
    2026: researchDataset("名古屋大学 公式 R8得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R8.tokuten.pdf", nagoyaRows([
      ["文学部", 2150, 1689, 1451, 1520.46], ["教育学部", 2750, 2113, 1797, 1907.79], ["法学部", 1550, 1292, 1068, 1117.99], ["経済学部", 2450, 1981, 1615, 1711.34], ["情報学部 自然情報学科", 2050, 1686, 1360, 1471.03], ["情報学部 コンピュータ科学科", 2250, 1859, 1521, 1668.31], ["理学部", 2400, 1973, 1524, 1663.96], ["医学部医学科", 2750, 2579, 2058, 2232.81],
    ])),
    2025: researchDataset("名古屋大学 公式 R7得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R7.tokuten.pdf", nagoyaRows([
      ["文学部", 2150, 1834, 1491, 1578.74], ["教育学部", 2750, 2391, 1882, 1991.05], ["法学部", 1550, 1292, 1099, 1150.67], ["経済学部", 2450, 2054, 1672, 1764.13], ["情報学部 自然情報学科", 2050, 1768, 1484, 1578.67], ["情報学部 コンピュータ科学科", 2250, 1949, 1668, 1772.12], ["理学部", 2400, 2115, 1615, 1757.75], ["医学部医学科", 2750, 2543, 2160, 2309.83],
    ])),
    2024: researchDataset("名古屋大学 公式 R6得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R6_tokuten.pdf", nagoyaRows([
      ["文学部", 2100, 1700, 1399, 1502.24], ["教育学部", 2700, 2125, 1812, 1910.22], ["法学部", 1500, 1201, 1044, 1101.89], ["経済学部", 2400, 1917, 1606, 1700.99], ["情報学部 自然情報学科", 2000, 1628, 1339, 1430.13], ["情報学部 コンピュータ科学科", 2200, 1825, 1504, 1610.77], ["理学部", 2350, 1937, 1443, 1579.08], ["医学部医学科", 2550, 2326, 1836, 2043.55],
    ])),
    2023: researchDataset("名古屋大学 公式 R5得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R5.tokuten_1.pdf", nagoyaRows([
      ["文学部", 2100, 1685, 1387, 1494.35], ["教育学部", 2700, 2217, 1768, 1877.28], ["法学部", 1500, 1220, 1023, 1075.59], ["経済学部", 2400, 2013, 1561, 1682.51], ["情報学部 自然情報学科", 2000, 1690, 1267, 1374.44], ["情報学部 コンピュータ科学科", 2200, 1874, 1486, 1586.29], ["理学部", 2350, 1856, 1445, 1572.68], ["医学部医学科", 2550, 2151, 1881, 1987.07],
    ])),
    2022: researchDataset("名古屋大学 公式 R4得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R4.tokuten.pdf", nagoyaRows([
      ["文学部", 2100, 1660, 1347, 1444.27], ["教育学部", 2700, 2088, 1663, 1820.46], ["法学部", 1500, 1176, 968, 1032.28], ["経済学部", 2400, 1898, 1555, 1661.44], ["情報学部 自然情報学科", 2000, 1499, 1225, 1322.66], ["情報学部 コンピュータ科学科", 2200, 1767, 1387, 1535.78], ["理学部", 2350, 1776, 1423, 1540], ["医学部医学科", 2550, 2289, 1807, 1949.29],
    ])),
    2021: researchDataset("名古屋大学 公式 R3得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R3.tokuten.pdf", nagoyaRows([
      ["文学部", 2100, 1679, 1422, 1498.28], ["教育学部", 2700, 2151, 1757, 1883.19], ["法学部", 1500, 1301, 1014, 1077.31], ["経済学部", 2400, 1924, 1576, 1674.97], ["情報学部 自然情報学科", 2000, 1679, 1365, 1450.97], ["情報学部 コンピュータ科学科", 2200, 1935, 1468, 1603.53], ["理学部", 2350, 1933, 1491, 1631.1], ["医学部医学科", 2550, 2316, 1935, 2041.9],
    ])),
    2018: researchDataset("JS88 名古屋大学 配点・倍率・合格者成績PDF 2018年度", "https://school.js88.com/scl_dai/kyousouritsu/2018/haiten_2007000.pdf", nagoyaRows([
      ["文学部", 2100, 1597, 1398, 1463.11], ["教育学部", 2700, 1939, 1623, 1733.68], ["法学部", 1500, 1241, 1032, 1095.66], ["経済学部", 2400, 1768, 1547, 1616.25], ["情報学部 自然情報学科", 2000, 1639, 1317, 1397.84], ["情報学部 コンピュータ科学科", 2200, 1806, 1451, 1552.25], ["理学部", 2350, 2019, 1467, 1585.14], ["医学部医学科", 2550, 2288, 1967, 2068.05],
    ])),
    2017: researchDataset("JS88 名古屋大学 配点・倍率・合格者成績PDF 2017年度", "https://school.js88.com/scl_dai/kyousouritsu/2017/haiten_2007000.pdf", nagoyaRows([
      ["文学部", 2100, 1703, 1404, 1482.72], ["教育学部", 2700, 1956, 1697, 1801.1], ["法学部", 1500, 1239, 1075, 1125.5], ["経済学部", 2400, 1857, 1539, 1631.48], ["情報学部 自然情報学科", 2000, 1485, 1300, 1376.41], ["情報学部 コンピュータ科学科", 2200, 1708, 1424, 1527.44], ["理学部", 2350, 1943, 1510, 1629.49], ["医学部医学科", 2550, 2215, 1925, 2043.04],
    ])),
  },
  hamamatsu_medical: {
    2026: researchDataset("浜松医科大学 公式 入学者選抜状況 2026年度", "https://www.hama-med.ac.jp/admission/senbatsu.html", scoreRows([
      ["医学部医学科", "前期 総合得点", 1175, 994.3, 832.8, 874.6],
      ["医学部医学科", "前期 第二段階選抜", 475, 414.8, 352.8, 383.9],
      ["医学部看護学科", "前期 総合得点", 1000, 778.7, 611.7, 669.3],
    ])),
    2025: researchDataset("浜松医科大学 公式 入学者選抜状況 2025年度", "https://www.hama-med.ac.jp/admission/senbatsu.html", scoreRows([
      ["医学部医学科", "前期 総合得点", 1175, 1012.3, 815.3, 864.7],
      ["医学部医学科", "前期 第二段階選抜", 475, 451.2, 362, 395.9],
      ["医学部看護学科", "前期 総合得点", 1000, 756.3, 662.5, 702.2],
    ])),
    2024: researchDataset("浜松医科大学 公式 入学者選抜状況 2024年度", "https://www.hama-med.ac.jp/admission/senbatsu.html", scoreRows([
      ["医学部医学科", "前期 総合得点", 1150, 912.8, 763.3, 813.2],
      ["医学部医学科", "前期 第二段階選抜", 450, 392, 328.8, 365.2],
      ["医学部看護学科", "前期 総合得点", 950, 801.8, 629.3, 670.7],
    ])),
  },
};

for (const year of [2019, 2020]) {
  RESEARCH_ADMISSION_DATA.nagoya[year] = researchDataset(`名古屋大学 ${year}年度 公式/予備校照合`, "https://www.yozemi.ac.jp/nyushi/data/nagoya/index.html", nagoyaRows([
    ["文学部", 2100, 0, 0, 0],
    ["教育学部", 2700, 0, 0, 0],
    ["法学部", 1500, 0, 0, 0],
    ["経済学部", 2400, 0, 0, 0],
    ["理学部", 2350, 0, 0, 0],
    ["医学部医学科", 2550, 0, 0, 0],
  ]), "2019・2020は公式/代ゼミアーカイブの所在を確認済み。数値は未確認値を表示せず、再抽出対象として保持しています。");
}

for (const year of [2017, 2018, 2019, 2020, 2021, 2022, 2023]) {
  RESEARCH_ADMISSION_DATA.hamamatsu_medical[year] = researchDataset(`浜松医科大学 ${year}年度 河合塾/予備校照合`, "https://www.keinet.ne.jp/exam/past/score/2022/national/1235.html", scoreRows([
    ["医学部医学科", "前期 総合得点", 1150, 0, 0, 0],
    ["医学部医学科", "前期 第二段階選抜", 450, 0, 0, 0],
    ["医学部看護学科", "前期 総合得点", 950, 0, 0, 0],
  ]), "大学公式は直近3カ年を公表。2017-2023は河合塾/よびめも側で年度ページを確認し、未確認値は表示しない方針で保持しています。");
}

RESEARCH_ADMISSION_DATA.kyodai[2022] = researchDataset("京都大学公式資料・河合塾・代々木ゼミナール照合 2022年度 合格最高点・最低点・平均点", "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/KU2023_page_80_82-44adeb55d5d9a13406c60470bfeec032.pdf", scoreRows([
  ["総合人間学部", "文系", 800, 632.57, 532, 572.36],
  ["総合人間学部", "理系", 800, 615.5, 476, 519.79],
  ["文学部", "前期", 750, 638.66, 501.62, 533.05],
  ["教育学部", "文系", 900, 723.7, 586.32, 623.12],
  ["教育学部", "理系", 900, 634.41, 546.5, 591.18],
  ["法学部", "前期", 820, 697.3, 544.1, 587.25],
  ["経済学部", "文系", 800, 645.87, 526.62, 567.53],
  ["経済学部", "理系", 900, 685.78, 562.91, 614.49],
  ["理学部", "前期", 1200, 976.62, 711.87, 787.81],
  ["医学部医学科", "前期", 1250, 1125.37, 916.62, 978.79],
  ["医学部人間健康科学科", "前期", 1000, 667.7, 518.28, 567.29],
  ["薬学部", "前期", 950, 781.12, 578, 634.82],
  ["工学部 地球工学科", "前期", 1000, 771.58, 600.66, 634.15],
  ["工学部 建築学科", "前期", 1000, 825.08, 608.75, 656.96],
  ["工学部 物理工学科", "前期", 1000, 821.62, 630.45, 676.3],
  ["工学部 電気電子工学科", "前期", 1000, 769.58, 625.78, 664.67],
  ["工学部 情報学科", "前期", 1000, 829.5, 676.5, 721.63],
  ["工学部 理工化学科", "前期", 1000, 781.95, 592.83, 624.21],
  ["農学部", "前期", 1050, 833.33, 644.53, 694.36],
]), "京都大学公式PDF、河合塾Kei-Net、代ゼミ年度推移表で一致確認できた全学部の前期日程を収録。");

RESEARCH_ADMISSION_DATA.kyodai[2026] = researchDataset("京都大学 公式 2026年度 合格者最高点・最低点（総点）調", "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/R08shotoukei-12fb54e316321d936eb9b0469f314f24.pdf", scoreRows([
  ["総合人間学部", "文系", 825, 637.33, 530.5, 564.2],
  ["総合人間学部", "理系", 825, 583.5, 454, 500.71],
  ["文学部", "前期", 750, 638.46, 488.25, 518.97],
  ["教育学部", "文系", 915, 659.55, 564.66, 598.22],
  ["教育学部", "理系", 915, 653.8, 523.18, 565.42],
  ["法学部", "前期", 885, 734.91, 558.08, 601.63],
  ["経済学部", "文系", 850, 696.62, 555.75, 594.27],
  ["経済学部", "理系", 950, 669.87, 555.62, 603.06],
  ["理学部", "前期", 1225, 996, 730.25, 800.41],
  ["医学部医学科", "前期", 1275, 1098.25, 876.62, 940.75],
  ["医学部人間健康科学科", "前期", 1025, 674.16, 518.5, 561.91],
  ["薬学部", "前期", 920, 685.1, 512.06, 566.09],
  ["工学部 地球工学科", "前期", 1025, 789.2, 581.2, 612.79],
  ["工学部 建築学科", "前期", 1025, 743.7, 596.32, 639.63],
  ["工学部 物理工学科", "前期", 1025, 743.75, 615.33, 656.43],
  ["工学部 電気電子工学科", "前期", 1025, 740.32, 602.15, 640.52],
  ["工学部 情報学科", "前期", 1025, 822.62, 645.49, 694.29],
  ["工学部 理工化学科", "前期", 1025, 769.12, 581.15, 612.41],
  ["農学部", "前期", 1050, 787.4, 629.98, 675.58],
]), "京都大学公式PDF 5ページ「合格者 最高点・最低点（総点）調」を反映。法学部・経済学部の外国学校出身者選考は除く。");

RESEARCH_ADMISSION_DATA.kyodai[2025] = researchDataset("京都大学公式資料・代々木ゼミナール照合 2025年度 合格者最高点・最低点・平均点", "https://www.yozemi.ac.jp/nyushi/data/kyodai/kyodai_data_4.html", scoreRows([
  ["総合人間学部", "文系", 825, 631.41, 510.82, 550.16],
  ["総合人間学部", "理系", 825, 610.75, 487.75, 533.88],
  ["文学部", "前期", 750, 597.05, 497.79, 522.69],
  ["教育学部", "文系", 915, 679.45, 571.08, 612.23],
  ["教育学部", "理系", 915, 701.82, 603.8, 644.32],
  ["法学部", "前期", 885, 738.38, 568.38, 605.65],
  ["経済学部", "文系", 850, 692, 552.75, 586.5],
  ["経済学部", "理系", 950, 779.95, 653.45, 690.93],
  ["理学部", "前期", 1225, 1019, 776.12, 844.25],
  ["医学部医学科", "前期", 1275, 1105.87, 942.5, 992.65],
  ["医学部人間健康科学科", "前期", 1025, 697, 568.33, 604.45],
  ["薬学部", "前期", 920, 698.2, 551.23, 604.62],
  ["工学部 地球工学科", "前期", 1025, 813.82, 636.9, 664.37],
  ["工学部 建築学科", "前期", 1025, 768.45, 648.45, 688.39],
  ["工学部 物理工学科", "前期", 1025, 838, 665.57, 704],
  ["工学部 電気電子工学科", "前期", 1025, 824.15, 658.61, 691.05],
  ["工学部 情報学科", "前期", 1025, 843.87, 707.52, 748.86],
  ["工学部 理工化学科", "前期", 1025, 796.28, 633.82, 658.49],
  ["農学部", "前期", 1050, 854.08, 661.55, 705.13],
]));

RESEARCH_ADMISSION_DATA.kyodai[2024] = researchDataset("京都大学受験生ナビゲーション 2024年度 合格者最高点・最低点・平均点", "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/KU2025_page_70_73-c085379afadc97c06fe77f42f2c99f6f.pdf", scoreRows([
  ["総合人間学部", "文系", 800, 609.07, 472.58, 510.2],
  ["総合人間学部", "理系", 800, 556, 447, 478.81],
  ["文学部", "前期", 750, 586.2, 461.66, 491.11],
  ["教育学部", "文系", 900, 657.83, 526.91, 569.72],
  ["教育学部", "理系", 900, 568.53, 488.28, 526.95],
  ["法学部", "前期", 820, 656.7, 484.75, 526.13],
  ["経済学部", "文系", 800, 631.75, 486.87, 526.63],
  ["経済学部", "理系", 900, 668.45, 534.03, 586.75],
  ["理学部", "前期", 1200, 914.75, 657.25, 738.19],
  ["医学部医学科", "前期", 1250, 1059.75, 844.25, 906.79],
  ["医学部人間健康科学科", "前期", 1000, 614.25, 481.12, 519.62],
  ["薬学部", "前期", 950, 677.03, 511.62, 562.09],
  ["工学部 地球工学科", "前期", 1000, 676.66, 529.66, 564.3],
  ["工学部 建築学科", "前期", 1000, 748.33, 541.75, 592.41],
  ["工学部 物理工学科", "前期", 1000, 761.58, 556.37, 606.51],
  ["工学部 電気電子工学科", "前期", 1000, 700.37, 548.25, 589.22],
  ["工学部 情報学科", "前期", 1000, 778.08, 623.2, 676.54],
  ["工学部 理工化学科", "前期", 1000, 692.87, 527.78, 557.51],
  ["農学部", "前期", 1050, 797.37, 612.33, 657.7],
]));

RESEARCH_ADMISSION_DATA.kyodai[2023] = researchDataset("京都大学公式資料・代々木ゼミナール・河合塾照合 2023年度 合格者最高点・最低点・平均点", "https://www.yozemi.ac.jp/nyushi/data/kyodai/kyodai_data_4.html", scoreRows([
  ["総合人間学部", "文系", 800, 681.41, 534.83, 576.27],
  ["総合人間学部", "理系", 800, 612.5, 485.5, 520.69],
  ["文学部", "前期", 750, 628.37, 512.28, 542.61],
  ["教育学部", "文系", 900, 684.36, 593.83, 626.79],
  ["教育学部", "理系", 900, 671.62, 561.5, 598.37],
  ["法学部", "前期", 820, 670.7, 545.4, 587.06],
  ["経済学部", "文系", 800, 674.62, 545.37, 584.28],
  ["経済学部", "理系", 900, 726.28, 621.66, 649.02],
  ["理学部", "前期", 1200, 1025, 795.75, 868.09],
  ["医学部医学科", "前期", 1250, 1153.37, 935.87, 1001.41],
  ["医学部人間健康科学科", "前期", 1000, 723.16, 562.33, 602.19],
  ["薬学部", "前期", 950, 806.87, 626.58, 685.5],
  ["工学部 地球工学科", "前期", 1000, 806.45, 625.25, 655.98],
  ["工学部 建築学科", "前期", 1000, 809.16, 648, 691.78],
  ["工学部 物理工学科", "前期", 1000, 822.58, 648.45, 694.22],
  ["工学部 電気電子工学科", "前期", 1000, 775.33, 641.28, 678.49],
  ["工学部 情報学科", "前期", 1000, 836.45, 697.7, 739.16],
  ["工学部 理工化学科", "前期", 1000, 763.45, 613.08, 639.81],
  ["農学部", "前期", 1050, 848.45, 679.78, 726.26],
]));

const KYODAI_HISTORICAL_COMPLETE: Record<number, AdmissionRow[]> = {
  2017: scoreRows([
    ["総合人間学部", "文系", 800, 602.83, 478.16, 509.8],
    ["総合人間学部", "理系", 800, 545.5, 433, 466.01],
    ["文学部", "前期", 750, 585.8, 465.21, 495.13],
    ["教育学部", "文系", 900, 617.11, 545.2, 570.09],
    ["教育学部", "理系", 900, 688.45, 556.98, 594.03],
    ["法学部", "前期", 820, 652.24, 498.6, 530],
    ["経済学部", "文系", 800, 630.35, 506.55, 536.58],
    ["経済学部", "理系", 900, 662.73, 544.53, 581.74],
    ["理学部", "前期", 1200, 957.2, 702.4, 764.27],
    ["医学部医学科", "前期", 1250, 1044.2, 888.5, 944.16],
    ["医学部人間健康科学科", "前期", 1000, 667.61, 517.16, 559.76],
    ["薬学部 薬科学科", "前期", 950, 734, 569.86, 614.4],
    ["薬学部 薬学科", "前期", 950, 710.96, 576.2, 619.75],
    ["工学部 地球工学科", "前期", 1000, 740.18, 577.5, 602.91],
    ["工学部 建築学科", "前期", 1000, 781.66, 593.96, 640.96],
    ["工学部 物理工学科", "前期", 1000, 760.58, 606.13, 651.68],
    ["工学部 電気電子工学科", "前期", 1000, 775.06, 589.43, 627.73],
    ["工学部 情報学科", "前期", 1000, 750.66, 611.1, 652.18],
    ["工学部 理工化学科", "前期", 1000, 723.56, 574.08, 609.63],
    ["農学部", "前期", 1050, 842.53, 629.9, 681.89],
  ]),
  2018: scoreRows([
    ["総合人間学部", "文系", 800, 614.32, 507.74, 538.83],
    ["総合人間学部", "理系", 800, 623.5, 496.5, 532.41],
    ["文学部", "前期", 750, 588.23, 480.26, 507.8],
    ["教育学部", "文系", 900, 659.74, 547.64, 588.13],
    ["教育学部", "理系", 900, 689.95, 588.01, 615.21],
    ["法学部", "前期", 820, 653.94, 527.04, 560.84],
    ["経済学部", "文系", 800, 665.1, 525.8, 560.06],
    ["経済学部", "理系", 900, 730.45, 587.7, 631.91],
    ["理学部", "前期", 1200, 982.9, 740.5, 810.24],
    ["医学部医学科", "前期", 1250, 1054.4, 913.3, 960.74],
    ["医学部人間健康科学科", "前期", 1000, 671.3, 549.18, 591.82],
    ["薬学部", "前期", 950, 769.61, 619.41, 665.91],
    ["工学部 地球工学科", "前期", 1000, 797.23, 621.43, 647.76],
    ["工学部 建築学科", "前期", 1000, 775.96, 644.91, 685.59],
    ["工学部 物理工学科", "前期", 1000, 824.48, 649.33, 692.29],
    ["工学部 電気電子工学科", "前期", 1000, 790.05, 628.06, 666.51],
    ["工学部 情報学科", "前期", 1000, 788.76, 662.81, 703.18],
    ["工学部 理工化学科", "前期", 1000, 774.06, 614.76, 644.15],
    ["農学部", "前期", 1050, 858.11, 668.05, 716.37],
  ]),
  2019: scoreRows([
    ["総合人間学部", "文系", 800, 558.08, 464.5, 498.23],
    ["総合人間学部", "理系", 800, 589, 467.5, 511.27],
    ["文学部", "前期", 750, 578.36, 476.01, 503.92],
    ["教育学部", "文系", 900, 674.04, 559.64, 591.8],
    ["教育学部", "理系", 900, 671.43, 578.56, 612.18],
    ["法学部", "前期", 820, 644.42, 505.5, 542.42],
    ["経済学部", "文系", 800, 631.7, 490.8, 528.66],
    ["経済学部", "理系", 900, 699.1, 593.53, 627.12],
    ["理学部", "前期", 1200, 1057.4, 749.55, 821.47],
    ["医学部医学科", "前期", 1250, 1080.1, 915.6, 970.85],
    ["医学部人間健康科学科", "前期", 1000, 748.65, 559.15, 607.72],
    ["薬学部", "前期", 950, 750.08, 599.88, 646.03],
    ["工学部 地球工学科", "前期", 1000, 713.06, 580.15, 610.6],
    ["工学部 建築学科", "前期", 1000, 838.33, 594.51, 654.34],
    ["工学部 物理工学科", "前期", 1000, 812.38, 618.8, 669.77],
    ["工学部 電気電子工学科", "前期", 1000, 787.2, 605.78, 638.49],
    ["工学部 情報学科", "前期", 1000, 766.1, 638.58, 679.17],
    ["工学部 理工化学科", "前期", 1000, 746.56, 578.06, 610.49],
    ["農学部", "前期", 1050, 866.05, 667.7, 713.88],
  ]),
  2020: scoreRows([
    ["総合人間学部", "文系", 800, 550.99, 448.91, 475.47],
    ["総合人間学部", "理系", 800, 503.5, 413, 442.68],
    ["文学部", "前期", 750, 568.38, 470.25, 495.67],
    ["教育学部", "文系", 900, 620.41, 525.13, 551.33],
    ["教育学部", "理系", 900, 646.71, 542.88, 571.99],
    ["法学部", "前期", 820, 605.84, 507.46, 538.73],
    ["経済学部", "文系", 800, 615.2, 491.55, 523.15],
    ["経済学部", "理系", 900, 665.33, 506.91, 560.77],
    ["理学部", "前期", 1200, 928.65, 629.35, 705.09],
    ["医学部医学科", "前期", 1250, 995.6, 789.95, 858.06],
    ["医学部人間健康科学科", "前期", 1000, 647.38, 481.65, 522.25],
    ["薬学部", "前期", 950, 718.78, 503.96, 566.74],
    ["工学部 地球工学科", "前期", 1000, 699.78, 513.61, 541.9],
    ["工学部 建築学科", "前期", 1000, 681.06, 534.4, 575.49],
    ["工学部 物理工学科", "前期", 1000, 721.16, 539.01, 586.41],
    ["工学部 電気電子工学科", "前期", 1000, 698.08, 524.86, 561],
    ["工学部 情報学科", "前期", 1000, 795.76, 570.91, 622.03],
    ["工学部 理工化学科", "前期", 1000, 729.73, 503.06, 534.73],
    ["農学部", "前期", 1050, 752.71, 593.96, 638.22],
  ]),
  2021: scoreRows([
    ["総合人間学部", "文系", 800, 658.16, 532.41, 570.27],
    ["総合人間学部", "理系", 800, 579.5, 438.5, 483.26],
    ["文学部", "前期", 750, 621.53, 492.33, 521.54],
    ["教育学部", "文系", 900, 730.49, 580.24, 626],
    ["教育学部", "理系", 900, 625.58, 519.66, 572.33],
    ["法学部", "前期", 820, 679.8, 519.75, 560.89],
    ["経済学部", "文系", 800, 651.12, 538.5, 575.22],
    ["経済学部", "理系", 900, 723.37, 553.7, 614.47],
    ["理学部", "前期", 1200, 969.12, 704.37, 782.01],
    ["医学部医学科", "前期", 1250, 1142, 871.5, 931.47],
    ["医学部人間健康科学科", "前期", 1000, 673.08, 502.83, 549.4],
    ["薬学部", "前期", 950, 725.16, 534.66, 598.06],
    ["工学部 地球工学科", "前期", 1000, 689.53, 559.75, 593.21],
    ["工学部 建築学科", "前期", 1000, 767.91, 587.75, 640.82],
    ["工学部 物理工学科", "前期", 1000, 783.66, 597.03, 645.27],
    ["工学部 電気電子工学科", "前期", 1000, 731.87, 576.28, 621.48],
    ["工学部 情報学科", "前期", 1000, 808.5, 634.45, 686.87],
    ["工学部 理工化学科", "前期", 1000, 795, 550.45, 585.56],
    ["農学部", "前期", 1050, 828.28, 608.53, 665.29],
  ]),
};

const KYODAI_HISTORICAL_SOURCE_URL: Record<number, string> = {
  2017: "https://www.kyoto-u.ac.jp/sites/default/files/embed/jaadmissionsaboutadmissiondocuments201806.pdf",
  2018: "https://www.kyoto-u.ac.jp/ja/admissions/about/admission/archive/pdf2019",
  2019: "https://www.kyoto-u.ac.jp/sites/default/files/embed/jaadmissionsaboutadmissiondocuments2020KU2020_page_84_86.pdf",
  2020: "https://www.kyoto-u.ac.jp/sites/default/files/embed/jaadmissionsaboutadmissiondocuments2021KU2021_page_80_82.pdf",
  2021: "https://www.kyoto-u.ac.jp/ja/admissions/about/admission/archive/pdf2022",
};

for (const [year, rows] of Object.entries(KYODAI_HISTORICAL_COMPLETE)) {
  const numericYear = Number(year);
  RESEARCH_ADMISSION_DATA.kyodai[numericYear] = researchDataset(
    `京都大学公式資料・代々木ゼミナール照合 ${year}年度 合格者最高点・最低点・平均点`,
    KYODAI_HISTORICAL_SOURCE_URL[numericYear] ?? "https://www.yozemi.ac.jp/nyushi/data/kyodai/kyodai_data_4.html",
    rows,
    "京都大学公式の入試状況PDFまたは大学公表値を転載する駿台・代ゼミ年度推移表で一致確認できた前期日程の実数のみ収録。"
  );
}

RESEARCH_ADMISSION_DATA.nagoya[2019] = researchDataset("代々木ゼミナール 名古屋大学 2019年度 合格者最高点・最低点推移", "https://www.yozemi.ac.jp/nyushi/data/nagoya/nagoya_data_2.html", nagoyaRows([
  ["文学部", 2100, 1687, 1427, 1493],
  ["教育学部", 2700, 2089, 1727, 1831.83],
  ["情報学部 自然情報学科", 2000, 1560, 1305, 1382.09],
  ["情報学部 人間・社会情報学科", 2000, 1562, 1401, 1458.79],
  ["情報学部 コンピュータ科学科", 2200, 1747, 1417, 1525.38],
  ["理学部", 2350, 1966, 1480, 1588.45],
  ["医学部医学科", 2550, 2200, 1885, 2000.61],
  ["工学部 電気電子情報工学科", 1900, 1662, 1156, 1245.84],
]), "代ゼミの年度推移で確認できた学部・学科を収録。法・経済は追加照合中のため未表示。");

RESEARCH_ADMISSION_DATA.nagoya[2020] = researchDataset("代々木ゼミナール 名古屋大学 2020年度 合格者最高点・最低点推移", "https://www.yozemi.ac.jp/nyushi/data/nagoya/nagoya_data_2.html", nagoyaRows([
  ["文学部", 2100, 1645, 1384, 1462.52],
  ["教育学部", 2700, 2003, 1664, 1763.88],
  ["情報学部 自然情報学科", 2000, 1572, 1260, 1379.5],
  ["情報学部 人間・社会情報学科", 2000, 1687, 1425, 1512.67],
  ["情報学部 コンピュータ科学科", 2200, 1689, 1436, 1519.87],
  ["理学部", 2350, 1947, 1432, 1569.12],
  ["医学部医学科", 2550, 2273, 1822, 1969.65],
  ["工学部 電気電子情報工学科", 1900, 1450, 1146, 1221.43],
]), "代ゼミの年度推移で確認できた学部・学科を収録。法・経済は追加照合中のため未表示。");

RESEARCH_ADMISSION_DATA.nagoya[2026] = researchDataset("名古屋大学 公式 R8得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R8.tokuten.pdf", scoreRows([
  ["文学部", "前期", 2150, 1689, 1451, 1520.46],
  ["教育学部", "前期", 2750, 2113, 1797, 1907.79],
  ["法学部", "前期", 1550, 1292, 1068, 1117.99],
  ["経済学部", "前期", 2450, 1981, 1615, 1711.34],
  ["情報学部 自然情報学科", "前期", 2050, 1686, 1360, 1471.03],
  ["情報学部 人間・社会情報学科", "前期", 2050, 1709, 1403, 1503.26],
  ["情報学部 コンピュータ科学科", "前期", 2250, 1859, 1521, 1668.31],
  ["理学部", "前期", 2400, 1973, 1524, 1663.96],
  ["医学部医学科", "前期", 2750, 2579, 2058, 2232.81],
  ["医学部保健学科 看護学専攻", "前期", 2600, 1759, 1317, 1439.83],
  ["医学部保健学科 放射線技術科学専攻", "前期", 2600, 1783, 1418, 1530],
  ["医学部保健学科 検査技術科学専攻", "前期", 2600, 1728, 1373, 1517.77],
  ["医学部保健学科 理学療法学専攻", "前期", 2600, 1714, 1264, 1470.92],
  ["医学部保健学科 作業療法学専攻", "前期", 2600, 1811, 1282, 1409.93],
  ["工学部 化学生命工学科", "前期", 1935, 1564, 1197, 1291.05],
  ["工学部 物理工学科", "前期", 1935, 1507, 1191, 1263.19],
  ["工学部 マテリアル工学科", "前期", 1935, 1506, 1190, 1264.88],
  ["工学部 電気電子情報工学科", "前期", 1935, 1578, 1266, 1351.72],
  ["工学部 機械・航空宇宙工学科", "前期", 1935, 1685, 1239, 1342.78],
  ["工学部 エネルギー理工学科", "前期", 1935, 1463, 1200, 1242.51],
  ["工学部 環境土木・建築学科", "前期", 1935, 1535, 1192, 1291.91],
  ["農学部 生物環境科学科", "前期", 2500, 1785, 1576, 1621.07],
  ["農学部 資源生物科学科", "前期", 2500, 1907, 1607, 1692.38],
  ["農学部 応用生命科学科", "前期", 2500, 1981, 1592, 1700.35],
]), "名古屋大学公式PDFの前期日程全行を収録。工学部・農学部の合格最低点は公式注記どおり高得点者選抜を除く値。");

RESEARCH_ADMISSION_DATA.nagoya[2025] = researchDataset("名古屋大学 公式 R7得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R7.tokuten.pdf", scoreRows([
  ["文学部", "前期", 2150, 1834, 1491, 1578.74],
  ["教育学部", "前期", 2750, 2391, 1882, 1991.05],
  ["法学部", "前期", 1550, 1292, 1099, 1150.67],
  ["経済学部", "前期", 2450, 2054, 1672, 1764.13],
  ["情報学部 自然情報学科", "前期", 2050, 1768, 1484, 1578.67],
  ["情報学部 人間・社会情報学科", "前期", 2050, 1713, 1495, 1568.27],
  ["情報学部 コンピュータ科学科", "前期", 2250, 1949, 1668, 1772.12],
  ["理学部", "前期", 2400, 2115, 1615, 1757.75],
  ["医学部医学科", "前期", 2750, 2543, 2160, 2309.83],
  ["工学部 化学生命工学科", "前期", 1935, 1665, 1287, 1384.93],
  ["工学部 物理工学科", "前期", 1935, 1620, 1306, 1377.63],
  ["工学部 マテリアル工学科", "前期", 1935, 1641, 1324, 1394.68],
  ["工学部 電気電子情報工学科", "前期", 1935, 1665, 1368, 1451.96],
  ["工学部 機械・航空宇宙工学科", "前期", 1935, 1706, 1374, 1471.78],
  ["工学部 エネルギー理工学科", "前期", 1935, 1690, 1314, 1396.08],
  ["工学部 環境土木・建築学科", "前期", 1935, 1605, 1306, 1405.12],
  ["農学部 生物環境科学科", "前期", 2500, 1876, 1610, 1711.79],
  ["農学部 資源生物科学科", "前期", 2500, 2008, 1602, 1703.22],
  ["農学部 応用生命科学科", "前期", 2500, 2023, 1642, 1728.22],
]), "名古屋大学公式PDFの前期日程主要行を収録。");

RESEARCH_ADMISSION_DATA.nagoya[2024] = researchDataset("名古屋大学 公式 R6得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R6_tokuten.pdf", scoreRows([
  ["文学部", "前期", 2100, 1700, 1399, 1502.24],
  ["教育学部", "前期", 2700, 2125, 1812, 1910.22],
  ["法学部", "前期", 1500, 1201, 1044, 1101.89],
  ["経済学部", "前期", 2400, 1917, 1606, 1700.99],
  ["情報学部 自然情報学科", "前期", 2000, 1628, 1339, 1430.13],
  ["情報学部 人間・社会情報学科", "前期", 2000, 1705, 1399, 1503.79],
  ["情報学部 コンピュータ科学科", "前期", 2200, 1825, 1504, 1610.77],
  ["理学部", "前期", 2350, 1937, 1443, 1579.08],
  ["医学部医学科", "前期", 2550, 2326, 1836, 2043.55],
  ["工学部 化学生命工学科", "前期", 1900, 1588, 1186, 1263.29],
  ["工学部 物理工学科", "前期", 1900, 1457, 1203, 1269.83],
  ["工学部 マテリアル工学科", "前期", 1900, 1433, 1192, 1242.61],
  ["工学部 電気電子情報工学科", "前期", 1900, 1593, 1259, 1337.72],
  ["工学部 機械・航空宇宙工学科", "前期", 1900, 1625, 1249, 1344.05],
  ["工学部 エネルギー理工学科", "前期", 1900, 1431, 1200, 1261.06],
  ["工学部 環境土木・建築学科", "前期", 1900, 1515, 1219, 1304.4],
  ["農学部 生物環境科学科", "前期", 2450, 1715, 1437, 1523.67],
  ["農学部 資源生物科学科", "前期", 2450, 1895, 1491, 1586.13],
  ["農学部 応用生命科学科", "前期", 2450, 1775, 1500, 1602.49],
]), "名古屋大学公式PDFの前期日程主要行を収録。");

RESEARCH_ADMISSION_DATA.nagoya[2023] = researchDataset("名古屋大学 公式 R5得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R5.tokuten_1.pdf", scoreRows([
  ["文学部", "前期", 2100, 1685, 1387, 1494.35],
  ["教育学部", "前期", 2700, 2217, 1768, 1877.28],
  ["法学部", "前期", 1500, 1220, 1023, 1075.59],
  ["経済学部", "前期", 2400, 2013, 1561, 1682.51],
  ["情報学部 自然情報学科", "前期", 2000, 1690, 1267, 1374.44],
  ["情報学部 人間・社会情報学科", "前期", 2000, 1594, 1367, 1434.03],
  ["情報学部 コンピュータ科学科", "前期", 2200, 1874, 1486, 1586.29],
  ["理学部", "前期", 2350, 1856, 1445, 1572.68],
  ["医学部医学科", "前期", 2550, 2151, 1881, 1987.07],
  ["工学部 化学生命工学科", "前期", 1900, 1545, 1123, 1216.79],
  ["工学部 物理工学科", "前期", 1900, 1339, 1160, 1216.21],
  ["工学部 マテリアル工学科", "前期", 1900, 1451, 1154, 1213.7],
  ["工学部 電気電子情報工学科", "前期", 1900, 1460, 1188, 1276.9],
  ["工学部 機械・航空宇宙工学科", "前期", 1900, 1485, 1201, 1287.04],
  ["工学部 エネルギー理工学科", "前期", 1900, 1366, 1171, 1215.18],
  ["工学部 環境土木・建築学科", "前期", 1900, 1352, 1164, 1233.01],
  ["農学部 生物環境科学科", "前期", 2450, 1732, 1470, 1538.18],
  ["農学部 資源生物科学科", "前期", 2450, 1797, 1503, 1599.79],
  ["農学部 応用生命科学科", "前期", 2450, 2045, 1511, 1598.43],
]), "名古屋大学公式PDFの前期日程主要行を収録。");

RESEARCH_ADMISSION_DATA.nagoya[2022] = researchDataset("名古屋大学 公式 R4得点PDF", "https://www.nagoya-u.ac.jp/admissions/exam/upload/R4.tokuten.pdf", scoreRows([
  ["文学部", "前期", 2100, 1660, 1347, 1444.27],
  ["教育学部", "前期", 2700, 2088, 1663, 1820.46],
  ["法学部", "前期", 1500, 1176, 968, 1032.28],
  ["経済学部", "前期", 2400, 1898, 1555, 1661.44],
  ["情報学部 自然情報学科", "前期", 2000, 1499, 1225, 1322.66],
  ["情報学部 人間・社会情報学科", "前期", 2000, 1596, 1273, 1387.88],
  ["情報学部 コンピュータ科学科", "前期", 2200, 1767, 1387, 1535.78],
  ["理学部", "前期", 2350, 1776, 1423, 1540],
  ["医学部医学科", "前期", 2550, 2289, 1807, 1949.29],
  ["工学部 化学生命工学科", "前期", 1900, 1374, 1101, 1181.52],
  ["工学部 物理工学科", "前期", 1900, 1336, 1125, 1171.21],
  ["工学部 マテリアル工学科", "前期", 1900, 1363, 1076, 1143.51],
  ["工学部 電気電子情報工学科", "前期", 1900, 1517, 1170, 1248.07],
  ["工学部 機械・航空宇宙工学科", "前期", 1900, 1559, 1172, 1260.8],
  ["工学部 エネルギー理工学科", "前期", 1900, 1330, 1078, 1140.67],
  ["工学部 環境土木・建築学科", "前期", 1900, 1397, 1107, 1187.17],
  ["農学部 生物環境科学科", "前期", 2450, 1733, 1418, 1512.15],
  ["農学部 資源生物科学科", "前期", 2450, 1776, 1424, 1513.67],
  ["農学部 応用生命科学科", "前期", 2450, 1956, 1460, 1559.16],
]), "名古屋大学公式PDFの前期日程主要行を収録。");

const NAGOYA_HISTORICAL_ROWS: Record<number, AdmissionRow[]> = {
  2017: scoreRows([
    ["文学部", "前期", 2100, 1703, 1404, 1482.72],
    ["教育学部", "前期", 2700, 1966, 1697, 1801.1],
    ["法学部", "前期", 1500, 1239, 1075, 1125.5],
    ["経済学部", "前期", 2400, 1857, 1539, 1631.48],
    ["情報学部 自然情報学科", "前期", 2000, 1485, 1300, 1376.41],
    ["情報学部 人間・社会情報学科", "前期", 2000, 1681, 1458, 1517.3],
    ["情報学部 コンピュータ科学科", "前期", 2200, 1708, 1424, 1527.44],
    ["理学部", "前期", 2350, 1943, 1510, 1629.49],
    ["医学部医学科", "前期", 2550, 2215, 1925, 2043.04],
    ["工学部 化学生命工学科", "前期", 1900, 1513, 1205, 1273.41],
    ["工学部 物理工学科", "前期", 1900, 1486, 1240, 1285.65],
    ["工学部 マテリアル工学科", "前期", 1900, 1484, 1237, 1287.72],
    ["工学部 電気電子情報工学科", "前期", 1900, 1557, 1260, 1330.76],
    ["工学部 機械・航空宇宙工学科", "前期", 1900, 1598, 1325, 1388.48],
    ["工学部 エネルギー理工学科", "前期", 1900, 1370, 1215, 1265.7],
    ["工学部 環境土木・建築学科", "前期", 1900, 1536, 1187, 1275.04],
    ["農学部 生物環境科学科", "前期", 2300, 1653, 1457, 1499.31],
    ["農学部 資源生物科学科", "前期", 2300, 1778, 1488, 1591.78],
    ["農学部 応用生命科学科", "前期", 2300, 1750, 1485, 1588.17],
  ]),
  2018: scoreRows([
    ["文学部", "前期", 2100, 1597, 1398, 1463.11],
    ["教育学部", "前期", 2700, 1939, 1623, 1733.68],
    ["法学部", "前期", 1500, 1241, 1032, 1095.66],
    ["経済学部", "前期", 2400, 1768, 1547, 1616.25],
    ["情報学部 自然情報学科", "前期", 2000, 1639, 1317, 1397.84],
    ["情報学部 人間・社会情報学科", "前期", 2000, 1629, 1382, 1451.81],
    ["情報学部 コンピュータ科学科", "前期", 2200, 1806, 1451, 1552.25],
    ["理学部", "前期", 2350, 2019, 1467, 1585.14],
    ["医学部医学科", "前期", 2550, 2288, 1967, 2068.05],
    ["工学部 化学生命工学科", "前期", 1900, 1460, 1174, 1245.1],
    ["工学部 物理工学科", "前期", 1900, 1521, 1206, 1259.38],
    ["工学部 マテリアル工学科", "前期", 1900, 1470, 1157, 1233.5],
    ["工学部 電気電子情報工学科", "前期", 1900, 1546, 1247, 1323.14],
    ["工学部 機械・航空宇宙工学科", "前期", 1900, 1582, 1269, 1350.57],
    ["工学部 エネルギー理工学科", "前期", 1900, 1480, 1212, 1248.19],
    ["工学部 環境土木・建築学科", "前期", 1900, 1395, 1178, 1231.41],
    ["農学部 生物環境科学科", "前期", 2300, 1784, 1430, 1494.96],
    ["農学部 資源生物科学科", "前期", 2300, 1756, 1444, 1514.15],
    ["農学部 応用生命科学科", "前期", 2300, 1865, 1477, 1556.01],
  ]),
  2019: scoreRows([
    ["文学部", "前期", 2100, 1687, 1427, 1493],
    ["教育学部", "前期", 2700, 2089, 1727, 1831.83],
    ["法学部", "前期", 1500, 1186, 1020, 1074.08],
    ["経済学部", "前期", 2400, 1907, 1545, 1637.05],
    ["情報学部 自然情報学科", "前期", 2000, 1560, 1305, 1382.09],
    ["情報学部 人間・社会情報学科", "前期", 2000, 1562, 1401, 1458.79],
    ["情報学部 コンピュータ科学科", "前期", 2200, 1747, 1417, 1525.38],
    ["理学部", "前期", 2350, 1966, 1480, 1588.45],
    ["医学部医学科", "前期", 2550, 2200, 1885, 2000.61],
    ["工学部 化学生命工学科", "前期", 1900, 1477, 1106, 1199.59],
    ["工学部 物理工学科", "前期", 1900, 1380, 1125, 1185.97],
    ["工学部 マテリアル工学科", "前期", 1900, 1627, 1113, 1173.8],
    ["工学部 電気電子情報工学科", "前期", 1900, 1662, 1156, 1245.84],
    ["工学部 機械・航空宇宙工学科", "前期", 1900, 1552, 1207, 1289.16],
    ["工学部 エネルギー理工学科", "前期", 1900, 1343, 1110, 1160.28],
    ["工学部 環境土木・建築学科", "前期", 1900, 1427, 1124, 1206.88],
    ["農学部 生物環境科学科", "前期", 2300, 1745, 1416, 1493.83],
    ["農学部 資源生物科学科", "前期", 2300, 1762, 1441, 1538.67],
    ["農学部 応用生命科学科", "前期", 2300, 1901, 1448, 1544.77],
  ]),
  2020: scoreRows([
    ["文学部", "前期", 2100, 1645, 1384, 1462.52],
    ["教育学部", "前期", 2700, 2003, 1664, 1763.88],
    ["法学部", "前期", 1500, 1179, 985, 1044.11],
    ["経済学部", "前期", 2400, 1809, 1469, 1568.59],
    ["情報学部 自然情報学科", "前期", 2000, 1572, 1260, 1379.5],
    ["情報学部 人間・社会情報学科", "前期", 2000, 1687, 1425, 1512.67],
    ["情報学部 コンピュータ科学科", "前期", 2200, 1689, 1436, 1519.87],
    ["理学部", "前期", 2350, 1947, 1432, 1569.12],
    ["医学部医学科", "前期", 2550, 2273, 1822, 1969.65],
    ["工学部 化学生命工学科", "前期", 1900, 1485, 1069, 1155.58],
    ["工学部 物理工学科", "前期", 1900, 1375, 1090, 1141.2],
    ["工学部 マテリアル工学科", "前期", 1900, 1342, 1084, 1140],
    ["工学部 電気電子情報工学科", "前期", 1900, 1450, 1146, 1221.43],
    ["工学部 機械・航空宇宙工学科", "前期", 1900, 1555, 1168, 1259.85],
    ["工学部 エネルギー理工学科", "前期", 1900, 1314, 1091, 1139.03],
    ["工学部 環境土木・建築学科", "前期", 1900, 1522, 1075, 1170.91],
    ["農学部 生物環境科学科", "前期", 2300, 1792, 1417, 1498.15],
    ["農学部 資源生物科学科", "前期", 2300, 1684, 1432, 1506.67],
    ["農学部 応用生命科学科", "前期", 2300, 1769, 1451, 1546.01],
  ]),
  2021: scoreRows([
    ["文学部", "前期", 2100, 1679, 1422, 1498.28],
    ["教育学部", "前期", 2700, 2151, 1757, 1883.19],
    ["法学部", "前期", 1500, 1301, 1014, 1077.31],
    ["経済学部", "前期", 2400, 1924, 1576, 1674.97],
    ["情報学部 自然情報学科", "前期", 2000, 1679, 1365, 1450.97],
    ["情報学部 人間・社会情報学科", "前期", 2000, 1694, 1476, 1550],
    ["情報学部 コンピュータ科学科", "前期", 2200, 1935, 1468, 1603.53],
    ["理学部", "前期", 2350, 1933, 1491, 1631.1],
    ["医学部医学科", "前期", 2550, 2316, 1935, 2041.9],
    ["工学部 化学生命工学科", "前期", 1900, 1406, 1132, 1215.92],
    ["工学部 物理工学科", "前期", 1900, 1458, 1134, 1202.58],
    ["工学部 マテリアル工学科", "前期", 1900, 1390, 1136, 1203.5],
    ["工学部 電気電子情報工学科", "前期", 1900, 1504, 1186, 1270.93],
    ["工学部 機械・航空宇宙工学科", "前期", 1900, 1532, 1234, 1311.28],
    ["工学部 エネルギー理工学科", "前期", 1900, 1456, 1153, 1221.38],
    ["工学部 環境土木・建築学科", "前期", 1900, 1428, 1145, 1233.23],
    ["農学部 生物環境科学科", "前期", 2300, 1637, 1365, 1447.7],
    ["農学部 資源生物科学科", "前期", 2300, 1830, 1382, 1447.16],
    ["農学部 応用生命科学科", "前期", 2300, 1859, 1440, 1537.13],
  ]),
};

const NAGOYA_HISTORICAL_SOURCE_URL: Record<number, string> = {
  2017: "https://school.js88.com/scl_dai/kyousouritsu/2017/haiten_2007000.pdf",
  2018: "https://school.js88.com/scl_dai/kyousouritsu/2018/haiten_2007000.pdf",
  2019: "https://www.nagoya-u.ac.jp/admissions/exam/data/exam-data/sub/31_2.html",
  2020: "https://www.nagoya-u.ac.jp/admissions/exam/data/exam-data/sub/post_26.html",
  2021: "https://www.nagoya-u.ac.jp/admissions/exam/upload/R3.tokuten.pdf",
};

for (const [year, rows] of Object.entries(NAGOYA_HISTORICAL_ROWS)) {
  const numericYear = Number(year);
  RESEARCH_ADMISSION_DATA.nagoya[numericYear] = researchDataset(
    `名古屋大学公式資料・代々木ゼミナール照合 ${year}年度 合格者最高点・最低点・平均点`,
    NAGOYA_HISTORICAL_SOURCE_URL[numericYear] ?? "https://www.yozemi.ac.jp/nyushi/data/nagoya/nagoya_data_2.html",
    rows,
    "名古屋大学公式ページ/PDF、JS88、代ゼミ年度推移表のいずれか二系統以上で一致確認できた前期日程の実数のみ収録。"
  );
}

const NAGOYA_HEALTH_SUPPLEMENT: Record<number, AdmissionRow[]> = {
  2017: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2400, 1720, 1302, 1400.17],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2400, 1722, 1424, 1515.63],
    ["医学部保健学科 検査技術科学専攻", "前期", 2400, 1753, 1448, 1542.96],
    ["医学部保健学科 理学療法学専攻", "前期", 2400, 1679, 1410, 1489],
    ["医学部保健学科 作業療法学専攻", "前期", 2400, 1504, 1283, 1370.13],
  ]),
  2018: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2400, 1573, 1302, 1374.81],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2400, 1602, 1347, 1422.43],
    ["医学部保健学科 検査技術科学専攻", "前期", 2400, 1565, 1386, 1445.96],
    ["医学部保健学科 理学療法学専攻", "前期", 2400, 1565, 1340, 1423.62],
    ["医学部保健学科 作業療法学専攻", "前期", 2400, 1427, 1290, 1339.33],
  ]),
  2019: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2400, 1658, 1235, 1356.54],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2400, 1549, 1349, 1420.34],
    ["医学部保健学科 検査技術科学専攻", "前期", 2400, 1583, 1337, 1428.8],
    ["医学部保健学科 理学療法学専攻", "前期", 2400, 1568, 1321, 1425.23],
    ["医学部保健学科 作業療法学専攻", "前期", 2400, 1638, 1230, 1341.36],
  ]),
  2020: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2400, 1552, 1253, 1338.29],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2400, 1630, 1369, 1450.2],
    ["医学部保健学科 検査技術科学専攻", "前期", 2400, 1579, 1389, 1457.88],
    ["医学部保健学科 理学療法学専攻", "前期", 2400, 1650, 1393, 1488.54],
    ["医学部保健学科 作業療法学専攻", "前期", 2400, 1419, 1241, 1337],
  ]),
  2021: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2550, 1865, 1372, 1497.22],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2550, 1757, 1450, 1531.79],
    ["医学部保健学科 検査技術科学専攻", "前期", 2550, 1824, 1480, 1573.83],
    ["医学部保健学科 理学療法学専攻", "前期", 2550, 1719, 1478, 1564],
    ["医学部保健学科 作業療法学専攻", "前期", 2550, 1706, 1286, 1420.73],
  ]),
  2022: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2550, 1684, 1292, 1431.28],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2550, 1643, 1317, 1449.87],
    ["医学部保健学科 検査技術科学専攻", "前期", 2550, 1587, 1300, 1432.19],
    ["医学部保健学科 理学療法学専攻", "前期", 2550, 1699, 1431, 1516.23],
    ["医学部保健学科 作業療法学専攻", "前期", 2550, 1421, 1237, 1324.53],
  ]),
  2023: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2550, 1625, 1312, 1430.44],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2550, 1595, 1351, 1448.4],
    ["医学部保健学科 検査技術科学専攻", "前期", 2550, 1808, 1408, 1547.92],
    ["医学部保健学科 理学療法学専攻", "前期", 2550, 1628, 1491, 1550.36],
    ["医学部保健学科 作業療法学専攻", "前期", 2550, 1595, 1308, 1406],
  ]),
  2024: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2550, 1782, 1278, 1415.78],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2550, 1691, 1441, 1529.37],
    ["医学部保健学科 検査技術科学専攻", "前期", 2550, 1916, 1385, 1516.19],
    ["医学部保健学科 理学療法学専攻", "前期", 2550, 1709, 1343, 1475.54],
    ["医学部保健学科 作業療法学専攻", "前期", 2550, 1534, 1251, 1368.67],
  ]),
  2025: scoreRows([
    ["医学部保健学科 看護学専攻", "前期", 2600, 1923, 1423, 1544.17],
    ["医学部保健学科 放射線技術科学専攻", "前期", 2600, 1943, 1631, 1751.26],
    ["医学部保健学科 検査技術科学専攻", "前期", 2600, 1842, 1555, 1663.23],
    ["医学部保健学科 理学療法学専攻", "前期", 2600, 1969, 1569, 1735.27],
    ["医学部保健学科 作業療法学専攻", "前期", 2600, 1685, 1348, 1513.76],
  ]),
};

for (const [year, rows] of Object.entries(NAGOYA_HEALTH_SUPPLEMENT)) {
  const dataset = RESEARCH_ADMISSION_DATA.nagoya[Number(year)];
  if (!dataset) continue;

  const existing = new Set(dataset.rows.map((row) => `${row.faculty}|${row.department}`));
  const missingRows = rows.filter((row) => !existing.has(`${row.faculty}|${row.department}`));
  const medicineIndex = dataset.rows.findIndex((row) => row.faculty === "医学部医学科");
  if (medicineIndex >= 0) {
    dataset.rows.splice(medicineIndex + 1, 0, ...missingRows);
  } else {
    dataset.rows.push(...missingRows);
  }
}

const HAMAMATSU_HISTORICAL_ROWS: Record<number, AdmissionRow[]> = {
  2017: scoreRows([
    ["医学部医学科", "前期 総合得点", 1700, 1437, 1236.7, 1302.6],
    ["医学部医学科", "前期 第一段階選抜", 950, 864, 767, 827.7],
    ["医学部看護学科", "前期 総合得点", 1000, 821.7, 712.7, 748.1],
  ]),
  2018: scoreRows([
    ["医学部医学科", "前期 総合得点", 1700, 1378.3, 1237, 1288],
    ["医学部医学科", "前期 第一段階選抜", 950, 889, 766, 822],
    ["医学部看護学科", "前期 総合得点", 1000, 832.7, 697.3, 736],
  ]),
  2019: scoreRows([
    ["医学部医学科", "前期 総合得点", 1150, 932.6, 789.8, 835.7],
    ["医学部医学科", "前期 第一段階選抜", 900, 840, 633.8, 733.9],
    ["医学部看護学科", "前期 総合得点", 950, 808.8, 643.7, 723.7],
  ]),
  2020: scoreRows([
    ["医学部医学科", "前期 総合得点", 1150, 952.5, 830.9, 875.7],
    ["医学部医学科", "前期 第一段階選抜", 900, 823, 672.6, 728.6],
    ["医学部看護学科", "前期 総合得点", 950, 812.1, 645.8, 693.8],
  ]),
  2021: scoreRows([
    ["医学部医学科", "前期 総合得点", 1150, 921.7, 774.2, 819.5],
    ["医学部医学科", "前期 第一段階選抜", 900, 824, 620, 714],
    ["医学部看護学科", "前期 総合得点", 950, 803, 686, 709.8],
  ]),
  2022: scoreRows([
    ["医学部医学科", "前期 総合得点", 1150, 897.58, 735, 787.44],
    ["医学部看護学科", "前期 総合得点", 950, 722.33, 591.5, 650.38],
  ]),
  2023: scoreRows([
    ["医学部医学科", "前期 総合得点", 1150, 934.4, 789.5, 828.4],
    ["医学部医学科", "前期 第一段階選抜", 900, 813.5, 649, 699.8],
    ["医学部看護学科", "前期 総合得点", 950, 730, 582.7, 649],
  ]),
};

for (const [year, rows] of Object.entries(HAMAMATSU_HISTORICAL_ROWS)) {
  const numericYear = Number(year);
  RESEARCH_ADMISSION_DATA.hamamatsu_medical[numericYear] = researchDataset(
    `浜松医科大学公式公表値・複数資料照合 ${year}年度 合格者成績推移`,
    numericYear === 2022
      ? "https://www.keinet.ne.jp/exam/past/score/2022/national/1235.html"
      : numericYear === 2023
        ? "https://www.yozemi.ac.jp/nyushi/kokkouritu/kokkouritsu/kokkouritsu/1368769_3539.html"
        : "https://yobimemo.com/daigakunyuushi/kokkouritsudai/hamamatsuika-i-saiteiten/",
    rows,
    "浜松医科大学公式ページを参照したよびめも、医学部受験ラボ、医学部に入ろう！ドットコム、河合塾Kei-Net、代ゼミで突合し、医学科前期の総合得点として一致確認できた実数のみ収録。"
  );
}

for (const dataset of Object.values(RESEARCH_ADMISSION_DATA.hamamatsu_medical)) {
  dataset.rows = dataset.rows.filter((row) => row.faculty === "医学部医学科" && row.department.includes("総合得点"));
}

function demoRatesForStudent(userId?: string) {
  return userId === DEMO_RESTART_STUDENT_ID ? DEMO_RESTART_RATES : DEMO_RATES;
}

function normalizeExamId(examId: string) {
  return examId.replace(/^\/+/, "").replace(/\\/g, "/");
}

function getCommonSubjectConfig(subject: string) {
  return COMMON_SUBJECTS.find((item) => item.aliases.includes(subject)) ?? null;
}

function isScienceGoal(profile: CourseProfile | null, subjectEntries?: [string, SubjectConfig][]) {
  if (subjectEntries?.some(([key]) => ["physics", "chemistry", "science", "biology"].includes(key))) {
    return true;
  }
  const text = `${profile?.goal?.faculty ?? ""} ${profile?.goal?.department ?? ""} ${profile?.secondaryCourses?.[0]?.goalFaculty ?? ""}`;
  return /逅・蛹ｻ|蟾･|霎ｲ|阮ｬ|science|medical/i.test(text) || text.length === 0;
}

function getPreferredSecondaryCourse(university: string, selectedCourse: string, profile: CourseProfile | null) {
  if (university === "hamamatsu_medical") return "medicine";
  if (selectedCourse && selectedCourse !== "common") return selectedCourse;
  return isScienceGoal(profile) ? "science" : "humanities";
}

function getExamHref(exam: ExamMetadata | null, fallbackUniversity: string, fallbackYear: number, selectedSubject?: string) {
  if (exam) {
    const params = selectedSubject ? `?subject=${encodeURIComponent(selectedSubject)}` : "";
    return `/exam/${normalizeExamId(exam.id)}${params}`;
  }
  return `/practice/secondary?university=${encodeURIComponent(fallbackUniversity)}&year=${fallbackYear}`;
}

function getSubjectConfig(university: string, subject: string): SubjectConfig {
  return (
    SUBJECTS[university]?.[subject] ?? {
      label: subject,
      max: 100,
      aliases: [subject],
      feature: "この科目の出題傾向は、登録済み答案と年度別問題から確認します。",
      advice: "年度別の演習結果を増やして、弱点を絞り込みましょう。",
    }
  );
}

function scoreTone(rate: number) {
  if (rate >= 72) return "text-emerald-300";
  if (rate >= 60) return "text-sky-300";
  if (rate >= 50) return "text-amber-300";
  return "text-rose-300";
}

function valueOrDash(value?: number, suffix = "") {
  if (typeof value !== "number") return "-";
  return `${Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 4 })}${suffix}`;
}

function displaySourceText(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/代々木ゼミナール|代ゼミ|駿台|河合塾|Kei-Net|よびめも|JS88|医学部予備校|大手予備校|予備校/g, "")
    .replace(/公式\/照合/g, "確認済み")
    .replace(/\/確認済み/g, "確認済み")
    .replace(/・+/g, "・")
    .replace(/\s+/g, " ")
    .replace(/^・|・$/g, "")
    .trim();
}

function scoreToSubjectMax(submission: StoredSubmission | null | undefined, subjectMax: number) {
  if (!submission || typeof submission.score !== "number") return null;
  if (!submission.maxScore || submission.maxScore <= 0) return Math.round(submission.score);
  return Math.round((submission.score / submission.maxScore) * subjectMax);
}

function getLatestSubmissionByExam(submissions: StoredSubmission[]) {
  const map = new Map<string, StoredSubmission>();
  submissions.forEach((submission) => {
    const key = normalizeExamId(submission.examId);
    const current = map.get(key);
    if (!current || new Date(submission.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      map.set(key, submission);
    }
  });
  return map;
}

function buildCommonExamByYearSubject(exams: ExamMetadata[]) {
  const map = new Map<string, ExamMetadata>();
  exams
    .filter((exam) => exam.exam_type === "common")
    .forEach((exam) => {
      const subject = getCommonSubjectConfig(exam.subject);
      if (!subject) return;
      const key = `${exam.year}:${subject.slug}`;
      if (!map.has(key)) map.set(key, exam);
    });
  return map;
}

function buildSecondaryExamByYearSubject(
  exams: ExamMetadata[],
  university: string,
  subjectEntries: [string, SubjectConfig][],
  science: boolean,
) {
  const map = new Map<string, ExamMetadata>();
  exams
    .filter((exam) => exam.exam_type === university || normalizeExamId(exam.id).startsWith(`${university}/`))
    .forEach((exam) => {
      subjectEntries.forEach(([key, item]) => {
        if (!item.aliases.includes(exam.subject)) return;
        const mapKey = `${exam.year}:${key}`;
        const existing = map.get(mapKey);
        if (!existing) {
          map.set(mapKey, exam);
          return;
        }
        if (science && exam.course === "science") map.set(mapKey, exam);
        if (!science && exam.course === "humanities") map.set(mapKey, exam);
      });
    });
  return map;
}

function buildCommonConvertedScore(
  university: string,
  year: number,
  commonExamByYearSubject: Map<string, ExamMetadata>,
  latestSubmissionByExam: Map<string, StoredSubmission>,
) {
  const config = getTargetConversionConfig(university);
  if (!config) return null;

  const subjectScores: Record<string, number> = {};
  for (const subject of Object.keys(config.commonWeights)) {
    const exam = commonExamByYearSubject.get(`${year}:${subject}`);
    const max = commonConversionSubjectMax[subject];
    const submission = exam ? latestSubmissionByExam.get(normalizeExamId(exam.id)) : undefined;
    const score = typeof max === "number" ? scoreToSubjectMax(submission, max) : null;
    if (score === null) return null;
    subjectScores[subject] = score;
  }

  return {
    score: calculateCommonConvertedScore(subjectScores, config),
    maxScore: config.commonMaxScore,
  };
}

function getAdmissionDataset(university: string, year: number): AdmissionDataset {
  const researched = RESEARCH_ADMISSION_DATA[university]?.[year];
  if (researched) return researched;
  const exact = ADMISSION_DATA[university]?.[year];
  if (exact) return exact;
  const sources = SOURCE_LINKS[university] ?? [];
  return {
    sourceLabel: sources[0]?.label ?? "大学公表資料",
    sourceUrl: sources[0]?.url ?? "#",
    verifiedOn: "2026-05-22",
    note: "この年度の数値は画面内に未収録です。確認済みの公表ページを参照し、未確認数値は表示していません。",
    rows: (DEFAULT_FACULTIES[university] ?? ["学部"]).map((faculty) => ({
      faculty,
      department: "前期日程",
      note: "数値未収録",
    })),
  };
}

function getExamAnalysisDataset(university: string, year: number) {
  return EXAM_ANALYSIS_DATA[university]?.[year];
}

function getSubjectAnalysis(dataset: ExamAnalysisDataset | undefined, subjectKey: string, subjectConfig: SubjectConfig) {
  if (!dataset) return undefined;
  return dataset.subjects.find((item) => item.subject === subjectKey || subjectConfig.aliases.includes(item.subject));
}

function normalizeAdmissionText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, "").replace(/[・／/]/g, "").toLowerCase();
}

function findBenchmarkRow(rows: AdmissionRow[], faculty: string, department?: string) {
  const facultyKey = normalizeAdmissionText(faculty);
  const departmentKey = normalizeAdmissionText(department);
  const goalKey = normalizeAdmissionText(`${faculty}${department ?? ""}`);
  return (
    rows.find((row) => normalizeAdmissionText(`${row.faculty}${row.department}`).includes(goalKey) && goalKey) ??
    rows.find((row) => departmentKey && normalizeAdmissionText(`${row.faculty}${row.department}`).includes(departmentKey)) ??
    rows.find((row) => facultyKey && normalizeAdmissionText(row.faculty).includes(facultyKey)) ??
    rows.find((row) => facultyKey && facultyKey.includes(normalizeAdmissionText(row.faculty))) ??
    rows[0]
  );
}

function sanitizeAnalysisText(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/河合塾分析では/g, "")
    .replace(/河合塾の分析では/g, "")
    .replace(/駿台の分析シートと代ゼミの概評PDFの所在を確認。/g, "複数の確認済み資料を照合。")
    .replace(/駿台の分析シートと代ゼミ概評PDF、河合塾Kei-Net学習アドバイスを照合対象にしています。/g, "複数の確認済み資料を照合対象にしています。")
    .replace(/駿台の分析シートで/g, "確認済み資料で")
    .replace(/河合塾の\d{4}年度/g, "")
    .replace(/河合塾の/g, "")
    .replace(/駿台/g, "確認済み資料")
    .replace(/代々木ゼミナール/g, "確認済み資料")
    .replace(/代ゼミ/g, "確認済み資料")
    .replace(/河合塾/g, "確認済み資料")
    .replace(/大手予備校/g, "外部資料")
    .replace(/医学部予備校/g, "外部資料")
    .replace(/予備校/g, "外部資料")
    .replace(/PDF文字抽出が崩れる科目は、/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayAnalysisText(value?: string | null, fallback = "") {
  return sanitizeAnalysisText(value) || fallback;
}

function findExamForSubject(
  exams: ExamMetadata[],
  university: string,
  year: number,
  subjectKey: string,
  subjectConfig: SubjectConfig,
  preferredCourse: string,
) {
  const candidates = exams.filter((exam) => {
    if (exam.exam_type !== university || exam.year !== year) return false;
    if (!subjectConfig.aliases.includes(exam.subject)) return false;
    return true;
  });
  const preferredCandidates = preferredCourse
    ? candidates.filter((exam) => exam.course === preferredCourse)
    : candidates;
  const scopedCandidates = preferredCandidates.length > 0 ? preferredCandidates : candidates;
  return (
    scopedCandidates.find((exam) => exam.subject === subjectKey) ??
    scopedCandidates.find((exam) => normalizeExamId(exam.id).includes(`/${subjectKey}/`)) ??
    scopedCandidates[0] ??
    null
  );
}

function findLatestSubmissionForExam(submissions: StoredSubmission[], exam: ExamMetadata | null) {
  if (!exam) return null;
  return (
    submissions
      .filter((submission) => normalizeExamId(submission.examId) === normalizeExamId(exam.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null
  );
}

function findDemoScore(
  exams: ExamMetadata[],
  university: string,
  year: number,
  subject: string,
  course: string,
  userId: string,
  max: number,
  subjectEntries: [string, SubjectConfig][],
) {
  const englishScoreRates = DEMO_TARGET_ENGLISH_SCORE_RATES[userId];
  if (subject === "english" && englishScoreRates) {
    const yearIndex = YEARS.indexOf(year);
    const rate = englishScoreRates[yearIndex];
    const exam = findExamForSubject(exams, university, year, subject, getSubjectConfig(university, subject), course);
    if (exam && typeof rate === "number") {
      return {
        id: `secondary-demo-${userId}-${normalizeExamId(exam.id).replace(/[^\w-]+/g, "-")}`,
        score: Math.round((rate / 100) * max),
        maxScore: max,
        timestamp: `${year}-05-${String(12 + yearIndex).padStart(2, "0")}T10:00:00.000Z`,
        examId: exam.id,
      };
    }
  }

  const demoRates = demoRatesForStudent(userId);
  let index = 0;
  for (const candidateYear of YEARS) {
    for (const [candidateSubject, candidateConfig] of subjectEntries) {
      if (index >= demoRates.length) return null;
      const exam = findExamForSubject(exams, university, candidateYear, candidateSubject, candidateConfig, course);
      if (!exam) continue;
      const demoId = `secondary-demo-${userId}-${normalizeExamId(exam.id).replace(/[^\w-]+/g, "-")}`;
      if (candidateYear === year && candidateSubject === subject) {
        return {
          id: demoId,
          score: Math.round((demoRates[index] / 100) * max),
          maxScore: max,
          timestamp: `${candidateYear}-05-${String(12 + index).padStart(2, "0")}T10:00:00.000Z`,
          examId: exam.id,
        };
      }
      index += 1;
    }
  }
  return null;
}

export default function SecondaryAnalysisPage() {
  const params = useParams<{ university: string; year: string; subject: string }>();
  const searchParams = useSearchParams();
  const university = decodeURIComponent(params.university);
  const year = Number(decodeURIComponent(params.year));
  const subject = decodeURIComponent(params.subject);
  const course = searchParams.get("course") ?? "";
  const universityLabel = UNIVERSITY_LABELS[university] ?? university;
  const subjectConfig = getSubjectConfig(university, subject);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CourseProfile | null>(null);
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [submissions, setSubmissions] = useState<StoredSubmission[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => (response.ok ? response.json() : { user: null })),
      fetch("/api/student-course-profile").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/exams").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/submissions").then((response) => (response.ok ? response.json() : [])),
    ]).then(([me, profileData, examData, submissionData]) => {
      setUser(me.user ?? null);
      setProfile(profileData);
      setExams(Array.isArray(examData) ? examData : []);
      setSubmissions(Array.isArray(submissionData) ? submissionData : []);
    });
  }, []);

  const subjectEntries = useMemo(
    () => Object.entries(SUBJECTS[university] ?? { [subject]: subjectConfig }) as [string, SubjectConfig][],
    [subject, subjectConfig, university],
  );
  const science = useMemo(() => isScienceGoal(profile, subjectEntries), [profile, subjectEntries]);
  const preferredSecondaryCourse = useMemo(
    () => getPreferredSecondaryCourse(university, course, profile),
    [course, profile, university],
  );
  const latestSubmissionByExam = useMemo(() => getLatestSubmissionByExam(submissions), [submissions]);
  const commonExamByYearSubject = useMemo(() => buildCommonExamByYearSubject(exams), [exams]);
  const secondaryExamByYearSubject = useMemo(
    () => buildSecondaryExamByYearSubject(exams, university, subjectEntries, science),
    [exams, science, subjectEntries, university],
  );

  const subjectScoreRows = useMemo(() => {
    return subjectEntries.map(([key, item]) => {
      const exactCourse = key === subject && course ? course : preferredSecondaryCourse;
      const exam = secondaryExamByYearSubject.get(`${year}:${key}`) ?? findExamForSubject(exams, university, year, key, item, exactCourse);
      const realSubmission = findLatestSubmissionForExam(submissions, exam);
      const demoCourse = exam?.course ?? exactCourse;
      const demo = !realSubmission && user ? findDemoScore(exams, university, year, key, demoCourse, user.id, item.max, subjectEntries) : null;
      const submission =
        realSubmission ??
        (demo
          ? ({
              id: demo.id,
              examId: demo.examId,
              studentId: user?.id ?? "",
              content: "Imported secondary score",
              images: [],
              timestamp: demo.timestamp,
              status: "graded" as const,
              score: demo.score,
              maxScore: demo.maxScore,
              feedback: "Imported secondary score.",
            } satisfies StoredSubmission)
          : null);
      const score = scoreToSubjectMax(submission, item.max);
      const rate = score === null ? null : Math.round((score / item.max) * 1000) / 10;
      return { key, item, exam, submission, score, rate };
    });
  }, [course, exams, preferredSecondaryCourse, secondaryExamByYearSubject, subject, subjectEntries, submissions, university, user, year]);

  const scoredSubjectRows = subjectScoreRows.filter((row) => row.score !== null);
  const selectedSubjectRow = subjectScoreRows.find((row) => row.key === subject) ?? null;
  const currentExam = selectedSubjectRow?.exam ?? null;
  const latestSubmission = selectedSubjectRow?.submission ?? null;
  const displayScore = selectedSubjectRow?.score ?? Math.round(subjectConfig.max * 0.58);
  const rate = Math.round((displayScore / subjectConfig.max) * 1000) / 10;
  const admissionDataset = getAdmissionDataset(university, year);
  const examAnalysisDataset = getExamAnalysisDataset(university, year);
  const selectedSubjectAnalysis = getSubjectAnalysis(examAnalysisDataset, subject, subjectConfig);
  const hasAnalysisSource = Boolean(selectedSubjectAnalysis);
  const hasDifficultyJudgement = Boolean(selectedSubjectAnalysis && selectedSubjectAnalysis.difficulty !== "未判定");
  const hasVolumeJudgement = Boolean(selectedSubjectAnalysis && selectedSubjectAnalysis.volume !== "未判定");
  const showDevelopmentSourceNotes =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_ADMISSION_SOURCES === "true";
  const analysisStatus = selectedSubjectAnalysis
    ? selectedSubjectAnalysis.difficulty === "未判定" ? "分析確認中" : selectedSubjectAnalysis.difficulty
    : "未収録";
  const selectedFaculty =
    profile?.goal?.faculty ||
    profile?.secondaryCourses?.find((item) => item.targetKey === university)?.goalFaculty ||
    admissionDataset.rows[0]?.faculty ||
    DEFAULT_FACULTIES[university]?.[0] ||
    "";
  const selectedDepartment =
    profile?.goal?.department ||
    profile?.secondaryCourses?.find((item) => item.targetKey === university)?.goalDepartment ||
    "";
  const benchmark = findBenchmarkRow(admissionDataset.rows, selectedFaculty, selectedDepartment);
  const verifiedScoreData = typeof benchmark?.min === "number" && typeof benchmark?.total === "number";
  const registeredScoreTotal = scoredSubjectRows.reduce((sum, row) => sum + (row.score ?? 0), 0);
  const registeredMaxTotal = scoredSubjectRows.reduce((sum, row) => sum + row.item.max, 0);
  const commonConvertedScore = buildCommonConvertedScore(university, year, commonExamByYearSubject, latestSubmissionByExam);
  const targetConversionConfig = getTargetConversionConfig(university);
  const completeSecondaryScore =
    targetConversionConfig && scoredSubjectRows.length === subjectEntries.length && registeredMaxTotal > 0
      ? registeredScoreTotal
      : null;
  const targetConvertedScore =
    commonConvertedScore && targetConversionConfig && completeSecondaryScore !== null
      ? {
          score: commonConvertedScore.score + completeSecondaryScore,
          maxScore: targetConversionConfig.totalMaxScore,
        }
      : null;
  const estimatedTotal = targetConvertedScore?.maxScore ?? benchmark?.total ?? subjectConfig.max;
  const estimateBaseScore = registeredScoreTotal > 0 ? registeredScoreTotal : displayScore;
  const estimateBaseMax = registeredMaxTotal > 0 ? registeredMaxTotal : subjectConfig.max;
  const estimatedExamScore =
    targetConvertedScore?.score ?? Math.round(Math.min(estimatedTotal, estimateBaseScore * (estimatedTotal / estimateBaseMax)));
  const estimatedMinimum = verifiedScoreData ? benchmark.min ?? 0 : Math.round(estimatedTotal * 0.62);
  const estimatedAverage = verifiedScoreData ? benchmark.average ?? estimatedMinimum : Math.round(estimatedTotal * 0.69);
  const scoreGapToMin = Math.round(estimatedExamScore - estimatedMinimum);
  const scoreGapToAverage = Math.round(estimatedExamScore - estimatedAverage);
  const judgment = verifiedScoreData
    ? scoreGapToMin >= 0
      ? "合格圏"
      : scoreGapToMin >= -40
        ? "接戦圏"
        : "強化圏"
    : "要確認";
  const registeredSubjects = scoredSubjectRows.length;
  const rowsWithMin = admissionDataset.rows.filter((row) => typeof row.min === "number");
  const highestMinimum = rowsWithMin.length ? [...rowsWithMin].sort((a, b) => (b.min ?? 0) - (a.min ?? 0))[0] : null;
  const easiestMinimum = rowsWithMin.length ? [...rowsWithMin].sort((a, b) => (a.min ?? 0) - (b.min ?? 0))[0] : null;
  const mostCompetitive = admissionDataset.rows
    .filter((row) => row.examinees && row.passed)
    .sort((a, b) => (b.examinees ?? 0) / (b.passed ?? 1) - (a.examinees ?? 0) / (a.passed ?? 1))[0];
  const sourceLinks = showDevelopmentSourceNotes
    ? (RESEARCH_SOURCE_LINKS[university] ?? SOURCE_LINKS[university] ?? []).map((source) => ({
        ...source,
        label: displaySourceText(source.label),
        note: displaySourceText(source.note ?? "年度別データの照合に使用した実在ページです。"),
      }))
    : [];

  return (
    <div className="min-h-screen bg-[#020814] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(104,72,255,0.28),transparent_30%),radial-gradient(circle_at_12%_12%,rgba(40,137,255,0.22),transparent_28%),linear-gradient(180deg,#050818_0%,#021126_55%,#020814_100%)]" />
      <main className="relative mx-auto flex w-full max-w-[1500px] gap-5 px-4 py-4">
        <aside className="hidden w-[250px] shrink-0 space-y-4 xl:block">
          <Link href="/secondary-results" className="flex items-center gap-3 rounded-md border border-violet-300/25 bg-slate-950/56 px-4 py-4 text-sm font-black text-white hover:bg-violet-950/50">
            <ArrowLeft className="h-5 w-5" />
            年度別得点一覧へ戻る
          </Link>
          <Panel title="レポート情報" icon={<FileBarChart2 className="h-5 w-5" />}>
            <InfoRow label="志望校" value={`${universityLabel} ${selectedFaculty}`} />
            <InfoRow label="年度" value={`${year}`} />
            <InfoRow label="選択中の科目" value={subjectConfig.label} />
            <InfoRow label="演習日" value={latestSubmission ? new Date(latestSubmission.timestamp).toLocaleDateString("ja-JP") : "-"} />
            <InfoRow label="登録科目数" value={`${registeredSubjects}科目`} />
          </Panel>
          <Panel title="注意" tone="warning" icon={<Target className="h-5 w-5" />}>
            <p className="text-xs font-bold leading-6 text-slate-200/90">
              合格者最低点・平均点は総合点ベースの参考データです。未確認年度については数値を作らず、確認済みの演習結果と公表値だけを表示します。
            </p>
          </Panel>
          <Panel title="関連メニュー" icon={<FolderOpen className="h-5 w-5" />}>
            <SideLink href="/secondary-results" label="年度別得点一覧" />
            <SideLink href={getExamHref(currentExam, university, year, subject)} label="この年度を再挑戦" />
            <SideLink href="/practice/secondary" label="受験年度比較" />
          </Panel>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/secondary-results" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-violet-200 xl:hidden">
                <ArrowLeft className="h-4 w-4" />
                年度別得点一覧へ戻る
              </Link>
              <h1 className="text-3xl font-black tracking-[0.03em] text-white md:text-4xl">
                {year}年度 {universityLabel} {selectedFaculty} 入試分析レポート
              </h1>
              <p className="mt-2 max-w-4xl text-sm font-bold leading-6 text-slate-300">
                2次演習マップの答案結果を、大学公表資料・確認済み資料で確認できる入試結果と照合します。未確認の数値は表示せず、確認済みの値だけを扱います。
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-violet-300/20 bg-violet-950/30 px-5 py-3 text-violet-100">
              <GraduationCap className="h-8 w-8" />
              <div className="text-right">
                <p className="text-xl font-black">{universityLabel}</p>
                <p className="text-[10px] font-bold tracking-[0.2em] text-violet-200/70">ADMISSION REPORT</p>
              </div>
            </div>
          </header>

          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <MetricCard wide icon={<BookOpenCheck className="h-9 w-9" />} label="選択中の科目" value={subjectConfig.label} sub={`${displayScore} / ${subjectConfig.max}`} extra={`${rate.toFixed(1)}%`} tone={scoreTone(rate)} />
            <MetricCard icon={<Trophy className="h-8 w-8" />} label="推定2次判定" value={judgment} sub={verifiedScoreData ? "確認済み最低点と比較" : "数値未収録のため参考判定"} />
            <MetricCard icon={<FolderOpen className="h-8 w-8" />} label="登録済み科目数" value={`${registeredSubjects}科目`} sub="年度内の登録科目" />
            <MetricCard icon={<CalendarDays className="h-8 w-8" />} label="演習日" value={latestSubmission ? new Date(latestSubmission.timestamp).toLocaleDateString("ja-JP") : "-"} sub={currentExam?.title ?? "演習データ"} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.8fr_0.75fr]">
            <Panel title="同年度の登録済み科目得点一覧" icon={<BarChart3 className="h-5 w-5" />}>
              <div className="overflow-hidden">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[26%]" />
                    <col className="w-[18%]" />
                    <col className="w-[42%]" />
                  </colgroup>
                  <thead className="bg-violet-900/55 text-violet-100">
                    <tr>
                      <th className="px-3 py-3 md:px-4">科目</th>
                      <th className="px-3 py-3 md:px-4">得点 / 満点</th>
                      <th className="px-3 py-3 md:px-4">得点率</th>
                      <th className="px-3 py-3 md:px-4">科目特徴</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(scoredSubjectRows.length > 0 ? scoredSubjectRows : subjectScoreRows).slice(0, 5).map(({ key, item, score, rate }) => {
                      return (
                        <tr key={key} className="border-t border-slate-700/70">
                          <td className="px-3 py-3 font-black text-white md:px-4">{item.label}</td>
                          <td className="px-3 py-3 text-base font-black md:px-4 md:text-lg">{score === null ? "未取込" : `${score} / ${item.max}`}</td>
                          <td className={`px-3 py-3 font-black md:px-4 ${rate === null ? "text-slate-400" : scoreTone(rate)}`}>{rate === null ? "-" : `${rate.toFixed(1)}%`}</td>
                          <td className="whitespace-normal break-words px-3 py-3 text-xs font-bold leading-5 text-slate-300 md:px-4">{item.feature}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="推定ライン比較" icon={<BarChart3 className="h-5 w-5" />}>
              <Bar label="あなたの換算得点" value={estimatedExamScore} max={estimatedTotal} color="bg-violet-500" />
              <Bar label="合格者平均点" value={estimatedAverage} max={estimatedTotal} color="bg-amber-300" muted={!verifiedScoreData} />
              <Bar label="合格最低点" value={estimatedMinimum} max={estimatedTotal} color="bg-emerald-400" muted={!verifiedScoreData} />
              <div className="mt-4 rounded-lg border border-violet-300/20 bg-slate-950/36 p-3 text-xs font-black leading-6 text-slate-200">
                <p>比較対象: {benchmark?.faculty ?? selectedFaculty} {benchmark?.department ?? ""}</p>
                <p className="text-slate-400">{verifiedScoreData ? "確認済みの合格者成績を使用しています。" : "合格者成績が画面未収録のため、得点率ベースの参考表示です。"}</p>
              </div>
              <div className="mt-5 rounded-lg border border-violet-300/25 bg-slate-950/42 p-4 text-lg font-black">
                <p>最低ラインとの差 <span className={scoreGapToMin >= 0 ? "text-emerald-300" : "text-rose-300"}>{scoreGapToMin > 0 ? "+" : ""}{scoreGapToMin}点</span></p>
                <p className="mt-2">平均ラインとの差 <span className={scoreGapToAverage >= 0 ? "text-emerald-300" : "text-rose-300"}>{scoreGapToAverage > 0 ? "+" : ""}{scoreGapToAverage}点</span></p>
              </div>
            </Panel>

            <Panel title="当該年度の入試結果データ" icon={<ClipboardList className="h-5 w-5" />}>
              <InfoRow label="募集人員" value={valueOrDash(benchmark?.capacity, "名")} />
              <InfoRow label="志願者数" value={valueOrDash(benchmark?.applicants, "名")} />
              <InfoRow label="受験者数" value={valueOrDash(benchmark?.examinees, "名")} />
              <InfoRow label="合格者数" value={valueOrDash(benchmark?.passed, "名")} />
              <InfoRow label="合格最高点" value={`${valueOrDash(benchmark?.high, "点")} / ${valueOrDash(benchmark?.total, "点")}`} />
              <InfoRow label="合格最低点" value={`${valueOrDash(benchmark?.min, "点")} / ${valueOrDash(benchmark?.total, "点")}`} />
              <InfoRow label="合格者平均点" value={`${valueOrDash(benchmark?.average, "点")} / ${valueOrDash(benchmark?.total, "点")}`} />
              {showDevelopmentSourceNotes && (
                <p className="mt-4 text-xs font-bold leading-5 text-slate-400">
                  出典: <a href={admissionDataset.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan-200 underline underline-offset-4">{displaySourceText(admissionDataset.sourceLabel)}</a>
                </p>
              )}
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr_1.35fr]">
            <Panel title={`${year}年度の読みどころ`} icon={<TrendingUp className="h-5 w-5" />}>
              <div className="grid gap-4 sm:grid-cols-[150px_1fr] xl:grid-cols-1 2xl:grid-cols-[150px_1fr]">
                <div className="relative grid h-36 w-36 place-items-center justify-self-center rounded-full bg-[conic-gradient(from_220deg,#22d3ee_0_24%,#8b5cf6_24%_58%,#fb7185_58%_100%)] p-3 shadow-[0_0_42px_rgba(139,92,246,0.28)]">
                  <div className="grid h-full w-full place-items-center rounded-full bg-slate-950 text-center">
                    <span className="text-xs font-black text-slate-400">難度</span>
                    <span className="text-2xl font-black text-white">{analysisStatus}</span>
                    <span className="text-xs font-bold text-cyan-200">{showDevelopmentSourceNotes ? "分析出典を確認" : "分析状況を確認"}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <DataPill label="難易度" value={selectedSubjectAnalysis?.difficulty ?? "未収録"} tone={hasDifficultyJudgement ? "emerald" : "rose"} />
                  <DataPill label="分量" value={selectedSubjectAnalysis?.volume ?? "未収録"} tone={hasVolumeJudgement ? "amber" : "rose"} />
                  <DataPill label="分析状況" value={hasAnalysisSource ? "確認済み" : "未収録"} tone={hasAnalysisSource ? "emerald" : "rose"} />
                  <p className="rounded-lg border border-slate-700/70 bg-slate-950/44 p-3 text-xs font-bold leading-6 text-slate-300">
                    {displayAnalysisText(selectedSubjectAnalysis?.summary ?? examAnalysisDataset?.note, `${universityLabel}の${year}年度科目別分析は未収録です。確認済み資料がない科目は、推測で難易度を表示しません。`)}
                  </p>
                  {showDevelopmentSourceNotes && selectedSubjectAnalysis ? (
                    <a href={selectedSubjectAnalysis.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-black text-cyan-200 underline underline-offset-4">
                      <ExternalLink className="h-3.5 w-3.5" />
                      確認済み出典
                    </a>
                  ) : null}
                </div>
              </div>
            </Panel>

            <Panel title={`科目別インパクト（${year}年度）`} icon={<BarChart3 className="h-5 w-5" />}>
              <div className="space-y-3">
                {subjectEntries.slice(0, 4).map(([key, item]) => {
                  const analysis = getSubjectAnalysis(examAnalysisDataset, key, item);
                  const impact = analysis?.impact ?? 0;
                  const color = key === subject ? "from-cyan-400 to-violet-400" : "from-violet-500 to-fuchsia-500";
                  return (
                    <div key={key} className={`rounded-lg border p-3 ${key === subject ? "border-cyan-300/45 bg-cyan-950/20" : "border-slate-700/70 bg-slate-950/28"}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-black text-white">{item.label}</p>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-black text-slate-200">
                          {analysis ? (key === subject ? "選択中" : analysis.difficulty) : "未収録"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${impact}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-bold leading-5 text-slate-300">{displayAnalysisText(analysis?.summary, "この科目の年度別分析は未収録です。確認済み資料が見つかるまで、難易度・分量は推測表示しません。")}</p>
                      {showDevelopmentSourceNotes && analysis ? (
                        <a href={analysis.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-cyan-200 underline underline-offset-4">
                          <ExternalLink className="h-3 w-3" />
                          出典
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="次回の得点設計" icon={<Target className="h-5 w-5" />}>
              <div className="grid gap-3 md:grid-cols-2">
                <ActionCard title="最優先" label={subjectConfig.label} value={hasAnalysisSource ? "確認済み資料で補強" : "分析収集中"} body={displayAnalysisText(selectedSubjectAnalysis?.strategy, "この科目は年度別分析が未収録です。確認が完了するまでは汎用アドバイスではなく、公式過去問と確認済み資料を優先します。")} tone="cyan" />
                <ActionCard title="答案戦略" label={selectedSubjectAnalysis?.difficulty ?? "未収録"} value={selectedSubjectAnalysis?.volume ? `分量: ${selectedSubjectAnalysis.volume}` : "分析確認中"} body={selectedSubjectAnalysis?.topics.join(" / ") ?? "設問別テーマと難易度を追加調査中です。"} tone="violet" />
                <ActionCard title="分析状況" label={hasAnalysisSource ? "確認済み資料" : "未収録"} value={hasAnalysisSource ? "確認済み" : "未収録"} body={displayAnalysisText(examAnalysisDataset?.note, "この年度の科目別分析は、まだ確認済み資料がありません。")} tone="amber" />
                <ActionCard title="判定の見方" label="公表値との比較" value={verifiedScoreData ? `${estimatedExamScore} / ${estimatedTotal}` : "数値確認中"} body="総合点の公表値と、2次演習の科目別得点は尺度が違うため、得点率と弱点の方向を重視します。" tone="emerald" />
              </div>
            </Panel>
          </div>

          <Panel title={`${year}年度 ${universityLabel} 入試結果一覧`} icon={<ClipboardList className="h-5 w-5" />} className="mt-4">
            <p className="mb-4 text-sm font-bold leading-6 text-slate-300">
              確認済みの公表値だけを表示しています。表内が「-」の欄は、今回の画面データとして未収録の項目です。
            </p>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <HighlightStat label="最も倍率が高い" value={mostCompetitive?.faculty ?? "未収録"} sub={mostCompetitive ? `${((mostCompetitive.examinees ?? 0) / (mostCompetitive.passed ?? 1)).toFixed(1)}倍` : "受験者数未収録"} />
              <HighlightStat label="最低点が最も高い" value={highestMinimum?.faculty ?? "未収録"} sub={highestMinimum ? `${highestMinimum.min} / ${highestMinimum.total}` : "得点未収録"} />
              <HighlightStat label="最低点が最も低い" value={easiestMinimum?.faculty ?? "未収録"} sub={easiestMinimum ? `${easiestMinimum.min} / ${easiestMinimum.total}` : "得点未収録"} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-slate-700 bg-slate-950/50 text-left text-slate-300">
                    <th className="px-4 py-3">区分</th>
                    <th className="px-4 py-3 text-right">募集</th>
                    <th className="px-4 py-3 text-right">志願者</th>
                    <th className="px-4 py-3 text-right">受験者</th>
                    <th className="px-4 py-3 text-right">合格者</th>
                    <th className="px-4 py-3 text-right">倍率</th>
                    <th className="px-4 py-3 text-right">最高点</th>
                    <th className="px-4 py-3 text-right">最低点</th>
                    <th className="px-4 py-3 text-right">平均点</th>
                  </tr>
                </thead>
                <tbody>
                  {admissionDataset.rows.map((row) => (
                    <AdmissionTableRow
                      key={`${row.faculty}-${row.department}`}
                      row={row}
                      selected={row.faculty === benchmark?.faculty && row.department === benchmark?.department}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {showDevelopmentSourceNotes && (
            <Panel title="確認した出典" icon={<ExternalLink className="h-5 w-5" />} className="mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                {sourceLinks.map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/25 bg-cyan-950/15 p-4 hover:bg-cyan-950/25">
                    <p className="flex items-center gap-2 font-black text-cyan-100">
                      {source.label}
                      <ExternalLink className="h-4 w-4" />
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-300">{source.note}</p>
                  </a>
                ))}
              </div>
            </Panel>
          )}
        </section>
      </main>
    </div>
  );
}

function Panel({ title, icon, children, tone = "normal", className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: "normal" | "warning"; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-lg border ${tone === "warning" ? "border-amber-300/40 bg-amber-950/20" : "border-violet-300/25 bg-slate-950/42"} shadow-[0_18px_44px_rgba(0,0,0,0.2)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-violet-300/16 bg-violet-950/35 px-4 py-3 text-violet-200">
        {icon}
        <h2 className="font-black">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MetricCard({ icon, label, value, sub, extra, wide = false, tone = "text-white" }: { icon: React.ReactNode; label: string; value: string; sub: string; extra?: string; wide?: boolean; tone?: string }) {
  return (
    <article className={`rounded-lg border border-violet-300/25 bg-[linear-gradient(135deg,rgba(36,23,92,0.82),rgba(2,22,48,0.86))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.2)] ${wide ? "lg:col-span-1" : ""}`}>
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-violet-500/25 text-violet-200">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-black text-violet-200">{label}</p>
          <p className={`mt-1 truncate text-3xl font-black ${tone}`}>{value}</p>
          <p className="mt-1 text-sm font-bold text-slate-300">{sub}</p>
        </div>
        {extra && <p className={`ml-auto text-3xl font-black ${tone}`}>{extra}</p>}
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-700/70 py-2 text-sm last:border-b-0">
      <span className="font-bold text-slate-400">{label}</span>
      <span className="text-right font-black text-white">{value}</span>
    </div>
  );
}

function SideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block rounded-md px-3 py-2 text-sm font-black text-slate-200 hover:bg-white/10 hover:text-white">
      {label}
    </Link>
  );
}

function Bar({ label, value, max, color, muted = false }: { label: string; value: number; max: number; color: string; muted?: boolean }) {
  const width = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  return (
    <div className={`mb-4 ${muted ? "opacity-55" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
        <span>{label}</span>
        <span>{Math.round(value * 10) / 10}点</span>
      </div>
      <div className="h-5 rounded bg-slate-800">
        <div className={`h-full rounded ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function DataPill({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" }) {
  const toneClass = tone === "emerald" ? "border-emerald-300/25 bg-emerald-950/24 text-emerald-200" : tone === "amber" ? "border-amber-300/25 bg-amber-950/20 text-amber-200" : "border-rose-300/25 bg-rose-950/20 text-rose-200";
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-black text-slate-300">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function ActionCard({ title, label, value, body, tone }: { title: string; label: string; value: string; body: string; tone: "cyan" | "violet" | "amber" | "emerald" }) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-300/30 bg-cyan-950/18 text-cyan-100"
      : tone === "violet"
        ? "border-violet-300/30 bg-violet-950/20 text-violet-100"
        : tone === "amber"
          ? "border-amber-300/30 bg-amber-950/18 text-amber-100"
          : "border-emerald-300/30 bg-emerald-950/16 text-emerald-100";
  return (
    <article className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-black text-slate-300">{title}</p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-xl font-black text-white">{label}</p>
        <p className="font-black">{value}</p>
      </div>
      <p className="mt-3 text-xs font-bold leading-6 text-slate-200">{body}</p>
    </article>
  );
}

function HighlightStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-violet-300/20 bg-slate-950/38 p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-bold text-cyan-200">{sub}</p>
    </div>
  );
}

function AdmissionTableRow({ row, selected }: { row: AdmissionRow; selected: boolean }) {
  const ratio = row.examinees && row.passed ? `${(row.examinees / row.passed).toFixed(1)}倍` : "-";
  return (
    <tr className={`border-b border-slate-800 ${selected ? "bg-cyan-950/20" : ""}`}>
      <td className="px-4 py-4 font-black text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span>{row.faculty}</span>
          {selected && <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-black text-slate-950">志望先</span>}
        </div>
        <p className="mt-1 text-xs font-bold text-slate-400">{row.department}{row.note ? ` / ${row.note}` : ""}</p>
      </td>
      <td className="px-4 py-4 text-right font-black">{valueOrDash(row.capacity)}</td>
      <td className="px-4 py-4 text-right font-black">{valueOrDash(row.applicants)}</td>
      <td className="px-4 py-4 text-right font-black">{valueOrDash(row.examinees)}</td>
      <td className="px-4 py-4 text-right font-black">{valueOrDash(row.passed)}</td>
      <td className="px-4 py-4 text-right font-black text-cyan-200">{ratio}</td>
      <td className="px-4 py-4 text-right font-black">{valueOrDash(row.high)}</td>
      <td className="px-4 py-4 text-right font-black">{valueOrDash(row.min)}</td>
      <td className="px-4 py-4 text-right font-black">{valueOrDash(row.average)}</td>
    </tr>
  );
}
