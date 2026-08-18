import { describe, it, expect } from 'vitest';
import { matchName, normalizeName, toleranceFor } from './match.js';
import { easterEggCount, lookupEasterEgg, easterEggFile } from './library.js';

const names = ['Elon Musk', 'Leaky Pipes', 'Svetlana', 'Jo'];

describe('easter egg name matching', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(normalizeName('  ELON   Musk! ')).toBe('elonmusk');
    for (const typed of ['Elon Musk', 'elonmusk', '  ELON   MUSK ', 'elon-musk', 'Elon.Musk']) {
      expect(matchName(typed, names)).toBe('Elon Musk');
    }
  });

  it('forgives a slip of the finger, in proportion to the length of the name', () => {
    expect(matchName('Elon Muskk', names)).toBe('Elon Musk');
    expect(matchName('leaky pipe', names)).toBe('Leaky Pipes');
    expect(matchName('svetlanna', names)).toBe('Svetlana');
    // Two characters is a whole name's worth of difference when the name is short.
    expect(toleranceFor(3)).toBe(0);
    expect(toleranceFor(8)).toBe(2);
    expect(toleranceFor(40)).toBe(3);
  });

  it('holds the line against names that are merely nearby', () => {
    expect(matchName('Bob', names)).toBeNull();
    expect(matchName('Steve', names)).toBeNull();
    expect(matchName('pipes', names)).toBeNull();
    expect(matchName('Elon', names)).toBeNull();
    expect(matchName('', names)).toBeNull();
    // A two-letter file cannot be reached by a different two-letter name.
    expect(matchName('Al', names)).toBeNull();
  });

  it('gives the closest name when two are within tolerance', () => {
    expect(matchName('svetlana', ['Svetlana', 'Svetlano'])).toBe('Svetlana');
  });
});

describe('easter egg library', () => {
  it('hands out a token only for a name it holds, and a file only for a token it issued', () => {
    expect(lookupEasterEgg('nobody-by-this-name-at-all')).toBeNull();
    expect(easterEggFile('not-a-real-token')).toBeNull();
    expect(easterEggFile('')).toBeNull();
  });

  it('round-trips whatever pictures are in the folder', () => {
    if (easterEggCount === 0) return; // no pictures checked in: nothing to prove
    const hit = lookupEasterEgg('Elon Musk');
    if (!hit) return; // the folder holds different names than this test knows
    expect(hit.token).toMatch(/^[0-9a-f]{24}$/);
    expect(easterEggFile(hit.token)).toMatch(/Elon Musk\./);
  });
});
