import { createSign } from 'crypto';

/** A Google service-account key file (the JSON you download from Google Cloud). */
export type ServiceAccount = { client_email: string; private_key: string };

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/**
 * Exchange a service-account key for a short-lived OAuth access token (JWT-bearer grant).
 * Uses Node crypto to sign an RS256 JWT — no google-auth-library dependency.
 */
export async function getGoogleAccessToken(sa: ServiceAccount, scope: string): Promise<string> {
  if (!sa?.client_email || !sa?.private_key) {
    throw new Error('Invalid service account — missing client_email/private_key.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  // private_key must contain real newlines; JSON.parse of the key file restores them.
  const signature = b64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('Google token exchange returned no access_token.');
  return body.access_token;
}
