-- Down restores the pre-backfill state (NULL issuer on credential accounts).
-- WARNING: running this while better-auth >= 1.7.x is deployed breaks sign-in.
UPDATE "accounts" SET "issuer" = NULL
WHERE "provider_id" = 'credential' AND "issuer" = 'local:credential';
