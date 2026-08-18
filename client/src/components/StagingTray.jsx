import { Card, isWildCard, pointsFor, rankIndex } from './Card.jsx';

// Selected cards collect above the hand and group themselves by rank. Wilds
// are ambiguous by nature, so each one joins the biggest group and can be
// clicked to move along to the next.
//
// pileCard is the top of the discard pile while it is yours to take. It rides
// along in the group of its own rank — counted, but never part of `all`, since
// it is the server that hands it over and only as part of the pickup.
export function buildGroups(cards, wildAssignments, pointValues, pileCard = null) {
  const naturals = cards.filter((c) => !isWildCard(c));
  const wilds = cards.filter(isWildCard);

  const byRank = new Map();
  for (const card of naturals) {
    if (!byRank.has(card.rank)) byRank.set(card.rank, []);
    byRank.get(card.rank).push(card);
  }

  const ranks = [...byRank.keys()].sort((a, b) => {
    const sizeDiff = byRank.get(b).length - byRank.get(a).length;
    return sizeDiff !== 0 ? sizeDiff : rankIndex(a) - rankIndex(b);
  });

  const groups = ranks.map((rank) => ({ rank, cards: [...byRank.get(rank)], wilds: [] }));
  for (const wild of wilds) {
    const wanted = wildAssignments[wild.id];
    const target = groups.find((g) => g.rank === wanted) ?? groups[0];
    if (target) target.wilds.push(wild);
    else groups.push({ rank: null, cards: [], wilds: [wild] });
  }

  return groups.map((g) => {
    const all = [...g.cards, ...g.wilds];
    const fromPile = pileCard && g.rank === pileCard.rank ? pileCard : null;
    const counted = fromPile ? [...all, fromPile] : all;
    return {
      ...g,
      all,
      fromPile,
      points: counted.reduce((sum, c) => sum + pointsFor(c, pointValues), 0),
      shortOfThree: counted.length < 3,
      tooManyWilds: g.wilds.length >= (fromPile ? g.cards.length + 1 : g.cards.length),
    };
  });
}

export function StagingTray({ groups, total, threshold, needsThreshold, onToggleCard, onCycleWild, hiddenIds }) {
  if (groups.length === 0) return null;

  return (
    <div className="tray">
      <div className="tray__groups">
        {groups.map((group, gi) => (
          <div className={`tray__group${group.shortOfThree || group.tooManyWilds ? ' tray__group--warn' : ''}`} key={group.rank ?? `w${gi}`}>
            <div className="tray__cards">
              {group.all.map((card, i) => (
                <div className="tray__slot" key={card.id} style={{ '--i': i }}>
                  <Card
                    card={card}
                    size="small"
                    selected
                    className={hiddenIds.has(card.id) ? 'is-flying' : ''}
                    onClick={() => (isWildCard(card) && groups.length > 1 ? onCycleWild(card) : onToggleCard(card.id))}
                  />
                </div>
              ))}
              {group.fromPile && (
                <div className="tray__slot tray__slot--pile" style={{ '--i': group.all.length }} title="from the discard pile">
                  <Card card={group.fromPile} size="small" static />
                </div>
              )}
            </div>
            <span className="tray__meta">
              {group.rank ? `${group.rank}s` : 'wild'} · {group.points}
              {group.fromPile && <b> +pile</b>}
              {group.shortOfThree && <em> needs 3+</em>}
              {!group.shortOfThree && group.tooManyWilds && <em> too many wilds</em>}
            </span>
          </div>
        ))}
      </div>

      {needsThreshold && (
        <div className={`tray__threshold${total >= threshold ? ' is-met' : ''}`}>
          <span className="tray__total">{total}</span>
          <span className="tray__of">/ {threshold} to open</span>
        </div>
      )}
    </div>
  );
}
