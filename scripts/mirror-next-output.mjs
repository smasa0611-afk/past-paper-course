import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const appDir = path.join(rootDir, "exam-system");

const copies = [
  [path.join(appDir, ".next"), path.join(rootDir, ".next")],
  [path.join(appDir, "public"), path.join(rootDir, "public")],
];

for (const [source, destination] of copies) {
  if (!fs.existsSync(source)) continue;
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}
