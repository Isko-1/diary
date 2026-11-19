import { converter, formatHex } from "culori";
import type { PhotoStats } from "./types";

const toOklch = converter("oklch");
const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function fileToDataUrl(file: File, max = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function analyzeOne(src: string): Promise<PhotoStats> {
  const img = await load(src);
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;

  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let sumL = 0, sumL2 = 0, warm = 0, warmW = 0, N = 0;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const o = toOklch({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
    const l = o.l, ch = o.c ?? 0, h = o.h ?? 0;
    sumL += l; sumL2 += l * l; N++;
    warmW += ch;
    if (h >= 20 && h <= 100) warm += ch;
    const w = 0.3 + ch * 4;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n += w; e.r += r * w; e.g += g * w; e.b += b * w;
    buckets.set(key, e);
  }

  const mean = sumL / N;
  const std = Math.sqrt(Math.max(0, sumL2 / N - mean * mean));

  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const palette: string[] = [];
  const chosen: [number, number, number][] = [];
  for (const e of sorted) {
    const col: [number, number, number] = [e.r / e.n, e.g / e.n, e.b / e.n];
    if (chosen.some((p) => Math.hypot(p[0] - col[0], p[1] - col[1], p[2] - col[2]) < 48)) continue;
    chosen.push(col);
    palette.push(formatHex({ mode: "rgb", r: col[0] / 255, g: col[1] / 255, b: col[2] / 255 }));
    if (palette.length === 5) break;
  }

  return {
    palette,
    brightness: clamp(mean),
    contrast: clamp(std * 3),
    warmth: warmW > 0 ? clamp(warm / warmW) : 0.5,
  };
}

export async function analyzeAll(srcs: string[]): Promise<PhotoStats> {
  const all = await Promise.all(srcs.map(analyzeOne));
  const avg = (f: (s: PhotoStats) => number) => all.reduce((x, s) => x + f(s), 0) / all.length;
  const palette: string[] = [];
  for (let k = 0; k < 3 && palette.length < 5; k++)
    for (const s of all) if (s.palette[k] && !palette.includes(s.palette[k]) && palette.length < 5) palette.push(s.palette[k]);
  return {
    palette,
    brightness: avg((s) => s.brightness),
    contrast: avg((s) => s.contrast),
    warmth: avg((s) => s.warmth),
  };
}
