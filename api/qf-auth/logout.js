import { clearQfCookies } from "../_qfOAuth.js";

export default function handler(req, res) {
  clearQfCookies(res);
  return res.status(200).json({ connected: false, success: true });
}
