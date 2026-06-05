import fs from "node:fs";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const nextDir = path.join(projectDir, ".next");

function* walk(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".nft.json")) {
      yield fullPath;
    }
  }
}

function isPdfTrace(filePath) {
  return filePath.replaceAll("\\", "/").toLowerCase().endsWith(".pdf");
}

let filesChanged = 0;
let entriesRemoved = 0;

for (const manifestPath of walk(nextDir)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.files)) continue;

  const before = manifest.files.length;
  manifest.files = manifest.files.filter((filePath) => !isPdfTrace(filePath));
  const removed = before - manifest.files.length;

  if (removed > 0) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    filesChanged += 1;
    entriesRemoved += removed;
  }
}

console.log(
  `Pruned ${entriesRemoved} PDF trace entr${entriesRemoved === 1 ? "y" : "ies"} from ${filesChanged} NFT manifest${filesChanged === 1 ? "" : "s"}.`,
);
