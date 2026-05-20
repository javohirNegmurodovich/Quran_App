async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let json;

  try {
    json = JSON.parse(text || "{}");
  } catch {
    throw new Error(`Server returned non-JSON response: ${text.slice(0, 160)}`);
  }

  if (!response.ok) {
    throw new Error(json.message || json.error || `Request failed: ${url}`);
  }

  return json;
}

async function optionalJson(url, fallback, options = {}) {
  try {
    return await requestJson(url, options);
  } catch {
    return fallback;
  }
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.bookmarks)) return payload.bookmarks;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.nodes)) return payload.nodes;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.readingSessions)) return payload.readingSessions;
  if (Array.isArray(payload?.streaks)) return payload.streaks;
  if (Array.isArray(payload?.goals)) return payload.goals;
  if (Array.isArray(payload?.edges))
    return payload.edges.map((edge) => edge.node || edge).filter(Boolean);
  return [];
}

function parseVerseKey(value) {
  const match = String(value || "").match(/^(\d+):(\d+)$/);
  if (!match) return { surahNumber: null, ayahNumber: null };
  return { surahNumber: Number(match[1]), ayahNumber: Number(match[2]) };
}

function normalizeAyahBookmark(item) {
  const verseKey =
    item.verseKey ||
    item.verse_key ||
    item.key ||
    item.verse?.verseKey ||
    item.verse?.verse_key ||
    "";
  const parsed = parseVerseKey(verseKey);

  const surahNumber =
    Number(item.surahNumber) ||
    Number(item.chapterNumber) ||
    Number(item.chapter_number) ||
    Number(item.key) ||
    parsed.surahNumber;

  const ayahNumber =
    Number(item.ayahNumber) ||
    Number(item.verseNumber) ||
    Number(item.verse_number) ||
    parsed.ayahNumber;

  if (!surahNumber || !ayahNumber) return null;

  return {
    id: String(verseKey || `${surahNumber}:${ayahNumber}`),
    verseKey: String(verseKey || `${surahNumber}:${ayahNumber}`),
    surahNumber,
    ayahNumber,
    type: "ayah",
    createdAt:
      item.createdAt || item.created_at || item.updatedAt || Date.now(),
    raw: item,
  };
}

function normalizeAyahBookmarks(payload) {
  const map = new Map();
  extractArray(payload).forEach((item) => {
    const bookmark = normalizeAyahBookmark(item);
    if (bookmark) map.set(bookmark.id, bookmark);
  });
  return [...map.values()];
}

function normalizeSurahNumbers(payload) {
  if (Array.isArray(payload?.learnedSurahs)) {
    return [...new Set(payload.learnedSurahs.map(Number))]
      .filter(
        (number) => Number.isFinite(number) && number >= 1 && number <= 114,
      )
      .sort((a, b) => a - b);
  }

  const numbers = extractArray(payload)
    .map(
      (item) =>
        Number(item.surahNumber) ||
        Number(item.chapterNumber) ||
        Number(item.chapter_number) ||
        Number(item.key) ||
        Number(item.id),
    )
    .filter(
      (number) => Number.isFinite(number) && number >= 1 && number <= 114,
    );

  return [...new Set(numbers)].sort((a, b) => a - b);
}

function normalizeLastRead(payload) {
  const sessions = extractArray(payload);
  const latest = sessions[0];
  if (!latest) return null;

  const surahNumber =
    Number(latest.surahNumber) ||
    Number(latest.chapterNumber) ||
    Number(latest.chapter_number) ||
    Number(latest.key);
  const ayahNumber =
    Number(latest.ayahNumber) ||
    Number(latest.verseNumber) ||
    Number(latest.verse_number);

  if (!surahNumber || !ayahNumber) return null;

  return {
    surahNumber,
    ayahNumber,
    verseKey: `${surahNumber}:${ayahNumber}`,
    updatedAt: latest.updatedAt || latest.updated_at || Date.now(),
    raw: latest,
  };
}

function getStreakDays(streaks) {
  const first = Array.isArray(streaks) ? streaks[0] : null;
  return (
    Number(first?.days) ||
    Number(first?.length) ||
    Number(first?.currentStreak) ||
    Number(first?.current_streak) ||
    0
  );
}

function getSurahNumber(input) {
  if (input && typeof input === "object") return Number(input.surahNumber);
  return Number(input);
}

export async function getQuranConnectionStatus() {
  return requestJson("/api/qf-auth/status");
}

export function connectQuranCom() {
  window.location.href = "/api/qf-auth/login";
}

export async function disconnectQuranCom() {
  return requestJson("/api/qf-auth/logout", { method: "POST" });
}

export const logoutQuranCom = disconnectQuranCom;

export async function getQuranProfile() {
  const json = await optionalJson("/api/qf-user/profile", null);
  return json?.data || json?.profile || json;
}

export const getQuranUserProfile = getQuranProfile;

export async function getQuranBookmarks() {
  return requestJson("/api/qf-user/bookmarks?type=ayah&mushafId=4&first=20");
}

export async function getQuranAyahBookmarks() {
  return normalizeAyahBookmarks(await getQuranBookmarks());
}

