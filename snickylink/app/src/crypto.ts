// ===========================================================================
// PLACEHOLDER — THIS IS NOT ENCRYPTION.
//
// The chat engine on the server is built correctly: it stores an opaque blob
// and never has a plaintext column. But the actual cipher has to live here, on
// the device, and React Native ships no AES primitive out of the box.
//
// What this file does today is base64-encode the message with an XOR pass.
// That is obfuscation, not security. Anyone with the database can read it.
//
// Before you call this feature private anywhere in the UI, on a store listing,
// or to a user, replace the two functions below with a vetted library —
// react-native-libsodium (crypto_secretbox) or react-native-quick-crypto
// (AES-256-GCM). The seam is deliberately tiny so the swap is contained:
// nothing outside this file knows how a message is encrypted.
//
// The key exchange also needs solving properly. Right now the couple key is
// derived from the couple id, which the server also knows — so the server
// could decrypt if it wanted to. A real build needs an X25519 handshake, or
// at minimum a passphrase the partners exchange in person, never over the API.
// ===========================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const K_KEY = 'snickylink.couplekey.v1';

let key: string | null = null;

export async function initKey(coupleId: string) {
  const stored = await AsyncStorage.getItem(K_KEY);
  if (stored) { key = stored; return; }
  key = coupleId; // <-- replace with a real shared secret
  await AsyncStorage.setItem(K_KEY, key);
}

function xor(input: string, k: string) {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  }
  return out;
}

const b64 = {
  encode: (s: string) => global.btoa(unescape(encodeURIComponent(s))),
  decode: (s: string) => decodeURIComponent(escape(global.atob(s))),
};

export function encrypt(plain: string) {
  if (!key) return { ciphertext: b64.encode(plain) };
  return { ciphertext: b64.encode(xor(plain, key)) };
}

export function decrypt(ciphertext: string) {
  try {
    const raw = b64.decode(ciphertext);
    return key ? xor(raw, key) : raw;
  } catch {
    return '[unreadable]';
  }
}
