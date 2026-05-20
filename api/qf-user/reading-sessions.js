import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const requestedFirst = Number(req.query.first || 20);
    const first = Math.min(Math.max(requestedFirst || 20, 1), 20);
    return qfUserApi(req, res, `/auth/v1/reading-sessions?first=${first}`, {
      softFail: true,
      fallbackData: [],
    });
  }

  if (req.method === "POST") {
    const { chapterNumber, verseNumber } = req.body || {};
    if (!chapterNumber || !verseNumber) {
      return res.status(400).json({ success: false, message: "chapterNumber and verseNumber are required." });
    }
    return qfUserApi(req, res, "/auth/v1/reading-sessions", {
      method: "POST",
      body: {
        chapterNumber: Number(chapterNumber),
        verseNumber: Number(verseNumber),
      },
      softFail: true,
      fallbackData: null,
    });
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
