"use client";
import { useEffect, useRef } from "react";
import type { DayPassport, Technique } from "@/lib/types";
import { dominant, techniqueName, theme } from "@/lib/style";

export const W = 1080, H = 1350;
/** Постоянные элементы: рамка фото, один и тот же в каждом дне. */
const F = { x: 90, y: 190, w: 900, h: 800 };
const SW = 96, SH = 85;
const LOOP = 24;

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function drawCover(c: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

type Slot = { img: HTMLImageElement; sample: Uint8ClampedArray; painted: HTMLCanvasElement; drawn: number; r: () => number };

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

export default function Scene({ day }: { day: DayPassport }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0, dead = false;
    const th = theme(day);
    const { palette: pal, grain, softness, tempo, density } = day.style.params;
    const palRgb = pal.map(rgbOf);
    const W8 = day.style.weights;
    const top = dominant(W8);

    (async () => {
      try {
        await Promise.all(['500 56px Fraunces', '60px Caveat', '500 28px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
      } catch {}
      const imgs = await Promise.all(day.photos.map(loadImg));
      if (dead) return;

      const slots: Slot[] = imgs.map((img, i) => {
        const sc = document.createElement("canvas");
        sc.width = SW; sc.height = SH;
        const sx = sc.getContext("2d", { willReadFrequently: true })!;
        drawCover(sx, img, 0, 0, SW, SH);
        const painted = document.createElement("canvas");
        painted.width = F.w; painted.height = F.h;
        return { img, sample: sx.getImageData(0, 0, SW, SH).data, painted, drawn: 0, r: rng(day.id + "m" + i) };
      });

      // единое зерно
      const noise = document.createElement("canvas");
      noise.width = noise.height = 256;
      const nx = noise.getContext("2d")!;
      const nd = nx.createImageData(256, 256);
      for (let i = 0; i < nd.data.length; i += 4) {
        const v = Math.random() * 255;
        nd.data[i] = nd.data[i + 1] = nd.data[i + 2] = v;
        nd.data[i + 3] = 255;
      }
      nx.putImageData(nd, 0, 0);
      const noisePat = ctx.createPattern(noise, "repeat")!;

      const TOTAL = Math.round(1800 + 1600 * density);

      // погода на кадре: дождь, снег, дымка. Движение идёт по часам, а не по циклу сцены, чтобы не дёргаться на стыке
      let clock = 0;
      const wr = rng(day.id + "w");
      const drops = Array.from({ length: 80 }, () => ({ x: wr(), y: wr(), v: 0.6 + wr() * 0.8, z: wr() }));
      function fx(a: number) {
        const k = day.weather?.kind;
        if (!k || k === "clear" || k === "cloud") return;
        ctx.save();
        ctx.globalAlpha = a;
        if (k === "fog") {
          const g = ctx.createLinearGradient(0, F.y, 0, F.y + F.h);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(1, "rgba(255,255,255,.38)");
          ctx.fillStyle = g;
          ctx.fillRect(F.x, F.y, F.w, F.h);
        } else if (k === "snow") {
          ctx.fillStyle = "rgba(255,255,255,.85)";
          drops.forEach((d) => {
            ctx.beginPath();
            ctx.arc(F.x + (d.x + Math.sin(clock * 0.6 + d.z * 6) * 0.02) * F.w, F.y + ((d.y + clock * 0.05 * d.v) % 1) * F.h, 2 + d.z * 4, 0, 7);
            ctx.fill();
          });
        } else {
          ctx.strokeStyle = "rgba(255,255,255,.45)";
          ctx.lineWidth = 1.5;
          drops.forEach((d) => {
            const y = ((d.y + clock * 0.9 * d.v) % 1) * F.h, x = d.x * F.w - y * 0.15;
            ctx.beginPath(); ctx.moveTo(F.x + x, F.y + y); ctx.lineTo(F.x + x - 6, F.y + y + 26); ctx.stroke();
          });
        }
        ctx.restore();
      }

      function paint(s: Slot, count: number) {
        const c = s.painted.getContext("2d")!;
        const len = 46 - 30 * tempo, wd = 12 + 10 * softness;
        c.lineCap = "round";
        for (let i = 0; i < count; i++) {
          const gx = (s.r() * SW) | 0, gy = (s.r() * SH) | 0, k = (gy * SW + gx) * 4;
          const p = palRgb[(s.r() * palRgb.length) | 0] ?? [200, 180, 120];
          const m = 0.25;
          const r = s.sample[k] * (1 - m) + p[0] * m, g = s.sample[k + 1] * (1 - m) + p[1] * m, b = s.sample[k + 2] * (1 - m) + p[2] * m;
          c.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},.88)`;
          c.lineWidth = wd * (0.6 + s.r() * 0.8);
          const a = -0.35 + s.r() * 0.5, x = gx * (F.w / SW), y = gy * (F.h / SH);
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
        }
      }

      function monet(s: Slot, a: number, local: number) {
        if (local < 0.02) { s.drawn = 0; s.painted.getContext("2d")!.clearRect(0, 0, F.w, F.h); }
        const want = Math.min(TOTAL, Math.floor(local * 1.8 * TOTAL));
        if (s.drawn < want) { const n = Math.min(70, want - s.drawn); paint(s, n); s.drawn += n; }
        ctx.save();
        ctx.globalAlpha = a * 0.92;
        ctx.drawImage(s.painted, F.x, F.y);
        ctx.restore();
        // мягкий свет
        const g = ctx.createRadialGradient(F.x + F.w * 0.7, F.y + F.h * 0.25, 20, F.x + F.w * 0.7, F.y + F.h * 0.25, F.w * 0.7);
        g.addColorStop(0, pal[1] ?? "#fff");
        g.addColorStop(1, "transparent");
        ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = a * 0.55 * (0.4 + softness); ctx.fillStyle = g; ctx.fillRect(F.x, F.y, F.w, F.h); ctx.restore();
      }

      function kandinsky(a: number, t: number) {
        const r = rng(day.id + "k");
        ctx.save();
        ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = a * 0.3; ctx.fillStyle = pal[0]; ctx.fillRect(F.x, F.y, F.w, F.h);
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = a * 0.25; ctx.strokeStyle = th.fg; ctx.lineWidth = 1;
        for (let x = F.x; x <= F.x + F.w; x += 90) { ctx.beginPath(); ctx.moveTo(x, F.y); ctx.lineTo(x, F.y + F.h); ctx.stroke(); }
        for (let y = F.y; y <= F.y + F.h; y += 90) { ctx.beginPath(); ctx.moveTo(F.x, y); ctx.lineTo(F.x + F.w, y); ctx.stroke(); }
        const n = 8 + Math.round(density * 22);
        for (let i = 0; i < n; i++) {
          const kind = r(), x = F.x + r() * F.w, y = F.y + r() * F.h, size = 30 + r() * 150;
          const col = pal[(r() * pal.length) | 0], rot = (r() - 0.5) * Math.PI + t * tempo * 0.4 * (i % 2 ? 1 : -1);
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.globalAlpha = a * 0.85;
          if (kind < 0.35) { ctx.lineWidth = 2 + r() * 5; ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.stroke(); }
          else if (kind < 0.65) { ctx.lineWidth = 2 + r() * 5; ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke(); }
          else if (kind < 0.85) { ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.moveTo(0, -size / 2); ctx.lineTo(size / 2, size / 2); ctx.lineTo(-size / 2, size / 2); ctx.closePath(); ctx.fill(); }
          else { ctx.beginPath(); ctx.arc(0, 0, size / 5, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        ctx.restore();
      }

      function blob(x: number, y: number, rad: number, seed: string, t: number) {
        const r = rng(seed), P = 9, pts: [number, number][] = [];
        for (let i = 0; i < P; i++) {
          const ang = (i / P) * Math.PI * 2, rr = rad * (0.65 + r() * 0.5) * (1 + 0.05 * Math.sin(t * (0.5 + tempo) + i));
          pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr]);
        }
        const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const s0 = mid(pts[P - 1], pts[0]);
        ctx.beginPath(); ctx.moveTo(s0[0], s0[1]);
        for (let i = 0; i < P; i++) { const m = mid(pts[i], pts[(i + 1) % P]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
        ctx.closePath();
      }

      function matisse(a: number, t: number) {
        const r = rng(day.id + "x");
        const n = 6 + Math.round(density * 10);
        ctx.save(); ctx.globalAlpha = a * 0.85;
        for (let i = 0; i < n; i++) {
          const edge = r() < 0.5;
          const x = F.x + (edge ? (r() < 0.5 ? r() * 0.2 : 0.8 + r() * 0.2) : r()) * F.w, y = F.y + r() * F.h;
          ctx.fillStyle = pal[(r() * pal.length) | 0];
          blob(x, y + Math.sin(t * (0.6 + tempo) + i) * 10, 40 + r() * 110, day.id + "b" + i, t);
          ctx.fill();
        }
        ctx.restore();
      }

      function minimal(a: number) {
        ctx.save(); ctx.globalAlpha = a * 0.5; ctx.fillStyle = pal[0]; ctx.fillRect(F.x, F.y, F.w, F.h);
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = th.fg; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(F.x, F.y + F.h * 0.66); ctx.lineTo(F.x + F.w, F.y + F.h * 0.66); ctx.stroke();
        ctx.fillStyle = pal[1] ?? th.fg; ctx.beginPath(); ctx.arc(F.x + F.w * 0.72, F.y + F.h * 0.3, 46, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      const layers: Record<Technique, (a: number, t: number, s: Slot, local: number) => void> = {
        monet: (a, _t, s, l) => monet(s, a, l),
        kandinsky: (a, t) => kandinsky(a, t),
        matisse: (a, t) => matisse(a, t),
        minimal: (a) => minimal(a),
      };

      function scene(i: number, alpha: number, t: number, local: number) {
        const s = slots[i];
        ctx.save();
        ctx.beginPath(); ctx.rect(F.x, F.y, F.w, F.h); ctx.clip();
        ctx.globalAlpha = alpha;
        try { ctx.filter = `blur(${softness * 5}px) saturate(${0.75 + 0.5 * day.mood.valence})`; } catch {}
        drawCover(ctx, s.img, F.x, F.y, F.w, F.h);
        ctx.filter = "none";
        (Object.keys(W8) as Technique[]).forEach((k) => {
          if (W8[k] < 0.12) return;
          layers[k](Math.min(1, W8[k] * 1.8) * alpha, t, s, local);
        });
        fx(alpha);
        ctx.restore();
      }

      function wrap(text: string, maxW: number) {
        const words = text.split(" "), lines: string[] = [];
        let cur = "";
        for (const w of words) {
          const nx = cur ? cur + " " + w : w;
          if (ctx.measureText(nx).width > maxW && cur) { lines.push(cur); cur = w; } else cur = nx;
        }
        if (cur) lines.push(cur);
        return lines;
      }

      const [yy, mm, dd] = day.date.split("-");
      let frame = 0, offX = 0, offY = 0;
      const start = performance.now();

      const loop = (now: number) => {
        if (dead) return;
        const t = ((now - start) / 1000) % LOOP;
        clock = now / 1000;
        ctx.globalAlpha = 1; ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);

        const n = slots.length, seg = LOOP / n, idx = Math.floor(t / seg) % n, local = (t % seg) / seg;
        const nxt = (idx + 1) % n, fade = local > 0.9 && n > 1 ? (local - 0.9) / 0.1 : 0;
        scene(idx, 1, t, local);
        if (fade > 0) scene(nxt, fade, t, 0);

        // --- постоянные элементы ---
        ctx.globalAlpha = 0.55; ctx.strokeStyle = th.fg; ctx.lineWidth = 1.5; ctx.strokeRect(F.x, F.y, F.w, F.h);
        ctx.globalAlpha = 1; ctx.fillStyle = th.fg; ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left"; ctx.font = '500 28px "JetBrains Mono", monospace';
        ctx.fillText(`${dd}.${mm}.${yy}`, F.x, 120);
        ctx.textAlign = "right"; ctx.globalAlpha = 0.6; ctx.font = '500 22px "JetBrains Mono", monospace';
        ctx.fillText(`// ${techniqueName(top).toUpperCase()}`, F.x + F.w, 120);
        ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.font = '500 56px Fraunces, serif';
        wrap(day.title, F.w).slice(0, 2).forEach((l, i) => ctx.fillText(l, F.x, F.y + F.h + 90 + i * 62));
        let fs = 60; const sig = `♪ ${day.song.title} — ${day.song.artist}`;
        ctx.font = `${fs}px Caveat, cursive`;
        while (ctx.measureText(sig).width > F.w && fs > 28) { fs -= 2; ctx.font = `${fs}px Caveat, cursive`; }
        ctx.globalAlpha = 0.85; ctx.fillText(sig, F.x, 1270);

        // единое зерно поверх всего
        if (frame++ % 3 === 0) { offX = Math.random() * 256; offY = Math.random() * 256; }
        ctx.save(); ctx.globalAlpha = grain; ctx.globalCompositeOperation = th.dark ? "screen" : "multiply";
        ctx.translate(-offX, -offY); ctx.fillStyle = noisePat; ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();

        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => { dead = true; cancelAnimationFrame(raf); };
  }, [day]);

  return <canvas ref={ref} width={W} height={H} className="h-auto w-full rounded-sm shadow-2xl" style={{ aspectRatio: "4 / 5" }} />;
}
