// api/qf.js
// One Vercel Function for all Quran Foundation CONTENT routes.
// Dispatch is controlled by ?route=... from vercel.json explicit rewrites.

import {
  handleChapters,
  handleResources,
  handleSurah,
} from "../server/qf.js";

function getRoute(req) {
  return String(req.query?.route || "").trim();
}

export default async function handler(req, res) {
  const route = getRoute(req);

  if (route === "chapters") return handleChapters(req, res);
  if (route === "resources") return handleResources(req, res);
  if (route === "surah") return handleSurah(req, res);

  return res.status(404).json({
    success: false,
    message: `Unknown content route: ${route}`,
    debug: {
      url: req.url,
      query: req.query,
      route,
    },
  });
}
