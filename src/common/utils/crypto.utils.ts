import crypto from "node:crypto";
import { PHONE_ENCRYPTION_KEY } from "../../config";

// Was a hardcoded, committed-to-source key - anyone reading the repo
// could decrypt every stored phone number. Now a real random 32-byte
// key from an env var, hex-decoded (the env var stores it as 64 hex
// characters, not the raw 32 bytes, since env vars are text). Rotating
// this key makes ciphertexts encrypted under the old key permanently
// undecryptable - deliberately not migrated: decryption() has never
// been called anywhere in the app, so old ciphertexts were already
// write-only and are simply abandoned, not silently broken for any
// live feature.
const KEY = Buffer.from(PHONE_ENCRYPTION_KEY, "hex");

export function encryption(plainText: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", KEY, iv);
  let encryptedData = cipher.update(plainText, "utf-8", "hex");
  encryptedData += cipher.final("hex");

  return `${iv.toString("hex")}:${encryptedData}`;
}

export function decryption(encryptedData: string) {
  const [iv, encryptedValue] = encryptedData.split(":");
  const ivBufferLike = Buffer.from(iv as string, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", KEY, ivBufferLike);

  let decryptedValue = decipher.update(encryptedValue as string, "hex", "utf-8");
  decryptedValue += decipher.final("utf-8");
  return decryptedValue;
}
