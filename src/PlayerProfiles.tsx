import { useMemo, useState } from 'react';
import { playerSummary } from './domain/players';
import type { Player } from './domain/players';
import type { ArchivedMatch } from './domain/archive';

export function PlayerField({
  index,
  name,
  profileId,
  players,
  bot,
  onName,
  onSelect,
  onSave,
}: {
  index: number;
  name: string;
  profileId: string | null;
  players: Player[];
  bot: boolean;
  onName: (name: string) => void;
  onSelect: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="player-setup-field">
      <label>
        {bot ? 'Opponent name' : `Player ${index + 1}`}
        <input
          required
          maxLength={30}
          value={
            players.find((player) => player.id === profileId)?.name ?? name
          }
          disabled={bot || !!profileId}
          autoComplete="off"
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      {!bot && (
        <div className="profile-choice">
          <label>
            Saved player {index + 1}
            <select
              value={profileId ?? ''}
              onChange={(e) => onSelect(e.target.value)}
            >
              <option value="">Guest / enter a name</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          {!profileId && (
            <button type="button" className="text-button" onClick={onSave}>
              Save this player
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayerProfiles({
  players,
  archives,
  onAdd,
  onRename,
  onPlay,
}: {
  players: Player[];
  archives: ArchivedMatch[];
  onAdd: (name: string) => Player | null;
  onRename: (id: string, name: string) => boolean;
  onPlay: (player: Player) => void;
}) {
  const [name, setName] = useState('');
  const [practice, setPractice] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const sorted = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  const summaries = useMemo(
    () =>
      new Map(
        sorted.map((player) => [
          player.id,
          playerSummary(archives, player.id, practice),
        ]),
      ),
    [sorted, archives, practice],
  );
  return (
    <div className="players-page">
      <section className="panel add-player-panel">
        <div>
          <div className="section-label">BUILD YOUR LINE-UP</div>
          <h2>Keep your name. Track your game.</h2>
          <p className="muted">
            Save a player, then select them at match setup to link their
            results.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (onAdd(name)) setName('');
          }}
        >
          <label>
            New player name
            <input
              required
              maxLength={30}
              value={name}
              placeholder="e.g. Wattsy"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            Add player +
          </button>
        </form>
      </section>
      <div className="players-toolbar">
        <span>
          {players.length} saved {players.length === 1 ? 'player' : 'players'}
        </span>
        <div role="group" aria-label="Player statistics mode">
          <button aria-pressed={!practice} onClick={() => setPractice(false)}>
            Versus players
          </button>
          <button aria-pressed={practice} onClick={() => setPractice(true)}>
            Practice
          </button>
        </div>
      </div>
      {!players.length && (
        <section className="panel empty-players">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>
          <h2>Your line-up starts here.</h2>
          <p>
            Save your first player above, or save a name when setting up a
            match.
          </p>
        </section>
      )}
      <div className="player-profile-grid">
        {sorted.map((player) => {
          const stats = summaries.get(player.id)!;
          return (
            <article
              className="panel player-profile"
              key={player.id}
              aria-label={`${player.name} profile`}
            >
              <div className="profile-heading">
                <span className="profile-avatar">
                  {player.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <span className="eyebrow">
                    {practice ? 'PRACTICE RECORD' : 'VERSUS PLAYERS'}
                  </span>
                  <h2>{player.name}</h2>
                </div>
                <button
                  className="text-button"
                  aria-label={`Rename ${player.name}`}
                  onClick={() => {
                    setEditing(player.id);
                    setRename(player.name);
                  }}
                >
                  Rename
                </button>
              </div>
              {editing === player.id && (
                <form
                  className="rename-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (onRename(player.id, rename)) setEditing(null);
                  }}
                >
                  <label>
                    Rename player
                    <input
                      required
                      maxLength={30}
                      value={rename}
                      onChange={(e) => setRename(e.target.value)}
                    />
                  </label>
                  <div>
                    <button className="button primary" type="submit">
                      Save name
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <div className="profile-record">
                <strong>
                  {stats.wins}
                  <small>WINS</small>
                </strong>
                <span> / </span>
                <strong>
                  {stats.losses}
                  <small>LOSSES</small>
                </strong>
                <div>
                  <b>
                    {stats.matches
                      ? `${Math.round((stats.wins / stats.matches) * 100)}%`
                      : '—'}
                  </b>
                  <small>WIN RATE</small>
                </div>
              </div>
              <dl className="profile-stat-grid">
                {[
                  ['3-dart average', stats.average],
                  ['Matches', stats.matches],
                  ['Legs won', stats.legsWon],
                  ['Legs lost', stats.legsLost],
                  ['180s', stats.maximums],
                  ['Highest checkout', stats.highestCheckout || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="profile-recent">
                <h3>Recent results</h3>
                {stats.recent.length ? (
                  stats.recent.map((result, i) => (
                    <div className="profile-result" key={i}>
                      <span className={result.won ? 'won' : 'lost'}>
                        {result.won ? 'W' : 'L'}
                      </span>
                      <span>
                        vs {result.opponent}
                        <small>
                          {new Date(result.date).toLocaleDateString()}
                        </small>
                      </span>
                      <strong>{result.score}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    No completed {practice ? 'practice' : 'player'} matches
                    linked to this profile yet.
                  </p>
                )}
              </div>
              <button
                className="button secondary"
                onClick={() => onPlay(player)}
              >
                Play as {player.name} ↗
              </button>
            </article>
          );
        })}
      </div>
      <p className="entry-hint">
        Statistics use completed matches linked to each profile in this
        browser’s retained history (latest 100 matches). Guest games and
        unfinished matches do not count. Renaming a player keeps the profile
        link and leaves names in old match reports unchanged.
      </p>
    </div>
  );
}
