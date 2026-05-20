import { getValidUserAccessToken, parseCookies } from "../_qfOAuth.js";

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req);
    const accessToken = await getValidUserAccessToken(req, res);

    return res.status(200).json({
      connected: Boolean(accessToken),
      hasAccessCookie: Boolean(cookies.qf_access_token),
      hasRefreshCookie: Boolean(cookies.qf_refresh_token),
      expiresAt: cookies.qf_expires_at || null,
    });
  } catch (error) {
    return res.status(200).json({
      connected: false,
      message: error.message,
    });
  }
}
