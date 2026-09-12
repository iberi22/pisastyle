-- D1 billing ledger — Fase pay-per-use 5% + vault 100% cifrado
-- Ejecutar: wrangler d1 execute swal-billing --file=./migrations/001_billing.sql
-- Si ya existe credits con tier 'socio', migrar a 'payg' via UPDATE.

CREATE TABLE IF NOT EXISTS credits (
  appId TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'payg',
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  appId TEXT NOT NULL,
  infra REAL NOT NULL,
  aiBase REAL NOT NULL,
  aiWithMargin REAL NOT NULL,
  handling REAL NOT NULL,
  total REAL NOT NULL,
  tokensUsed INTEGER NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY (appId) REFERENCES credits(appId)
);

CREATE INDEX IF NOT EXISTS idx_invoices_appId ON invoices(appId);

-- Vault 100% cifrado: meta de sealed packs (ciphertext en R2, solo hash+key en D1)
CREATE TABLE IF NOT EXISTS sealed_meta (
  id TEXT PRIMARY KEY,
  appId TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sealed_meta_app_instance ON sealed_meta(appId, instance_id);
CREATE INDEX IF NOT EXISTS idx_sealed_meta_entity ON sealed_meta(entity);
CREATE INDEX IF NOT EXISTS idx_sealed_meta_hash ON sealed_meta(content_hash);

-- Subscripciones pay-per-use (Stripe webhook)
CREATE TABLE IF NOT EXISTS subscriptions (
  instance_id TEXT PRIMARY KEY,
  appId TEXT NOT NULL,
  stripe_customer TEXT,
  stripe_sub TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  tier TEXT NOT NULL DEFAULT 'mesh-only',
  r2_quota_bytes INTEGER NOT NULL DEFAULT 10737418240,
  r2_used_bytes INTEGER NOT NULL DEFAULT 0,
  period_end INTEGER,
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_app ON subscriptions(appId);

-- Migracion legacy: socio -> payg, managed -> payg-managed
UPDATE credits SET tier='payg' WHERE tier='socio';
UPDATE credits SET tier='payg-managed' WHERE tier='managed';
UPDATE subscriptions SET tier='payg' WHERE tier='socio';
UPDATE subscriptions SET tier='payg-managed' WHERE tier='managed';
