import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

/**
 * Generates a new Ed25519 key pair.
 * @returns {{ publicKey: Uint8Array, secretKey: Uint8Array }} The generated key pair.
 */
export function generateKeyPair() {
  return nacl.sign.keyPair();
}

/**
 * Signs a payload using the secret key.
 * @param {string|Uint8Array} payload The data to sign.
 * @param {Uint8Array} secretKey The secret key of the signer.
 * @returns {string} The base64 encoded signature.
 */
export function sign(payload, secretKey) {
  const messageUint8 = typeof payload === 'string' ? naclUtil.decodeUTF8(payload) : payload;
  const signature = nacl.sign.detached(messageUint8, secretKey);
  return encodeBase64(signature);
}

/**
 * Verifies a signature.
 * @param {string|Uint8Array} payload The original data.
 * @param {string} signatureBase64 The base64 encoded signature.
 * @param {string} publicKeyBase64 The base64 encoded public key.
 * @returns {boolean} True if the signature is valid, false otherwise.
 */
export function verify(payload, signatureBase64, publicKeyBase64) {
  try {
    const messageUint8 = typeof payload === 'string' ? naclUtil.decodeUTF8(payload) : payload;
    const signatureUint8 = decodeBase64(signatureBase64);
    const publicKeyUint8 = decodeBase64(publicKeyBase64);
    return nacl.sign.detached.verify(messageUint8, signatureUint8, publicKeyUint8);
  } catch (error) {
    return false;
  }
}

/**
 * Hashes a string using basic SHA-256 (via Web Crypto API).
 * @param {string} str The string to hash.
 * @returns {Promise<string>} The HEX encoded hash.
 */
export async function hashString(str) {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Encodes a Uint8Array into a Base64 string.
 * @param {Uint8Array} arr The array to encode.
 * @returns {string} Base64 string.
 */
export function encodeBase64(arr) {
  return naclUtil.encodeBase64(arr);
}

/**
 * Decodes a Base64 string into a Uint8Array.
 * @param {string} str The Base64 string to decode.
 * @returns {Uint8Array} The decoded byte array.
 */
export function decodeBase64(str) {
  return naclUtil.decodeBase64(str);
}