export async function addQuranAyahBookmark({ surahNumber, ayahNumber }) {
  try {
    const data = await requestJson("/api/qf-user/add-bookmark", {
      method: "POST",
      body: JSON.stringify({
        type: "ayah",
        surahNumber: Number(surahNumber),
        ayahNumber: Number(ayahNumber),
      }),
    });
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Quran.com bookmark saqlanmadi.",
    };
  }
}

export const addQuranBookmark = addQuranAyahBookmark;

export async function getQuranLearnedSurahs() {
  const json = await optionalJson("/api/qf-user/learned-surahs?first=20", {
    learnedSurahs: [],
  });
  return normalizeSurahNumbers(json);
}

export const getQuranSurahBookmarks = getQuranLearnedSurahs;

export async function markQuranSurahLearned(input) {
  const surahNumber = getSurahNumber(input);
  if (!surahNumber || surahNumber < 1 || surahNumber > 114) {
    return { success: false, message: "Valid surahNumber is required." };
  }

  try {
    const data = await requestJson("/api/qf-user/learned-surahs", {
      method: "POST",
      body: JSON.stringify({ surahNumber }),
    });
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Sura Quran.com progressga saqlanmadi.",
    };
  }
}

export async function unmarkQuranSurahLearned(input) {
  const surahNumber = getSurahNumber(input);
  if (!surahNumber || surahNumber < 1 || surahNumber > 114) {
    return { success: false, message: "Valid surahNumber is required." };
  }

  try {
    const data = await requestJson("/api/qf-user/learned-surahs", {
      method: "DELETE",
      body: JSON.stringify({ surahNumber }),
    });
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Sura Quran.com progressdan olib tashlanmadi.",
    };
  }
}

export const addQuranSurahBookmark = markQuranSurahLearned;
export const removeQuranSurahBookmark = unmarkQuranSurahLearned;

export async function getQuranReadingSessions() {
  return optionalJson("/api/qf-user/reading-sessions?first=20", { data: [] });
}

export async function saveQuranReadingSession({ chapterNumber, verseNumber }) {
  try {
    const data = await requestJson("/api/qf-user/reading-sessions", {
      method: "POST",
      body: JSON.stringify({
        chapterNumber: Number(chapterNumber),
        verseNumber: Number(verseNumber),
      }),
    });
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Reading session saqlanmadi.",
    };
  }
}

export async function creditQuranActivity({
  surahNumber,
  fromAyah,
  toAyah,
  seconds = 30,
}) {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent";
  try {
    const data = await requestJson("/api/qf-user/activity-day", {
      method: "POST",
      headers: { "x-timezone": timezone },
      body: JSON.stringify({
        surahNumber: Number(surahNumber),
        fromAyah: Number(fromAyah),
        toAyah: Number(toAyah),
        seconds: Number(seconds),
      }),
    });
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Activity/streak saqlanmadi.",
    };
  }
}

export const syncQuranActivity = creditQuranActivity;

export async function getQuranStreaks() {
  return optionalJson("/api/qf-user/streaks?first=20", { data: [] });
}

export async function getQuranGoals() {
  return optionalJson("/api/qf-user/goals?first=20", { data: [] });
}

export async function createQuranGoal(goal) {
  try {
    const data = await requestJson("/api/qf-user/goals", {
      method: "POST",
      body: JSON.stringify(goal),
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, message: error.message || "Goal yaratilmadi." };
  }
}

export async function bootstrapQuranUser() {
  const status = await getQuranConnectionStatus().catch((error) => ({
    connected: false,
    message: error.message,
  }));

  if (!status.connected) {
    return {
      connected: false,
      profile: null,
      learnedSurahs: [],
      bookmarkedAyahs: [],
      bookmarkedSurahs: [],
      lastRead: null,
      readingSessions: [],
      streaks: [],
      goals: [],
      stats: {
        totalLearned: 0,
        totalBookmarkedAyahs: 0,
        currentStreak: 0,
        goals: 0,
      },
      error: status.message || null,
    };
  }

  const [
    profile,
    learnedSurahs,
    ayahBookmarksJson,
    sessionsJson,
    streaksJson,
    goalsJson,
  ] = await Promise.all([
    getQuranProfile(),
    getQuranLearnedSurahs(),
    optionalJson("/api/qf-user/bookmarks?type=ayah&mushafId=4&first=20", {
      data: [],
    }),
    getQuranReadingSessions(),
    getQuranStreaks(),
    getQuranGoals(),
  ]);

  const bookmarkedAyahs = normalizeAyahBookmarks(ayahBookmarksJson);
  const readingSessions = extractArray(sessionsJson);
  const streaks = extractArray(streaksJson);
  const goals = extractArray(goalsJson);

  return {
    connected: true,
    profile,
    user: profile,
    learnedSurahs,
    bookmarkedAyahs,
    bookmarkedSurahs: learnedSurahs,
    lastRead: normalizeLastRead(sessionsJson),
    readingSessions,
    streaks,
    goals,
    stats: {
      totalLearned: learnedSurahs.length,
      totalBookmarkedAyahs: bookmarkedAyahs.length,
      currentStreak: getStreakDays(streaks),
      goals: goals.length,
    },
    error: null,
    lastSyncedAt: Date.now(),
  };
}

export const refreshQuranUser = bootstrapQuranUser;
