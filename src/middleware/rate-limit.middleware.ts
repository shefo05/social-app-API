import rateLimit from "express-rate-limit";

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
  message: { message: "too many requests, please try again later", success: false },
});
