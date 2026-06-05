import { supabase } from './supabase.js';
import { savePendingTransaction } from './db.js';

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

  if (!navigator.onLine) {
    await savePendingTransaction({ payload, status: 'pending' });
    try {
      const swRegistration = await navigator.serviceWorker.ready;
      if (swRegistration.sync) {
        await swRegistration.sync.register('sync-transactions');
      }
    } catch (err) {
      console.warn("Background Sync not supported");
    }
    return { success: true, offline: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sync-batch', {
      body: { payload }
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn("Edge function sync-batch failed, executing directly:", err.message);
    const fromBalance = await getBalance(currentPubkey);
    if (fromBalance < amount) {
      throw new Error("Insufficient funds");
    }
    const toBalance = await getBalance(toPubkey);
    
    // Updates
    await supabase.from('balances').upsert({ pubkey: currentPubkey, balance: fromBalance - amount });
    await supabase.from('balances').upsert({ pubkey: toPubkey, balance: toBalance + amount });
    
    const { error: txError } = await supabase.from('transactions').insert({
      from_pubkey: currentPubkey,
      to_pubkey: toPubkey,
      amount: amount,
      status: 'confirmed'
    });
    
    if (txError) {
      throw new Error("Transaction submission failed: " + txError.message);
    }
    return { success: true };
  }
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

  try {
    const { data, error } = await supabase.functions.invoke('faucet', {
      body: { pubkey }
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn("Edge function faucet failed, executing directly:", err.message);
    const currentBalance = await getBalance(pubkey);
    
    // Updates
    const { error: upsertError } = await supabase.from('balances').upsert({ pubkey, balance: currentBalance + 50 });
    if (upsertError) {
      throw new Error("Failed to process faucet request directly: " + upsertError.message);
    }
    
    await supabase.from('transactions').insert({
      from_pubkey: 'GDC_FAUCET_NODE_TESTNET',
      to_pubkey: pubkey,
      amount: 50,
      status: 'confirmed'
    });
    
    return { success: true, newBalance: currentBalance + 50 };
  }
}

export async function registerNode(ownerPubkey) {
  if (typeof window === 'undefined') return null;
  let deviceId = localStorage.getItem('gdc_device_id');
  if (!deviceId) {
    deviceId = `node-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
    localStorage.setItem('gdc_device_id', deviceId);
  }

  if (!isConfigured()) {
    return { device_id: deviceId, rewards_earned: 0, strikes: 0, frozen: false };
  }

  try {
    const { data, error } = await supabase.functions.invoke('register-node', {
      body: { device_id: deviceId, pubkey: ownerPubkey }
    });
    if (error) throw error;
    if (data) return data;
  } catch (err) {
    console.warn("Edge function register-node failed, executing directly:", err.message);
  }

  // Fallback to direct supabase call
  const { data: existing } = await supabase
    .from('nodes')
    .select('*')
    .eq('device_id', deviceId)
    .single();
  
  if (existing) return existing;

  const { data, error: insErr } = await supabase
    .from('nodes')
    .insert({ device_id: deviceId, owner_pubkey: ownerPubkey, rewards_earned: 0, strikes: 0, frozen: false })
    .select()
    .single();

  if (insErr) {
    console.warn("Could not insert node, table may not exist:", insErr);
    return { device_id: deviceId, rewards_earned: 0, strikes: 0, frozen: false };
  }
  return data;
}

export async function getNodeInfo(deviceId) {
  if (!isConfigured()) return { device_id: deviceId, rewards_earned: 0, strikes: 0, frozen: false };
  const { data, error } = await supabase.from('nodes').select('*').eq('device_id', deviceId).single();
  if (error) return { device_id: deviceId, rewards_earned: 0, strikes: 0, frozen: false };
  return data;
}

export async function getSyncBatches(limit = 5) {
  if (!isConfigured()) return [];
  const { data, error } = await supabase.from('sync_batches').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) {
    console.warn("Could not get sync_batches:", error);
    return [];
  }
  return data;
}

export async function submitSyncBatch(batchJson, deviceId) {
  let payload;
  try { payload = JSON.parse(batchJson); } catch (e) { throw new Error("Invalid JSON batch"); }

  if (!isConfigured()) {
    return { success: true, simulated: true };
  }
  
  const { data, error } = await supabase.from('sync_batches').insert({
    device_id: deviceId,
    batch_data: JSON.stringify(payload),
    status: 'processed'
  }).select().single();

  if (error) {
    console.warn("Insert to sync_batches failed", error);
    throw new Error(error.message);
  }
  
  const { data: nodeData } = await supabase.from('nodes').select('rewards_earned').eq('device_id', deviceId).single();
  if (nodeData) {
    await supabase.from('nodes').update({ rewards_earned: nodeData.rewards_earned + 10 }).eq('device_id', deviceId);
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
