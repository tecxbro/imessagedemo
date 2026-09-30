import { lstatSync, realpathSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CliError, EXIT_ENVIRONMENT } from "@/cli/errors";
import type { AuthoringDocument } from "@/cli/authoring";

const ASSET_PREFIX = "/demo-assets/";

export type AssetOk = {
  src: string;
  file: string;
  type: "png" | "jpeg" | "gif" | "webp";
  width: number;
  height: number;
};

export function preflightAssets(document: AuthoringDocument, repoRoot: string): AssetOk[] {
  const assets: AssetOk[] = [];
  for (const contact of [document.contact, ...(document.conversations ?? []).map(conversation => conversation.contact)]) {
    if (contact.photo) assets.push(inspectAsset(contact.photo, repoRoot));
  }
  for (const message of document.messages) {
    if (message.appCard?.layout?.image) assets.push(inspectAsset(message.appCard.layout.image, repoRoot));
    if (message.appCard?.app === "miniapp" && message.appCard.url.startsWith("/demo-apps/")) {
      const root = realpathSync(path.join(repoRoot, "public"));
      const candidate = path.join(root, message.appCard.url.slice(1));
      if (!existsSync(candidate) || !realpathSync(candidate).startsWith(root + path.sep) || !lstatSync(candidate).isFile()) {
        throw new CliError(`Missing or invalid local mini app: ${message.appCard.url}`, EXIT_ENVIRONMENT);
      }
    }
    if (message.video) {
      inspectVideoAsset(message.video.src, repoRoot);
      if (message.video.poster) assets.push(inspectAsset(message.video.poster, repoRoot));
    }
    for (const voter of message.poll?.voters ?? []) {
      assets.push(inspectAsset(voter.avatar, repoRoot));
    }
    for (const image of message.images ?? []) {
      const asset = inspectAsset(image.src, repoRoot);
      if (image.width !== undefined && image.width !== asset.width) {
        throw new CliError(
          `Asset width mismatch for ${image.src}: file ${asset.width}, declared ${image.width}`,
          EXIT_ENVIRONMENT,
          { src: image.src },
        );
      }
      if (image.height !== undefined && image.height !== asset.height) {
        throw new CliError(
          `Asset height mismatch for ${image.src}: file ${asset.height}, declared ${image.height}`,
          EXIT_ENVIRONMENT,
          { src: image.src },
        );
      }
      assets.push(asset);
    }
  }
  return assets;
}

export function inspectAsset(src: string, repoRoot: string): AssetOk {
  const real = resolveAsset(src, repoRoot);
  const bytes = readFileSync(real);
  const kind = sniffImage(bytes);
  if (!kind) {
    throw new CliError(`Unsupported asset type: ${src}`, EXIT_ENVIRONMENT, { src });
  }
  const size = imageSize(bytes, kind);
  return { src, file: real, type: kind, width: size.width, height: size.height };
}

function resolveAsset(src: string, repoRoot: string): string {
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("file:")) {
    throw new CliError(`External media is not allowed: ${src}`, EXIT_ENVIRONMENT, { src });
  }
  if (!src.startsWith(ASSET_PREFIX) && !src.startsWith("demo-assets/")) {
    throw new CliError(`Asset paths must be under ${ASSET_PREFIX}: ${src}`, EXIT_ENVIRONMENT, { src });
  }
  const relative = src.replace(/^\/?demo-assets\//, "");
  if (relative.includes("\0") || path.isAbsolute(relative)) {
    throw new CliError(`Illegal asset path: ${src}`, EXIT_ENVIRONMENT, { src });
  }

  const root = path.join(repoRoot, "public", "demo-assets");
  if (!existsSync(root)) {
    throw new CliError("public/demo-assets is missing", EXIT_ENVIRONMENT);
  }
  const rootReal = realpathSync(root);
  const candidate = path.resolve(root, relative);
  if (candidate !== rootReal && !candidate.startsWith(rootReal + path.sep)) {
    throw new CliError(`Asset path escapes public/demo-assets: ${src}`, EXIT_ENVIRONMENT, { src });
  }
  if (!existsSync(candidate)) {
    throw new CliError(`Missing asset: ${src}`, EXIT_ENVIRONMENT, { src });
  }
  const stat = lstatSync(candidate);
  const real = realpathSync(candidate);
  if (stat.isSymbolicLink() && real !== rootReal && !real.startsWith(rootReal + path.sep)) {
    throw new CliError(`Asset symlink escapes public/demo-assets: ${src}`, EXIT_ENVIRONMENT, { src });
  }
  if (real !== rootReal && !real.startsWith(rootReal + path.sep)) {
    throw new CliError(`Asset path escapes public/demo-assets: ${src}`, EXIT_ENVIRONMENT, { src });
  }

  if (!lstatSync(real).isFile()) throw new CliError(`Asset is not a file: ${src}`, EXIT_ENVIRONMENT, { src });
  return real;
}

export function inspectVideoAsset(src: string, repoRoot: string): { src: string; file: string; type: "mp4" | "webm" } {
  if (!/^\/demo-assets\/(?:[a-z0-9_-]+\/)*[a-z0-9._-]+\.(mp4|webm)$/i.test(src) || src.includes("..")) {
    throw new CliError(`Video must be a local MP4 or WebM: ${src}`, EXIT_ENVIRONMENT, { src });
  }
  const file = resolveAsset(src, repoRoot);
  const bytes = readFileSync(file);
  const type = src.toLowerCase().endsWith(".mp4") ? "mp4" : "webm";
  const recognized = type === "mp4"
    ? bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp"
    : bytes.length >= 4 && bytes.readUInt32BE(0) === 0x1a45dfa3;
  if (!recognized) throw new CliError(`Invalid ${type} video header: ${src}`, EXIT_ENVIRONMENT, { src });
  return { src, file, type };
}

export function sniffImage(bytes: Buffer): "png" | "jpeg" | "gif" | "webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF87a") return "gif";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function imageSize(bytes: Buffer, type: AssetOk["type"]): { width: number; height: number } {
  if (type === "png") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (type === "gif") {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (type === "jpeg") return jpegSize(bytes);
  if (type === "webp") return webpSize(bytes);
  throw new CliError("Unknown image type", EXIT_ENVIRONMENT);
}

function jpegSize(bytes: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new CliError("Could not read JPEG dimensions", EXIT_ENVIRONMENT);
}

function webpSize(bytes: Buffer): { width: number; height: number } {
  const chunk = bytes.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X") {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new CliError("Could not read WebP dimensions", EXIT_ENVIRONMENT);
}
