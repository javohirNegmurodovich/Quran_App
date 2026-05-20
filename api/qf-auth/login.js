import {
  appendSetCookie,
  createCodeChallenge,
  getClientId,
  getQfAuthBaseUrl,
  getRedirectUri,
  getUserScopes,
  randomString,
  serializeCookie,
} from "../_qfOAuth.js";

export default async function handler(req, res) {
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
