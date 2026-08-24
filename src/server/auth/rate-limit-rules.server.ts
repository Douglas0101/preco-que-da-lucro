// Differentiated rate-limit buckets for sensitive auth endpoints (plan §20.5).
// Keys are matched by exact path unless they contain "*" (Better Auth wildcard).
export const AUTH_RATE_LIMIT_RULES = {
  // Login brute-force protection: 5 attempts per minute per IP.
  "/sign-in/email": { window: 60, max: 5 },
  // Sign-up throttling: 3 accounts per minute per IP.
  "/sign-up/email": { window: 60, max: 3 },
  // Password reset request: 3 emails per 15 minutes per IP (spam/enumeration guard).
  "/forget-password*": { window: 900, max: 3 },
  // Reset confirmation is not covered by any default special rule; keep it tight too.
  "/reset-password": { window: 300, max: 10 },
} as const;

export type AuthRateLimitRules = typeof AUTH_RATE_LIMIT_RULES;
