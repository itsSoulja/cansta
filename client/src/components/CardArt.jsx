import { useId } from 'react';

/* ── Card art ─────────────────────────────────────────────────────────────
   Every card is one SVG on a 240×336 viewBox (the 2.5×3.5 poker ratio), so
   the same drawing is sharp from the 34px meld thumbnails up to the pile.
   Nothing here knows about the game — it takes a rank and a suit and draws
   the classic rider-back deck: corner indices, standard pip layouts, court
   figures mirrored about the middle, and the filigree back.              */

export const VIEW_W = 240;
export const VIEW_H = 336;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

const INK = '#1a1a1a';
const PAPER = '#fffdf8';

/* ── Pips ───────────────────────────────────────────────────────────────
   Each suit is drawn inside a 100×100 box and placed by <Pip>, which
   scales it and rotates the ones that sit below the middle of the card,
   exactly as a real deck does.                                          */

const SPADE = 'M50 8C42 26 11 41 11 60c0 12 9 21 21 21 7 0 13-4 16-10-1 12-6 21-15 27h34c-9-6-14-15-15-27 3 6 9 10 16 10 12 0 21-9 21-21C89 41 58 26 50 8Z';
const HEART = 'M50 92C19 69 9 53 9 37 9 22 19 11 33 11c8 0 14 4 17 11 3-7 9-11 17-11 14 0 24 11 24 26 0 16-10 32-41 55Z';
const DIAMOND = 'M50 6c9 18 22 33 38 44-16 11-29 26-38 44-9-18-22-33-38-44 16-11 29-26 38-44Z';
const CLUB = 'M50 7c11 0 20 9 20 20 0 4-1 8-3 11 4-3 9-5 14-5 11 0 20 9 20 20s-9 20-20 20c-9 0-16-5-19-13 1 12 6 21 15 27H23c9-6 14-15 15-27-3 8-10 13-19 13C8 73 0 64 0 53s9-20 20-20c5 0 10 2 14 5-2-3-3-7-3-11 0-11 9-20 19-20Z';

function suitPath(suit) {
  if (suit === 'S') return SPADE;
  if (suit === 'H') return HEART;
  if (suit === 'D') return DIAMOND;
  return CLUB;
}

function Pip({ suit, x, y, size, flip }) {
  const s = size / 100;
  return (
    <path
      d={suitPath(suit)}
      fill="currentColor"
      transform={`translate(${x} ${y}) scale(${s}) ${flip ? 'rotate(180)' : ''} translate(-50 -50)`}
    />
  );
}

/* ── Pip layouts ─────────────────────────────────────────────────────── */

const L = 70;
const C = CX;
const R = 170;
const T3 = 84;
const M3 = CY;
const B3 = 252;
const T4 = 82;
const U4 = 139;
const D4 = 197;
const B4 = 254;
const HI3 = 126; // between the top and middle of a three-row column — the 7's odd pip
const LO3 = 210;
const HI4 = 110; // between the top two of a four-row column — the 10's odd pips
const LO4 = 226;

const col3 = (x) => [[x, T3], [x, M3], [x, B3, true]];
const col4 = (x) => [[x, T4], [x, U4], [x, D4, true], [x, B4, true]];

const LAYOUTS = {
  A: [[C, CY]],
  2: [[C, T3], [C, B3, true]],
  3: [[C, T3], [C, M3], [C, B3, true]],
  4: [[L, T3], [R, T3], [L, B3, true], [R, B3, true]],
  5: [[L, T3], [R, T3], [C, M3], [L, B3, true], [R, B3, true]],
  6: [...col3(L), ...col3(R)],
  7: [...col3(L), ...col3(R), [C, HI3]],
  8: [...col3(L), ...col3(R), [C, HI3], [C, LO3, true]],
  9: [...col4(L), ...col4(R), [C, M3]],
  10: [...col4(L), ...col4(R), [C, HI4], [C, LO4, true]],
};

// The nine and ten carry four to a column, so their pips are cut down to keep
// the middle one clear of them.
const PIP_SIZE = { A: 0, 9: 39, 10: 39 };

const pipTransform = (x, y, size) => `translate(${x} ${y}) scale(${size / 100}) translate(-50 -50)`;

