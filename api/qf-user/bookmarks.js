import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
  const type = req.query.type || "ayah";
  const mushafId = req.query.mushafId || "4";
  const requestedFirst = Number(req.query.first || 20);
  const first = Math.min(Math.max(requestedFirst || 20, 1), 20);

  return qfUserApi(
    req,
    res,
    `/auth/v1/bookmarks?type=${encodeURIComponent(type)}&mushafId=${encodeURIComponent(mushafId)}&first=${first}`,
  );
}
