import { readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("vendor/upstream/registry.json", "utf8"));
const capabilities = JSON.parse(readFileSync("src/contracts/capabilities.json", "utf8"));
const coverage = readFileSync("docs/ios-feature-coverage.md", "utf8");
const errors = [];

for (const item of registry.items ?? []) {
  if (!coverage.includes(`| ${item.name} |`)) errors.push(`coverage matrix omits registry item ${item.name}`);
}

if (capabilities.unsupported?.some((entry) => entry.id === "polls")) {
  errors.push("capabilities.json still marks polls unsupported");
}
if (!capabilities.supported?.some((entry) => entry.id === "poll")) {
  errors.push("capabilities.json does not list poll as supported");
}
if (!coverage.includes("examples/ios-poll.flow.json")) errors.push("coverage matrix does not point at the poll example");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ status: "passed", items: registry.items.length }));
