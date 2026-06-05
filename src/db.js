import { openDB } from 'idb';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from './crypto.js';
import naclUtil from 'tweetnacl-util';

const DB_NAME = 'gdc_v2';
const DB_VERSION = 1;

let dbPromise;

/**
 * Initializes the IndexedDB.
 */
export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('pending')) {
          db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Helper: Derives a 32-byte key from a PIN using Web Crypto API.
 */
async function deriveKeyFromPin(pin) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  // Using a static salt for simplicity in this example (not recommended for production production without user-specific salt)
  const salt = enc.encode('gdc_v2_salt_123'); 
  const derivedBits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(derivedBits);
}

/**
 * Saves the encrypted secret key.
 * @param {Uint8Array} secretKeyUint8 
 * @param {string} pin 
 */
export async function saveEncryptedKey(secretKeyUint8, pin) {
  const db = await initDB();
  const key = await deriveKeyFromPin(pin);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  
  const encryptedParams = nacl.secretbox(secretKeyUint8, nonce, key);
  
  const payload = {
    box: encodeBase64(encryptedParams),
    nonce: encodeBase64(nonce)
  };
  
  await db.put('keys', payload, 'walletKey');
}

/**
 * Loads and decrypts the secret key.
 * @param {string} pin 
 * @returns {Promise<{publicKeyBase64: string, secretKeyUint8: Uint8Array} | null>}
 */
export async function loadAndDecryptKey(pin) {
  const db = await initDB();
  const payload = await db.get('keys', 'walletKey');
  if (!payload) return null;
  
  try {
    const key = await deriveKeyFromPin(pin);
    const box = decodeBase64(payload.box);
    const nonce = decodeBase64(payload.nonce);
    
    const secretKeyUint8 = nacl.secretbox.open(box, nonce, key);
    if (!secretKeyUint8) {
      throw new Error('Decryption failed (invalid PIN)');
    }
    
    // In tweetnacl, Ed25519 secret key (64 bytes) contains the public key as the last 32 bytes
    const publicKeyUint8 = nacl.sign.keyPair.fromSecretKey(secretKeyUint8).publicKey;
    
    return {
      publicKeyBase64: encodeBase64(publicKeyUint8),
      secretKeyUint8
    };
  } catch (error) {
    console.error('Failed to decrypt key:', error);
    return null;
  }
}

/**
 * Gets the device ID.
 */
export async function getDeviceId() {
  const db = await initDB();
  return await db.get('settings', 'deviceId');
}

/**
 * Sets the device ID.
 * @param {string} id 
 */
export async function setDeviceId(id) {
  const db = await initDB();
  await db.put('settings', id, 'deviceId');
}

/**
 * Saves a pending transaction.
 * @param {object} txObj 
 */
export async function savePendingTransaction(txObj) {
  const db = await initDB();
  await db.put('pending', txObj);
}

/**
 * Gets all pending transactions.
 * @returns {Promise<Array>}
 */
export async function getPendingTransactions() {
  const db = await initDB();
  return await db.getAll('pending');
}

/**
 * Clears all pending transactions.
 */
export async function clearPendingTransactions() {
  const db = await initDB();
  await db.clear('pending');
}
