-- ============================================================
-- BankScan Database Setup
-- Run this in your Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS guards.
-- ============================================================

-- 1. Create the Statements table
CREATE TABLE IF NOT EXISTS statements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename TEXT NOT NULL,
  classifier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  bank TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  description TEXT,
  statement_id UUID REFERENCES statements(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. If the transactions table already existed (older setup), add the missing column:
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES statements(id) ON DELETE CASCADE;

-- 4. Enable Row Level Security
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'statements' AND policyname = 'Allow public read access on statements'
  ) THEN
    CREATE POLICY "Allow public read access on statements"
      ON statements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow public read access on transactions'
  ) THEN
    CREATE POLICY "Allow public read access on transactions"
      ON transactions FOR SELECT USING (true);
  END IF;
END $$;

-- 6. Force PostgREST to reload its schema cache (fixes "column not found in schema cache" errors)
NOTIFY pgrst, 'reload schema';
