// server/qfOAuth.js
// Quran.com OAuth and User API helpers.

import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const isProduction = process.env.NODE_ENV === "production";

export function getUserScopes() {
  return (
    process.env.QF_USER_SCOPES ||
    process.env.SCOPES ||
    "openid offline_access user bookmark collection reading_session activity_day streak goal preference"
  );
}

export function getAppUrl() {
  return (
    process.env.APP_URL || process.env.APP_BASE_URL || "http://localhost:3000"
  );
}

export function getRedirectUri() {
  return (
    process.env.QF_REDIRECT_URI ||
    process.env.REDIRECT_URI ||
    `${getAppUrl()}/api/qf-auth/callback`
  );
}

export function getQfAuthBaseUrl() {
  if (process.env.QF_OAUTH_BASE_URL) return process.env.QF_OAUTH_BASE_URL;

  return process.env.QF_ENV === "production"
    ? "https://oauth2.quran.foundation"
    : "https://prelive-oauth2.quran.foundation";
}

export function getQfApiBaseUrl() {
  if (process.env.QF_API_BASE_URL) return process.env.QF_API_BASE_URL;

  return process.env.QF_ENV === "production"
    ? "https://apis.quran.foundation"
    : "https://apis-prelive.quran.foundation";
}

export function getClientId() {
  return process.env.QF_CLIENT_ID || process.env.CLIENT_ID || "";
}

export function getClientSecret() {
  return process.env.QF_CLIENT_SECRET || process.env.CLIENT_SECRET || "";
}

export function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function randomString(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

export function createCodeChallenge(verifier) {
  return base64Url(crypto.createHash("sha256").update(verifier).digest());
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";

  return header.split(";").reduce((cookies, item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return cookies;

    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure ?? isProduction) parts.push("Secure");

  parts.push(`Path=${options.path || "/"}`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}

export function appendSetCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");

  if (!current) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, cookie]);
    return;
  }

  res.setHeader("Set-Cookie", [current, cookie]);
}

export function clearQfCookies(res) {
  [
    "qf_oauth_state",
    "qf_oauth_nonce",
    "qf_code_verifier",
    "qf_access_token",
    "qf_refresh_token",
    "qf_expires_at",
    "qf_id_token",
  ].forEach((name) => {
    appendSetCookie(
      res,
      serializeCookie(name, "", {
        maxAge: 0,
      }),
    );
  });
}

export function setTokenCookies(res, tokenData) {
  const expiresIn = Number(tokenData.expires_in || 3600);
  const expiresAt = Date.now() + expiresIn * 1000;

  appendSetCookie(
    res,
    serializeCookie("qf_access_token", tokenData.access_token, {
      maxAge: expiresIn,
    }),
  );

  if (tokenData.refresh_token) {
    appendSetCookie(
      res,
      serializeCookie("qf_refresh_token", tokenData.refresh_token, {
        maxAge: 60 * 60 * 24 * 30,
      }),
    );
  }

  if (tokenData.id_token) {
    appendSetCookie(
      res,
      serializeCookie("qf_id_token", tokenData.id_token, {
        maxAge: expiresIn,
      }),
    );
  }

  appendSetCookie(
    res,
    serializeCookie("qf_expires_at", String(expiresAt), {
      maxAge: 60 * 60 * 24 * 30,
    }),
  );
}

async function tokenRequest(body) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Missing QF_CLIENT_ID or QF_CLIENT_SECRET.");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${getQfAuthBaseUrl()}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body),
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text || "{}");
  } catch {
    throw new Error(`Token endpoint returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(
      json.error_description || json.error || "Token request failed.",
    );
  }

  return json;
}

export async function exchangeCodeForTokens({ code, codeVerifier }) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier,
  });
}

export async function refreshTokens(refreshToken) {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function getValidUserAccessToken(req, res) {
  const cookies = parseCookies(req);

  const accessToken = cookies.qf_access_token;
  const refreshToken = cookies.qf_refresh_token;
  const expiresAt = Number(cookies.qf_expires_at || 0);

  if (accessToken && expiresAt - Date.now() > 60_000) {
    return accessToken;
  }

  if (!refreshToken) return null;

  const refreshed = await refreshTokens(refreshToken);
  setTokenCookies(res, refreshed);

  return refreshed.access_token;
}

export async function qfRawUserApi(req, res, path, options = {}) {
  const accessToken = await getValidUserAccessToken(req, res);

  if (!accessToken) {
    return {
      status: 401,
      json: {
        success: false,
        connected: false,
        message: "Quran.com account is not connected.",
      },
      headers: {},
    };
  }

  const clientId = getClientId();

  const response = await fetch(`${getQfApiBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      "x-auth-token": accessToken,
      "x-client-id": clientId,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json;

  try {
    json = JSON.parse(text || "{}");
  } catch {
    json = {
      success: false,
      message: "Quran Foundation returned non-JSON response.",
      raw: text.slice(0, 300),
    };
  }

  return {
    status: response.status,
    json,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

export async function qfUserApi(req, res, path, options = {}) {
  const result = await qfRawUserApi(req, res, path, options);

  Object.entries(result.headers || {}).forEach(([key, value]) => {
    if (key.toLowerCase() === "x-mutation-at") {
      res.setHeader("X-Mutation-At", value);
    }
  });

  if (result.status >= 400 && options.softFail) {
    return res.status(200).json({
      success: true,
      softFailed: true,
      data: options.fallbackData ?? null,
      originalStatus: result.status,
      originalError: result.json,
    });
  }

  return res.status(result.status).json(result.json);
}

function redirectWithResult(res, params) {
  const url = new URL("/", getAppUrl());
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );

  return res.redirect(302, url.toString());
}

export async function handleCallback(req, res) {
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

export async function handleLogin(req, res) {
  const clientId = getClientId();

  if (!clientId) {
    return res.status(500).json({
      success: false,
      message: "Missing QF_CLIENT_ID.",
    });
  }

  const state = randomString(24);
  const nonce = randomString(24);
  const codeVerifier = randomString(64);
  const codeChallenge = createCodeChallenge(codeVerifier);

  appendSetCookie(
    res,
    serializeCookie("qf_oauth_state", state, { maxAge: 10 * 60 }),
  );
  appendSetCookie(
    res,
    serializeCookie("qf_oauth_nonce", nonce, { maxAge: 10 * 60 }),
  );
  appendSetCookie(
    res,
    serializeCookie("qf_code_verifier", codeVerifier, { maxAge: 10 * 60 }),
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: getUserScopes(),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return res.redirect(
    302,
    `${getQfAuthBaseUrl()}/oauth2/auth?${params.toString()}`,
  );
}

export function handleLogout(req, res) {
  clearQfCookies(res);

  return res.status(200).json({
    connected: false,
    success: true,
  });
}

export async function handleStatus(req, res) {
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
