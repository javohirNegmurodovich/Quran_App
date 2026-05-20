import { callContentApi } from "../_qf.js";

const FALLBACK_RECITATIONS = [
  { id: "7", name: "Mishary Rashid Alafasy", style: "" },
  { id: "1", name: "AbdulBaset AbdulSamad", style: "Mujawwad" },
];

const FALLBACK_TAFSIRS = [
  { id: "169", name: "Tafsir Ibn Kathir", languageName: "english" },
];

function asArray(payload, keys) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }

  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeRecitation(item) {
  const id = item.id || item.recitation_id || item.resource_id;

  return {
    id: String(id),
    name:
      item.reciter_name ||
      item.name ||
      item.translated_name?.name ||
      item.translatedName?.name ||
      `Reciter #${id}`,
    style: item.style || item.qiraat_name || item.qiraatName || "",
  };
}

function normalizeTafsir(item) {
  const id = item.id || item.tafsir_id || item.resource_id;

  return {
    id: String(id),
    name:
      item.name ||
      item.translated_name?.name ||
      item.translatedName?.name ||
      item.author_name ||
      `Tafsir #${id}`,
    languageName:
      item.language_name ||
      item.languageName ||
      item.language ||
      item.lang ||
      "",
  };
}

export default async function handler(req, res) {
  try {
    const [recitationsResult, tafsirsResult] = await Promise.allSettled([
      callContentApi("/content/api/v4/resources/recitations?language=en"),
      callContentApi("/content/api/v4/resources/tafsirs?language=en"),
    ]);

    const rawRecitations =
      recitationsResult.status === "fulfilled"
        ? asArray(recitationsResult.value, ["recitations"])
        : [];

    const rawTafsirs =
      tafsirsResult.status === "fulfilled"
        ? asArray(tafsirsResult.value, ["tafsirs"])
        : [];

    const recitations = rawRecitations
      .map(normalizeRecitation)
      .filter((item) => item.id && item.name);

    const tafsirs = rawTafsirs
      .map(normalizeTafsir)
      .filter((item) => item.id && item.name);

    return res.status(200).json({
      success: true,
      recitations: recitations.length ? recitations : FALLBACK_RECITATIONS,
      tafsirs: tafsirs.length ? tafsirs : FALLBACK_TAFSIRS,
      source: {
        recitations:
          recitationsResult.status === "fulfilled" ? "api" : "fallback",
        tafsirs: tafsirsResult.status === "fulfilled" ? "api" : "fallback",
      },
    });
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: error.message,
      recitations: FALLBACK_RECITATIONS,
      tafsirs: FALLBACK_TAFSIRS,
      source: {
        recitations: "fallback",
        tafsirs: "fallback",
      },
    });
  }
}
