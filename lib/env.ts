import type { Geo, Weather, WeatherKind } from "./types";

const get = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

/**
 * Запрос геолокации в браузере с понятными ошибками на русском.
 * Координаты округляются до 3 знаков (~100м) ради приватности.
 */
export const getGeo = () =>
  new Promise<Geo>((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return reject(new Error("Геолокация не поддерживается вашим браузером."));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: +pos.coords.latitude.toFixed(3),
          lon: +pos.coords.longitude.toFixed(3),
        });
      },
      (err) => {
        let msg = "Не удалось определить местоположение.";
        if (err.code === 1) {
          msg = "Доступ к геолокации запрещён в настройках браузера. Вы можете указать город вручную.";
        } else if (err.code === 2) {
          msg = "Координаты недоступны. Проверьте подключение к интернету или укажите город вручную.";
        } else if (err.code === 3) {
          msg = "Время ожидания ответа геолокации истекло. Попробуйте ещё раз или введите город.";
        }
        reject(new Error(msg));
      },
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 60000 },
    );
  });

/**
 * Определение названия района / города по координатам (Reverse Geocoding).
 * Сначала пробует BigDataCloud (быстрый, без ключа, открытый CORS), затем Nominatim OpenStreetMap.
 */
export async function reverse(g: Geo): Promise<string | undefined> {
  // 1. BigDataCloud Client API
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${g.lat}&longitude=${g.lon}&localityLanguage=ru`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      const parts = [data.locality || data.city, data.principalSubdivision || data.countryName].filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
    }
  } catch {}

  // 2. Nominatim OpenStreetMap
  try {
    const j = await get(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=ru&lat=${g.lat}&lon=${g.lon}`,
    );
    const a = j.address ?? {};
    const local = a.suburb || a.neighbourhood || a.city_district;
    const city = a.city || a.town || a.village || a.county;
    if (local && city && local !== city) return `${city}, ${local}`;
    return city || local || a.state;
  } catch {}

  return undefined;
}

/**
 * Город → координаты через Open-Meteo Geocoding API (без ключа, поддержка русского языка).
 */
export async function geocode(name: string): Promise<Geo | null> {
  if (!name.trim()) return null;
  try {
    const j = await get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=1&language=ru`,
    );
    const r = j.results?.[0];
    if (!r) return null;
    const parts = [r.name, r.admin1, r.country].filter(Boolean);
    const place = parts.length > 1 ? `${r.name}, ${r.country || r.admin1}` : r.name;
    return {
      lat: +r.latitude.toFixed(3),
      lon: +r.longitude.toFixed(3),
      place,
    };
  } catch {
    return null;
  }
}

export function kindOf(c: number): [WeatherKind, string] {
  if (c === 0) return ["clear", "ясно"];
  if (c <= 2) return ["cloud", "малооблачно"];
  if (c === 3) return ["cloud", "пасмурно"];
  if (c <= 48) return ["fog", "туман"];
  if (c <= 57) return ["rain", "морось"];
  if (c <= 67) return ["rain", "дождь"];
  if (c <= 77) return ["snow", "снег"];
  if (c <= 82) return ["rain", "ливень"];
  if (c <= 86) return ["snow", "снегопад"];
  return ["storm", "гроза"];
}

/**
 * Получение погоды СТРОГО на конкретную выбранную пользователем дату (YYYY-MM-DD).
 * Сначала опрашивается прогноз Open-Meteo (охватывает даты до 3 месяцев назад и до 14 дней вперед).
 * Если дата дальше в прошлом — автоматически опрашивается официальный архив Open-Meteo Archive API.
 */
export async function fetchWeather(g: Geo, date: string): Promise<Weather | null> {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const q = `latitude=${g.lat}&longitude=${g.lon}&start_date=${date}&end_date=${date}&timezone=auto&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max`;

  // 1. Пробуем Forecast API (недавние даты, сегодня и ближайшие дни)
  try {
    const res = await get(`https://api.open-meteo.com/v1/forecast?${q}`);
    const d = res.daily;
    if (d?.weather_code?.[0] != null) {
      const code = d.weather_code[0];
      const [kind, label] = kindOf(code);
      const temp = Math.round((d.temperature_2m_max[0] + d.temperature_2m_min[0]) / 2);
      const wind = Math.round(d.wind_speed_10m_max?.[0] ?? 0);
      return { code, kind, label, temp, wind };
    }
  } catch {}

  // 2. Пробуем Archive API (для дат в прошлом: месяц назад, год назад, 5 лет назад)
  try {
    const res = await get(`https://archive-api.open-meteo.com/v1/archive?${q}`);
    const d = res.daily;
    if (d?.weather_code?.[0] != null) {
      const code = d.weather_code[0];
      const [kind, label] = kindOf(code);
      const temp = Math.round((d.temperature_2m_max[0] + d.temperature_2m_min[0]) / 2);
      const wind = Math.round(d.wind_speed_10m_max?.[0] ?? 0);
      return { code, kind, label, temp, wind };
    }
  } catch {}

  // 3. Только если выбран СЕГОДНЯШНИЙ день и дневная сводка ещё формируется — берём текущий срез
  const isToday = (() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      return date === todayStr;
    } catch {
      return false;
    }
  })();

  if (isToday) {
    try {
      const res = await get(
        `https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`,
      );
      if (res.current?.weather_code != null) {
        const code = res.current.weather_code;
        const [kind, label] = kindOf(code);
        return {
          code,
          kind,
          label,
          temp: Math.round(res.current.temperature_2m),
          wind: Math.round(res.current.wind_speed_10m ?? 0),
        };
      }
    } catch {}
  }

  return null;
}

/** Тайл OpenStreetMap и относительное положение точки внутри (в %) */
export function tile(g: Geo, z = 15) {
  const n = 2 ** z;
  const fx = ((g.lon + 180) / 360) * n;
  const rad = (g.lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return {
    url: `https://tile.openstreetmap.org/${z}/${Math.floor(fx)}/${Math.floor(fy)}.png`,
    px: (fx % 1) * 100,
    py: (fy % 1) * 100,
  };
}

export const GLYPH: Record<WeatherKind, string> = {
  clear: "☀️",
  cloud: "⛅",
  fog: "🌫️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
};
