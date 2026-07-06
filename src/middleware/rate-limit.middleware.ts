import rateLimit from "express-rate-limit";

/**
 * Local-only escape hatch for automated test runs (Playwright etc.) that
 * legitimately create/log into several accounts per run and blow through
 * the cap. Deliberately double-gated rather than a single flag:
 *   - RATE_LIMIT_DISABLED=true is the explicit opt-in - never set in
 *     render.yaml, so it's simply undefined on Render regardless of what
 *     ends up in a local .env.
 *   - NODE_ENV !== "production" is the structural backstop - render.yaml
 *     pins NODE_ENV=production explicitly (not left to Render's default,
 *     whatever that happens to be), so even if RATE_LIMIT_DISABLED were
 *     ever mistakenly set on Render, this second condition still fails
 *     and the limiter stays fully active.
 * Both must hold; neither alone disables anything.
 */
function isRateLimitExempt(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.RATE_LIMIT_DISABLED === "true"
  );
}

/**
 * Shared limiter for the auth endpoints an attacker would actually want
 * to hammer: login (password guessing), signup/send-otp/verify-account/
 * forgot-password/reset-password-confirm (OTP guessing or spam), and
 * google (token-verification spam). One instance, applied at each of
 * those route registrations - not a bespoke config per route.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitExempt(),
  message: { message: "too many requests, please try again later", success: false },
});
