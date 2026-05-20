// server/_qf.js
// Shared Quran Foundation Content API helpers only.
// Do not put route handlers in this file.

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

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function getConfig() {
  const env = readEnv("QF_ENV") || "prelive";

  return {
    env,
    authBase: AUTH_BASE_BY_ENV[env] || AUTH_BASE_BY_ENV.prelive,
    apiBase: API_BASE_BY_ENV[env] || API_BASE_BY_ENV.prelive,
    clientId: readEnv("QF_CLIENT_ID", "CLIENT_ID"),
    clientSecret: readEnv("QF_CLIENT_SECRET", "CLIENT_SECRET"),
  };
}

function basicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

let contentTokenCache = {
  accessToken: null,
  expiresAt: 0,
};

export async function getContentToken() {
  const { authBase, clientId, clientSecret } = getConfig();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing QF_CLIENT_ID/QF_CLIENT_SECRET or CLIENT_ID/CLIENT_SECRET.",
    );
  }

  if (
    contentTokenCache.accessToken &&
    contentTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return contentTokenCache.accessToken;
  }

  const response = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "content",
    }),
  });

  const text = await response.text();

  let token;
  try {
    token = JSON.parse(text || "{}");
  } catch {
    throw new Error(`Content token returned non-JSON: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(
      `Content token failed: ${response.status} ${JSON.stringify(token)}`,
    );
  }

  contentTokenCache = {
    accessToken: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
  };

  return contentTokenCache.accessToken;
}

export async function callContentApi(path) {
  const { apiBase, clientId } = getConfig();
  const accessToken = await getContentToken();

  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      "x-auth-token": accessToken,
      "x-client-id": clientId,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text || "{}");
  } catch {
    throw new Error(`QF Content API returned non-JSON: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(
      `QF Content API failed: ${response.status} ${JSON.stringify(data)}`,
    );
  }

  return data;
}
