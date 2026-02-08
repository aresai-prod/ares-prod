import { OAuth2Client } from "google-auth-library";

export type GoogleProfile = {
  email: string;
  name: string;
};

function getClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.");
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(appOrigin: string): string {
  const client = getClient();
  const scopes = ["openid", "email", "profile"];
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  return client.generateAuthUrl({
    scope: scopes,
    redirect_uri: redirectUri,
    access_type: "offline",
    prompt: "consent",
    response_type: "code",
    state: appOrigin
  });
}

export async function getGoogleProfile(code: string): Promise<GoogleProfile> {
  const client = getClient();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.id_token) {
    throw new Error("Missing id_token from Google.");
  }
  return getGoogleProfileFromIdToken(tokens.id_token);
}

export async function getGoogleProfileFromIdToken(idToken: string): Promise<GoogleProfile> {
  const client = getClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error("Google profile email is missing.");
  }
  return {
    email: payload.email,
    name: payload.name ?? "Google User"
  };
}

export async function getGoogleProfileFromAccessToken(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error("Google userinfo request failed.");
  }
  const payload = (await response.json()) as { email?: string; name?: string };
  if (!payload.email) {
    throw new Error("Google profile email is missing.");
  }
  return {
    email: payload.email,
    name: payload.name ?? "Google User"
  };
}
