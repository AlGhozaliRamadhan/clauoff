import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const vadDist = path.join(
  projectRoot,
  "node_modules",
  "@ricky0123",
  "vad-web",
  "dist",
);
const ortDist = path.join(
  projectRoot,
  "node_modules",
  "@ricky0123",
  "vad-web",
  "node_modules",
  "onnxruntime-web",
  "dist",
);
const destination = path.join(projectRoot, "public", "vendor", "vad");

async function copyIfChanged(source, target) {
  const sourceStat = await stat(source);
  const targetStat = await stat(target).catch(() => null);
  if (targetStat?.size === sourceStat.size) return false;
  await copyFile(source, target);
  return true;
}

await mkdir(destination, { recursive: true });

const fixedAssets = [
  "vad.worklet.bundle.min.js",
  "silero_vad_v5.onnx",
  "silero_vad_legacy.onnx",
];
const ortAssets = (await readdir(ortDist)).filter(
  (name) => name.startsWith("ort-wasm") && (name.endsWith(".mjs") || name.endsWith(".wasm")),
);

let copied = 0;
for (const name of fixedAssets) {
  if (await copyIfChanged(path.join(vadDist, name), path.join(destination, name))) copied++;
}
for (const name of ortAssets) {
  if (await copyIfChanged(path.join(ortDist, name), path.join(destination, name))) copied++;
}

if (copied > 0) {
  process.stdout.write(`Prepared ${copied} local voice runtime asset${copied === 1 ? "" : "s"}.\n`);
}
