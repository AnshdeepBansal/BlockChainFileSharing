import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export type EncryptionResult = {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
};

export function shouldCompress(fileType: string, fileSize: number): boolean {
  const compressiblePrefixes = ['text/', 'application/json', 'application/javascript', 'application/xml'];
  const alreadyCompressedPrefixes = ['image/', 'video/', 'audio/', 'application/zip', 'application/gzip', 'application/pdf'];

  if (fileSize < 10 * 1024) return false;
  if (alreadyCompressedPrefixes.some((p) => fileType.startsWith(p))) return false;
  return compressiblePrefixes.some((p) => fileType.startsWith(p));
}

export function compressBuffer(buf: Buffer): Buffer {
  return gzipSync(buf, { level: 9 });
}

export function decompressBuffer(buf: Buffer): Buffer {
  return gunzipSync(buf);
}

export function encryptAesGcm(plaintext: Buffer, key: Buffer): EncryptionResult {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

export function decryptAesGcm(ciphertext: Buffer, key: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function encodePayload(iv: Buffer, tag: Buffer, ciphertext: Buffer): Buffer {
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decodePayload(payload: Buffer): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  if (payload.length < 28) {
    throw new Error('Encrypted payload is malformed');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  return { iv, tag, ciphertext };
}
