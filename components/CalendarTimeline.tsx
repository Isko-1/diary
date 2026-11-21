"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MOODS, MOOD_ORDER, moodColor } from "@/lib/mood";
import type { DayPassport } from "@/lib/types";

const MON = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export default function CalendarTimeline({
  days,
  selectedDayId,
  onSelectDay,
}: {
  days: DayPassport[];
  selectedDayId?: string;
  onSelectDay?: (dayId: string | null) => void;
}) {
  // Дата берётся только на клиенте: страница `/` пререндерится при сборке,
  // и `new Date()` в рендере давал расхождение сервер/клиент (React #418).
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const now = new Date();
    setCurrentDate(now);
    setToday(now);
  }, []);

  if (!currentDate || !today) {
    return <div aria-hidden className="h-64 w-full rounded-2xl border border-[var(--border)] bg-white/40" />;
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Количество дней в текущем месяце
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Сегодняшняя дата в формате YYYY-MM-DD
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Быстрый поиск записей по YYYY-MM-DD
  const daysByDate = new Map<string, DayPassport>();
  days.forEach((d) => {
    daysByDate.set(d.date, d);
  });

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  const daysElements = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const entry = daysByDate.get(dateKey);
    const isToday = dateKey === todayKey;
    const isSelected = entry && entry.id === selectedDayId;
    const color = entry ? moodColor(entry.mood) : undefined;

    daysElements.push({
      dayNum: d,
      dateKey,
      entry,
      isToday,
      isSelected,
      color,
    });
  }

  return (
    <div className="w-full rounded-2xl border border-[var(--border)] bg-white/70 p-5 shadow-sm backdrop-blur">
      {/* Заголовок календаря с переключением месяца */}
      <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-stone-200/60">
        <div className="flex items-center gap-3">
          <h3
            className="text-base font-semibold tracking-tight text-stone-900"
            style={{ fontFamily: "'Unbounded', sans-serif" }}
          >
            {MON[month]} {year}
          </h3>
          <span className="font-mono text-xs text-muted">
            • {days.filter((d) => d.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length} воспоминаний в этом месяце
          </span>
        </div>

        <div className="flex items-center gap-1 text-stone-600">
          <button
            type="button"
            onClick={prevMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-stone-200 transition text-lg"
            title="Предыдущий месяц"
            aria-label="Предыдущий месяц"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 text-xs font-mono rounded-md hover:bg-stone-200 transition"
            title="Текущий месяц"
          >
            сегодня
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-stone-200 transition text-lg"
            title="Следующий месяц"
            aria-label="Следующий месяц"
          >
            ›
          </button>
        </div>
      </div>

      {/* Горизонтальная линейка дней месяца */}
      <div
        className="grid gap-1 sm:gap-1.5 h-24 sm:h-28 pt-2 items-end overflow-x-auto pb-1"
        style={{
          gridTemplateColumns: `repeat(${daysInMonth}, minmax(18px, 1fr))`,
        }}
      >
        {daysElements.map(({ dayNum, dateKey, entry, isToday, isSelected, color }) => {
          if (entry) {
            return (
              <Link
                key={dateKey}
                href={`/day/${entry.id}`}
                onClick={(e) => {
                  if (onSelectDay) {
                    e.preventDefault();
                    onSelectDay(entry.id);
                  }
                }}
                className={`group flex flex-col items-center justify-end h-full min-w-0 transition-transform hover:-translate-y-1 ${
                  isSelected ? "scale-105" : ""
                }`}
                title={`${dayNum} ${MON[month].toLowerCase()}: ${entry.title} (${entry.song.title})`}
              >
                {/* Цветной столбик дня с воспоминанием */}
                <div
                  className={`w-full rounded-[4px] transition-all shadow-sm group-hover:brightness-95 group-hover:shadow-md ${
                    isSelected ? "ring-2 ring-stone-900 ring-offset-1" : ""
                  }`}
                  style={{
                    height: "100%",
                    background: color,
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                />
                <span
                  className={`mt-1.5 font-mono text-[10px] sm:text-xs leading-none transition-colors ${
                    isToday
                      ? "text-rose-600 font-bold"
                      : isSelected
                      ? "text-stone-900 font-bold"
                      : "text-stone-700 font-medium group-hover:text-stone-950"
                  }`}
                >
                  {dayNum}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={dateKey}
              href={`/new?date=${dateKey}`}
              className="group flex flex-col items-center justify-end h-full min-w-0"
              title={`${dayNum} ${MON[month].toLowerCase()}: этот день ещё не собран. Нажмите, чтобы добавить.`}
            >
              {/* Пунктирный столбик пустого дня */}
              <div
                className={`w-full rounded-[4px] border border-dashed transition-colors ${
                  isToday
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-stone-300 bg-stone-100/40 hover:bg-stone-200/60 hover:border-stone-400"
                }`}
                style={{ height: "26px" }}
              />
              <span
                className={`mt-1.5 font-mono text-[10px] sm:text-xs leading-none ${
                  isToday ? "text-rose-600 font-bold" : "text-stone-400"
                }`}
              >
                {dayNum}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Легенда настроений внизу календаря */}
      <div className="mt-3 pt-2.5 border-t border-stone-200/50 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] uppercase font-semibold text-stone-500">Настроения:</span>
          {MOOD_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: MOODS[k].color }} />
              <span>{MOODS[k].label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-[3px] border border-dashed border-stone-400 bg-stone-100" />
          <span>Свободный день (+ новый)</span>
        </div>
      </div>
    </div>
  );
}
