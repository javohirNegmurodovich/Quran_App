import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const requestedFirst = Number(req.query.first || 20);
    const first = Math.min(Math.max(requestedFirst || 20, 1), 20);

    return qfUserApi(
      req,
      res,
      `/auth/v1/bookmarks?type=surah&mushafId=4&first=${first}`,
      { softFail: true, fallbackData: [] },
    );
  }

  if (req.method === "POST") {
    const { surahNumber } = req.body || {};
    const number = Number(surahNumber);

    if (!number || number < 1 || number > 114) {
      return res.status(400).json({ success: false, message: "Valid surahNumber is required." });
    }

    return qfUserApi(req, res, "/auth/v1/collections/__default__/bookmarks", {
      method: "POST",
      body: { type: "surah", key: number, mushafId: 4 },
    });
  }

  if (req.method === "DELETE") {
    const { surahNumber } = req.body || {};
    const number = Number(surahNumber);

    if (!number || number < 1 || number > 114) {
      return res.status(400).json({ success: false, message: "Valid surahNumber is required." });
    }

    return qfUserApi(req, res, "/auth/v1/collections/__default__/bookmarks", {
      method: "DELETE",
      body: { type: "surah", key: number, mushafId: 4 },
      softFail: true,
      fallbackData: [],
    });
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
