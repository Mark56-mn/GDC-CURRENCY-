-- Temporary RLS policies for prototyping (INSECURE FOR PRODUCTION)
-- These policies allow the client-side JavaScript to insert and update balances
-- directly when the Edge Function fails. 

-- Enable RLS on tables
ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;

-- Wallets RLS Policies
DROP POLICY IF EXISTS "Allow public read access" ON "public"."wallets";
CREATE POLICY "Allow public read access" ON "public"."wallets"
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON "public"."wallets";
CREATE POLICY "Allow public insert access" ON "public"."wallets"
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access" ON "public"."wallets";
CREATE POLICY "Allow public update access" ON "public"."wallets"
FOR UPDATE USING (true);

-- Transactions RLS Policies 
DROP POLICY IF EXISTS "Allow public read access" ON "public"."transactions";
CREATE POLICY "Allow public read access" ON "public"."transactions"
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON "public"."transactions";
CREATE POLICY "Allow public insert access" ON "public"."transactions"
FOR INSERT WITH CHECK (true);
