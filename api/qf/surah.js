import { callContentApi } from "../_qf.js";

const TRANSLITERATION_ID = process.env.QF_TRANSLITERATION_ID || "57";

function asArray(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .trim();
}

function getAudioUrl(audio) {
  if (!audio) return null;

  const url =
    audio.url ||
    audio.audio_url ||
    audio.audioUrl ||
    audio.file_url ||
    audio.path ||
    "";

  if (!url) return null;

  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://verses.quran.com${url}`;

  return `https://verses.quran.com/${url}`;
}

function normalizeTafsir(item) {
  if (!item) return null;

  const text = item.text || item.body || item.content || "";

  if (!text) return null;

  return {
    id: item.id || null,
    resourceId: item.resource_id || item.resourceId || null,
    resourceName: item.resource_name || item.resourceName || "",
    languageName: item.language_name || item.languageName || "",
    verseKey: item.verse_key || item.verseKey || "",
    text,
  };
}

function normalizeVerse(verse, index, tafsirByVerseKey) {
  const verseKey = verse.verse_key || verse.verseKey || "";
  const number =
    Number(verse.verse_number) ||
    Number(verse.verseNumber) ||
    Number(String(verseKey).split(":")[1]) ||
    index + 1;

  const translation = Array.isArray(verse.translations)
    ? verse.translations[0]
    : null;

  const inlineTafsir = Array.isArray(verse.tafsirs)
    ? verse.tafsirs[0]
    : verse.tafsir;

  const tafsir =
    normalizeTafsir(inlineTafsir) ||
    normalizeTafsir(tafsirByVerseKey.get(verseKey)) ||
    null;

  return {
    number,
    globalIndex: index,
    verseKey: verseKey || `${verse.chapter_id}:${number}`,
    arabic:
      verse.text_uthmani ||
      verse.text_uthmani_simple ||
      verse.text_indopak ||
      verse.text_imlaei ||
      "",
    latin: stripHtml(translation?.text || ""),
    tafsir,
    audioUrl: getAudioUrl(verse.audio),
  };
}

async function fetchAllPages(path, key) {
  let page = 1;
  const all = [];

  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const json = await callContentApi(
      `${path}${separator}page=${page}&per_page=50`,
    );
    const items = asArray(json, key);
    all.push(...items);

    const nextPage =
      json?.pagination?.next_page || json?.meta?.pagination?.next_page || null;

    if (!nextPage) break;
    page = Number(nextPage);
  }

  return all;
}

export default async function handler(req, res) {
  try {
    const chapter = Number(req.query.chapter);
    const recitationId = String(req.query.recitationId || "7");
    const tafsirId = String(req.query.tafsirId || "169");

    if (!chapter || chapter < 1 || chapter > 114) {
      return res.status(400).json({
        success: false,
        message: "Valid chapter is required.",
      });
    }

    const versePath =
      `/content/api/v4/verses/by_chapter/${chapter}` +
      `?language=en` +
      `&words=false` +
      `&fields=text_uthmani,verse_key,verse_number,chapter_id` +
      `&translations=${TRANSLITERATION_ID}` +
      `&audio=${encodeURIComponent(recitationId)}` +
      `&tafsirs=${encodeURIComponent(tafsirId)}` +
      `&tafsir_fields=verse_key,verse_number,resource_name,language_name,text`;

    const verses = await fetchAllPages(versePath, "verses");

    let externalTafsirs = [];

    try {
      externalTafsirs = await fetchAllPages(
        `/content/api/v4/tafsirs/${encodeURIComponent(
          tafsirId,
        )}/by_chapter/${chapter}?fields=verse_key,verse_number,resource_name,language_name,text`,
        "tafsirs",
      );
    } catch (error) {
      console.warn("Dedicated tafsir fallback failed:", error.message);
    }

    const tafsirByVerseKey = new Map();

    externalTafsirs.forEach((item) => {
      const verseKey = item.verse_key || item.verseKey;
      if (verseKey) tafsirByVerseKey.set(String(verseKey), item);
    });

    const ayahs = verses.map((verse, index) =>
      normalizeVerse(verse, index, tafsirByVerseKey),
    );

    const hasTafsir = ayahs.some((ayah) => Boolean(ayah.tafsir?.text));

    return res.status(200).json({
      success: true,
      surahName:
        verses[0]?.chapter?.name_simple ||
        verses[0]?.chapter?.translated_name?.name ||
        `Surah ${chapter}`,
      surah: {
        number: chapter,
      },
      ayahs,
      debug: {
        tafsirId,
        totalAyahs: ayahs.length,
        externalTafsirs: externalTafsirs.length,
        hasTafsir,
      },
    });
  } catch (error) {
    console.error("Surah API failed:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Surah API failed.",
    });
  }
}
