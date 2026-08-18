import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { matchName } from './match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Pictures live at the repo root, not under the client, on purpose: nothing
// here is bundled, so the names and the images stay off the wire until someone
// types a name that earns one.
const FOLDERS = ['easter eggs', 'easter-eggs'].map((f) => path.join(__dirname, '../../..', f));
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

function token(name) {
  return crypto.createHash('sha256').update(`cansta:${name}`).digest('hex').slice(0, 24);
}

function load() {
  const byToken = new Map();
  const names = [];
  for (const folder of FOLDERS) {
    let entries;
    try {
      entries = fs.readdirSync(folder);
    } catch {
      continue; // the folder is optional — no pictures, no easter eggs
    }
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (!EXTENSIONS.has(ext)) continue;
      const name = entry.slice(0, -ext.length);
      names.push(name);
      byToken.set(token(name), path.join(folder, entry));
    }
  }
  return { names, byToken };
}

const library = load();

export const easterEggCount = library.names.length;

// A name close enough to one of the files earns the token that fetches it.
// The token is a digest, so knowing one tells you nothing about the others.
export function lookupEasterEgg(typedName) {
  const match = matchName(typedName, library.names);
  return match ? { token: token(match) } : null;
}

export function easterEggFile(candidate) {
  return library.byToken.get(candidate) ?? null;
}
