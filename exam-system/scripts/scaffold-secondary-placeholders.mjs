import fs from "node:fs";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const rootDir = path.resolve(projectDir, "..");
const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

const targets = [
  {
    exam_type: "todai",
    university: "東京大学",
    subjects: [
      { subject: "english", course: "science", label: "英語", time_minutes: 120 },
      { subject: "math", course: "humanities", label: "文系数学", time_minutes: 100 },
      { subject: "math", course: "science", label: "理系数学", time_minutes: 150 },
      { subject: "japanese", course: "humanities", label: "国語 文科", time_minutes: 150 },
      { subject: "japanese", course: "science", label: "国語 理科", time_minutes: 100 },
      { subject: "science", course: "science", label: "理科", time_minutes: 150 },
      { subject: "social", course: "humanities", label: "地理歴史", time_minutes: 150 },
    ],
  },
  {
    exam_type: "kyodai",
    university: "京都大学",
    subjects: [
      { subject: "english", course: "science", label: "英語", time_minutes: 120 },
      { subject: "math", course: "humanities", label: "文系数学", time_minutes: 120 },
      { subject: "math", course: "science", label: "理系数学", time_minutes: 150 },
      { subject: "japanese", course: "humanities", label: "国語 文系", time_minutes: 120 },
      { subject: "japanese", course: "science", label: "国語 理系", time_minutes: 90 },
      { subject: "social", course: "humanities", label: "地理歴史", time_minutes: 90 },
      { subject: "physics", course: "science", label: "物理", time_minutes: 90 },
      { subject: "chemistry", course: "science", label: "化学", time_minutes: 90 },
      { subject: "biology", course: "science", label: "生物", time_minutes: 90 },
    ],
  },
  {
    exam_type: "nagoya",
    university: "名古屋大学",
    subjects: [
      { subject: "english", course: "science", label: "英語", time_minutes: 105 },
      { subject: "math", course: "humanities", label: "文系数学", time_minutes: 120 },
      { subject: "math", course: "science", label: "理系数学", time_minutes: 150 },
      { subject: "japanese", course: "humanities", label: "国語", time_minutes: 105 },
      { subject: "social", course: "humanities", label: "地理歴史", time_minutes: 90 },
      { subject: "physics", course: "science", label: "物理", time_minutes: 75 },
      { subject: "chemistry", course: "science", label: "化学", time_minutes: 75 },
      { subject: "biology", course: "science", label: "生物", time_minutes: 75 },
    ],
  },
  {
    exam_type: "hamamatsu_medical",
    university: "浜松医科大学",
    subjects: [
      { subject: "english", course: "medicine", label: "英語", time_minutes: 90 },
      { subject: "math", course: "medicine", label: "数学", time_minutes: 120 },
      { subject: "physics", course: "medicine", label: "物理", time_minutes: 90 },
      { subject: "chemistry", course: "medicine", label: "化学", time_minutes: 90 },
      { subject: "biology", course: "medicine", label: "生物", time_minutes: 90 },
      { subject: "essay", course: "medicine", label: "小論文", time_minutes: 80 },
    ],
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPlaceholderPdf(destination, id, title) {
  if (fs.existsSync(destination) && fs.statSync(destination).size > 0) return false;

  const lines = [
    "Problem PDF placeholder",
    `ID: ${id}`,
    `Title: ${title}`,
    "Replace this file when Sanaru material research room provides the real PDF.",
  ];
  const stream = [
    "BT",
    "/F1 18 Tf",
    "72 760 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? `(${escapePdfText(line)}) Tj` : `0 -28 Td (${escapePdfText(line)}) Tj`,
    ]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  fs.writeFileSync(destination, pdf, "ascii");
  return true;
}

let created = 0;
let skipped = 0;

for (const target of targets) {
  for (const year of years) {
    for (const subject of target.subjects) {
      const id = `${target.exam_type}/${year}/${subject.subject}/${subject.course}`;
      const title = `${target.university} ${subject.label} ${year}`;
      const examDir = path.join(rootDir, id);
      ensureDir(examDir);

      const metadataPath = path.join(examDir, "metadata.json");
      if (!fs.existsSync(metadataPath)) {
        fs.writeFileSync(
          metadataPath,
          `${JSON.stringify(
            {
              exam_type: target.exam_type,
              year,
              subject: subject.subject,
              course: subject.course,
              title,
              time_minutes: subject.time_minutes,
              problem_files: [{ label: "問題PDF準備中", path: "problem.pdf" }],
              source: {
                kind: "placeholder",
                note: "教材研究室から問題PDFを受領後、problem.pdfを差し替える",
              },
            },
            null,
            2
          )}\n`
        );
      }

      const rubricPath = path.join(examDir, "rubric.md");
      if (!fs.existsSync(rubricPath)) {
        fs.writeFileSync(
          rubricPath,
          `# ${title}\n\n問題PDFと解説PDFは未配置です。教材研究室から受領後に差し替えてください。\n`
        );
      }

      if (createPlaceholderPdf(path.join(examDir, "problem.pdf"), id, title)) {
        created += 1;
      } else {
        skipped += 1;
      }
    }
  }
}

console.log(`Created ${created} placeholder problem PDFs. Skipped ${skipped} existing PDFs.`);
