"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { fetchWeather, geocode, getGeo, reverse, GLYPH } from "@/lib/env";
import { weatherTweak } from "@/lib/style";
import type { DayPassport, SceneItem, Weather } from "@/lib/types";
import { NOTE_COLORS, VINYL_STYLES, defaultItems } from "./Overlay";

type Props = {
  day: DayPassport;
  setDay: Dispatch<SetStateAction<DayPassport | null | undefined>>;
  items: SceneItem[];
  setItems: Dispatch<SetStateAction<SceneItem[]>>;
  sel: string | null;
  setSel: (id: string | null) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
};

const STICKER_PRESETS = [
  "✨", "🎵", "🎧", "💿", "☕", "🍷", "🌙", "☀️", "🌧️", "❄️",
  "🕯️", "📷", "🎞️", "🌸", "🌿", "🍂", "⭐️", "💫", "❤️‍🔥", "🖤",
  "🕊️", "🛹", "🥐", "🍵", "🥨", "🪩", "💌", "🎸", "🪐", "🐈",
];

const BADGE_PRESETS = [
  "MEMORABLE",
  "SOUNDTRACK",
  "GOOD VIBES",
  "FAVORITE",
  "BEST DAY",
  "ARCHIVED",
  "WARMTH",
  "DAY OFF",
  "NIGHT OWL",
  "GENESIS",
];

