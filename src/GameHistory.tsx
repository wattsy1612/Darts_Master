import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { GameRecord } from './domain/games/registry';
import type { ArchivedMatch } from './domain/archive';
import { isX01Archive } from './domain/archive';
import MatchHistory from './MatchHistory';
import CricketHistory from './CricketHistory';
export default function GameHistory({
  current,
  archives,
  correction,
}: {
  current: GameRecord | null;
  archives: ArchivedMatch<GameRecord>[];
  correction?: ComponentProps<typeof MatchHistory>['correction'];
}) {
  const [game, setGame] = useState(
    current?.game === 'cricket' ? 'cricket' : 'x01',
  );
  return (
    <div className="game-history">
      <label className="record-format">
        Game in match centre
        <select value={game} onChange={(e) => setGame(e.target.value)}>
          <option value="x01">X01</option>
          <option value="cricket">Cricket</option>
        </select>
      </label>
      {game === 'cricket' ? (
        <CricketHistory
          current={current?.game === 'cricket' ? current : null}
          archives={archives}
        />
      ) : (
        <MatchHistory
          current={current?.game !== 'cricket' ? current : null}
          archives={archives.filter(isX01Archive)}
          correction={correction}
        />
      )}
    </div>
  );
}
