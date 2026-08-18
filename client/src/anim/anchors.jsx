import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

// Every place a card can live registers itself under a key ('stock', 'discard',
// 'hand:<playerId>', 'meld:<team>:<rank>', 'redthree:<team>'). The flight layer
// looks up screen rects by key so a card can be animated from wherever it was
// to wherever it is going, without those components knowing about each other.
const AnchorContext = createContext(null);

export function AnchorProvider({ children }) {
  const anchors = useRef(new Map());

  const value = useMemo(
    () => ({
      register(key, el) {
        if (el) anchors.current.set(key, el);
        else anchors.current.delete(key);
      },
      rectOf(key) {
        const el = anchors.current.get(key);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return r;
      },
    }),
    [],
  );

  return <AnchorContext.Provider value={value}>{children}</AnchorContext.Provider>;
}

export function useAnchors() {
  return useContext(AnchorContext);
}

// Ref callback: <div ref={useAnchor(`hand:${id}`)} />
export function useAnchor(key) {
  const ctx = useContext(AnchorContext);
  return useCallback((el) => ctx?.register(key, el), [ctx, key]);
}
