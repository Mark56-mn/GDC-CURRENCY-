import { generateKeyPair, sign, encodeBase64 } from './crypto.js';
import { saveEncryptedKey, loadAndDecryptKey, savePendingTransaction } from './db.js';
import { supabase } from './supabase.js';

// Global memory state for unlocked wallet
let activeWallet = null;

// Mock state for preview mode when Supabase is not configured
let mockBalance = 0;
let mockTransactions = [];

function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return url && !url.includes('placeholder.supabase.co');
}

/**
 * Creates a new wallet, encrypts the secret key with the given PIN,
 * saves it to IndexedDB, and returns the public key in Base64 format.
 * @param {string} pin 
 * @returns {Promise<string>} Base64 encoded public key
 */
export async function createWallet(pin) {
  const { publicKey, secretKey } = generateKeyPair();
  await saveEncryptedKey(secretKey, pin);
  const publicKeyBase64 = encodeBase64(publicKey);
  
  activeWallet = {
    publicKeyBase64,
    secretKeyUint8: secretKey
  };
  
  return publicKeyBase64;
}

/**
 * Unlocks the wallet by decrypting the stored key with the PIN.
 * @param {string} pin 
 * @returns {Promise<{publicKeyBase64: string} | null>}
 */
export async function unlockWallet(pin) {
  const walletData = await loadAndDecryptKey(pin);
  if (walletData) {
    activeWallet = walletData;
    return { publicKeyBase64: walletData.publicKeyBase64 };
  }
  return null;
}

/**
 * Gets the balance of the given public key by summing transactions from Supabase.
 * @param {string} pubkey 
 * @returns {Promise<number>}
 */
export async function getBalance(pubkey) {
  if (!isConfigured()) {
    return mockBalance;
  }

  const { data, error } = await supabase
    .from('balances')
    .select('balance')
    .eq('pubkey', pubkey)
    .single();

  if (error) {
    console.error('Error fetching balance:', error);
    return 0; // default to 0 on error
  }
  
  return data?.balance || 0;
}

/**
 * Sends a transaction. Builds payload, signs it, and submits it to /sync-batch Edge Function.
 * @param {string} toPubkey 
 * @param {number} amount 
 * @param {string} pin 
 * @returns {Promise<object>} The response of the transaction submission.
 */
export async function sendTransaction(toPubkey, amount, pin) {
  const walletToUse = activeWallet || await loadAndDecryptKey(pin);
  
  if (!walletToUse) {
    throw new Error('Invalid PIN or wallet not found');
  }

  if (!isConfigured()) {
    console.warn("Supabase not configured. Simulating transaction locally.");
    if (mockBalance < amount) {
      throw new Error("Insufficient funds (simulated)");
    }
    mockBalance -= amount;
    const tx = {
      id: Math.random().toString(36).substring(2, 10),
      from_pubkey: walletToUse.publicKeyBase64,
      to_pubkey: toPubkey,
      amount: amount,
      created_at: new Date().toISOString(),
      status: 'confirmed'
    };
    mockTransactions.unshift(tx);
    await savePendingTransaction(tx);
    return { success: true };
  }

  const payload = {
    from_pubkey: walletToUse.publicKeyBase64,
    to_pubkey: toPubkey,
    amount: amount,
    timestamp: new Date().toISOString()
  };

  const payloadString = JSON.stringify(payload);
  const signatureBase64 = sign(payloadString, walletToUse.secretKeyUint8);

  const transactionData = {
    payload,
    signature: signatureBase64
  };

  // Temporarily store locally
  await savePendingTransaction({ ...transactionData, status: 'pending' });

  // Submit to Edge Function
  const { data, error } = await supabase.functions.invoke('sync-batch', {
    body: transactionData
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

/**
 * Fetches transaction history for a given public key.
 * @param {string} pubkey 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
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
    console.error('Error fetching transaction history:', error);
    return [];
  }

  return data;
}
