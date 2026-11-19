import { entries, get, set } from "idb-keyval";
import type { DayPassport } from "./types";

export async function listDays(): Promise<DayPassport[]> {
  const e = await entries<string, DayPassport>();
  const own = e.filter(([k]) => typeof k === "string" && k.startsWith("day:")).map(([, v]) => v);
  let seed: DayPassport[] = [];
  try {
    const r = await fetch("/seed/days.json");
    if (r.ok) seed = await r.json();
  } catch {}
  const ids = new Set(own.map((d) => d.id));
  return [...own, ...seed.filter((s) => !ids.has(s.id))].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDay(id: string): Promise<DayPassport | undefined> {
  return (await get<DayPassport>(`day:${id}`)) ?? (await listDays()).find((d) => d.id === id);
}

export const saveDay = (d: DayPassport) => set(`day:${d.id}`, d);
