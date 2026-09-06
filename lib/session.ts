import crypto from "crypto";

/**
 * Session cookie signing + verification. Moved out of the login route
 * because Next.js API route files can only export the HTTP method
 * handlers — any extra exports fail the build.
 */
// SESSION_SECRET must be set explicitly. In production we refuse to
// boot without it — anyone who learns the fallback derivation could
// forge sessions. In development we accept a fallback so `npm run dev`
// still works out of the box.
// Resolved LAZILY at first use, not at module load. `next build` collects
// page data by importing route modules under NODE_ENV=production, and a
// module-load throw when SESSION_SECRET is absent locally fails the build
// even though the deployed environment has the var. Deferring the check to
// call-time keeps the production guarantee (any real request without the
// secret still throws) while letting the build succeed.
let _secret: string | null = null;
function getSessionSecret(): string {
  if (_secret) return _secret;
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.length >= 32) {
    _secret = envSecret;
    return _secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET env var is required in production (min 32 chars)."
    );
  }
  // Dev-only fallback — never used in a deployed environment.
  _secret = crypto
    .createHash("sha256")
    .update("payranker-dev-only-secret")
    .digest("hex");
  return _secret;
}

const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export function signSessionCookie(handle: string): {
  value: string;
  expires: Date;
} {
  const expires = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);
  const payload = `${handle}.${expires.getTime()}`;
  const hmac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
  return { value: `${payload}.${hmac}`, expires };
}

export function verifySessionCookie(raw: string | null | undefined): {
  handle: string;
} | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [handle, expiryStr, sig] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(`${handle}.${expiryStr}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? { handle } : null;
}

export function extractSessionFromCookieHeader(cookieHeader: string | null): {
  handle: string;
} | null {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("payranker_session="))
    ?.slice("payranker_session=".length);
  return verifySessionCookie(raw);
}
