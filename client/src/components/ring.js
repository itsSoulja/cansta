// Seats round an oval, the viewer always at the bottom of it.
//
// The lobby and the game share this so the table does not move when the cards
// come out: the same people stay in the same chairs, and only what is on the
// felt in front of them changes. `radius` steps a seat's parts off the rim —
// the fan sits outside it, the melds inside.
const RX = 38;
const RY = 38;

export function ringSpot(index, count, radius = 1) {
  const angle = ((90 + (index * 360) / count) * Math.PI) / 180;
  return {
    left: `${50 + RX * radius * Math.cos(angle)}%`,
    top: `${50 + RY * radius * Math.sin(angle)}%`,
  };
}
