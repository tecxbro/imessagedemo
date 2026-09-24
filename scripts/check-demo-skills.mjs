import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Documentation regression checks only. No dependencies, network, or provider calls.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");
const highPath = ".agents/skills/photon-demo-creator/SKILL.md";
const lowPath = ".agents/skills/make-imessage-demo/SKILL.md";
const htmlPath = ".agents/skills/photon-demo-creator/references/html-renderer.md";
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };

function filesUnder(dir) {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(name) : [name];
  });
}

const skills = ["photon-demo-creator", "make-imessage-demo"];
const docs = ["AGENTS.md", "README.md", "docs/agent-workflow.md", ...skills.flatMap((skill) =>
  filesUnder(`.agents/skills/${skill}`).filter((name) => name.endsWith(".md")))];

for (const skill of skills) {
  const text = read(`.agents/skills/${skill}/SKILL.md`);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
  check(Boolean(frontmatter), `${skill}: missing frontmatter`);
  check(new RegExp(`^name: ${skill}$`, "m").test(frontmatter[1]), `${skill}: name mismatch`);
  check(/^description: .+$/m.test(frontmatter[1]), `${skill}: missing description`);
  const metadata = read(`.agents/skills/${skill}/agents/openai.yaml`);
  check(metadata.startsWith("interface:\n"), `${skill}: missing interface metadata`);
  for (const field of ["display_name", "short_description", "default_prompt"]) {
    check(new RegExp(`^  ${field}: ".+"$`, "m").test(metadata), `${skill}: missing ${field}`);
  }
  check(metadata.includes(`$${skill}`), `${skill}: default prompt invokes wrong skill`);
}

let links = 0;
for (const doc of docs) {
  const text = read(doc);
  for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
    const relative = decodeURIComponent(target.split("#")[0]);
    const resolved = path.resolve(root, path.dirname(doc), relative);
    check(resolved.startsWith(root + path.sep), `${doc}: link escapes repository: ${target}`);
    check(existsSync(resolved), `${doc}: broken local link: ${target}`);
    links += 1;
  }
}

const high = read(highPath);
const low = read(lowPath);
const html = read(htmlPath);
check(high.includes("../make-imessage-demo/SKILL.md"), "high-level skill must delegate to repository executor");
check(low.includes("../photon-demo-creator/SKILL.md"), "executor must route company-only briefs");
check(high.includes("never bounce between the skills"), "high-level skill needs a no-recursion handoff");
check(low.includes("without restarting research or routing back"), "executor needs a no-recursion handoff");
check(html.includes("../../make-imessage-demo/SKILL.md"), "HTML adapter must link to the executor");
check(!/npm run demo --/.test(high + html), "command cookbook must not be duplicated in high-level workflow");
check(/three distinct conversations/.test(html), "company-only default must be defined in HTML workflow");
check(low.includes("authoring.ts") && low.includes("contracts/index.ts"), "executor must point at actual schema sources");
check(low.includes("../../../examples/agent-walkover.flow.json"), "executor must use checked-in example");
check(!/```json\s*\{/.test(low), "do not reintroduce a copied example with a drifting clock");
check(!/## After assembly|Production entry points throw/.test(low + read("AGENTS.md")), "stale foundation instructions returned");
check(/separate existing Spectrum checkout/.test(high), "Spectrum must stay outside the render-only repository");

// Compare documented commands/flags to the actual CLI parser, not a second fixed list.
const args = read("src/cli/args.ts");
const set = args.match(/const COMMANDS = new Set<CliCommand>\(\[([^\]]+)\]\)/);
check(Boolean(set), "CLI command declaration changed; update the documentation check");
const commands = new Set([...set[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]));
const flags = new Set([
  ...[...args.matchAll(/flags\.([A-Za-z][\w]*)/g)].map((m) => m[1]),
  ...[...args.matchAll(/flags\["([\w-]+)"\]/g)].map((m) => m[1]),
]);
let commandCount = 0;
for (const doc of docs) {
  for (const match of read(doc).matchAll(/npm run demo -- ([a-z-]+)([^\n`]*)/g)) {
    check(commands.has(match[1]), `${doc}: nonexistent CLI command ${match[1]}`);
    for (const flag of match[2].matchAll(/--([a-z][a-z-]*)/g)) {
      check(flags.has(flag[1]), `${doc}: nonexistent CLI flag --${flag[1]}`);
    }
    commandCount += 1;
  }
}
check(commandCount > 0, "no CLI commands checked");

const example = JSON.parse(read("examples/agent-walkover.flow.json"));
const baseline = example.messages[0].atMs;
const reply = example.messages.find((m) => m.id === "out-1");
const checkpoint = example.checkpoints.find((c) => c.id === "after-reply");
check(Boolean(reply && checkpoint), "example must define out-1 and after-reply");
check(checkpoint.atMs === reply.atMs - baseline, "after-reply checkpoint no longer matches the reply clock");
check(example.targets.includes("ios"), "example commands require an iOS target");
const ids = new Set();
for (const message of example.messages) {
  check(!ids.has(message.id), `duplicate example message ID ${message.id}`);
  ids.add(message.id);
  check(["incoming", "outgoing"].includes(message.direction), "invalid example direction");
  check(Number.isInteger(message.atMs) && message.atMs >= baseline, "invalid example time");
}

for (const name of ["adding-categories", "company-analysis", "conversation-design", "health", "server-lifecycle", "sites-apple-pay", "travel", "video"]) {
  check(read(`.agents/skills/photon-demo-creator/references/${name}.md`).trim().length > 0, `missing original reference ${name}`);
}
console.log(JSON.stringify({ ok: true, checks, documents: docs.length, links, cliCommands: commandCount, scope: "skill/docs alignment only; renderer and browser tests are separate" }));
