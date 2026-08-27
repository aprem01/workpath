-- Caroline 8/23 Round 8: password hash + PII columns on User.
-- Additive only — no drops. Column-level nullability defaults so the
-- migration is safe to apply against a live table.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "firstName"    TEXT,
  ADD COLUMN IF NOT EXISTS "lastName"     TEXT,
  ADD COLUMN IF NOT EXISTS "phone"        TEXT;