// The ace of spades is the one card a real deck decorates, so it gets the
// engraved double outline and a pair of scrolls at the shoulders.
function AceOfSpades() {
  return (
    <g>
      <path d={SPADE} fill="currentColor" transform={pipTransform(CX, CY, 126)} />
      <path d={SPADE} fill="none" stroke={PAPER} strokeWidth="2" transform={pipTransform(CX, CY, 98)} />
      <path d={SPADE} fill="none" stroke={PAPER} strokeWidth="1" transform={pipTransform(CX, CY, 88)} />
    </g>
  );
}

function PipField({ rank, suit }) {
  if (rank === 'A' && suit === 'S') return <AceOfSpades />;
  const spots = LAYOUTS[rank];
  if (!spots) return null;
  const size = rank === 'A' ? (suit === 'S' ? 108 : 86) : (PIP_SIZE[rank] ?? 45);
  return spots.map(([x, y, flip], i) => <Pip key={i} suit={suit} x={x} y={y} size={size} flip={flip} />);
}

/* ── Court cards ─────────────────────────────────────────────────────────
   One half-figure drawn from the top edge down to the middle, then the
   same group rotated 180° about the centre — the way a real court card is
   built, so it reads either way up.                                     */

function Headdress({ rank, tint }) {
  if (rank === 'K') {
    return (
      <g>
        <path d="M98 74 96 50l12 9 12-17 12 17 12-9-2 24Z" fill={tint} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="120" cy="46" r="4" fill={tint} stroke={INK} strokeWidth="2" />
        <rect x="96" y="72" width="48" height="10" rx="3" fill={tint} stroke={INK} strokeWidth="2.5" />
        <circle cx="108" cy="77" r="2.5" fill={PAPER} />
        <circle cx="120" cy="77" r="2.5" fill={PAPER} />
        <circle cx="132" cy="77" r="2.5" fill={PAPER} />
      </g>
    );
  }
  if (rank === 'Q') {
    return (
      <g>
        <path d="M98 74c0-16 10-26 22-26s22 10 22 26Z" fill={tint} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="104" cy="54" r="4" fill={PAPER} stroke={INK} strokeWidth="2" />
        <circle cx="120" cy="46" r="4.5" fill={PAPER} stroke={INK} strokeWidth="2" />
        <circle cx="136" cy="54" r="4" fill={PAPER} stroke={INK} strokeWidth="2" />
        <rect x="96" y="72" width="48" height="10" rx="4" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      </g>
    );
  }
  return (
    <g>
      <path d="M98 74c-2-18 8-28 22-28s24 10 22 28Z" fill={tint} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M140 60c14-10 22-6 26 2-8 8-18 9-26 4Z" fill={PAPER} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="96" y="72" width="48" height="9" rx="3" fill={PAPER} stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

function Regalia({ rank, tint }) {
  if (rank === 'K') {
    return (
      <g>
        <path d="M166 142V64l6-14 6 14v78Z" fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="156" y="142" width="32" height="9" rx="3" fill={tint} stroke={INK} strokeWidth="2.5" />
        <rect x="167" y="151" width="10" height="15" rx="3" fill={tint} stroke={INK} strokeWidth="2.5" />
      </g>
    );
  }
  if (rank === 'Q') {
    return (
      <g>
        <path d="M172 166v-50" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M162 128c-6 4-6 12 2 14" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="172" cy="98" rx="6" ry="11" fill={tint} stroke={INK} strokeWidth="2"
            transform={`rotate(${a} 172 108)`} />
        ))}
        <circle cx="172" cy="108" r="5" fill={PAPER} stroke={INK} strokeWidth="2" />
      </g>
    );
  }
  return (
    <g>
      <path d="M172 166V80" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M164 80 172 48l8 32Z" fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="162" y="80" width="20" height="7" rx="2" fill={tint} stroke={INK} strokeWidth="2" />
    </g>
  );
}

