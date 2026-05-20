// ─────────────────────────────────────────────────────────────────────────────
// quranClientCache.js  —  Optimised edition
// Fixes: double preload, idle scheduling, request deduplication, typed helpers
// + LRU session-storage cap so storage never overflows
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = "v3";

const TTL = {
  chapters: 1_000 * 60 * 60 * 24, // 24 h
  resources: 1_000 * 60 * 60 * 24, // 24 h
  surah: 1_000 * 60 * 60, //  1 h
};

// Maximum number of surahs kept in session storage at once.
// Each surah with tafsir ≈ 200–500 KB; 8 entries ≈ 2–4 MB — safely under 5 MB.
const SURAH_SESSION_LIMIT = 8;

// LRU tracker key stored in sessionStorage alongside the surah entries.
const LRU_KEY = `nabzi:${CACHE_VERSION}:surah:__lru__`;

// Single shared in-flight dedup map across the whole module lifetime
const inFlightRequests = new Map();
const warmBootStarted = new Set();

// ─── Static fallback data ────────────────────────────────────────────────────

export const STATIC_CHAPTERS = [
  [1, "Al-Fatihah", "الفاتحة", 7, "makkah"],
  [2, "Al-Baqarah", "البقرة", 286, "madinah"],
  [3, "Ali 'Imran", "آل عمران", 200, "madinah"],
  [4, "An-Nisa", "النساء", 176, "madinah"],
  [5, "Al-Ma'idah", "المائدة", 120, "madinah"],
  [6, "Al-An'am", "الأنعام", 165, "makkah"],
  [7, "Al-A'raf", "الأعراف", 206, "makkah"],
  [8, "Al-Anfal", "الأنفال", 75, "madinah"],
  [9, "At-Tawbah", "التوبة", 129, "madinah"],
  [10, "Yunus", "يونس", 109, "makkah"],
  [11, "Hud", "هود", 123, "makkah"],
  [12, "Yusuf", "يوسف", 111, "makkah"],
  [13, "Ar-Ra'd", "الرعد", 43, "madinah"],
  [14, "Ibrahim", "إبراهيم", 52, "makkah"],
  [15, "Al-Hijr", "الحجر", 99, "makkah"],
  [16, "An-Nahl", "النحل", 128, "makkah"],
  [17, "Al-Isra", "الإسراء", 111, "makkah"],
  [18, "Al-Kahf", "الكهف", 110, "makkah"],
  [19, "Maryam", "مريم", 98, "makkah"],
  [20, "Ta-Ha", "طه", 135, "makkah"],
  [21, "Al-Anbiya", "الأنبياء", 112, "makkah"],
  [22, "Al-Hajj", "الحج", 78, "madinah"],
  [23, "Al-Mu'minun", "المؤمنون", 118, "makkah"],
  [24, "An-Nur", "النور", 64, "madinah"],
  [25, "Al-Furqan", "الفرقان", 77, "makkah"],
  [26, "Ash-Shu'ara", "الشعراء", 227, "makkah"],
  [27, "An-Naml", "النمل", 93, "makkah"],
  [28, "Al-Qasas", "القصص", 88, "makkah"],
  [29, "Al-'Ankabut", "العنكبوت", 69, "makkah"],
  [30, "Ar-Rum", "الروم", 60, "makkah"],
  [31, "Luqman", "لقمان", 34, "makkah"],
  [32, "As-Sajdah", "السجدة", 30, "makkah"],
  [33, "Al-Ahzab", "الأحزاب", 73, "madinah"],
  [34, "Saba", "سبأ", 54, "makkah"],
  [35, "Fatir", "فاطر", 45, "makkah"],
  [36, "Ya-Sin", "يس", 83, "makkah"],
  [37, "As-Saffat", "الصافات", 182, "makkah"],
  [38, "Sad", "ص", 88, "makkah"],
  [39, "Az-Zumar", "الزمر", 75, "makkah"],
  [40, "Ghafir", "غافر", 85, "makkah"],
  [41, "Fussilat", "فصلت", 54, "makkah"],
  [42, "Ash-Shuraa", "الشورى", 53, "makkah"],
  [43, "Az-Zukhruf", "الزخرف", 89, "makkah"],
  [44, "Ad-Dukhan", "الدخان", 59, "makkah"],
  [45, "Al-Jathiyah", "الجاثية", 37, "makkah"],
  [46, "Al-Ahqaf", "الأحقاف", 35, "makkah"],
  [47, "Muhammad", "محمد", 38, "madinah"],
  [48, "Al-Fath", "الفتح", 29, "madinah"],
  [49, "Al-Hujurat", "الحجرات", 18, "madinah"],
  [50, "Qaf", "ق", 45, "makkah"],
  [51, "Adh-Dhariyat", "الذاريات", 60, "makkah"],
  [52, "At-Tur", "الطور", 49, "makkah"],
  [53, "An-Najm", "النجم", 62, "makkah"],
  [54, "Al-Qamar", "القمر", 55, "makkah"],
  [55, "Ar-Rahman", "الرحمن", 78, "madinah"],
  [56, "Al-Waqi'ah", "الواقعة", 96, "makkah"],
  [57, "Al-Hadid", "الحديد", 29, "madinah"],
  [58, "Al-Mujadila", "المجادلة", 22, "madinah"],
  [59, "Al-Hashr", "الحشر", 24, "madinah"],
  [60, "Al-Mumtahanah", "الممتحنة", 13, "madinah"],
  [61, "As-Saff", "الصف", 14, "madinah"],
  [62, "Al-Jumu'ah", "الجمعة", 11, "madinah"],
  [63, "Al-Munafiqun", "المنافقون", 11, "madinah"],
  [64, "At-Taghabun", "التغابن", 18, "madinah"],
  [65, "At-Talaq", "الطلاق", 12, "madinah"],
  [66, "At-Tahrim", "التحريم", 12, "madinah"],
  [67, "Al-Mulk", "الملك", 30, "makkah"],
  [68, "Al-Qalam", "القلم", 52, "makkah"],
  [69, "Al-Haqqah", "الحاقة", 52, "makkah"],
  [70, "Al-Ma'arij", "المعارج", 44, "makkah"],
  [71, "Nuh", "نوح", 28, "makkah"],
  [72, "Al-Jinn", "الجن", 28, "makkah"],
  [73, "Al-Muzzammil", "المزمل", 20, "makkah"],
  [74, "Al-Muddaththir", "المدثر", 56, "makkah"],
  [75, "Al-Qiyamah", "القيامة", 40, "makkah"],
  [76, "Al-Insan", "الإنسان", 31, "madinah"],
  [77, "Al-Mursalat", "المرسلات", 50, "makkah"],
  [78, "An-Naba", "النبأ", 40, "makkah"],
  [79, "An-Nazi'at", "النازعات", 46, "makkah"],
  [80, "'Abasa", "عبس", 42, "makkah"],
  [81, "At-Takwir", "التكوير", 29, "makkah"],
  [82, "Al-Infitar", "الإنفطار", 19, "makkah"],
  [83, "Al-Mutaffifin", "المطففين", 36, "makkah"],
  [84, "Al-Inshiqaq", "الإنشقاق", 25, "makkah"],
  [85, "Al-Buruj", "البروج", 22, "makkah"],
  [86, "At-Tariq", "الطارق", 17, "makkah"],
  [87, "Al-A'la", "الأعلى", 19, "makkah"],
  [88, "Al-Ghashiyah", "الغاشية", 26, "makkah"],
  [89, "Al-Fajr", "الفجر", 30, "makkah"],
  [90, "Al-Balad", "البلد", 20, "makkah"],
  [91, "Ash-Shams", "الشمس", 15, "makkah"],
  [92, "Al-Layl", "الليل", 21, "makkah"],
  [93, "Ad-Duhaa", "الضحى", 11, "makkah"],
  [94, "Ash-Sharh", "الشرح", 8, "makkah"],
  [95, "At-Tin", "التين", 8, "makkah"],
  [96, "Al-'Alaq", "العلق", 19, "makkah"],
  [97, "Al-Qadr", "القدر", 5, "makkah"],
  [98, "Al-Bayyinah", "البينة", 8, "madinah"],
  [99, "Az-Zalzalah", "الزلزلة", 8, "madinah"],
  [100, "Al-'Adiyat", "العاديات", 11, "makkah"],
  [101, "Al-Qari'ah", "القارعة", 11, "makkah"],
  [102, "At-Takathur", "التكاثر", 8, "makkah"],
  [103, "Al-'Asr", "العصر", 3, "makkah"],
  [104, "Al-Humazah", "الهمزة", 9, "makkah"],
  [105, "Al-Fil", "الفيل", 5, "makkah"],
  [106, "Quraysh", "قريش", 4, "makkah"],
  [107, "Al-Ma'un", "الماعون", 7, "makkah"],
  [108, "Al-Kawthar", "الكوثر", 3, "makkah"],
  [109, "Al-Kafirun", "الكافرون", 6, "makkah"],
  [110, "An-Nasr", "النصر", 3, "madinah"],
  [111, "Al-Masad", "المسد", 5, "makkah"],
  [112, "Al-Ikhlas", "الإخلاص", 4, "makkah"],
  [113, "Al-Falaq", "الفلق", 5, "makkah"],
  [114, "An-Nas", "الناس", 6, "makkah"],
].map(([number, englishName, name, numberOfAyahs, revelationPlace]) => ({
  number,
  englishName,
  name,
  numberOfAyahs,
  revelationPlace,
  isFallback: true,
}));

