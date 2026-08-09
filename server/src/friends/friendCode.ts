import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity

export function generateFriendCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) {
    code += ALPHABET[b % ALPHABET.length];
  }
  return `WC-${code}`;
}