function CourtHalf({ rank, tint }) {
  return (
    <g>
      <Regalia rank={rank} tint={tint} />
      {/* robe — paper, the way a real court card is mostly white with
          colour carried by the trim, so the mirrored pair never reads as a
          single dark blob across the middle. */}
      <path d="M78 168c0-33 19-48 42-48s42 15 42 48Z" fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M108 122h24l7 46h-38Z" fill={tint} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="120" cy="142" r="3.4" fill={PAPER} />
      <circle cx="120" cy="158" r="3.4" fill={PAPER} />
      {/* mantle over the shoulders */}
      <path d="M84 146c6-16 19-26 36-26s30 10 36 26c-12-6-23-9-36-9s-24 3-36 9Z"
        fill={tint} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M96 133c8-3 16-5 24-5s16 2 24 5" stroke={PAPER} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* sleeve reaching for the regalia */}
      <path d="M152 140c10 0 18 6 22 16l-11 5c-3-7-7-10-13-10Z" fill={tint} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M76 168c2-12 5-22 10-30M164 168c-2-12-5-22-10-30" stroke={tint} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* ruff */}
      <path d="M94 112c9 10 17 10 26 4 9 6 17 6 26-4l3 14c-9 10-20 10-29 4-9 6-20 6-29-4Z" fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* hair */}
      <circle cx="98" cy="99" r="10" fill={tint} stroke={INK} strokeWidth="2.2" />
      <circle cx="142" cy="99" r="10" fill={tint} stroke={INK} strokeWidth="2.2" />
      {/* head */}
      <ellipse cx="120" cy="91" rx="18" ry="21" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <Headdress rank={rank} tint={tint} />
      <circle cx="113" cy="89" r="2.2" fill={INK} />
      <circle cx="127" cy="89" r="2.2" fill={INK} />
      <path d="M120 91v8" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {rank === 'Q' ? (
        <path d="M114 105c4 3 8 3 12 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M108 104c5 5 9 7 12 7s7-2 12-7" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}
      {rank === 'K' && (
        <path d="M104 105c2 15 8 23 16 23s14-8 16-23" fill={PAPER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      )}
    </g>
  );
}

function CourtField({ rank, tint, clipId }) {
  return (
    <g>
      <rect x="44" y="38" width="152" height="260" rx="7" fill={tint} opacity="0.035" />
      <rect x="44" y="38" width="152" height="260" rx="7" fill="none" stroke={tint} strokeWidth="3" />
      <rect x="50" y="44" width="140" height="248" rx="4" fill="none" stroke={tint} strokeWidth="1.2" />
      <g clipPath={`url(#${clipId})`}>
        <CourtHalf rank={rank} tint={tint} />
        <g transform={`rotate(180 ${CX} ${CY})`}>
          <CourtHalf rank={rank} tint={tint} />
        </g>
      </g>
      <path d={`M50 ${CY}h140`} stroke={tint} strokeWidth="2.5" />
      <path d={`M50 ${CY - 4}h140M50 ${CY + 4}h140`} stroke={tint} strokeWidth="0.9" opacity="0.6" />
    </g>
  );
}

/* ── Joker ───────────────────────────────────────────────────────────── */

function JokerField({ tint }) {
  return (
    <g>
      <rect x="46" y="40" width="148" height="256" rx="8" fill={tint} opacity="0.07" />
      <rect x="46" y="40" width="148" height="256" rx="8" fill="none" stroke={tint} strokeWidth="3" />
      {/* cap */}
      <path d="M120 96c-26 0-44 16-46 34 0 0-22-30-16-46 12 4 20 10 24 16 2-16 16-30 38-30s36 14 38 30c4-6 12-12 24-16 6 16-16 46-16 46-2-18-20-34-46-34Z"
        fill={tint} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="58" cy="84" r="8" fill={tint} stroke={INK} strokeWidth="2.5" />
      <circle cx="182" cy="84" r="8" fill={tint} stroke={INK} strokeWidth="2.5" />
      {/* face */}
      <ellipse cx="120" cy="150" rx="34" ry="38" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <path d="M86 130c22 8 46 8 68 0" stroke={INK} strokeWidth="2.5" fill="none" />
      <circle cx="107" cy="146" r="4" fill={INK} />
      <circle cx="133" cy="146" r="4" fill={INK} />
      <path d="M120 150v12" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M102 168c10 12 26 12 36 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* ruff and body */}
      <path d="M88 186c10 12 20 14 32 8 12 6 22 4 32-8l6 18c-10 14-24 16-38 9-14 7-28 5-38-9Z"
        fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M82 262c0-32 17-48 38-48s38 16 38 48Z" fill={tint} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M110 216h20l4 46h-28Z" fill={PAPER} stroke={INK} strokeWidth="2" />
      <circle cx="120" cy="232" r="4" fill={tint} />
      <circle cx="120" cy="248" r="4" fill={tint} />
    </g>
  );
}

