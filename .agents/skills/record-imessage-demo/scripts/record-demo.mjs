#!/usr/bin/env node
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, access, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const help = `Record authored iMessage playback as one complete, silent MP4.
Usage: node record-demo.mjs --url <running-preview> --out <new-file.mp4>
Options:
  --segment-ms <ms>  Adjacent takes for seek-restorable timelines (default: 0, continuous)
  --hold-ms <ms>     Final settled hold (default: 2000)
  --fps <number>     Encoded frame rate (default: 25)
  --headful         Show Chromium while recording
  --help            Show this help
Requires: repository @playwright/test + Chromium, ffmpeg, ffprobe.`;

function options(argv) {
  const opts = { segmentMs: 0, holdMs: 2000, fps: 25, headful: false };
  const flags = { "--url": "url", "--out": "out", "--segment-ms": "segmentMs", "--hold-ms": "holdMs", "--fps": "fps" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help") { console.log(help); process.exit(0); }
    if (flag === "--headful") { opts.headful = true; continue; }
    if (!flags[flag] || !argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`Invalid argument: ${flag}\n${help}`);
    opts[flags[flag]] = argv[++i];
  }
  if (!opts.url || !opts.out) throw new Error(help);
  const url = new URL(opts.url);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Preview URL must be HTTP(S)");
  for (const key of ["segmentMs", "holdMs", "fps"]) opts[key] = Number(opts[key]);
  if (!Number.isInteger(opts.segmentMs) || opts.segmentMs < 0 || (opts.segmentMs > 0 && opts.segmentMs < 1000)) throw new Error("segment-ms must be 0 or an integer >= 1000");
  if (!Number.isInteger(opts.holdMs) || opts.holdMs < 0) throw new Error("hold-ms must be a nonnegative integer");
  if (!Number.isInteger(opts.fps) || opts.fps < 1 || opts.fps > 60) throw new Error("fps must be an integer from 1 to 60");
  opts.out = path.resolve(opts.out);
  if (path.extname(opts.out).toLowerCase() !== ".mp4") throw new Error("Output must end in .mp4");
  return opts;
}

function command(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-16000); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(stdout) : reject(new Error(`${binary} exited ${code}: ${stderr}`)));
  });
}

async function probe(file) {
  return JSON.parse(await command("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
}

async function openReady(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!response?.ok()) throw new Error(`Preview returned HTTP ${response?.status()}`);
  try {
    await page.waitForFunction(() => Boolean(window.IMESSAGE_DEMO), undefined, { timeout: 20000 });
    await page.locator("[data-demo-frame]").waitFor({ state: "visible", timeout: 10000 });
  } catch (error) {
    const text = await page.locator("body").innerText().catch(() => "");
    throw new Error(`${error.message}\nPreview body: ${text.slice(0, 2000)}`);
  }
  await page.evaluate(async () => {
    window.IMESSAGE_DEMO.pause();
    const reset = await window.IMESSAGE_DEMO.reset();
    await window.IMESSAGE_DEMO.ready(reset.revision);
    await document.fonts.ready;
  });
}

function captureStyles(width, height) {
  return `
    html, body, #root { margin:0 !important; width:${width}px !important; height:${height}px !important; overflow:hidden !important; }
    [data-demo-player] { position:fixed !important; inset:0 !important; width:${width}px !important; height:${height}px !important; margin:0 !important; padding:0 !important; }
    [data-demo-player] > *:not([data-demo-frame]) { display:none !important; }
    [data-demo-frame] { position:absolute !important; left:0 !important; top:0 !important; margin:0 !important; }
    [data-demo-frame], [data-demo-frame] * { scrollbar-width:none !important; -ms-overflow-style:none !important; }
    [data-demo-frame]::-webkit-scrollbar, [data-demo-frame] *::-webkit-scrollbar { display:none !important; width:0 !important; height:0 !important; }
  `;
}

async function inspectPreview(chromium, opts) {
  const browser = await chromium.launch({ headless: !opts.headful });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, reducedMotion: "no-preference" });
    await openReady(page, opts.url);
    const info = await page.evaluate(async () => {
      const receipt = await window.IMESSAGE_DEMO.ready();
      const frame = document.querySelector("[data-demo-frame]");
      const box = frame.getBoundingClientRect();
      return { state: window.IMESSAGE_DEMO.state(), contact: window.IMESSAGE_DEMO.frame().contact,
        platform: frame.dataset.platform, theme: frame.dataset.theme,
        width: box.width, height: box.height, receipt };
    });
    if (!Number.isFinite(info.state.durationMs) || info.state.durationMs <= 0) throw new Error("Preview has no playable duration");
    if (!Number.isInteger(info.width) || !Number.isInteger(info.height) || info.width <= 0 || info.height <= 0) throw new Error("Invalid native frame dimensions");
    return info;
  } finally { await browser.close(); }
}

