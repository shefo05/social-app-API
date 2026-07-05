import { OAuth2Client, TokenPayload } from "google-auth-library";
import { GOOGLE_CLIENT_ID } from "../../config";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verifies a Google ID token's signature, expiry, issuer, and audience
 * (must have been minted for our client id) via google-auth-library.
 * Throws on anything invalid/tampered/expired - callers don't need to
 * separately sanity-check the result before trusting its email/name/
 * picture claims.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Google token had no payload");
  return payload;
}
