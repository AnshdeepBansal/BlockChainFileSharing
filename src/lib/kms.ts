import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function getMasterKey(): Buffer {
  const fromEnv = process.env.APP_MASTER_KEY;
  if (fromEnv) {
    const key = Buffer.from(fromEnv, 'base64');
    if (key.length !== 32) {
      throw new Error('APP_MASTER_KEY must be base64 encoded 32 bytes');
    }
    return key;
  }

  // Development fallback only.
  return createHash('sha256').update('dev-master-key-change-me').digest();
}

export async function generateAndWrapDataKey(): Promise<{ plaintextKey: Buffer; wrappedKey: string }> {
  const plaintextKey = randomBytes(32);
  const masterKey = getMasterKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  const enc = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrapped = Buffer.concat([iv, tag, enc]).toString('base64');

  return { plaintextKey, wrappedKey: wrapped };
}

export async function unwrapDataKey(wrappedKey: string): Promise<Buffer> {
  const payload = Buffer.from(wrappedKey, 'base64');
  if (payload.length < 60) {
    throw new Error('Wrapped key is invalid');
  }

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encryptedKey = payload.subarray(28);
  const masterKey = getMasterKey();

  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encryptedKey), decipher.final()]);
}
