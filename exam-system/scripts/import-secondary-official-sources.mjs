import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const rootDir = path.resolve(projectDir, "..");

const exams = [
  {
    id: "todai/2026/japanese/humanities",
    title: "東京大学 国語 文科 2026",
    exam_type: "todai",
    year: 2026,
    subject: "japanese",
    course: "humanities",
    time_minutes: 150,
    problemUrl: "https://www.u-tokyo.ac.jp/content/400239115.pdf",
  },
  {
    id: "todai/2026/japanese/science",
    title: "東京大学 国語 理科 2026",
    exam_type: "todai",
    year: 2026,
    subject: "japanese",
    course: "science",
    time_minutes: 100,
    problemUrl: "https://www.u-tokyo.ac.jp/content/400239116.pdf",
  },
  {
    id: "todai/2026/math/humanities",
    title: "東京大学 文系数学 2026",
    exam_type: "todai",
    year: 2026,
    subject: "math",
    course: "humanities",
    time_minutes: 100,
    problemUrl: "https://www.u-tokyo.ac.jp/content/400239117.pdf",
  },
  {
    id: "todai/2026/math/science",
    title: "東京大学 理系数学 2026",
    exam_type: "todai",
    year: 2026,
    subject: "math",
    course: "science",
    time_minutes: 150,
    problemUrl: "https://www.u-tokyo.ac.jp/content/400239118.pdf",
  },
  {
    id: "todai/2026/social/humanities",
    title: "東京大学 地理歴史 2026",
    exam_type: "todai",
    year: 2026,
    subject: "social",
    course: "humanities",
    time_minutes: 150,
    problemUrl: "https://www.u-tokyo.ac.jp/content/400239119.pdf",
  },
  {
    id: "todai/2026/science/science",
    title: "東京大学 理科 2026",
    exam_type: "todai",
    year: 2026,
    subject: "science",
    course: "science",
    time_minutes: 150,
    problemUrl: "https://www.u-tokyo.ac.jp/content/400239120.pdf",
  },
  {
    id: "kyodai/2025/math/humanities",
    title: "京都大学 文系数学 2025",
    exam_type: "kyodai",
    year: 2025,
    subject: "math",
    course: "humanities",
    time_minutes: 120,
    problemUrl:
      "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_3M03-668651f395772cd32108e0f81b087eab.pdf",
    answerUrl:
      "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_3M03-bc66a1f7c9e9cad58c9fcb6bc3ce49d3.pdf",
    answerLabel: "出題意図等",
  },
  {
    id: "kyodai/2025/math/science",
    title: "京都大学 理系数学 2025",
    exam_type: "kyodai",
    year: 2025,
    subject: "math",
    course: "science",
    time_minutes: 150,
    problemUrl:
      "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_3M04-9acd1fcb2bd4a749430c5d4444aa5419.pdf",
    answerUrl:
      "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_3M04-fa877291099b827b01bb54be3f57c828.pdf",
    answerLabel: "出題意図等",
  },
  {
    id: "kyodai/2025/english/science",
    title: "京都大学 英語 2025",
    exam_type: "kyodai",
    year: 2025,
    subject: "english",
    course: "science",
    time_minutes: 120,
    problemUrl:
      "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_5M05-d8d36bac3e06b6861f3cd42491e2846c.pdf",
    answerUrl:
      "https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_5M05-fc31cc2bb68a563cf77d85e6e34c6291.pdf",
    answerLabel: "出題意図等",
  },
  {
    id: "nagoya/2026/math/science",
    title: "名古屋大学 理系数学 2026",
    exam_type: "nagoya",
    year: 2026,
    subject: "math",
    course: "science",
    time_minutes: 150,
    problemUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/3-2_r8mondai_math_ri.pdf",
    answerUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/3_r8ito_math_1.pdf",
    answerLabel: "出題意図・解答例",
  },
  {
    id: "nagoya/2026/math/humanities",
    title: "名古屋大学 文系数学 2026",
    exam_type: "nagoya",
    year: 2026,
    subject: "math",
    course: "humanities",
    time_minutes: 120,
    problemUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/3-1_r8mondai_math_bun.pdf",
    answerUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/3_r8ito_math_1.pdf",
    answerLabel: "出題意図・解答例",
  },
  {
    id: "nagoya/2026/english/science",
    title: "名古屋大学 英語 2026",
    exam_type: "nagoya",
    year: 2026,
    subject: "english",
    course: "science",
    time_minutes: 105,
    problemUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/5_r8mondai_eng.pdf",
    answerUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/5_r8ito_kaitorei_eng_1.pdf",
    answerLabel: "出題意図・解答例",
  },
  {
    id: "nagoya/2026/physics/science",
    title: "名古屋大学 物理 2026",
    exam_type: "nagoya",
    year: 2026,
    subject: "physics",
    course: "science",
    time_minutes: 75,
    problemUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/4-1_r8mondai_buturi.pdf",
    answerUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/4_r8ito_kaitorei_physics_1.pdf",
    answerLabel: "出題意図・解答例",
  },
  {
    id: "nagoya/2026/chemistry/science",
    title: "名古屋大学 化学 2026",
    exam_type: "nagoya",
    year: 2026,
    subject: "chemistry",
    course: "science",
    time_minutes: 75,
    problemUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/4-2_r8mondai_kagaku.pdf",
    answerUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/4_r8ito_kaitorei_chemistry_1.pdf",
    answerLabel: "出題意図・解答例",
  },
  {
    id: "nagoya/2026/biology/science",
    title: "名古屋大学 生物 2026",
    exam_type: "nagoya",
    year: 2026,
    subject: "biology",
    course: "science",
    time_minutes: 75,
    problemUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/4-3_r8mondai_seibutu.pdf",
    answerUrl: "https://www.nagoya-u.ac.jp/admissions/exam/upload/4_r8ito_kaitorei_biology_1.pdf",
    answerLabel: "出題意図・解答例",
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
      resolve("skipped");
      return;
    }

    const file = fs.createWriteStream(destination);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destination);
          download(new URL(res.headers.location, url).toString(), destination).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destination);
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve("downloaded");
        });
      })
      .on("error", (error) => {
        file.close();
        if (fs.existsSync(destination)) fs.unlinkSync(destination);
        reject(error);
      });
  });
}

