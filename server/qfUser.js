// server/qfUser.js
// Quran Foundation User API handlers.
// Called by api/qf-user.js.

import { qfUserApi } from "./qfOAuth.js";

export async function handleProfile(req, res) {
  return qfUserApi(req, res, "/auth/v1/users/profile?qdc=true", {
    softFail: true,
    fallbackData: null,
  });
}

export async function handleBookmarks(req, res) {
  const type = req.query.type || "ayah";
  const mushafId = req.query.mushafId || "4";
  const requestedFirst = Number(req.query.first || 20);
  const first = Math.min(Math.max(requestedFirst || 20, 1), 20);

  return qfUserApi(
    req,
    res,
    `/auth/v1/bookmarks?type=${encodeURIComponent(
      type,
    )}&mushafId=${encodeURIComponent(mushafId)}&first=${first}`,
    {
      softFail: true,
      fallbackData: [],
    },
  );
}

export async function handleAddBookmark(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
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

export async function handleLearnedSurahs(req, res) {
  if (req.method === "GET") {
    const requestedFirst = Number(req.query.first || 20);
    const first = Math.min(Math.max(requestedFirst || 20, 1), 20);

    return qfUserApi(
      req,
      res,
      `/auth/v1/bookmarks?type=surah&mushafId=4&first=${first}`,
      {
        softFail: true,
        fallbackData: [],
      },
    );
  }

  if (req.method === "POST") {
    const { surahNumber } = req.body || {};
    const number = Number(surahNumber);

    if (!number || number < 1 || number > 114) {
      return res.status(400).json({
        success: false,
        message: "Valid surahNumber is required.",
      });
    }

    return qfUserApi(req, res, "/auth/v1/collections/__default__/bookmarks", {
      method: "POST",
      body: {
        type: "surah",
        key: number,
        mushafId: 4,
      },
    });
  }

  if (req.method === "DELETE") {
    const { surahNumber } = req.body || {};
    const number = Number(surahNumber);

    if (!number || number < 1 || number > 114) {
      return res.status(400).json({
        success: false,
        message: "Valid surahNumber is required.",
      });
    }

    return qfUserApi(req, res, "/auth/v1/collections/__default__/bookmarks", {
      method: "DELETE",
      body: {
        type: "surah",
        key: number,
        mushafId: 4,
      },
      softFail: true,
      fallbackData: [],
    });
  }

  return res.status(405).json({
    success: false,
    message: "Method not allowed.",
  });
}

export async function handleReadingSessions(req, res) {
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
      return res.status(400).json({
        success: false,
        message: "chapterNumber and verseNumber are required.",
      });
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

  return res.status(405).json({
    success: false,
    message: "Method not allowed.",
  });
}

export async function handleActivityDay(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
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
    headers: {
      "x-timezone": req.headers["x-timezone"] || "Asia/Tashkent",
    },
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

export async function handleStreaks(req, res) {
  return qfUserApi(
    req,
    res,
    "/auth/v1/streaks?type=QURAN&status=ACTIVE&first=20&orderBy=startDate&sortOrder=desc",
    {
      softFail: true,
      fallbackData: [],
    },
  );
}

export async function handleGoals(req, res) {
  if (req.method === "GET") {
    return qfUserApi(req, res, "/auth/v1/goals?first=20", {
      softFail: true,
      fallbackData: [],
    });
  }

  if (req.method === "POST") {
    return qfUserApi(req, res, "/auth/v1/goals", {
      method: "POST",
      body: req.body || {},
      softFail: true,
      fallbackData: null,
    });
  }

  return res.status(405).json({
    success: false,
    message: "Method not allowed.",
  });
}
