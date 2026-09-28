import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Small symmetric encryption helper for connector credentials at rest (AES-256-GCM).
 * The key is derived from APP_SECRET (set one in production!); it falls back to a key derived
 * from DATABASE_URL so an existing deploy keeps working, and finally to a dev constant.
 * Format stored: base64( iv[12] | authTag[16] | ciphertext ).
 */
function key(): Buffer {
  const secret = process.env.APP_SECRET || process.env.DATABASE_URL || 'growlytics-dev-secret';
  return createHash('sha256').update(secret).digest(); // 32 bytes
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptJson<T = unknown>(blob: string): T | null {
  try {
    const buf = Buffer.from(blob, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch {
    return null;
  }
}
