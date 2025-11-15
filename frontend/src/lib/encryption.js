import nacl from "tweetnacl";
import { Buffer } from "buffer";

const KEY_PAIR_STORAGE_KEY = "chatapp:e2ee:keypair";
const BACKUP_PREFIX = "CHATKEY1:";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const encodeStringToBase64 = (value) => {
  if (typeof window === "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  return window.btoa(value);
};

const decodeStringFromBase64 = (value) => {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }
  return window.atob(value);
};

const toBase64 = (buffer) => {
  if (!buffer) return "";
  if (typeof window === "undefined") {
    return Buffer.from(buffer).toString("base64");
  }

  let binary = "";
  buffer.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const fromBase64 = (value) => {
  if (typeof value !== "string" || !value) return null;

  let binaryString;
  if (typeof window === "undefined") {
    binaryString = Buffer.from(value, "base64").toString("binary");
  } else {
    binaryString = window.atob(value);
  }

  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const generateKeyPair = () => {
  const { publicKey, secretKey } = nacl.box.keyPair();
  return {
    publicKey: toBase64(publicKey),
    secretKey: toBase64(secretKey),
  };
};

const derivePublicKey = (secretKeyBase64) => {
  const secretBytes = fromBase64(secretKeyBase64);
  if (!secretBytes) return null;
  const derived = nacl.box.keyPair.fromSecretKey(secretBytes);
  return toBase64(derived.publicKey);
};

export const storeKeyPair = (keyPair) => {
  if (typeof window === "undefined" || !keyPair) return;
  window.localStorage.setItem(KEY_PAIR_STORAGE_KEY, JSON.stringify(keyPair));
};

export const getStoredKeyPair = () => {
  if (typeof window === "undefined") return null;

  const serialized = window.localStorage.getItem(KEY_PAIR_STORAGE_KEY);
  if (!serialized) return null;

  try {
    return JSON.parse(serialized);
  } catch (error) {
    console.error("Failed to parse stored key pair", error);
    return null;
  }
};

export const clearStoredKeyPair = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_PAIR_STORAGE_KEY);
};

const normalizeKeyPair = (keyPair) => {
  if (!keyPair?.secretKey) return null;

  try {
    const derivedPublicKey = derivePublicKey(keyPair.secretKey);

    if (keyPair.publicKey === derivedPublicKey) return keyPair;

    const normalized = { ...keyPair, publicKey: derivedPublicKey };
    storeKeyPair(normalized);
    return normalized;
  } catch (error) {
    console.error("Failed to normalize key pair", error);
    return null;
  }
};

export const getNormalizedKeyPair = () => {
  const stored = getStoredKeyPair();
  return normalizeKeyPair(stored);
};

export const hasStoredSecretKey = () => Boolean(getStoredKeyPair()?.secretKey);

export const encryptText = (plaintext, receiverPublicKey, senderSecretKey) => {
  if (!plaintext?.length) return null;
  if (!receiverPublicKey || !senderSecretKey) {
    throw new Error("Missing keys for encryption");
  }

  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(
    textEncoder.encode(plaintext),
    nonce,
    fromBase64(receiverPublicKey),
    fromBase64(senderSecretKey)
  );

  return {
    ciphertext: toBase64(encrypted),
    nonce: toBase64(nonce),
  };
};

export const decryptText = (ciphertext, nonce, otherPublicKey, mySecretKey) => {
  if (!ciphertext || !nonce || !otherPublicKey || !mySecretKey) return null;

  try {
    const decrypted = nacl.box.open(
      fromBase64(ciphertext),
      fromBase64(nonce),
      fromBase64(otherPublicKey),
      fromBase64(mySecretKey)
    );

    if (!decrypted) return null;
    return textDecoder.decode(decrypted);
  } catch (error) {
    console.error("Failed to decrypt message", error);
    return null;
  }
};

export const ensureKeyPairMatchesServer = (serverPublicKey) => {
  const normalized = getNormalizedKeyPair();
  if (!normalized) return null;
  if (!serverPublicKey || normalized.publicKey === serverPublicKey) return normalized;

  return normalized;
};

export const exportKeyBackupString = () => {
  const keyPair = getNormalizedKeyPair();
  if (!keyPair?.secretKey) return null;

  const payload = {
    version: 1,
    secretKey: keyPair.secretKey,
  };

  const serialized = JSON.stringify(payload);
  const base64 = encodeStringToBase64(serialized);
  return `${BACKUP_PREFIX}${base64}`;
};

export const importKeyBackupString = (backupString) => {
  if (typeof backupString !== "string" || !backupString.trim()) {
    throw new Error("Backup string cannot be empty");
  }

  try {
    let normalized = backupString.trim();
    if (normalized.startsWith(BACKUP_PREFIX)) {
      normalized = normalized.slice(BACKUP_PREFIX.length);
    }

    const decoded = decodeStringFromBase64(normalized);
    const payload = JSON.parse(decoded);

    if (payload.version !== 1 || !payload.secretKey) {
      throw new Error("Unsupported backup format");
    }

    const derivedPublicKey = derivePublicKey(payload.secretKey);
    if (!derivedPublicKey) {
      throw new Error("Invalid secret key");
    }

    const keyPair = { secretKey: payload.secretKey, publicKey: derivedPublicKey };
    storeKeyPair(keyPair);
    return keyPair;
  } catch (error) {
    throw new Error(error.message || "Invalid backup");
  }
};
