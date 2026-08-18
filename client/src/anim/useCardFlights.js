import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnchors } from './anchors.jsx';

const LEG_MS = 420;
const STAGGER_MS = 90;

// Turns one server event into the legs a card should travel. Returning several
// legs makes a card pause somewhere on the way — a red 3 lands in your hand
// first, then moves off to the side, exactly as it would on a real table.
function flightsFor(event, myId) {
  const mine = event.playerId === myId;
  const hand = `hand:${event.playerId}`;

  switch (event.type) {
    case 'DRAW_STOCK':
      return [{ card: event.card, faceDown: !mine, legs: ['stock', hand] }];

    case 'RED_THREE': {
      const zone = `redthree:${event.team}`;
      if (event.source === 'draw') {
        // Drawn, briefly held, then laid to the side; the replacement follows.
        return [{ card: event.card, faceDown: false, legs: ['stock', hand, zone] }];
      }
      const flights = [{ card: event.card, faceDown: false, legs: [hand, zone] }];
      if (event.replacement || !mine) {
        flights.push({ card: event.replacement, faceDown: !mine, legs: ['stock', hand] });
      }
      return flights;
    }

    case 'DISCARD':
      return [{ card: event.card, faceDown: false, legs: [hand, 'discard'] }];

    case 'MELD':
      return (event.added ?? []).map((card) => ({
        card,
        faceDown: false,
        legs: [hand, `meld:${event.team}:${event.rank}`],
      }));

    case 'TAKE_DISCARD': {
      // The rest of the pile sweeps into the taker's hand; the top card is
      // covered by the MELD event that always follows.
      const buried = Math.max(0, (event.pileCount ?? 1) - 1);
      return Array.from({ length: Math.min(buried, 8) }, () => ({
        card: null,
        faceDown: true,
        legs: ['discard', hand],
      }));
    }

    default:
      return [];
  }
}

let flightId = 0;

// Plays queued events as overlay animations. Cards being flown are reported
// through `hiddenIds` so their resting place can hold an empty slot until the
// flight lands — otherwise the card would appear twice mid-flight.
export function useCardFlights({ events, myId, enabled = true }) {
  const anchors = useAnchors();
  const [flights, setFlights] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const lastSeq = useRef(0);
  const timers = useRef([]);

  const hide = useCallback((id) => {
    if (!id) return;
    setHiddenIds((prev) => new Set(prev).add(id));
  }, []);

  const reveal = useCallback((id) => {
    if (!id) return;
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || !events?.length) return;
    const fresh = events.filter((e) => e.seq > lastSeq.current);
    if (!fresh.length) return;
    lastSeq.current = Math.max(...events.map((e) => e.seq));

    let offset = 0;
    for (const event of fresh) {
      for (const spec of flightsFor(event, myId)) {
        const rects = spec.legs.map((key) => anchors.rectOf(key));
        if (rects.some((r) => r === null)) continue; // anchor not mounted; skip silently

        const id = `f${flightId++}`;
        const duration = LEG_MS * (rects.length - 1);
        const startAt = offset;
        offset += STAGGER_MS;

        timers.current.push(
          setTimeout(() => {
            hide(spec.card?.id);
            setFlights((prev) => [...prev, { id, card: spec.card, faceDown: spec.faceDown, rects }]);
          }, startAt),
          setTimeout(() => {
            setFlights((prev) => prev.filter((f) => f.id !== id));
            reveal(spec.card?.id);
          }, startAt + duration + 60),
        );
      }
    }
  }, [events, myId, anchors, enabled, hide, reveal]);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    },
    [],
  );

  return { flights, hiddenIds, legMs: LEG_MS };
}
