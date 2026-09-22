import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readExportLiteral(source, name, known) {
  const marker = `export const ${name}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing export const ${name}`);
  let index = start + marker.length;
  let depth = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "<" || char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ">" || char === ")" || char === "}" || char === "]") depth -= 1;
    else if (char === "=" && depth === 0) {
      index += 1;
      break;
    }
    index += 1;
  }
  const value = parseValue(source, index, known);
  const comment = precedingComment(source, start);
  return { value: value.value, comment };
}

function precedingComment(source, start) {
  const before = source.slice(Math.max(0, start - 1200), start);
  const block = before.match(/\/\*[\s\S]*\*\/\s*$/);
  const lines = before.split("\n").slice(-8).join("\n");
  return `${block?.[0] ?? ""}\n${lines}`;
}

function confidenceFor(comment) {
  if (/UNVERIFIED|rather than a capture|before claiming fidelity|not measured/i.test(comment)) return "unverified";
  if (/measured/i.test(comment)) return "measured";
  return "source-export";
}

function parseValue(source, index, known) {
  skipSpace(source, () => index);
  function skip() {
    while (index < source.length) {
      if (/\s/.test(source[index])) {
        index += 1;
        continue;
      }
      if (source.startsWith("//", index)) {
        index = source.indexOf("\n", index);
        if (index < 0) index = source.length;
        continue;
      }
      if (source.startsWith("/*", index)) {
        const end = source.indexOf("*/", index + 2);
        index = end < 0 ? source.length : end + 2;
        continue;
      }
      break;
    }
  }
  function parse() {
    const value = parseAtom();
    skip();
    if (source.startsWith("as const", index)) index += "as const".length;
    return value;
  }
  function parseAtom() {
    skip();
    const char = source[index];
    if (char === "{") return parseObject();
    if (char === "[") return parseArray();
    if (char === '"' || char === "'") return parseString();
    if (char === "-" || (char >= "0" && char <= "9")) return parseNumber();
    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (word && ["true", "false", "null"].includes(word[0])) {
      index += word[0].length;
      return word[0] === "true" ? true : word[0] === "false" ? false : null;
    }
    if (word && known[word[0]]) {
      index += word[0].length;
      skip();
      if (source[index] === ".") {
        index += 1;
        const property = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (!property || !Object.hasOwn(known[word[0]], property[0])) {
          throw new Error(`Unresolved member ${word[0]}.${property?.[0] ?? ""}`);
        }
        index += property[0].length;
        return known[word[0]][property[0]];
      }
      return known[word[0]];
    }
    throw new Error(`Cannot parse literal at ${index}: ${source.slice(index, index + 40)}`);
  }
  function parseObject() {
    index += 1;
    const object = {};
    skip();
    if (source[index] === "}") {
      index += 1;
      return object;
    }
    while (index < source.length) {
      skip();
      let key;
      if (source[index] === '"' || source[index] === "'") key = parseString();
      else {
        const match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (!match) throw new Error(`Expected key at ${index}`);
        key = match[0];
        index += key.length;
      }
      skip();
      if (source[index] !== ":") throw new Error(`Expected colon after ${key}`);
      index += 1;
      object[key] = parse();
      skip();
      if (source[index] === ",") {
        index += 1;
        skip();
        if (source[index] === "}") {
          index += 1;
          return object;
        }
        continue;
      }
      if (source[index] === "}") {
        index += 1;
        return object;
      }
      throw new Error(`Expected comma or closing brace at ${index}`);
    }
    throw new Error("Unclosed object");
  }
  function parseArray() {
    index += 1;
    const array = [];
    skip();
    if (source[index] === "]") {
      index += 1;
      return array;
    }
    while (index < source.length) {
      array.push(parse());
      skip();
      if (source[index] === ",") {
        index += 1;
        skip();
        if (source[index] === "]") {
          index += 1;
          return array;
        }
        continue;
      }
      if (source[index] === "]") {
        index += 1;
        return array;
      }
      throw new Error(`Expected comma or closing bracket at ${index}`);
    }
    throw new Error("Unclosed array");
  }
  function parseString() {
    const quote = source[index];
    index += 1;
    let value = "";
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        const next = source[index + 1];
        const map = { n: "\n", r: "\r", t: "\t", '"': '"', "'": "'", "\\": "\\" };
        value += map[next] ?? next;
        index += 2;
        continue;
      }
      if (char === quote) {
        index += 1;
        return value;
      }
      value += char;
      index += 1;
    }
    throw new Error("Unclosed string");
  }
  function parseNumber() {
    const match = source.slice(index).match(/^-?\d+(?:\.\d+)?/);
    if (!match) throw new Error(`Expected number at ${index}`);
    index += match[0].length;
    return Number(match[0]);
  }
  skip();
  return { value: parse(), index };
}

function skipSpace() {}

const wanted = [
  ["src/components/imessage/message-motion.tsx", "messageMotion"],
  ["src/components/imessage/ios-messages-app.tsx", "iosScreen"],
  ["src/components/imessage/ios-messages-app.tsx", "iosScreenTransition"],
  ["src/components/imessage/macos-window.tsx", "macWindowMetrics"],
  ["src/components/imessage/macos-messages-app.tsx", "macScreen"],
  ["src/components/imessage/macos-messages-app.tsx", "macTransitions"],
  ["src/components/imessage/message-effects.tsx", "bubbleEffectDuration"],
  ["src/components/imessage/screen-effects.tsx", "screenEffectDuration"],
];

const known = {};
const tokens = [];
for (const [file, symbol] of wanted) {
  const source = await readFile(path.join(root, file), "utf8");
  const extracted = readExportLiteral(source, symbol, known);
  known[symbol] = extracted.value;
  tokens.push({
    symbol,
    file,
    confidence: confidenceFor(extracted.comment),
    value: extracted.value,
  });
}

const destination = path.join(root, "src/contracts/motion-tokens.json");
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify({ extractedBy: "scripts/extract-motion-tokens.mjs", method: "literal-parse", tokens }, null, 2)}\n`);
console.log(`wrote ${tokens.length} tokens`);
