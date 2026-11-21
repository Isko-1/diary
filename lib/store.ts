import { del, entries, get, set } from "idb-keyval";
import type { DayPassport } from "./types";

export async function listDays(): Promise<DayPassport[]> {
  const e = await entries<string, any>();
  const deletedSet = new Set(
    e.filter(([k, v]) => typeof k === "string" && k.startsWith("deleted:") && v === true)
     .map(([k]) => k.replace(/^deleted:/, ""))
  );
  const own = e
    .filter(([k]) => typeof k === "string" && k.startsWith("day:"))
    .map(([, v]) => v as DayPassport)
    .filter((d) => d && !deletedSet.has(d.id));
  let seed: DayPassport[] = [];
  try {
    const r = await fetch("/seed/days.json");
    if (r.ok) seed = await r.json();
  } catch {}
  const ids = new Set(own.map((d) => d.id));
  return [...own, ...seed.filter((s) => s && !ids.has(s.id) && !deletedSet.has(s.id))].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDay(id: string): Promise<DayPassport | undefined> {
  const isDeleted = await get<boolean>(`deleted:${id}`);
  if (isDeleted) return undefined;
  return (await get<DayPassport>(`day:${id}`)) ?? (await listDays()).find((d) => d.id === id);
}

export const saveDay = async (d: DayPassport) => {
  await del(`deleted:${d.id}`);
  return set(`day:${d.id}`, d);
};

export async function deleteDay(id: string): Promise<void> {
  await del(`day:${id}`);
  await set(`deleted:${id}`, true);
}