// ─── Storage helpers ─────────────────────────────────────────────────────────

function getStorage(type) {
  if (typeof window === "undefined") return null;
  return type === "local" ? window.localStorage : window.sessionStorage;
}

function safeRead(storage, key, maxAge) {
  try {
    if (!storage) return null;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached.createdAt || Date.now() - cached.createdAt > maxAge)
      return null;
    return cached.data;
  } catch {
    return null;
  }
}

function safeWrite(storage, key, data) {
  try {
    if (!storage) return;
    storage.setItem(key, JSON.stringify({ createdAt: Date.now(), data }));
  } catch {
    // Ignore quota / private-mode errors
  }
}

// ─── LRU helpers for session storage ─────────────────────────────────────────
// We keep an ordered array of surah cache keys in sessionStorage.
// The FRONT of the array = least recently used → first to evict.
// The BACK of the array  = most recently used → kept longest.

function lruReadOrder() {
  try {
    const raw = sessionStorage.getItem(LRU_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lruWriteOrder(order) {
  try {
    sessionStorage.setItem(LRU_KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
}

/**
 * Touch a key: move it to the back (most-recently-used position).
 * Called on every cache READ so hot surahs are never evicted.
 */
function lruTouch(key) {
  const order = lruReadOrder();
  const idx = order.indexOf(key);
  if (idx !== -1) order.splice(idx, 1);
  order.push(key);
  lruWriteOrder(order);
}

/**
 * Register a newly-written key and evict the LRU entry if over the limit.
 * Called on every cache WRITE.
 */
function lruRegister(key) {
  const order = lruReadOrder();

  // Move to back (treat as most-recently-used)
  const idx = order.indexOf(key);
  if (idx !== -1) order.splice(idx, 1);
  order.push(key);

  // Evict entries from the front until we're within the limit
  while (order.length > SURAH_SESSION_LIMIT) {
    const evictKey = order.shift();
    try {
      sessionStorage.removeItem(evictKey);
    } catch {
      /* ignore */
    }
  }

  lruWriteOrder(order);
}

/**
 * Write a surah entry to session storage with LRU tracking.
 * Drops gracefully if storage is full after eviction attempts.
 */
function surahSessionWrite(key, data) {
  const storage = getStorage("session");
  if (!storage) return;

  // Evict first, then write — prevents quota errors
  lruRegister(key);

  try {
    storage.setItem(key, JSON.stringify({ createdAt: Date.now(), data }));
  } catch (err) {
    // If still full (e.g. single entry is very large), evict one more and retry
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      const order = lruReadOrder();
      if (order.length > 1) {
        const evictKey = order.shift();
        try {
          storage.removeItem(evictKey);
        } catch {
          /* ignore */
        }
        lruWriteOrder(order);
        try {
          storage.setItem(key, JSON.stringify({ createdAt: Date.now(), data }));
        } catch {
          /* give up gracefully */
        }
      }
    }
  }
}

/**
 * Read a surah entry from session storage and touch it in the LRU order.
 */
function surahSessionRead(key, maxAge) {
  try {
    const storage = getStorage("session");
    if (!storage) return null;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached.createdAt || Date.now() - cached.createdAt > maxAge) {
      // Expired — remove and untrack
      storage.removeItem(key);
      const order = lruReadOrder().filter((k) => k !== key);
      lruWriteOrder(order);
      return null;
    }
    // Promote to most-recently-used on every read
    lruTouch(key);
    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Schedule a low-priority task.
 * Uses requestIdleCallback when available, falls back to setTimeout.
 */
function idle(task, timeout = 2500) {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(task, { timeout });
  } else {
    window.setTimeout(task, 1);
  }
}

function isValidChapters(chapters) {
  return Array.isArray(chapters) && chapters.length >= 100;
}

/** Normalise recitationId / tafsirId — handles object or primitive forms */
export function normalizeId(value, fallback) {
  if (value && typeof value === "object" && "id" in value)
    return String(value.id);
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

// ─── JSON fetch helper ───────────────────────────────────────────────────────

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 180)}`);
  }
  if (!response.ok) {
    throw new Error(json.error || json.message || `Request failed: ${url}`);
  }
  return json;
}

// ─── Cache key builders ──────────────────────────────────────────────────────

export const chaptersKey = () => `nabzi:${CACHE_VERSION}:chapters`;
export const resourcesKey = () => `nabzi:${CACHE_VERSION}:resources`;

export function surahKey(chapter, recitationId = "7", tafsirId = "169") {
  return `nabzi:${CACHE_VERSION}:surah:${chapter}:reciter:${normalizeId(recitationId, "7")}:tafsir:${normalizeId(tafsirId, "169")}`;
}

// ─── Cached reads (synchronous) ──────────────────────────────────────────────

export function readCachedChapters() {
  const cached = safeRead(getStorage("local"), chaptersKey(), TTL.chapters);
  return isValidChapters(cached) ? cached : null;
}

export function readCachedResources() {
  const cached = safeRead(getStorage("local"), resourcesKey(), TTL.resources);
  if (!cached) return null;
  return {
    recitations: Array.isArray(cached.recitations) ? cached.recitations : [],
    tafsirs: Array.isArray(cached.tafsirs) ? cached.tafsirs : [],
  };
}

export function readCachedSurah(chapter, recitationId = "7", tafsirId = "169") {
  const cached = surahSessionRead(
    surahKey(chapter, recitationId, tafsirId),
    TTL.surah,
  );
  return cached?.ayahs?.length ? cached : null;
}

// ─── Async data fetchers (with in-flight dedup) ──────────────────────────────

export async function getChapters({ signal } = {}) {
  const cached = readCachedChapters();
  if (cached) return cached;

  const key = chaptersKey();
  if (inFlightRequests.has(key)) return inFlightRequests.get(key);

  const promise = fetchJson("/api/qf/chapters", signal)
    .then((json) => {
      const chapters = isValidChapters(json.chapters)
        ? json.chapters
        : STATIC_CHAPTERS;
      safeWrite(getStorage("local"), key, chapters);
      return chapters;
    })
    .catch((error) => {
      const afterError = readCachedChapters();
      if (afterError) return afterError;
      if (error?.name === "AbortError") throw error;
      return STATIC_CHAPTERS;
    })
    .finally(() => inFlightRequests.delete(key));

  inFlightRequests.set(key, promise);
  return promise;
}

export async function getResources({ signal } = {}) {
  const cached = readCachedResources();
  if (cached?.recitations?.length || cached?.tafsirs?.length) return cached;

  const key = resourcesKey();
  if (inFlightRequests.has(key)) return inFlightRequests.get(key);

  const promise = fetchJson("/api/qf/resources", signal)
    .then((json) => {
      const resources = {
        recitations: json.recitations || [],
        tafsirs: json.tafsirs || [],
      };
      safeWrite(getStorage("local"), key, resources);
      return resources;
    })
    .finally(() => inFlightRequests.delete(key));

  inFlightRequests.set(key, promise);
  return promise;
}

export async function getSurah({
  chapter,
  recitationId = "7",
  tafsirId = "169",
  signal,
} = {}) {
  const safeChapter = String(chapter || "1");
  const safeRecitationId = normalizeId(recitationId, "7");
  const safeTafsirId = normalizeId(tafsirId, "169");
  const key = surahKey(safeChapter, safeRecitationId, safeTafsirId);

  const cached = readCachedSurah(safeChapter, safeRecitationId, safeTafsirId);
  if (cached) return cached;

  if (inFlightRequests.has(key)) return inFlightRequests.get(key);

  const params = new URLSearchParams({
    chapter: safeChapter,
    recitationId: safeRecitationId,
    tafsirId: safeTafsirId,
  });

  const promise = fetchJson(`/api/qf/surah?${params}`, signal)
    .then((json) => {
      const data = {
        surahName:
          json.surahName || json.surah?.englishName || `Surah ${safeChapter}`,
        surah: json.surah || null,
        ayahs: (json.ayahs || []).map((ayah, index) => ({
          number: ayah.number ?? index + 1,
          globalIndex: index,
          arabic: ayah.arabic || "",
          latin: ayah.latin || ayah.transliteration || "",
          audioUrl: ayah.audioUrl || "",
          tafsir: ayah.tafsir || null,
        })),
      };
      if (!data.ayahs.length) throw new Error("Surah response had no ayahs");
      surahSessionWrite(key, data);
      return data;
    })
    .finally(() => inFlightRequests.delete(key));

  inFlightRequests.set(key, promise);
  return promise;
}

// ─── Prefetch helpers ────────────────────────────────────────────────────────

export function prefetchSurah(chapter, recitationId = "7", tafsirId = "169") {
  const cached = readCachedSurah(chapter, recitationId, tafsirId);
  if (cached) return Promise.resolve(cached);
  return getSurah({ chapter, recitationId, tafsirId }).catch(() => null);
}

/** Preload audio metadata so first-play starts faster */
export function preloadAudioMetadata(url) {
  if (!url || typeof window === "undefined") return;
  try {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
  } catch {
    // ignore
  }
}

/**
 * Inject a <link rel="preload"> tag for a static asset.
 * De-duplicated by URL — safe to call multiple times.
 * @param {string} url
 * @param {"fetch"|"image"|"script"|"style"|"font"} as_
 */
export function preloadAsset(url, as_ = "fetch") {
  if (!url || typeof document === "undefined") return;
  if (document.querySelector(`link[data-nabzi-preload="${CSS.escape(url)}"]`))
    return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.href = url;
  link.as = as_;
  link.crossOrigin = "anonymous";
  link.dataset.nabziPreload = url;
  document.head.appendChild(link);
}

// ─── Warm-boot orchestrator ──────────────────────────────────────────────────

const PRIORITY_SURAHS = [1, 94, 36, 67, 112]; // Fatiha + popular short surahs

/**
 * Called once per recitation+tafsir combo.
 * Kicks off background fetches in priority order without blocking the UI.
 */
export function warmBootQuranData({
  recitationId = "7",
  tafsirId = "169",
} = {}) {
  const safeRecitationId = normalizeId(recitationId, "7");
  const safeTafsirId = normalizeId(tafsirId, "169");
  const bootKey = `${safeRecitationId}:${safeTafsirId}`;

  if (warmBootStarted.has(bootKey)) return;
  warmBootStarted.add(bootKey);

  // Kick off low-priority meta fetches
  idle(() => getChapters().catch(() => null));
  idle(() => getResources().catch(() => null));

  // Stagger surah prefetches so they don't compete with the first paint
  PRIORITY_SURAHS.forEach((chapter, i) => {
    window.setTimeout(
      () => prefetchSurah(chapter, safeRecitationId, safeTafsirId),
      800 + i * 700,
    );
  });
}

// ─── Cache purge ─────────────────────────────────────────────────────────────

export function clearQuranClientCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("nabzi:")) localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("nabzi:")) sessionStorage.removeItem(key);
    }
    // LRU tracker starts with "nabzi:" too, so it's already removed above.
    // Defensive explicit clear in case the key format ever changes:
    try {
      sessionStorage.removeItem(LRU_KEY);
    } catch {
      /* ignore */
    }
  } catch {
    // ignore
  }
}
