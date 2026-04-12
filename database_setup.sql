-- Run this script in your Supabase SQL Editor

CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  bank TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security) and add a policy if you want it accessible from the client.
-- Since we do server-side inserts with the service_role key, minimal RLS is needed for backend access.
-- But for the client, if we want to read data directly, enable read access.

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON transactions
  FOR SELECT
  USING (true);
