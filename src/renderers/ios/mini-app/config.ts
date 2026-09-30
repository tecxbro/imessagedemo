import { parseCheckoutOrigins } from "../app-card/config";

export const MINI_APP_ORIGINS_ENV = "VITE_PHOTON_MINIAPP_ORIGINS";
export const localMiniAppPath = (value: string) => /^\/demo-apps\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.html$/.test(value);

/** Resolve without ever opening an unconfigured remote origin or inheriting payment privileges. */
export function resolveMiniApp(url: string, parentOrigin: string, configured = ""):
  { ok: true; src: string } | { ok: false; message: string } {
  if (localMiniAppPath(url)) return { ok: true, src: new URL(url, parentOrigin).href };
  try {
    const target = new URL(url);
    if (!["https:", "http:"].includes(target.protocol) || target.username || target.password) throw new Error();
    if (!parseCheckoutOrigins(configured).origins.includes(target.origin)) {
      return { ok: false, message: `Allow ${target.origin} in ${MINI_APP_ORIGINS_ENV} to open this app.` };
    }
    return { ok: true, src: target.href };
  } catch {
    return { ok: false, message: "This mini app URL cannot be opened." };
  }
}