/* ── Indices ─────────────────────────────────────────────────────────── */

function Index({ rank, suit }) {
  const wide = rank === '10';
  return (
    <g>
      <text
        x="27"
        y="66"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="54"
        {...(wide ? { textLength: 44, lengthAdjust: 'spacingAndGlyphs' } : {})}
      >
        {rank}
      </text>
      <Pip suit={suit} x={27} y={95} size={28} />
    </g>
  );
}

function JokerIndex() {
  return (
    <g fill="currentColor" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontWeight="700" fontSize="26" textAnchor="middle">
      {'JOKER'.split('').map((ch, i) => (
        <text key={i} x="28" y={48 + i * 26}>{ch}</text>
      ))}
    </g>
  );
}

/* ── The face ────────────────────────────────────────────────────────── */

export function CardFace({ rank, suit, red }) {
  const uid = useId();
  const clipId = `court${uid.replace(/[^a-zA-Z0-9]/g, '')}`;
  const tint = red ? 'var(--card-red)' : 'var(--card-black)';
  const isCourt = rank === 'J' || rank === 'Q' || rank === 'K';
  const isJoker = rank === 'JOKER';

  return (
    <svg className="card-art" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="50" y="44" width="140" height="248" rx="4" />
        </clipPath>
      </defs>
      {isJoker ? (
        <>
          <JokerField tint={tint} />
          <JokerIndex />
          <g transform={`rotate(180 ${CX} ${CY})`}><JokerIndex /></g>
        </>
      ) : (
        <>
          {isCourt ? <CourtField rank={rank} tint={tint} clipId={clipId} /> : <PipField rank={rank} suit={suit} />}
          <Index rank={rank} suit={suit} />
          <g transform={`rotate(180 ${CX} ${CY})`}><Index rank={rank} suit={suit} /></g>
        </>
      )}
    </svg>
  );
}

/* ── The back ────────────────────────────────────────────────────────────
   The rider back: a white margin, a field of filigree, an ornate double
   frame, corner fans, and the winged cyclist in a central cartouche —
   drawn twice, head to foot, so the back has no upright either.        */

const BACKS = {
  blue: { base: '#2a5ca8', deep: '#1b3d75', line: '#dce7f7' },
  red: { base: '#bb2b34', deep: '#821c24', line: '#fadfe0' },
};

function Rider({ line }) {
  return (
    <g stroke={line} fill="none" strokeWidth="2" strokeLinecap="round">
      <circle cx={CX} cy="140" r="17" />
      {[0, 45, 90, 135].map((a) => (
        <path key={a} d={`M${CX - 17} 140h34`} transform={`rotate(${a} ${CX} 140)`} strokeWidth="1.2" />
      ))}
      <path d={`M${CX} 140 106 124`} />
      <circle cx={CX} cy="104" r="7" fill={line} stroke="none" />
      <path d={`M${CX} 111c-7 8-9 18-5 27h10c4-9 2-19-5-27Z`} fill={line} stroke="none" />
      <path d="M117 115c-13-8-22-6-27 2 8 4 18 6 27 5Z" fill={line} stroke="none" />
      <path d="M123 115c13-8 22-6 27 2-8 4-18 6-27 5Z" fill={line} stroke="none" />
    </g>
  );
}

