// api/qf-user.js
// One Vercel Function for all Quran Foundation USER routes.
// Dispatch is controlled by ?route=... from vercel.json explicit rewrites.

import {
  handleActivityDay,
  handleAddBookmark,
  handleBookmarks,
  handleGoals,
  handleLearnedSurahs,
  handleProfile,
  handleReadingSessions,
  handleStreaks,
} from "../server/qfUser.js";

function getRoute(req) {
  return String(req.query?.route || "").trim();
}

export default async function handler(req, res) {
  const route = getRoute(req);

  if (route === "profile") return handleProfile(req, res);
  if (route === "bookmarks") return handleBookmarks(req, res);
  if (route === "add-bookmark") return handleAddBookmark(req, res);
  if (route === "learned-surahs") return handleLearnedSurahs(req, res);
  if (route === "reading-sessions") return handleReadingSessions(req, res);
  if (route === "activity-day") return handleActivityDay(req, res);
  if (route === "streaks") return handleStreaks(req, res);
  if (route === "goals") return handleGoals(req, res);

  return res.status(404).json({
    success: false,
    message: `Unknown user route: ${route}`,
    debug: {
      url: req.url,
      query: req.query,
      route,
    },
  });
}
