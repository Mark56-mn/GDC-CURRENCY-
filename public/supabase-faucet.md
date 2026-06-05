# Supabase Faucet Setup

## 1. Create the `faucet_claims` Table
Run this SQL in your Supabase SQL Editor to create the table that tracks claims.

```sql
CREATE TABLE public.faucet_claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pubkey text NOT NULL,
  claimed_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for quick lookups
CREATE INDEX idx_faucet_claims_pubkey ON public.faucet_claims(pubkey);

-- Optional: RLS policies (only edge function Service Role will insert)
ALTER TABLE public.faucet_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.faucet_claims FOR SELECT USING (true);
```

## 2. Deploy the `faucet` Edge Function

Create a new file in `supabase/functions/faucet/index.ts` and deploy it.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pubkey } = await req.json();

    if (!pubkey) {
      return new Response(JSON.stringify({ error: 'pubkey is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client with Service Role to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Check if user claimed in the last 24 hours
    const { data: recentClaim, error: claimError } = await supabaseClient
      .from('faucet_claims')
      .select('*')
      .eq('pubkey', pubkey)
      .gte('claimed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .single();

    if (recentClaim) {
      return new Response(JSON.stringify({ error: 'Faucet already claimed in the last 24 hours' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Insert new claim record
    const { error: insertError } = await supabaseClient
      .from('faucet_claims')
      .insert([{ pubkey }]);

    if (insertError) {
      throw new Error(`Failed to record claim: ${insertError.message}`);
    }

    // 3. Increment user's balance
    // This assumes there's an RPC or you update the balance table directly
    const amountToGive = 50;
    const { data: balanceData, error: balanceError } = await supabaseClient.rpc('increment_balance', {
      p_pubkey: pubkey,
      p_amount: amountToGive
    });

    if (balanceError) {
      throw new Error(`Failed to increment balance: ${balanceError.message}`);
    }

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Claimed 50 GDC', 
        newBalance: balanceData 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```
