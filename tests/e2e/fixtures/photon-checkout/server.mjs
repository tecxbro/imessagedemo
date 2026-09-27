// Test double for the Photon checkout mini app, served on its own origin so the renderer's
// cross-origin bridge checks run for real. Never part of the application.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? process.argv[2] ?? 4174);
const host = "127.0.0.1";
const routes = new Set(["/hotel", "/pass", "/flight", "/eur", "/jpy", "/kwd"]);
const files = new Map([
  ["/checkout.js", "checkout.js"],
  ["/vendor/bridge.js", "vendor/bridge.js"],
  ["/vendor/apple-pay.js", "vendor/apple-pay.js"],
  ["/vendor/motion-data.js", "vendor/motion-data.js"],
]);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const file = routes.has(url.pathname) ? "checkout.html" : files.get(url.pathname);
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
    return;
  }
  try {
    const body = await readFile(path.join(dir, file));
    response.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" }).end(body);
  } catch {
    response.writeHead(500).end();
  }
}).listen(port, host, () => {
  console.log(`photon checkout double on http://${host}:${port}`);
});
