import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using Node.js's built-in scrypt algorithm.
 * Returns a string formatted as "derivedKeyInHex.saltInHex".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${hash.toString('hex')}.${salt}`;
}

/**
 * Compare a plain-text password with an scrypt hash.
 */
export async function comparePassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  const parts = storedHash.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [hashedPasswordHex, salt] = parts;
  const hashedBuffer = Buffer.from(hashedPasswordHex, 'hex');

  const verificationHash = (await scryptAsync(password, salt, 64)) as Buffer;

  if (hashedBuffer.length !== verificationHash.length) {
    return false;
  }

  return timingSafeEqual(hashedBuffer, verificationHash);
}
