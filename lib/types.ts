export type Technique = "monet" | "matisse" | "kandinsky" | "minimal";
export type TimeOfDay = "morning" | "day" | "evening" | "night";
export type Season = "winter" | "spring" | "summer" | "autumn";

export type SongFeatures = {
  energy?: number; // 0..1
  valence?: number; // 0..1
  tempo?: number; // bpm
  mode?: 0 | 1; // 0 = минор, 1 = мажор
};

export type Song = {
  title: string;
  artist: string;
  year?: number;
  link: string;
  deezerId?: number; // превью запрашиваем при открытии дня, URL не храним
  features: SongFeatures | null;
  featuresSource: "reccobeats" | "meyda" | "llm" | null;
};

export type DayContext = {
  timeOfDay: TimeOfDay;
  season: Season;
  people: string[];
  places: string[];
  keywords: string[];
};

export type PhotoStats = {
  palette: string[]; // hex
  brightness: number; // 0..1
  contrast: number; // 0..1
  warmth: number; // 0..1, доля тёплых оттенков OKLCH 20-100°, вес = насыщенность
};

export type WeatherKind = "clear" | "cloud" | "fog" | "rain" | "snow" | "storm";
export type Weather = { temp: number; wind: number; code: number; kind: WeatherKind; label: string };
/** Координаты округлены до ~100 м, хранятся только в браузере пользователя. */
export type Geo = { lat: number; lon: number; place?: string };

export type ItemKind = "disc" | "weather" | "map" | "place" | "note" | "sticker" | "tape" | "stamp" | "wave" | "cassette" | "playlist";
/** Элемент, который пользователь расставляет на сцене. x, y — центр в % сцены. */
export type SceneItem = {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  s: number;
  r: number;
  text?: string;
  subtext?: string;
  variant?: string;
  color?: string;
  font?: string;
  size?: number;
  zIndex?: number;
};

export type DayPassport = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  text: string;
  photos: string[]; // dataURL или путь в /public
  song: Song;
  playlist?: Song[]; // Плейлист / саундтрек дня
  textMood: { valence: number; arousal: number; warmth: number };
  photoStats: PhotoStats;
  context: DayContext;
  mood: { valence: number; arousal: number };
  style: {
    weights: Record<Technique, number>;
    params: {
      grain: number;
      softness: number;
      tempo: number;
      density: number;
      palette: string[];
    };
  };
  why: string[];
  weather?: Weather;
  geo?: Geo;
  items?: SceneItem[];
};
