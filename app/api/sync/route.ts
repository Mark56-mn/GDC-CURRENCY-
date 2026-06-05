import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { payload } = await req.json();
    // Re-import supabase if needed
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const sb = createClient(supabaseUrl, supabaseKey);

    try {
      const { data, error } = await sb.functions.invoke('sync-batch', {
        body: { payload }
      });
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    } catch (edgeErr: any) {
      console.warn("Edge function sync-batch failed remotely, executing via direct postgres:", edgeErr.message);

      const fromPubkey = payload.from_pubkey;
      const toPubkey = payload.to_pubkey;
      const amount = Number(payload.amount);
      
      const { data: fromBalData } = await sb.from('balances').select('balance').eq('pubkey', fromPubkey).single();
      const fromBalance = fromBalData?.balance || 0;
      
      if (fromBalance < amount) {
        return NextResponse.json({ error: "Insufficient funds" }, { status: 400 });
      }

      const { data: toBalData } = await sb.from('balances').select('balance').eq('pubkey', toPubkey).single();
      const toBalance = toBalData?.balance || 0;

      await sb.from('balances').upsert({ pubkey: fromPubkey, balance: fromBalance - amount });
      await sb.from('balances').upsert({ pubkey: toPubkey, balance: toBalance + amount });

      const { error: txError } = await sb.from('transactions').insert({
        from_pubkey: fromPubkey,
        to_pubkey: toPubkey,
        amount: amount,
        status: 'confirmed'
      });
      
      if (txError) {
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
