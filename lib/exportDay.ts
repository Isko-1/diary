import type { DayPassport } from "./types";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Имя безопасно для папки и файла в Windows/macOS/Linux. */
const safeName = (s: string) =>
  s
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 60) || "День";

function canvasToPng(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!canvas) return resolve(null);
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null); // tainted canvas
    }
  });
}

/**
 * Собирает папку дня в ZIP и скачивает её:
 * <название дня>/text.txt, photos/*, song.json, poster.png.
 * Возвращает false, если poster.png снять не удалось (остальное в архиве есть).
 */
export async function downloadDayFolder(day: DayPassport, canvas: HTMLCanvasElement | null): Promise<boolean> {
  const { default: JSZip } = await import("jszip");
  const name = safeName(day.title);
  const zip = new JSZip();
  const dir = zip.folder(name)!;

  dir.file("text.txt", `${day.title}\n${day.date}${day.geo?.place ? `\n${day.geo.place}` : ""}\n\n${day.text}\n`);

  const photos = dir.folder("photos")!;
  await Promise.all(
    day.photos.map(async (src, i) => {
      try {
        const blob = await (await fetch(src)).blob();
        photos.file(`photo-${String(i + 1).padStart(2, "0")}.${EXT[blob.type] ?? "jpg"}`, blob);
      } catch {}
    }),
  );

  const playlist = day.playlist && day.playlist.length > 0 ? day.playlist : [day.song];
  dir.file("song.json", JSON.stringify({ main: day.song, playlist }, null, 2));

  const poster = await canvasToPng(canvas);
  if (poster) dir.file("poster.png", poster);

  const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return !!poster;
}
