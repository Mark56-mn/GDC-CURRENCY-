import { supabase } from './supabase.js';

let mockBalance = 0;
let mockTransactions = [];

function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return url && !url.includes('placeholder.supabase.co');
}

export async function signUp(email, password) {
  if (!isConfigured()) {
    mockBalance = 0;
    mockTransactions = [];
    return { id: `local-user-${Date.now()}` };
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function login(email, password) {
  if (!isConfigured()) {
    return { id: `local-user-demo` };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function logout() {
  if (isConfigured()) {
    await supabase.auth.signOut();
  }
}

export async function getSessionUser() {
  if (!isConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

export async function getBalance(pubkey) {
  if (!isConfigured()) return mockBalance;

  const { data, error } = await supabase
    .from('balances')
    .select('balance')
    .eq('pubkey', pubkey)
    .single();

  if (error) {
    return 0; // default to 0 on error / if not exists
  }
  
  return data?.balance || 0;
}

export async function sendTransaction(toPubkey, amount, currentPubkey) {
  if (!isConfigured()) {
    console.warn("Supabase not configured. Simulating transaction locally.");
    if (mockBalance < amount) {
      throw new Error("Insufficient funds (simulated)");
    }
    mockBalance -= amount;
    const tx = {
      id: Math.random().toString(36).substring(2, 10),
      from_pubkey: currentPubkey,
      to_pubkey: toPubkey,
      amount: amount,
      created_at: new Date().toISOString(),
      status: 'confirmed'
    };
    mockTransactions.unshift(tx);
    return { success: true };
  }

  const payload = {
    from_pubkey: currentPubkey,
    to_pubkey: toPubkey,
    amount: amount,
    timestamp: new Date().toISOString()
  };

  const { data, error } = await supabase.functions.invoke('sync-batch', {
    body: { payload }
  });

  if (error) {
    console.error('Transaction submission failed:', error);
    throw new Error(error.message || 'Failed to submit transaction to Edge Function');
  }

  return data;
}

export async function requestFaucet(pubkey) {
  if (!isConfigured()) {
    console.warn("Supabase not configured. Simulating Faucet locally.");
    mockBalance += 50;
    mockTransactions.unshift({
      id: Math.random().toString(36).substring(2, 10),
      from_pubkey: 'GDC_FAUCET_NODE_TESTNET',
      to_pubkey: pubkey,
      amount: 50,
      created_at: new Date().toISOString(),
      status: 'confirmed'
    });
    return { success: true, newBalance: mockBalance };
  }

  const { data, error } = await supabase.functions.invoke('faucet', {
    body: { pubkey }
  });

  if (error) {
    console.error('Faucet request failed:', error);
    throw new Error(error.message || 'Failed to request faucet from Edge Function');
  }
  return data;
}

export async function getTransactionHistory(pubkey, limit = 20) {
  if (!isConfigured()) {
    return mockTransactions.slice(0, limit);
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`from_pubkey.eq.${pubkey},to_pubkey.eq.${pubkey}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code) {
      console.warn('Transaction history fetch warning (database may not be seeded):', error.message);
    } else {
      console.error('Error fetching transaction history:', error);
    }
    return [];
  }

  return data;
}
