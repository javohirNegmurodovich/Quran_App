import {
  appendSetCookie,
  clearQfCookies,
  exchangeCodeForTokens,
  getAppUrl,
  parseCookies,
  serializeCookie,
  setTokenCookies,
} from "../_qfOAuth.js";

function redirectWithResult(res, params) {
  const url = new URL("/", getAppUrl());
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  return res.redirect(302, url.toString());
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    clearQfCookies(res);
    return redirectWithResult(res, { qf_error: error_description || error });
  }

  const cookies = parseCookies(req);

  if (!state || state !== cookies.qf_oauth_state) {
    clearQfCookies(res);
    return redirectWithResult(res, {
      qf_error: "Invalid OAuth state. Please connect again.",
    });
  }

  if (!code || !cookies.qf_code_verifier) {
    clearQfCookies(res);
    return redirectWithResult(res, {
      qf_error: "Missing OAuth code or PKCE verifier.",
    });
  }

  try {
    const tokenData = await exchangeCodeForTokens({
      code,
      codeVerifier: cookies.qf_code_verifier,
    });

    setTokenCookies(res, tokenData);

    appendSetCookie(res, serializeCookie("qf_oauth_state", "", { maxAge: 0 }));
    appendSetCookie(res, serializeCookie("qf_oauth_nonce", "", { maxAge: 0 }));
    appendSetCookie(
      res,
      serializeCookie("qf_code_verifier", "", { maxAge: 0 }),
    );

    return redirectWithResult(res, { qf_connected: "1" });
  } catch (err) {
    clearQfCookies(res);
    return redirectWithResult(res, {
      qf_error: err.message || "Quran.com connection failed.",
    });
  }
}
