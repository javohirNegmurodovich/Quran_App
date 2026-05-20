import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { surahNumber, ayahNumber } = req.body || {};
  const chapter = Number(surahNumber);
  const verseNumber = Number(ayahNumber);

  if (!chapter || !verseNumber) {
    return res.status(400).json({
      success: false,
      message: "surahNumber and ayahNumber are required.",
    });
  }

  return qfUserApi(req, res, "/auth/v1/collections/__default__/bookmarks", {
    method: "POST",
    body: {
      type: "ayah",
      key: chapter,
      verseNumber,
      mushafId: 4,
    },
  });
}
