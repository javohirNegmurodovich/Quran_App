// api/qf-auth.js
// One Vercel Function for all Quran.com OAuth routes.
// Dispatch is controlled by ?route=... from vercel.json explicit rewrites.

import {
  handleCallback,
  handleLogin,
  handleLogout,
  handleStatus,
} from "../server/qfOAuth.js";

function getRoute(req) {
  return String(req.query?.route || "").trim();
}

export default async function handler(req, res) {
  const route = getRoute(req);

  if (route === "login") return handleLogin(req, res);
  if (route === "callback") return handleCallback(req, res);
  if (route === "status") return handleStatus(req, res);
  if (route === "logout") return handleLogout(req, res);

  return res.status(404).json({
    success: false,
    message: `Unknown auth route: ${route}`,
    debug: {
      url: req.url,
      query: req.query,
      route,
    },
  });
}
