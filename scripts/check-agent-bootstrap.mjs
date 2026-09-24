import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Instruction regression checks, not an installer or a renderer/browser test.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
const bootstrapPath = "docs/agent-bootstrap.md";
const bootstrap = read(bootstrapPath);
const entryPoints = [
  "README.md",
  "AGENTS.md",
  "docs/agent-workflow.md",
  ".agents/skills/make-imessage-demo/SKILL.md",
  ".agents/skills/photon-demo-creator/SKILL.md",
];
for (const name of entryPoints) {
  const text = read(name);
  const links = [...text.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)];
  check(links.some(([, target]) =>
    path.resolve(root, path.dirname(name), target) === path.join(root, bootstrapPath)),
  `${name}: must link to the canonical bootstrap`);
}

const readme = read("README.md");
check(readme.indexOf("## Give this repo to your agent") >= 0, "README needs the shareable setup prompt");
check(readme.indexOf("## Give this repo to your agent") < readme.indexOf("## Start with a company"), "setup must precede company authoring");
for (const name of [bootstrapPath, "README.md"]) {
  const text = read(name);
  for (const skill of ["make-imessage-demo", "photon-demo-creator"]) {
    check(text.includes(`$${skill}`), `${name}: ready handoff must identify ${skill}`);
  }
  check(text.includes("hit me with a company name."), `${name}: missing requested ready invitation`);
  check(text.includes("Skills loaded from this project:"), `${name}: do not mislabel repository discovery as global installation`);
}
for (const phrase of [
  "Do not treat the repository URL as a company brief",
  "A read-only review or explanation stays read-only",
  "Do not overwrite personal/global skill folders",
  "Stop on a failed required command",
  "Do not ask for a company as though setup passed",
  "When a company or transcript is already supplied, skip the invitation",
  "a loopback URL alone is not a usable handoff",
  "Do not commit setup artifacts",
]) {
  check(bootstrap.includes(phrase), `bootstrap lost scope or failure rule: ${phrase}`);
}
for (const command of [
  "npm ci",
  "npx playwright install chromium",
  "node scripts/check-demo-skills.mjs",
  "node scripts/check-agent-bootstrap.mjs",
  "npm run build",
]) {
  check(bootstrap.includes(command), `bootstrap lost environment gate: ${command}`);
}
check(!/npm run demo --/.test(bootstrap), "keep renderer CLI examples in the executor, not a second bootstrap cookbook");
for (const item of ["examples/agent-walkover.flow.json", "1690 ms", "Play, Pause, and Reset", "setup-notes.md", "Only after dependencies"]) {
  check(bootstrap.includes(item), `bootstrap lost verification requirement: ${item}`);
}
check(!/\/Users\/[A-Za-z]/.test(bootstrap), "bootstrap must work outside the original author's Mac");

let links = 0;
for (const [, target] of bootstrap.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
  if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
  const resolved = path.resolve(root, "docs", decodeURIComponent(target.split("#")[0]));
  check(resolved.startsWith(root + path.sep), `bootstrap link escapes checkout: ${target}`);
  check(existsSync(resolved), `bootstrap link missing: ${target}`);
  links += 1;
}
console.log(JSON.stringify({ ok: true, checks, entryPoints: entryPoints.length, links, scope: "bootstrap instructions only; no installation, renderer, or browser execution" }));
