import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
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

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
