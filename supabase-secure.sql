-- SECURE SUPABASE FIX FOR GDC FAUCET
-- 1. Lock down tables so clients cannot arbitrarily change their balances
ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."faucet_claims" ENABLE ROW LEVEL SECURITY;

-- Remove any previously created insecure write policies
DROP POLICY IF EXISTS "Allow public insert access" ON "public"."wallets";
DROP POLICY IF EXISTS "Allow public update access" ON "public"."wallets";
DROP POLICY IF EXISTS "Allow public insert access" ON "public"."transactions";
DROP POLICY IF EXISTS "Allow public update access" ON "public"."transactions";

-- Only allow public to read (SELECT) data
DROP POLICY IF EXISTS "Allow public read access" ON "public"."wallets";
CREATE POLICY "Allow public read access" ON "public"."wallets" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON "public"."transactions";
CREATE POLICY "Allow public read access" ON "public"."transactions" FOR SELECT USING (true);

-- 2. Create a secure, atomic stored procedure (RPC) for claiming the faucet.
-- SECURITY DEFINER allows this function to bypass RLS internally, giving coins 
-- without letting the client directly mess with the `wallets` table.
CREATE OR REPLACE FUNCTION claim_faucet(target_pubkey text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    daily_claims int;
    current_balance numeric;
    pool_pubkey text := 'U2FsdGVkX1/9xR5Lm8Q3jHp2vK4wJc7aB6yN0mE4tY8=';
BEGIN
    -- Check if user already claimed today
    SELECT count(*) INTO daily_claims 
    FROM faucet_claims 
    WHERE pubkey = target_pubkey 
      AND claim_date = CURRENT_DATE;
      
    IF daily_claims > 0 THEN
        RAISE EXCEPTION 'Faucet already claimed today for this wallet.';
    END IF;

    -- Insert claim log
    INSERT INTO faucet_claims (pubkey, claim_date, amount)
    VALUES (target_pubkey, CURRENT_DATE, 50);

    -- Upsert the wallet balance
    INSERT INTO wallets (pubkey, balance, created_at)
    VALUES (target_pubkey, 50, NOW())
    ON CONFLICT (pubkey)
    DO UPDATE SET balance = wallets.balance + 50;

    -- Fetch the updated balance
    SELECT balance INTO current_balance FROM wallets WHERE pubkey = target_pubkey;

    -- Deduct from pool if you want, or just log the transaction
    INSERT INTO transactions (tx_hash, from_pubkey, to_pubkey, amount, status, created_at)
    VALUES (
        md5(random()::text || clock_timestamp()::text), -- Generate unique dummy tx_hash
        pool_pubkey,
        target_pubkey,
        50,
        'confirmed',
        NOW()
    );

    RETURN json_build_object('success', true, 'newBalance', current_balance);
END;
$$;
