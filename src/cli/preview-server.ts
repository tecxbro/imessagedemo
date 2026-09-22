import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { CliError, EXIT_ENVIRONMENT } from "@/cli/errors";
import type { DemoRunManifest } from "@/player/types";

export type PreviewHandle = {
  url: string;
  host: string;
  port: number;
  close(): Promise<void>;
};

export function demoManifestPlugin(manifestPath: string): Plugin {
  return {
    name: "imessage-demo-manifest",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/__demo/manifest.json") {
          next();
          return;
        }
        const body = readFileSync(manifestPath);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
      });
    },
  };
}

export async function startPreviewServer(options: {
  repoRoot: string;
  host?: string;
  port?: number;
  manifestPath: string;
}): Promise<PreviewHandle> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  let server: ViteDevServer | undefined;
  try {
    server = await createServer({
      configFile: false,
      root: path.join(options.repoRoot, "src/player/host"),
      publicDir: path.join(options.repoRoot, "public"),
      appType: "spa",
      plugins: [react(), tailwindcss(), demoManifestPlugin(options.manifestPath)],
      resolve: {
        alias: {
          "@": path.join(options.repoRoot, "src"),
        },
      },
      server: {
        host,
        port,
        strictPort: port !== 0,
        hmr: false,
      },
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new CliError("Preview server bound without an address", EXIT_ENVIRONMENT);
    }
    const boundPort = address.port;
    const url = `http://${host}:${boundPort}/`;
    const ready = await fetch(`${url}__demo/manifest.json`);
    if (!ready.ok) {
      throw new CliError("Preview server started but the run manifest is not ready", EXIT_ENVIRONMENT);
    }
    JSON.parse(await ready.text()) as DemoRunManifest;
    return {
      url,
      host,
      port: boundPort,
      close: async () => {
        await server?.close();
      },
    };
  } catch (error) {
    await server?.close().catch(() => undefined);
    if (isAddressInUse(error)) {
      throw new CliError(`Port ${port} is occupied`, EXIT_ENVIRONMENT);
    }
    throw error;
  }
}

function isAddressInUse(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "EADDRINUSE") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /already in use|EADDRINUSE/i.test(message);
}
