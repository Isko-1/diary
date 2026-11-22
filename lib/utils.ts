import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Названия треков из Deezer/iTunes часто приходят капсом («ХОЧЕШЬ?»). Приводим к обычному регистру:
 * «Хочешь?». Короткие аббревиатуры (≤3 буквы, «SOS») и смешанный регистр не трогаем.
 */
export function tidyTitle(s: string): string {
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4 || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return s;
  const low = s.toLowerCase();
  const i = low.search(/\p{L}/u);
  return low.slice(0, i) + low.charAt(i).toUpperCase() + low.slice(i + 1);
}
