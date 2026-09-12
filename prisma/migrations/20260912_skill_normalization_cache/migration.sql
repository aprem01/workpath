-- Deterministic normalization cache.
-- Additive only: creates one new table, touches no existing data.
CREATE TABLE IF NOT EXISTS "SkillNormalization" (
    "id"             TEXT NOT NULL,
    "rawInput"       TEXT NOT NULL,
    "domainId"       TEXT NOT NULL DEFAULT '',
    "normalizedTerm" TEXT NOT NULL,
    "payload"        TEXT NOT NULL,
    "safetyVersion"  INTEGER NOT NULL DEFAULT 1,
    "hitCount"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillNormalization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SkillNormalization_rawInput_domainId_key"
    ON "SkillNormalization"("rawInput", "domainId");

CREATE INDEX IF NOT EXISTS "SkillNormalization_normalizedTerm_idx"
    ON "SkillNormalization"("normalizedTerm");
