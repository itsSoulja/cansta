import { useEffect } from 'react';
import { SERVER_URL } from '../socket.js';

// Paints the picture behind the whole app — landing, lobby and table alike —
// for the player whose name summoned it. Nothing is announced, and nothing is
// shipped in the bundle: the client asks the server with the typed name and is
// given a URL only when it is close enough to one of the files.
export function useEasterEgg(name) {
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      root.style.removeProperty('--egg-image');
      document.body.classList.remove('has-egg');
    };

    const typed = (name ?? '').trim();
    if (!typed) {
      clear();
      return undefined;
    }

    let cancelled = false;
    // Typing is not a query per keystroke; wait for the hand to settle.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/easter-egg?name=${encodeURIComponent(typed)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.found) return clear();
        root.style.setProperty('--egg-image', `url("${SERVER_URL}${data.url}")`);
        document.body.classList.add('has-egg');
      } catch {
        // No easter egg is not an error; the table just stays green.
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name]);
}
