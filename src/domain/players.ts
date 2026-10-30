import { matchId } from './archive';
import type { ArchivedMatch } from './archive';
import { replay } from './match';

export type Player = { id: string; name: string; createdAt: string };
export const playersKey = 'darts-master.players.v1';
const nameKey = (name: string) => name.trim().toLowerCase();
function validName(name: string) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 30)
    throw new Error('Use a player name between 1 and 30 characters.');
  return name.trim();
}
export function readPlayers(raw: string | null): Player[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (
    data?.version !== 1 ||
    !Array.isArray(data.players) ||
    data.players.length > 100
  )
    throw new Error('Invalid saved players.');
  const ids = new Set<string>(),
    names = new Set<string>();
  return data.players.map((player: Player) => {
    if (
      !player ||
      typeof player.id !== 'string' ||
      !player.id.trim() ||
      typeof player.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(player.createdAt))
    )
      throw new Error('Invalid player profile.');
    const name = validName(player.name);
    if (ids.has(player.id) || names.has(nameKey(name)))
      throw new Error('Duplicate saved player.');
    ids.add(player.id);
    names.add(nameKey(name));
    return { ...player, name };
  });
}
export function addPlayer(
  players: Player[],
  name: string,
  id = matchId(),
): Player[] {
  const checked = validName(name);
  if (typeof id !== 'string' || !id.trim())
    throw new Error('A saved player needs an identifier.');
  if (players.length >= 100)
    throw new Error('This browser already has 100 saved players.');
  if (players.some((p) => nameKey(p.name) === nameKey(checked)))
    throw new Error(
      'That name is already saved. Choose it from saved players.',
    );
  if (players.some((p) => p.id === id))
    throw new Error('The player identifier is already in use.');
  return [
    ...players,
    { id, name: checked, createdAt: new Date().toISOString() },
  ];
}
export function renamePlayer(
  players: Player[],
  id: string,
  name: string,
): Player[] {
  const checked = validName(name);
  if (!players.some((p) => p.id === id))
    throw new Error('This player could not be found.');
  if (players.some((p) => p.id !== id && nameKey(p.name) === nameKey(checked)))
    throw new Error('Another saved player already uses that name.');
  return players.map((p) => (p.id === id ? { ...p, name: checked } : p));
}
export function playerSummary(
  archive: ArchivedMatch[],
  id: string,
  practice: boolean,
) {
  let matches = 0,
    wins = 0,
    legsWon = 0,
    legsLost = 0,
    scored = 0,
    darts = 0,
    maximums = 0,
    best = 0,
    highestCheckout = 0;
  const recent: {
    opponent: string;
    won: boolean;
    score: string;
    date: string;
  }[] = [];
  const seen = new Set<string>();
  for (const entry of archive) {
    const key = entry.session.id;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    if (!!entry.session.setup.bot !== practice) continue;
    const match = replay(entry.session);
    const index =
      match.setup.playerIds?.findIndex((playerId) => playerId === id) ?? -1;
    if (index < 0 || (practice && index === 1) || match.winner === null)
      continue;
    matches++;
    if (match.winner === index) wins++;
    legsWon += match.legs[index];
    legsLost += match.legs[1 - index];
    for (const visit of match.visits.filter((v) => v.player === index)) {
      darts += visit.darts;
      if (!visit.bust) {
        scored += visit.total;
        best = Math.max(best, visit.total);
        if (visit.total === 180) maximums++;
      }
      if (visit.checkout)
        highestCheckout = Math.max(highestCheckout, visit.total);
    }
    if (recent.length < 3)
      recent.push({
        opponent: match.setup.players[1 - index],
        won: match.winner === index,
        score: match.setup.setsToWin
          ? `${match.sets[index]}–${match.sets[1 - index]} sets`
          : `${match.legs[index]}–${match.legs[1 - index]}`,
        date: entry.completedAt,
      });
  }
  return {
    matches,
    wins,
    losses: matches - wins,
    legsWon,
    legsLost,
    average: darts ? ((scored / darts) * 3).toFixed(1) : '—',
    darts,
    maximums,
    best,
    highestCheckout,
    recent,
  };
}
