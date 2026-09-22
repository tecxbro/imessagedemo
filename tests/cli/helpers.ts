import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileDemoDouble, validateDemoDouble } from "../contracts/doubles";
import type { CliDeps } from "@/cli/deps";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function fixturePath(name: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", name);
}

export function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write(chunk: string) { stdout += chunk; } },
      stderr: { write(chunk: string) { stderr += chunk; } },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

export function makeDeps(overrides: Partial<CliDeps> = {}): { deps: CliDeps; io: ReturnType<typeof captureIo> } {
  const io = captureIo();
  return {
    io,
    deps: {
      validateDemo: validateDemoDouble,
      compileDemo: compileDemoDouble,
      repoRoot,
      io: io.io,
      ...overrides,
    },
  };
}

export function parseStdoutJson(text: string): unknown {
  const lines = text.trim().split("\n").filter(Boolean);
  return JSON.parse(lines[lines.length - 1] ?? "null");
}

export function startHtmlServer(html: string): Promise<{ origin: string; close(): Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("html server missing port"));
        return;
      }
      resolve({
        origin: `http://127.0.0.1:${address.port}/`,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
