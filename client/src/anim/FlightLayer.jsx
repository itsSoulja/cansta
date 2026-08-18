import { useEffect, useRef } from 'react';
import { Card, CardBack } from '../components/Card.jsx';

// A card in transit. Positioned from the centre of each anchor rect so it does
// not matter that a hand card and a melded card are drawn at different sizes.
function Flight({ flight, legMs }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || flight.rects.length < 2) return;
    const rect = el.getBoundingClientRect();
    const frames = flight.rects.map((r, i) => {
      const x = r.left + r.width / 2 - rect.width / 2;
      const y = r.top + r.height / 2 - rect.height / 2;
      const last = i === flight.rects.length - 1;
      const tilt = last ? 0 : i === 0 ? -4 : 5;
      return {
        transform: `translate(${x}px, ${y}px) rotate(${tilt}deg) scale(${last ? 1 : 1.08})`,
        offset: i / (flight.rects.length - 1),
      };
    });
    const animation = el.animate(frames, {
      duration: legMs * (flight.rects.length - 1),
      easing: 'cubic-bezier(.34, .8, .32, 1)',
      fill: 'both',
    });
    return () => animation.cancel();
  }, [flight, legMs]);

  return (
    <div className="flight" ref={ref}>
      {flight.faceDown || !flight.card ? <CardBack /> : <Card card={flight.card} static />}
    </div>
  );
}

export function FlightLayer({ flights, legMs }) {
  return (
    <div className="flight-layer" aria-hidden="true">
      {flights.map((f) => (
        <Flight key={f.id} flight={f} legMs={legMs} />
      ))}
    </div>
  );
}