export default function Editor({
  day,
  setDay,
  items,
  setItems,
  sel,
  setSel,
  onSave,
  onClose,
}: Props) {
  const [savedTick, setSavedTick] = useState(false);
  const [geoModal, setGeoModal] = useState(false);
  const [modalDate, setModalDate] = useState(day.date);
  const [geoCity, setGeoCity] = useState("");
  const [geoCountry, setGeoCountry] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");

  const selectedItem = items.find((i) => i.id === sel);

  // Сохранить с анимацией
  async function handleSave() {
    await onSave();
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2000);
  }

  // Сброс оформления к оригиналу
  function handleReset() {
    if (confirm("Сбросить расположение и элементы к начальным?")) {
      const def = defaultItems(day);
      setItems(def);
      setSel(null);
    }
  }

  // Обновление выбранного элемента
  function updateSel(patch: Partial<SceneItem>) {
    if (!sel) return;
    setItems((prev) => prev.map((i) => (i.id === sel ? { ...i, ...patch } : i)));
  }

  // Удаление выбранного
  function removeSel() {
    if (!sel) return;
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== sel);
      return next.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
    setSel(null);
  }

  // Дублирование выбранного
  function duplicateSel() {
    if (!selectedItem) return;
    const nextId = `${selectedItem.kind}-${Date.now()}`;
    const clone: SceneItem = {
      ...selectedItem,
      id: nextId,
      x: Math.min(90, selectedItem.x + 5),
      y: Math.min(90, selectedItem.y + 5),
    };
    setItems((prev) => {
      const next = [...prev, clone];
      return next.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
    setSel(nextId);
  }

  // Перемещение слоя: выше, ниже, в самый верх (передний план), в самый низ (задний план)
  function moveZ(dir: "up" | "down" | "top" | "bottom") {
    if (!sel) return;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === sel);
      if (idx === -1) return prev;
      const copy = [...prev];
      let target = idx;
      if (dir === "up") target = Math.min(copy.length - 1, idx + 1);
      else if (dir === "down") target = Math.max(0, idx - 1);
      else if (dir === "top") target = copy.length - 1;
      else if (dir === "bottom") target = 0;
      if (target === idx) return prev;

      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);

      // Синхронизируем явный zIndex у всех элементов
      return copy.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
  }

  // Добавление новых элементов
  function addItem(kind: SceneItem["kind"]) {
    const id = `${kind}-${Date.now()}`;
    const pal = day.style.params.palette;

    let newItem: SceneItem;
    switch (kind) {
      case "disc":
        newItem = {
          id,
          kind: "disc",
          x: 50,
          y: 50,
          s: 1.3,
          r: 0,
          size: 40,
          variant: "black",
          text: "photo",
        };
        break;
      case "weather":
        if (!day.weather) {
          setGeoModal(true);
          return;
        }
        newItem = { id, kind: "weather", x: 30, y: 30, s: 1.1, r: -2, variant: "card" };
        break;
      case "map":
        if (!day.geo) {
          setGeoModal(true);
          return;
        }
        newItem = { id, kind: "map", x: 70, y: 30, s: 1.05, r: 3, variant: "tile" };
        break;
      case "note":
        newItem = {
          id,
          kind: "note",
          x: 50,
          y: 75,
          s: 1,
          r: -2,
          variant: "yellow",
          font: "hand",
          text: "Маленькая деталь, которую хочется помнить.",
        };
        break;
      case "sticker":
        newItem = { id, kind: "sticker", x: 50, y: 30, s: 1.2, r: 12, text: "✨" };
        break;
      case "tape":
        newItem = {
          id,
          kind: "tape",
          x: 50,
          y: 20,
          s: 1,
          r: -6,
          color: pal[0] ?? "#f59e0b",
        };
        break;
      case "stamp":
        newItem = { id, kind: "stamp", x: 80, y: 80, s: 1, r: -8, variant: "round", text: "ОДОБРЕНО" };
        break;
      case "place":
        newItem = {
          id,
          kind: "place",
          x: 50,
          y: 40,
          s: 1,
          r: 0,
          text: day.geo?.place || "Любимое место",
        };
        break;
      case "wave":
        newItem = { id, kind: "wave", x: 50, y: 85, s: 1, r: 0 };
        break;
      case "cassette":
        newItem = { id, kind: "cassette", x: 45, y: 45, s: 1.1, r: -4, variant: "dark" };
        break;
      case "playlist":
        newItem = { id, kind: "playlist", x: 75, y: 35, s: 1, r: 2 };
        break;
      default:
        return;
    }

    setItems((prev) => {
      const next = [...prev, newItem];
      return next.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
    setSel(id);
  }

  // Определение геолокации и погоды строго за выбранную дату
  async function detectLocation() {
    setGeoLoading(true);
    setGeoMsg(`Запрашиваем геолокацию и погоду за дату ${modalDate}…`);
    try {
      const g = await getGeo();
      setGeoMsg(`Координаты получены. Запрашиваем погоду за ${modalDate}…`);
      const [place, w] = await Promise.all([reverse(g), fetchWeather(g, modalDate)]);
      const resolvedGeo = { ...g, place: place || g.place };

      applyGeoAndWeather(resolvedGeo, w, modalDate);
      setGeoMsg(
        w
          ? `Успешно: ${resolvedGeo.place || `${g.lat}, ${g.lon}`} · погода за ${modalDate}: ${w.temp > 0 ? "+" : ""}${w.temp}°C, ${w.label}`
          : `Локация определена: ${resolvedGeo.place || `${g.lat}, ${g.lon}`}`
      );
    } catch (err: any) {
      setGeoMsg(`Ошибка: ${err?.message || String(err)}`);
    } finally {
      setGeoLoading(false);
    }
  }

  // Ручной поиск города и страны строго за выбранную дату
  async function searchCity() {
    if (!geoCity.trim()) return;
    setGeoLoading(true);
    const queryLabel = geoCountry.trim() ? `${geoCity.trim()}, ${geoCountry.trim()}` : geoCity.trim();
    setGeoMsg(`Ищем «${queryLabel}» и погоду за ${modalDate}…`);
    try {
      const g = await geocode(geoCity, geoCountry);
      if (!g) {
        setGeoMsg("Город не найден. Проверьте написание города и страны.");
        return;
      }
      setGeoMsg(`Найден: ${g.place}. Запрашиваем погоду за ${modalDate}…`);
      const w = await fetchWeather(g, modalDate);
      applyGeoAndWeather(g, w, modalDate);
      setGeoMsg(
        w
          ? `Успешно: ${g.place} · погода за ${modalDate}: ${w.temp > 0 ? "+" : ""}${w.temp}°C, ${w.label}`
          : `Локация сохранена: ${g.place}`
      );
    } catch (err: any) {
      setGeoMsg(`Ошибка: ${err?.message || String(err)}`);
    } finally {
      setGeoLoading(false);
    }
  }

  // Обновление погоды при изменении даты в модалке
  async function handleModalDateChange(newDate: string) {
    setModalDate(newDate);
    if (day.geo) {
      setGeoLoading(true);
      setGeoMsg(`Запрашиваем архив/прогноз погоды за ${newDate}…`);
      try {
        const w = await fetchWeather(day.geo, newDate);
        applyGeoAndWeather(day.geo, w, newDate);
        setGeoMsg(
          w
            ? `Погода обновлена за ${newDate}: ${w.temp > 0 ? "+" : ""}${w.temp}°C, ${w.label}`
            : `Данные о погоде за ${newDate} недоступны.`
        );
      } catch {
        setGeoMsg(`Ошибка обновления погоды за ${newDate}`);
      } finally {
        setGeoLoading(false);
      }
    }
  }

  function applyGeoAndWeather(geo: DayPassport["geo"], weather: Weather | null, targetDate = modalDate) {
    setDay((prev) => {
      if (!prev) return prev;
      let nextStyle = prev.style;
      let extraWhy: string[] = [];
      if (weather) {
        const tw = weatherTweak(prev.style, weather);
        nextStyle = tw.style;
        extraWhy = tw.why;
      }
      return {
        ...prev,
        date: targetDate,
        geo,
        weather: weather ?? prev.weather,
        style: nextStyle,
        why: [...prev.why, ...extraWhy],
      };
    });

    // Если погоды или карты не было на сцене, добавим их
    setItems((prev) => {
      const hasW = prev.some((i) => i.kind === "weather");
      const hasM = prev.some((i) => i.kind === "map");
      const next = [...prev];
      if (weather && !hasW) {
        next.push({ id: `weather-${Date.now()}`, kind: "weather", x: 24, y: 72, s: 1.1, r: -3, variant: "card" });
      }
      if (geo && !hasM) {
        next.push({ id: `map-${Date.now()}`, kind: "map", x: 78, y: 26, s: 1.05, r: 3, variant: "tile" });
      }
      return next.map((it, i) => ({ ...it, zIndex: (i + 1) * 10 }));
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-white/70 p-5 shadow-lg backdrop-blur">
      {/* Шапка редактора */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="font-mono text-sm font-bold tracking-wider uppercase">Редактор оформления</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Перетаскивайте элементы прямо по холсту. Кликните для настройки.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setGeoModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 font-mono text-xs transition hover:border-[var(--foreground)]"
            title="Настроить погоду и геолокацию"
          >
            <span>🛰️</span>
            <span>{day.weather ? `${GLYPH[day.weather.kind]} ${day.weather.temp}°` : "Погода / GPS"}</span>
          </button>

          <button
            onClick={handleReset}
            className="rounded-full border border-[var(--border)] px-3.5 py-1.5 font-mono text-xs text-muted transition hover:text-[var(--foreground)]"
          >
            ↺ Сброс
          </button>

          <button
            onClick={handleSave}
            className={`rounded-full px-5 py-1.5 font-mono text-xs font-medium transition ${
              savedTick
                ? "bg-emerald-600 text-white"
                : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
            }`}
          >
            {savedTick ? "✓ Сохранено!" : "💾 Сохранить"}
          </button>

          <button
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-3.5 py-1.5 font-mono text-xs transition hover:bg-black/5"
          >
            ✕ Готово
          </button>
        </div>
      </div>

      {/* Панель добавления элементов */}
      <div>
        <span className="block font-mono text-[11px] text-muted uppercase tracking-wider mb-2">
          + Добавить на сцену:
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { kind: "disc", label: "💿 Винил", desc: "Увеличенный винил" },
            { kind: "weather", label: "🌦️ Погода", desc: "Виджет погоды" },
            { kind: "map", label: "🗺️ Карта", desc: "Мини-карта OSM" },
            { kind: "note", label: "📝 Заметка", desc: "Стикер с текстом" },
            { kind: "sticker", label: "✨ Стикер", desc: "Эмодзи или бейдж" },
            { kind: "tape", label: "🎗️ Скотч", desc: "Декоративная лента" },
            { kind: "stamp", label: "💮 Штамп", desc: "Почтовая печать" },
            { kind: "place", label: "🏷️ Место", desc: "Бейдж локации" },
            { kind: "wave", label: "📊 Волна", desc: "Аудио-визуализатор" },
            { kind: "cassette", label: "📼 Кассета", desc: "Ретро-кассета" },
            { kind: "playlist", label: "📋 Треклист", desc: "Карточка плейлиста" },
          ].map((btn) => (
            <button
              key={btn.kind}
              onClick={() => addItem(btn.kind as SceneItem["kind"])}
              className="rounded-lg border border-[var(--border)] bg-white/80 px-3 py-1.5 font-mono text-xs transition hover:border-[var(--foreground)] hover:bg-white active:scale-95"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Настройки выбранного элемента */}
      {selectedItem ? (
        <div className="space-y-4 rounded-lg border border-dashed border-rose-400 bg-rose-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase text-rose-900">
                {selectedItem.kind.toUpperCase()} (#{selectedItem.id.slice(-4)})
              </span>
              <span className="rounded-full bg-rose-200/70 px-2 py-0.5 font-mono text-[10px] text-rose-950 font-medium">
                Слой {items.findIndex((i) => i.id === sel) + 1} из {items.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => moveZ("bottom")}
                disabled={items.findIndex((i) => i.id === sel) === 0}
                className="rounded border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] hover:bg-stone-50 disabled:opacity-35 disabled:cursor-not-allowed transition"
                title="На самый задний план (вниз всех слоев)"
              >
                ⏬ Вниз
              </button>
              <button
                type="button"
                onClick={() => moveZ("down")}
                disabled={items.findIndex((i) => i.id === sel) === 0}
                className="rounded border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] hover:bg-stone-50 disabled:opacity-35 disabled:cursor-not-allowed transition"
                title="Опустить на один слой ниже"
              >
                ⬇ Ниже
              </button>
              <button
                type="button"
                onClick={() => moveZ("up")}
                disabled={items.findIndex((i) => i.id === sel) === items.length - 1}
                className="rounded border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] hover:bg-stone-50 disabled:opacity-35 disabled:cursor-not-allowed transition"
                title="Поднять на один слой выше"
              >
                ⬆ Выше
              </button>
              <button
                type="button"
                onClick={() => moveZ("top")}
                disabled={items.findIndex((i) => i.id === sel) === items.length - 1}
                className="rounded border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] hover:bg-stone-50 disabled:opacity-35 disabled:cursor-not-allowed transition"
                title="На самый передний план (поверх всех)"
              >
                ⏫ Вверх
              </button>
              <button
                type="button"
                onClick={duplicateSel}
                className="rounded border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] hover:bg-stone-50 transition"
                title="Дублировать элемент"
              >
                📋 Копия
              </button>
              <button
                type="button"
                onClick={removeSel}
                className="rounded border border-red-300 bg-red-100 px-2.5 py-1 font-mono text-[11px] text-red-700 hover:bg-red-200 transition"
                title="Удалить со сцены"
              >
                🗑 Удалить
              </button>
            </div>
          </div>

          {/* Слайдеры размера и поворота */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between font-mono text-xs text-muted mb-1">
                <span>Размер (Scale)</span>
                <span>{(selectedItem.s || 1).toFixed(2)}x</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={selectedItem.s || 1}
                  onChange={(e) => updateSel({ s: parseFloat(e.target.value) })}
                  className="w-full accent-rose-600"
                />
                <button
                  onClick={() => updateSel({ s: 1 })}
                  className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 font-mono text-[10px]"
                >
                  1x
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-mono text-xs text-muted mb-1">
                <span>Поворот (Rotate)</span>
                <span>{Math.round(selectedItem.r)}°</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={selectedItem.r || 0}
                  onChange={(e) => updateSel({ r: parseInt(e.target.value) })}
                  className="w-full accent-rose-600"
                />
                <button
                  onClick={() => updateSel({ r: 0 })}
                  className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 font-mono text-[10px]"
                >
                  0°
                </button>
                <button
                  onClick={() => updateSel({ r: (selectedItem.r || 0) + 15 })}
                  className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 font-mono text-[10px]"
                >
                  +15°
                </button>
              </div>
            </div>
          </div>

          {/* Специфичные настройки: ВИНИЛ */}
          {selectedItem.kind === "disc" && (
            <div className="space-y-3 border-t border-rose-200/60 pt-3">
              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Материал винила:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "black", label: "🖤 Чёрный обсидиан" },
                    { key: "gold", label: "🟡 Золотой мастер" },
                    { key: "ruby", label: "🔴 Рубиновый" },
                    { key: "sapphire", label: "🔵 Кобальт" },
                    { key: "amber", label: "🟠 Дымчатый янтарь" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => updateSel({ variant: s.key })}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                        (selectedItem.variant || "black") === s.key
                          ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                          : "border border-[var(--border)] bg-white hover:bg-stone-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Центральный лейбл:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "photo", label: "📷 Фото дня" },
                    { key: "vintage", label: "📻 Ретро-лейбл" },
                    { key: "palette", label: "🎨 Палитра дня" },
                    { key: "minimal", label: "⬛ Минимал" },
                  ].map((l) => (
                    <button
                      key={l.key}
                      onClick={() => updateSel({ text: l.key })}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                        (selectedItem.text || "photo") === l.key
                          ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                          : "border border-[var(--border)] bg-white hover:bg-stone-50"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Специфичные настройки: ПОГОДА */}
          {selectedItem.kind === "weather" && (
            <div className="space-y-3 border-t border-rose-200/60 pt-3">
              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Стиль виджета:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "card", label: "📄 Винтажная карточка" },
                    { key: "glass", label: "🪟 Матовое стекло" },
                    { key: "stamp", label: "📮 Почтовый штамп" },
                  ].map((v) => (
                    <button
                      key={v.key}
                      onClick={() => updateSel({ variant: v.key })}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                        (selectedItem.variant || "card") === v.key
                          ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                          : "border border-[var(--border)] bg-white hover:bg-stone-50"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Специфичные настройки: КАРТА И ЛОКАЦИЯ */}
          {(selectedItem.kind === "map" || selectedItem.kind === "place") && (
            <div className="space-y-3 border-t border-rose-200/60 pt-3">
              {selectedItem.kind === "map" && (
                <div>
                  <span className="block font-mono text-xs text-muted mb-1.5">Вид карты:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "tile", label: "🗺️ Мини-карта OSM" },
                      { key: "ticket", label: "🎫 Посадочный билет" },
                    ].map((v) => (
                      <button
                        key={v.key}
                        onClick={() => updateSel({ variant: v.key })}
                        className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                          (selectedItem.variant || "tile") === v.key
                            ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                            : "border border-[var(--border)] bg-white hover:bg-stone-50"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-mono text-xs text-muted mb-1">
                  Название места (отображается на элементе):
                </label>
                <input
                  type="text"
                  value={selectedItem.text ?? day.geo?.place ?? ""}
                  onChange={(e) => updateSel({ text: e.target.value })}
                  placeholder="Например: Любимая набережная, Сочи"
                  className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Специфичные настройки: ЗАМЕТКА */}
          {selectedItem.kind === "note" && (
            <div className="space-y-3 border-t border-rose-200/60 pt-3">
              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Цвет бумаги:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(NOTE_COLORS).map(([k, c]) => (
                    <button
                      key={k}
                      onClick={() => updateSel({ variant: k })}
                      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs"
                      style={{
                        background: c.bg,
                        color: c.fg,
                        borderColor: (selectedItem.variant || "yellow") === k ? "#e11d48" : "transparent",
                        fontWeight: (selectedItem.variant || "yellow") === k ? 700 : 400,
                      }}
                    >
                      <span className="h-2 w-2 rounded-full border border-black/20" style={{ background: c.fg }} />
                      <span>{k}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Шрифт:</span>
                <div className="flex gap-2">
                  {[
                    { key: "hand", label: "✍️ Рукописный" },
                    { key: "mono", label: "⌨️ Машинка" },
                    { key: "serif", label: "📖 Книжный" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => updateSel({ font: f.key })}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                        (selectedItem.font || "hand") === f.key
                          ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                          : "border border-[var(--border)] bg-white hover:bg-stone-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-muted mb-1">Текст заметки:</label>
                <textarea
                  rows={3}
                  value={selectedItem.text ?? ""}
                  onChange={(e) => updateSel({ text: e.target.value })}
                  placeholder="Напишите мысль или цитату…"
                  className="w-full rounded-md border border-[var(--border)] bg-white p-2 font-mono text-xs outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Специфичные настройки: СТИКЕР */}
          {selectedItem.kind === "sticker" && (
            <div className="space-y-3 border-t border-rose-200/60 pt-3">
              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Выбрать стикер или эмодзи:</span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white rounded border border-[var(--border)]">
                  {STICKER_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => updateSel({ text: emoji })}
                      className="h-8 w-8 text-lg rounded hover:bg-rose-100 flex items-center justify-center transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Или текстовый бейдж:</span>
                <div className="flex flex-wrap gap-1.5">
                  {BADGE_PRESETS.map((b) => (
                    <button
                      key={b}
                      onClick={() => updateSel({ text: b })}
                      className="rounded border border-[var(--border)] bg-white px-2.5 py-1 font-mono text-[11px] hover:border-black"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-muted mb-1">Свой текст / символ:</label>
                <input
                  type="text"
                  value={selectedItem.text ?? ""}
                  onChange={(e) => updateSel({ text: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-1.5 font-mono text-xs outline-none"
                />
              </div>
            </div>
          )}

          {/* Специфичные настройки: ШТАМП */}
          {selectedItem.kind === "stamp" && (
            <div className="space-y-3 border-t border-rose-200/60 pt-3">
              <div>
                <span className="block font-mono text-xs text-muted mb-1.5">Форма печати:</span>
                <div className="flex gap-2">
                  {[
                    { key: "round", label: "⭕ Круглый почтовый" },
                    { key: "rect", label: "⏹ Прямоугольная" },
                  ].map((v) => (
                    <button
                      key={v.key}
                      onClick={() => updateSel({ variant: v.key })}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                        (selectedItem.variant || "round") === v.key
                          ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                          : "border border-[var(--border)] bg-white hover:bg-stone-50"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-muted mb-1">Текст печати:</label>
                <input
                  type="text"
                  value={selectedItem.text ?? ""}
                  onChange={(e) => updateSel({ text: e.target.value })}
                  placeholder="ОДОБРЕНО, СОХРАНЕНО, ARCHIVED..."
                  className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-1.5 font-mono text-xs outline-none"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-muted">
          Кликните по любому элементу на постере, чтобы изменить его стиль, размер, поворот или текст.
        </div>
      )}

      {/* Модальное окно настройки погоды и геолокации */}
      {geoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">Погода и геолокация</h3>
                <p className="text-xs text-muted mt-1">
                  Определите текущее местоположение или укажите город воспоминания вручную.
                </p>
              </div>
              <button
                onClick={() => setGeoModal(false)}
                className="rounded-full p-1.5 text-muted hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Выбор даты для проверки погоды */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-1.5">
                <label className="block font-mono text-xs text-stone-600 font-semibold uppercase tracking-wider">
                  📅 Дата для архива погоды:
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => handleModalDateChange(e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-stone-800"
                  />
                  {day.geo && (
                    <button
                      type="button"
                      disabled={geoLoading}
                      onClick={() => handleModalDateChange(modalDate)}
                      className="rounded-lg border border-stone-800 bg-stone-100 px-3 py-2 font-mono text-xs hover:bg-stone-200 transition"
                      title="Перезапросить погоду за эту дату"
                    >
                      🔄
                    </button>
                  )}
                </div>
                <p className="font-mono text-[10px] text-muted">
                  Погода будет найдена именно за этот день (архив Open-Meteo).
                </p>
              </div>

              <button
                disabled={geoLoading}
                onClick={detectLocation}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-stone-900 px-4 py-3 font-mono text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                <span>🛰️</span>
                <span>Определить по GPS погоду за {modalDate}</span>
              </button>

              <div className="relative flex items-center justify-center">
                <span className="w-full border-t border-stone-200" />
                <span className="absolute bg-white px-3 font-mono text-xs text-muted uppercase">или</span>
              </div>

              <div className="space-y-2">
                <label className="block font-mono text-xs text-muted font-semibold">Укажите город и страну:</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={geoCity}
                    onChange={(e) => setGeoCity(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchCity()}
                    placeholder="Город (например: Уральск)"
                    className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 font-mono text-sm outline-none focus:border-stone-800"
                  />
                  <input
                    type="text"
                    value={geoCountry}
                    onChange={(e) => setGeoCountry(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchCity()}
                    placeholder="Страна (например: Казахстан)"
                    className="sm:w-48 rounded-xl border border-[var(--border)] px-4 py-2.5 font-mono text-sm outline-none focus:border-stone-800"
                  />
                  <button
                    disabled={geoLoading || !geoCity.trim()}
                    onClick={searchCity}
                    className="rounded-xl border border-stone-900 bg-stone-100 px-5 py-2.5 font-mono text-sm font-medium hover:bg-stone-200 disabled:opacity-50 transition cursor-pointer"
                  >
                    Найти
                  </button>
                </div>
                <p className="font-mono text-[10px] text-muted">
                  💡 Укажите страну рядом, чтобы найти нужный город (например: «Уральск» + «Казахстан»).
                </p>
              </div>

              {geoMsg && (
                <div className="rounded-lg bg-stone-100 p-3 font-mono text-xs text-stone-700">
                  {geoMsg}
                </div>
              )}

              {day.weather && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">{GLYPH[day.weather.kind]}</span>
                    <div>
                      <div className="font-semibold text-sm">
                        {day.weather.temp > 0 ? "+" : ""}
                        {day.weather.temp}°C, {day.weather.label}
                      </div>
                      <div className="text-xs text-muted font-mono">
                        Погода за дату: <strong>{day.date}</strong> · {day.geo?.place || "Локация сохранена"}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded font-semibold">
                    Сохранено
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setGeoModal(false)}
                className="rounded-full bg-stone-900 px-5 py-2 font-mono text-xs text-white"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