async function take(chromium, opts, info, startMs, endMs, holdMs, rawDir, index) {
  const browser = await chromium.launch({ headless: !opts.headful });
  let context;
  const errors = [];
  try {
    // Browser writes outside the Vite checkout; copy only finalized media into artifacts.
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "imessage-recording-"));
    context = await browser.newContext({ viewport: { width: info.width, height: info.height },
      deviceScaleFactor: 1, colorScheme: info.theme, locale: "en-US", reducedMotion: "no-preference",
      recordVideo: { dir: tempDir, size: { width: info.width, height: info.height } } });
    const recordingStartedAt = Date.now();
    const page = await context.newPage();
    const video = page.video();
    page.on("pageerror", error => errors.push(error.message));
    await openReady(page, opts.url);
    await page.addStyleTag({ content: captureStyles(info.width, info.height) });
    const initial = await page.evaluate(async (at) => {
      const seek = await window.IMESSAGE_DEMO.seek(at);
      const receipt = await window.IMESSAGE_DEMO.ready(seek.revision);
      return { ...window.IMESSAGE_DEMO.state(), receipt };
    }, startMs);
    if (initial.playing || Math.abs(initial.timeMs - startMs) > 1 || initial.durationMs !== info.state.durationMs ||
        initial.receipt.platform !== info.platform || initial.receipt.theme !== info.theme) throw new Error("Preview changed between takes");
    const box = await page.locator("[data-demo-frame]").boundingBox();
    if (!box || box.x !== 0 || box.y !== 0 || box.width !== info.width || box.height !== info.height) throw new Error(`Recording crop mismatch: ${JSON.stringify(box)}`);
    await page.waitForTimeout(120);
    const playOffsetMs = Date.now() - recordingStartedAt;
    await page.evaluate(() => window.IMESSAGE_DEMO.play());
    try {
      await page.waitForFunction(end => window.IMESSAGE_DEMO.state().timeMs >= end,
        endMs, { timeout: endMs - startMs + 20000, polling: 25 });
    } catch (error) {
      const state = await page.evaluate(() => window.IMESSAGE_DEMO?.state()).catch(() => null);
      throw new Error(`${error.message}\nLast player state: ${JSON.stringify(state)}\nRaw recording directory: ${tempDir}`);
    }
    await page.evaluate(() => window.IMESSAGE_DEMO.pause());
    const final = await page.evaluate(() => window.IMESSAGE_DEMO.state());
    await page.waitForTimeout(holdMs);
    if (errors.length) throw new Error(`Page errors: ${errors.join("; ")}`);
    await context.close();
    context = undefined;
    const rawPath = path.join(rawDir, `take-${String(index + 1).padStart(2, "0")}.webm`);
    await copyFile(await video.path(), rawPath);
    const raw = await probe(rawPath);
    const keepSeconds = (endMs - startMs + (endMs === info.state.durationMs ? holdMs : 0)) / 1000;
    if (Number(raw.format.duration) + 0.12 < playOffsetMs / 1000 + keepSeconds) throw new Error("Finalized recording is shorter than the requested interval");
    return { rawPath, startMs, endMs, actualEndMs: final.timeMs, playOffsetMs, keepSeconds, initialReceipt: initial.receipt };
  } finally {
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function encode(takes, opts) {
  const inputs = takes.flatMap(take => ["-i", take.rawPath]);
  const filters = takes.map((take, i) => `[${i}:v]trim=start=${take.playOffsetMs / 1000}:duration=${take.keepSeconds},setpts=PTS-STARTPTS[v${i}]`);
  const labels = takes.map((_, i) => `[v${i}]`).join("");
  filters.push(`${labels}concat=n=${takes.length}:v=1:a=0,fps=${opts.fps},pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p[v]`);
  await command("ffmpeg", ["-v", "error", "-n", ...inputs, "-filter_complex", filters.join(";"),
    "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", opts.out]);
}

async function reviewImages(opts, takes, seconds) {
  const dir = path.dirname(opts.out);
  const stem = path.basename(opts.out, ".mp4");
  const images = [];
  async function extract(label, at) {
    const output = path.join(dir, `${stem}-review-${label}.png`);
    await command("ffmpeg", ["-v", "error", "-n", "-ss", String(Math.max(0, at)), "-i", opts.out, "-frames:v", "1", output]);
    images.push(output);
  }
  await extract("opening", 0);
  await extract("middle", seconds / 2);
  await extract("final", Math.max(0, seconds - 0.2));
  let boundary = 0;
  for (let i = 0; i < takes.length - 1; i++) {
    boundary += takes[i].keepSeconds;
    for (const [label, offset] of [["before", -0.08], ["after", 0.08]]) await extract(`join-${i + 1}-${label}`, boundary + offset);
  }
  return images;
}

async function main() {
  const opts = options(process.argv.slice(2));
  const receiptPath = opts.out.replace(/\.mp4$/i, ".recording.json");
  for (const file of [opts.out, receiptPath]) {
    if (await access(file).then(() => true, () => false)) throw new Error(`Output exists; use a fresh run path: ${file}`);
  }
  await Promise.all([command("ffmpeg", ["-version"]), command("ffprobe", ["-version"])]);
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const { chromium } = createRequire(path.join(root, "package.json"))("@playwright/test");
  const info = await inspectPreview(chromium, opts);
  await mkdir(path.dirname(opts.out), { recursive: true });
  const rawDir = await mkdtemp(path.join(path.dirname(opts.out), "raw-"));
  const takes = [];
  try {
    const interval = opts.segmentMs || info.state.durationMs;
    for (let start = 0; start < info.state.durationMs;) {
      let end = Math.min(start + interval, info.state.durationMs);
      // Avoid a tiny final take that would reopen an already-present checkout sheet.
      const remainder = info.state.durationMs - end;
      if (remainder > 0 && remainder <= Math.min(4000, interval / 4)) end = info.state.durationMs;
      console.error(`Recording ${start}–${end} ms of ${info.state.durationMs} ms`);
      takes.push(await take(chromium, opts, info, start, end, end === info.state.durationMs ? opts.holdMs : 150, rawDir, takes.length));
      start = end;
    }
    await encode(takes, opts);
    const encoded = await probe(opts.out);
    const stream = encoded.streams.find(stream => stream.codec_type === "video");
    const expectedSeconds = (info.state.durationMs + opts.holdMs) / 1000;
    const seconds = Number(encoded.format.duration);
    if (!stream || stream.codec_name !== "h264" || stream.pix_fmt !== "yuv420p" ||
        stream.width !== Math.ceil(info.width / 2) * 2 || stream.height !== Math.ceil(info.height / 2) * 2 ||
        !Number.isFinite(seconds) || Math.abs(seconds - expectedSeconds) > Math.max(0.2, 2 / opts.fps)) throw new Error("Encoded MP4 failed media verification");
    const images = await reviewImages(opts, takes, seconds);
    const receipt = { ok: true, visuallyReviewed: false, output: opts.out, url: opts.url,
      createdAt: new Date().toISOString(), segmented: takes.length > 1, silent: true,
      nativeFrame: { width: info.width, height: info.height, platform: info.platform, theme: info.theme },
      contact: info.contact, timelineMs: info.state.durationMs, holdMs: opts.holdMs,
      seconds, width: stream.width, height: stream.height, fps: stream.avg_frame_rate,
      codec: stream.codec_name, pixelFormat: stream.pix_fmt, bytes: Number(encoded.format.size), takes, reviewImages: images };
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ ok: true, output: opts.out, receipt: receiptPath, segmented: receipt.segmented,
      seconds, width: stream.width, height: stream.height, reviewImages: images, visuallyReviewed: false }));
  } catch (error) {
    await writeFile(path.join(rawDir, "failure.json"), JSON.stringify({ ok: false, error: error.message, url: opts.url, completedTakes: takes }, null, 2));
    throw error;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
