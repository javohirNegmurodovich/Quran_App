// api/_qf.js
import crypto from "node:crypto";

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const AUTH_BASE_BY_ENV = {
  prelive: "https://prelive-oauth2.quran.foundation",
  production: "https://oauth2.quran.foundation",
};

const API_BASE_BY_ENV = {
  prelive: "https://apis-prelive.quran.foundation",
  production: "https://apis.quran.foundation",
};

export function getConfig() {
  const env = process.env.QF_ENV || "prelive";

  return {
    env,
    authBase: AUTH_BASE_BY_ENV[env],
    apiBase: API_BASE_BY_ENV[env],
    clientId: process.env.QF_CLIENT_ID,
    clientSecret: process.env.QF_CLIENT_SECRET,
    appUrl: process.env.APP_URL,
    scopes: process.env.QF_SCOPES || "openid offline_access bookmark",
  };
}

function basicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function createPkcePair() {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(
    crypto.createHash("sha256").update(codeVerifier).digest(),
  );

  return { codeVerifier, codeChallenge };
}

export function randomToken() {
  return base64Url(crypto.randomBytes(24));
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [
          decodeURIComponent(part.slice(0, index)),
          decodeURIComponent(part.slice(index + 1)),
        ];
      }),
  );
}

export function setCookie(res, name, value, maxAgeSeconds) {
  const isProduction = process.env.NODE_ENV === "production";

  const cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  const previous = res.getHeader("Set-Cookie");
  const next = previous ? [].concat(previous, cookie) : cookie;

  res.setHeader("Set-Cookie", next);
}

export function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}

export function encodeSession(data) {
  return base64Url(Buffer.from(JSON.stringify(data)));
}

export function decodeSession(value) {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

let contentTokenCache = {
  accessToken: null,
  expiresAt: 0,
};

export async function getContentToken() {
  const { authBase, clientId, clientSecret } = getConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Missing QF_CLIENT_ID or QF_CLIENT_SECRET");
  }

  const now = Date.now();

  if (
    contentTokenCache.accessToken &&
    contentTokenCache.expiresAt > now + 60_000
  ) {
    return contentTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "content",
  });

  const response = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Content token failed: ${response.status} ${errorText}`);
  }

  const token = await response.json();

  contentTokenCache = {
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in || 3600) * 1000,
  };

  return token.access_token;
}

export async function callContentApi(path) {
  const { apiBase, clientId } = getConfig();
  const accessToken = await getContentToken();

  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      "x-auth-token": accessToken,
      "x-client-id": clientId,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QF Content API failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function exchangeCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
}) {
  const { authBase, clientId, clientSecret } = getConfig();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

export function getUserSession(req) {
  const cookies = parseCookies(req);
  return decodeSession(cookies.qf_session);
}

export async function callUserApi(req, path, options = {}) {
  const session = getUserSession(req);
  const { apiBase, clientId } = getConfig();

  if (!session?.access_token) {
    const error = new Error("Not authenticated");
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers: {
      "x-auth-token": session.access_token,
      "x-client-id": clientId,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error("QF User API failed");
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function decodeJwtPayload(token) {
  if (!token) return null;

  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
}
