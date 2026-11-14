import { build } from "esbuild";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "web", "lyco-music-pwa");
const dist = path.join(srcDir, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [path.join(srcDir, "src", "app.ts")],
  outfile: path.join(dist, "app.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  logLevel: "info",
});

await cp(path.join(srcDir, "index.template.html"), path.join(dist, "index.html"));
await cp(path.join(srcDir, "manifest.webmanifest"), path.join(dist, "manifest.webmanifest"));
await cp(path.join(srcDir, "sw.js"), path.join(dist, "sw.js"));

const icons = spawnSync("python3", [path.join(root, "scripts", "make-pwa-icons.py"), dist], { encoding: "utf8" });
if (icons.status !== 0) {
  console.error(icons.stdout || "", icons.stderr || "");
  throw new Error("icon generation failed");
}
console.log(icons.stdout.trim());

for (const name of ["index.html", "app.js", "sw.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"]) {
  const info = await stat(path.join(dist, name));
  console.log("OK", name, info.size);
}
