import { describe, it, expect } from 'vitest';
import { generateFriendCode } from '../src/friends/friendCode';

describe('generateFriendCode', () => {
  it('produces a WC- prefixed 6-character uppercase alphanumeric code', () => {
    const code = generateFriendCode();
    expect(code).toMatch(/^WC-[A-Z0-9]{6}$/);
  });

  it('produces different codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateFriendCode()));
    expect(codes.size).toBe(20);
  });
});
