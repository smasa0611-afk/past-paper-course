import fs from "fs";
import path from "path";

const root = process.cwd();
const masterDir = path.join(root, "data", "master-data");
const outputDir = path.join(root, "outputs", "toyota-dummy-import");
const bulkDir = path.join(outputDir, "bulk-10-csv");

const fileMap = [
  ["HONBU.csv", "headquarters.json"],
  ["KOUSHA.csv", "schools.json"],
  ["GAKUNEN.csv", "grade_masters.json"],
  ["DAIGAKU.csv", "universities.json"],
  ["LINEUP.csv", "course_lineups.json"],
  ["SHAIN.csv", "employees.json"],
  ["KANRIHONBU.csv", "employee_headquarter_permissions.json"],
  ["KANRIKOUSHA.csv", "employee_school_permissions.json"],
  ["SEITO.csv", "master_students.json"],
  ["JUKOUKANRI.csv", "master_student_course_enrollments.json"],
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(filePath, rows, preferredHeaders) {
  const headers = preferredHeaders ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ];
  fs.writeFileSync(filePath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function byKeys(rows, keys) {
  const set = new Set();
  return rows.filter((row) => {
    const key = keys.map((column) => row[column] ?? "").join("\u001f");
    if (set.has(key)) return false;
    set.add(key);
    return true;
  });
}

function universityLookup() {
  const rows = readJson(path.join(masterDir, "universities.json"));
  const byCode = new Map(rows.map((row) => [row["コード"], row]));
  return {
    todaiHumanities: byCode.get("011000110110"),
    todaiScience: byCode.get("011000210110"),
    kyodaiHumanities: byCode.get("028001010110"),
    kyodaiScience: byCode.get("028010810110"),
    kyodaiEducation: byCode.get("028006010112"),
    kyodaiEconomics: byCode.get("028003010113"),
    nagoyaHumanitiesA: byCode.get("024501010110"),
    nagoyaHumanitiesB: byCode.get("024503010110"),
    nagoyaScienceA: byCode.get("024510810110"),
    nagoyaScienceB: byCode.get("024515510110"),
    nagoyaInfo: byCode.get("024510580210"),
    hamamatsuMedical: byCode.get("024013010110"),
    hamamatsuNursing: byCode.get("024013010210"),
    hokkaido: byCode.get("000511510530"),
    tsukuba: byCode.get("008515680230"),
    shizuokaInfo: byCode.get("023510510110"),
    kobeLaw: byCode.get("031502010110"),
  };
}

function studentRow(id, index, goal) {
  const n = String(index).padStart(2, "0");
  return {
    "\u751f\u5f92\uff29\uff24": id,
    "\u5b66\u6821\u533a\u5206": "4",
    "\u5b66\u5e74\u533a\u5206": "3",
    "\u9ad8\u7b49\u90e8\u6821\u820e\u30b3\u30fc\u30c9": "2291",
    "\u59d3": "\u8c4a\u7530",
    "\u540d": `\u30c0\u30df\u30fc${n}`,
    "\u30ab\u30ca\u59d3": "\u30c8\u30e8\u30bf",
    "\u30ab\u30ca\u540d": `\u30c0\u30df\u30fc${n}`,
    "\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9": `toyota_dummy_${n}@example.invalid`,
    "\u5fd7\u671b\u6821\u30b3\u30fc\u30c9": goal?.["コード"] ?? "",
    "\u5927\u5b66\u540d": goal?.["大学名"] ?? "",
    "\u5b66\u90e8\u540d": goal?.["学部名"] ?? "",
    "\u5b66\u79d1\u540d": goal?.["学科名"] ?? "",
  };
}

function enrollmentRow(studentId, courseCode) {
  return {
    "\u5e74\u5ea6": "2026",
    "\u6388\u696d\u533a\u5206": "40",
    "\u8b1b\u5ea7\u7a2e\u985e": "65",
    "\u8b1b\u5ea7\u30b3\u30fc\u30b9\u533a\u5206": courseCode,
    "\u751f\u5f92\uff29\uff24": studentId,
  };
}

function scoreRow(student, courseCode, courseTitle, assignmentName, subject, year, round, score) {
  return {
    "\u751f\u5f92ID": student["生徒ＩＤ"],
    "\u8b1b\u5ea7\u30b3\u30fc\u30c9": courseCode,
    "\u8b1b\u5ea7\u540d": courseTitle,
    "\u8ab2\u984c\u540d": assignmentName,
    "\u6559\u79d1": subject,
    "\u5e74\u5ea6": year,
    "\u56de\u6570": round,
    "\u70b9\u6570": score,
    "\u63d0\u51fa\u65e5": "2026-05-14",
    "\u63a1\u70b9\u65e5": "2026-05-15",
    "\u5099\u8003": "toyota dummy score",
  };
}

fs.mkdirSync(bulkDir, { recursive: true });

const goals = universityLookup();
const commonGoals = [goals.hokkaido, goals.tsukuba, goals.shizuokaInfo, goals.kobeLaw, goals.hamamatsuNursing];
const secondaryPlan = [
  ["10", goals.todaiHumanities, "\u6771\u59272\u6b21\u6f14\u7fd2", "\u6771\u5927\u82f1\u8a9e2026", "\u82f1\u8a9e"],
  ["15", goals.todaiScience, "\u6771\u59272\u6b21\u6f14\u7fd2", "\u6771\u5927\u7406\u7cfb\u6570\u5b662026", "\u6570\u5b66"],
  ["20", goals.kyodaiHumanities, "\u4eac\u59272\u6b21\u6f14\u7fd2", "\u4eac\u5927\u6587\u7cfb\u6570\u5b662026", "\u6570\u5b66"],
  ["25", goals.kyodaiScience, "\u4eac\u59272\u6b21\u6f14\u7fd2", "\u4eac\u5927\u7406\u7cfb\u6570\u5b662026", "\u6570\u5b66"],
  ["26", goals.kyodaiEducation, "\u4eac\u59272\u6b21\u6f14\u7fd2", "\u4eac\u5927\u82f1\u8a9e2026", "\u82f1\u8a9e"],
  ["27", goals.kyodaiEconomics, "\u4eac\u59272\u6b21\u6f14\u7fd2", "\u4eac\u5927\u7406\u7cfb\u6570\u5b662026", "\u6570\u5b66"],
  ["30", goals.nagoyaHumanitiesA, "\u540d\u59272\u6b21\u6f14\u7fd2", "\u540d\u5927\u6587\u7cfb\u6570\u5b662026", "\u6570\u5b66"],
  ["31", goals.nagoyaHumanitiesB, "\u540d\u59272\u6b21\u6f14\u7fd2", "\u540d\u5927\u82f1\u8a9e2026", "\u82f1\u8a9e"],
  ["35", goals.nagoyaScienceA, "\u540d\u59272\u6b21\u6f14\u7fd2", "\u540d\u5927\u7406\u7cfb\u6570\u5b662026", "\u6570\u5b66"],
  ["36", goals.nagoyaScienceB, "\u540d\u59272\u6b21\u6f14\u7fd2", "\u540d\u5927\u7406\u7cfb\u6570\u5b662026", "\u6570\u5b66"],
  ["37", goals.nagoyaInfo, "\u540d\u59272\u6b21\u6f14\u7fd2", "\u540d\u5927\u82f1\u8a9e2026", "\u82f1\u8a9e"],
  ["40", goals.hamamatsuMedical, "\u6d5c\u677e\u533b\u59272\u6b21\u6f14\u7fd2", "\u6d5c\u677e\u533b\u5927\u82f1\u8a9e2026", "\u82f1\u8a9e"],
  ["15", goals.todaiScience, "\u6771\u59272\u6b21\u6f14\u7fd2", "\u6771\u5927\u7269\u74062026", "\u7269\u7406"],
  ["25", goals.kyodaiScience, "\u4eac\u59272\u6b21\u6f14\u7fd2", "\u4eac\u5927\u7269\u74062026", "\u7269\u7406"],
  ["40", goals.hamamatsuMedical, "\u6d5c\u677e\u533b\u59272\u6b21\u6f14\u7fd2", "\u6d5c\u677e\u533b\u5927\u6570\u5b662026", "\u6570\u5b66"],
];

const dummyStudents = [];
const dummyEnrollments = [];
const dummyScores = [];

for (let i = 1; i <= 5; i++) {
  const id = `829100${String(i).padStart(2, "0")}`;
  const student = studentRow(id, i, commonGoals[i - 1]);
  dummyStudents.push(student);
  dummyEnrollments.push(enrollmentRow(id, "01"));
  dummyScores.push(scoreRow(student, "01", "\u6771\u59272\u6b21\u6f14\u7fd2", "\u6771\u5927\u82f1\u8a9e2026", "\u82f1\u8a9e", "2026", "1", 62 + i));
}

secondaryPlan.forEach(([courseCode, goal, courseTitle, assignmentName, subject], index) => {
  const number = index + 6;
  const id = `829100${String(number).padStart(2, "0")}`;
  const student = studentRow(id, number, goal);
  dummyStudents.push(student);
  dummyEnrollments.push(enrollmentRow(id, courseCode));
  dummyScores.push(scoreRow(student, courseCode, courseTitle, assignmentName, subject, "2026", String((index % 3) + 1), 58 + ((index * 7) % 37)));
});

const existingStudents = readJson(path.join(masterDir, "master_students.json"));
const existingEnrollments = readJson(path.join(masterDir, "master_student_course_enrollments.json"));
const studentIds = new Set(dummyStudents.map((row) => row["生徒ＩＤ"]));
const enrollmentKeys = new Set(dummyEnrollments.map((row) => `${row["年度"]}|${row["授業区分"]}|${row["講座種類"]}|${row["講座コース区分"]}|${row["生徒ＩＤ"]}`));

for (const [csvName, jsonName] of fileMap) {
  const rows = readJson(path.join(masterDir, jsonName));
  let nextRows = rows;
  if (csvName === "SEITO.csv") {
    nextRows = [...rows.filter((row) => !studentIds.has(row["生徒ＩＤ"])), ...dummyStudents];
  }
  if (csvName === "JUKOUKANRI.csv") {
    nextRows = [
      ...rows.filter((row) => !enrollmentKeys.has(`${row["年度"]}|${row["授業区分"]}|${row["講座種類"]}|${row["講座コース区分"]}|${row["生徒ＩＤ"]}`)),
      ...dummyEnrollments,
    ];
  }
  const headers = Object.keys(rows[0] ?? nextRows[0] ?? {});
  writeCsv(path.join(bulkDir, csvName), nextRows, headers);
}

writeCsv(path.join(outputDir, "toyota_secondary_scores.csv"), dummyScores, Object.keys(dummyScores[0]));
writeCsv(
  path.join(outputDir, "toyota_dummy_students_manifest.csv"),
  dummyStudents.map((student) => {
    const enrollment = dummyEnrollments.find((row) => row["生徒ＩＤ"] === student["生徒ＩＤ"]);
    return {
      studentId: student["生徒ＩＤ"],
      name: `${student["姓"]}${student["名"]}`,
      schoolCode: student["高等部校舎コード"],
      courseCode: enrollment?.["講座コース区分"] ?? "",
      goalCode: student["志望校コード"],
      university: student["大学名"],
      faculty: student["学部名"],
      department: student["学科名"],
    };
  }),
  ["studentId", "name", "schoolCode", "courseCode", "goalCode", "university", "faculty", "department"],
);

const summary = {
  outputDir,
  bulkDir,
  dummyStudentCount: dummyStudents.length,
  dummyEnrollmentCount: dummyEnrollments.length,
  dummyScoreCount: dummyScores.length,
  studentIds: dummyStudents.map((row) => row["生徒ＩＤ"]),
  bulkFiles: fileMap.map(([name]) => name),
};
fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

if (process.argv.includes("--apply-local-master")) {
  fs.mkdirSync(path.join(outputDir, "backup"), { recursive: true });
  const studentsPath = path.join(masterDir, "master_students.json");
  const enrollmentsPath = path.join(masterDir, "master_student_course_enrollments.json");
  const appliedStudents = [
    ...existingStudents.filter((row) => !studentIds.has(row["生徒ＩＤ"])),
    ...dummyStudents,
  ];
  const appliedEnrollments = [
    ...existingEnrollments.filter((row) => !enrollmentKeys.has(`${row["年度"]}|${row["授業区分"]}|${row["講座種類"]}|${row["講座コース区分"]}|${row["生徒ＩＤ"]}`)),
    ...dummyEnrollments,
  ];
  fs.copyFileSync(studentsPath, path.join(outputDir, "backup", "master_students.before-toyota-dummy.json"));
  fs.copyFileSync(enrollmentsPath, path.join(outputDir, "backup", "master_student_course_enrollments.before-toyota-dummy.json"));
  fs.writeFileSync(studentsPath, `\uFEFF${JSON.stringify(byKeys(appliedStudents, ["生徒ＩＤ"]), null, 4)}`, "utf8");
  fs.writeFileSync(
    enrollmentsPath,
    `\uFEFF${JSON.stringify(byKeys(appliedEnrollments, ["年度", "授業区分", "講座種類", "講座コース区分", "生徒ＩＤ"]), null, 4)}`,
    "utf8",
  );
  summary.appliedLocalMaster = true;
  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
}

console.log(JSON.stringify(summary, null, 2));