function CornerFan({ line, transform }) {
  return (
    <g transform={transform} stroke={line} fill="none" strokeWidth="1.8" strokeLinecap="round">
      <path d="M0 44C0 20 20 0 44 0" />
      <path d="M0 30C0 13 13 0 30 0" strokeWidth="1.2" />
      <path d="M2 56c14-3 24-13 27-27M56 2c-3 14-13 24-27 27" strokeWidth="1.2" />
      <circle cx="17" cy="17" r="7" strokeWidth="1.4" />
      <circle cx="17" cy="17" r="2.4" fill={line} stroke="none" />
      <path d="M6 34c6-1 11-3 15-7M34 6c-1 6-3 11-7 15" strokeWidth="1" />
      <path d="M46 46c-6-9-6-18 0-26 6 8 6 17 0 26Z" strokeWidth="1.2" />
    </g>
  );
}

export function CardBackArt({ variant = 'blue' }) {
  const id = useId();
  const pid = `pat${id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const { base, deep, line } = BACKS[variant] ?? BACKS.blue;

  return (
    <svg className="card-art" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
      <defs>
        <pattern id={pid} width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill={base} />
          <g fill="none" stroke={line} strokeLinecap="round">
            <path d="M11 0 22 11 11 22 0 11Z" strokeWidth="0.8" opacity="0.85" />
            <circle cx="11" cy="11" r="3.6" strokeWidth="0.8" opacity="0.9" />
            <path d="M11 7.4c1.8 1.4 1.8 5.8 0 7.2-1.8-1.4-1.8-5.8 0-7.2ZM7.4 11c1.4-1.8 5.8-1.8 7.2 0-1.4 1.8-5.8 1.8-7.2 0Z"
              strokeWidth="0.6" opacity="0.75" />
            <path d="M0 0c4.4 1.6 7 4.2 8.6 8.6M22 0c-4.4 1.6-7 4.2-8.6 8.6M0 22c4.4-1.6 7-4.2 8.6-8.6M22 22c-4.4-1.6-7-4.2-8.6-8.6"
              strokeWidth="0.7" opacity="0.6" />
          </g>
          <circle cx="11" cy="11" r="1.2" fill={line} opacity="0.9" />
          <circle cx="0" cy="0" r="1.4" fill={line} opacity="0.7" />
          <circle cx="22" cy="0" r="1.4" fill={line} opacity="0.7" />
          <circle cx="0" cy="22" r="1.4" fill={line} opacity="0.7" />
          <circle cx="22" cy="22" r="1.4" fill={line} opacity="0.7" />
        </pattern>
      </defs>

      <rect x="12" y="12" width={VIEW_W - 24} height={VIEW_H - 24} rx="12" fill={`url(#${pid})`} />
      <rect x="12" y="12" width={VIEW_W - 24} height={VIEW_H - 24} rx="12" fill="none" stroke={deep} strokeWidth="2" />
      <rect x="21" y="21" width={VIEW_W - 42} height={VIEW_H - 42} rx="8" fill="none" stroke={line} strokeWidth="3" />
      <rect x="27" y="27" width={VIEW_W - 54} height={VIEW_H - 54} rx="5" fill="none" stroke={line} strokeWidth="1" opacity="0.8" />

      <CornerFan line={line} transform="translate(32 32)" />
      <CornerFan line={line} transform={`translate(${VIEW_W - 32} 32) scale(-1 1)`} />
      <CornerFan line={line} transform={`translate(32 ${VIEW_H - 32}) scale(1 -1)`} />
      <CornerFan line={line} transform={`translate(${VIEW_W - 32} ${VIEW_H - 32}) scale(-1 -1)`} />

      <ellipse cx={CX} cy={CY} rx="60" ry="98" fill={deep} stroke={line} strokeWidth="3" />
      <ellipse cx={CX} cy={CY} rx="54" ry="92" fill="none" stroke={line} strokeWidth="1" opacity="0.7" />
      <Rider line={line} />
      <g transform={`rotate(180 ${CX} ${CY})`}><Rider line={line} /></g>

      <path d={`M${CX - 60} ${CY}h-22M${CX + 60} ${CY}h22`} stroke={line} strokeWidth="1.6" />
      <circle cx={CX - 86} cy={CY} r="7" fill="none" stroke={line} strokeWidth="1.6" />
      <circle cx={CX + 86} cy={CY} r="7" fill="none" stroke={line} strokeWidth="1.6" />
    </svg>
  );
}
