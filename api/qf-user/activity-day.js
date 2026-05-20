import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { surahNumber, fromAyah, toAyah, seconds = 30 } = req.body || {};
  if (!surahNumber || !fromAyah || !toAyah) {
    return res.status(400).json({
      success: false,
      message: "surahNumber, fromAyah, and toAyah are required.",
    });
  }

  return qfUserApi(req, res, "/auth/v1/activity-days", {
    method: "POST",
    headers: { "x-timezone": req.headers["x-timezone"] || "Asia/Tashkent" },
    body: {
      type: "QURAN",
      seconds: Math.max(1, Number(seconds)),
      ranges: [`${surahNumber}:${fromAyah}-${surahNumber}:${toAyah}`],
      mushafId: 4,
    },
    softFail: true,
    fallbackData: null,
  });
}