for (const exam of exams) {
  const examDir = path.join(rootDir, exam.id);
  ensureDir(examDir);

  const metadata = {
    exam_type: exam.exam_type,
    year: exam.year,
    subject: exam.subject,
    course: exam.course,
    title: exam.title,
    time_minutes: exam.time_minutes,
    problem_files: [{ label: "問題", path: "problem.pdf" }],
    ...(exam.answerUrl ? { answer_files: [{ label: exam.answerLabel ?? "解答", path: "answer.pdf" }] } : {}),
    source: {
      kind: exam.sourceKind ?? "official",
      problem_url: exam.problemUrl,
      ...(exam.answerUrl ? { answer_url: exam.answerUrl } : {}),
    },
  };

  fs.writeFileSync(path.join(examDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  if (!fs.existsSync(path.join(examDir, "rubric.md"))) {
    fs.writeFileSync(
      path.join(examDir, "rubric.md"),
      `# ${exam.title}\n\n記述式2次試験です。佐鳴の解説・採点基準に差し替えるまで、採点ルーブリックは仮置きです。\n`
    );
  }

  const problemResult = await download(exam.problemUrl, path.join(examDir, "problem.pdf"));
  const answerResult = exam.answerUrl ? await download(exam.answerUrl, path.join(examDir, "answer.pdf")) : "none";
  console.log(`${exam.id}: problem ${problemResult}, answer ${answerResult}`);
}
