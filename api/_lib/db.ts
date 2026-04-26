import { sql } from "@vercel/postgres";

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id    TEXT PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT '',
      city       TEXT NOT NULL DEFAULT 'Phoenix',
      home_size  TEXT NOT NULL DEFAULT 'Medium',
      appliances JSONB NOT NULL DEFAULT '[]'::jsonb,
      wake_hour  INTEGER NOT NULL DEFAULT 7,
      sleep_hour INTEGER NOT NULL DEFAULT 23,
      onboarded  BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS check_ins (
      user_id        TEXT NOT NULL,
      date           DATE NOT NULL,
      usages         JSONB NOT NULL DEFAULT '[]'::jsonb,
      per_appliance  JSONB NOT NULL DEFAULT '[]'::jsonb,
      total_lbs      NUMERIC NOT NULL DEFAULT 0,
      saved_lbs      NUMERIC NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, date)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_check_ins_user_date ON check_ins(user_id, date DESC);`;
  initialized = true;
}

export { sql };
