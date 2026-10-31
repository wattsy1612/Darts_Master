import ScoreEvidence from './ScoreEvidence';
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
  onAdd: (name: string) => Promise<Player | null>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onPlay: (player: Player) => void;
}) {
  const [name, setName] = useState('');
  const [practice, setPractice] = useState(false);
  const [format, setFormat] = useState<
    'singles' | 'multiplayer' | 'team' | 'all'
  >('singles');
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
          playerSummary(archives, player.id, practice, format),
        ]),
      ),
    [sorted, archives, practice, format],
  );
  return (
    <div
      className={`players-page ${players.length ? 'has-players' : 'is-empty'}`}
    >
      <section className="panel add-player-panel">
        <div>
          <div className="section-label">THE PEOPLE AT YOUR BOARD</div>
          <h2>
            {players.length ? (
              'Add to your line-up.'
            ) : (
              <>
                Your line-up.
                <br />
                Your next game.
              </>
            )}
          </h2>
          <p className="muted">
            Save the players you throw with. Select them at match setup to keep
            their results together.
          </p>
        </div>
        <form
          className="add-player-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onAdd(name)) setName('');
          }}
        >
          <label>
            New player name
            <input
              required
              maxLength={30}
              value={name}
              placeholder="Enter a player’s name"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            Add player +
          </button>
        </form>
      </section>
      <div className="players-collection-heading">
        <div>
          <h2>
            Your players <span>{players.length}</span>
          </h2>
          <p>Saved on this device</p>
        </div>
      </div>
      <div className="players-toolbar">
        <div role="group" aria-label="Player statistics mode">
          <button aria-pressed={!practice} onClick={() => setPractice(false)}>
            Versus players
          </button>
          <button aria-pressed={practice} onClick={() => setPractice(true)}>
            Practice
          </button>
        </div>{' '}
        <label className="record-format">
          Record format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
          >
            <option value="singles">Singles</option>
            <option value="multiplayer">Multiplayer</option>
            <option value="team">Pairs and teams</option>
            <option value="all">All local formats</option>
          </select>
        </label>
      </div>
      <p className="record-scope">
        Records combine retained local X01 rule variants within the selected
        match format and mode. They are not verified rankings.
      </p>
      {!players.length && (
        <section className="panel empty-players">
          <div className="lineup-illustration" aria-hidden="true">
            <svg viewBox="0 0 220 160" fill="none">
              <circle
                cx="110"
                cy="72"
                r="54"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle
                cx="110"
                cy="72"
                r="38"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle
                cx="110"
                cy="72"
                r="18"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle cx="110" cy="72" r="5" fill="currentColor" />
              <path
                d="M110 18v36m0 36v36M56 72h36m36 0h36M72 34l26 26m24 24 26 26M148 34l-26 26m-24 24-26 26"
                stroke="currentColor"
              />
              <path
                d="m110 72 48-39 22 2-12 16-15-7-43 28Z"
                fill="currentColor"
              />
              <path d="M55 145h110" stroke="currentColor" />
            </svg>
          </div>
          <h2>A place for your first player.</h2>
          <p>
            Add a name above to get started. Their linked results will appear
            here as you play.
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
                <span
                  className="profile-avatar"
                  data-tone={
                    Array.from(player.id).reduce(
                      (n, c) => n + c.charCodeAt(0),
                      0,
                    ) % 4
                  }
                >
                  {player.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <span className="eyebrow">
                    {practice ? 'PRACTICE RECORD' : 'LOCAL PLAYER'}
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
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await onRename(player.id, rename)) setEditing(null);
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
              <dl className="profile-stat-grid">
                {[
                  [
                    '3-dart average',
                    stats.coverage.darts ? stats.average : '—',
                  ],
                  ['Matches', stats.matches],
                  [
                    format === 'team' || format === 'all'
                      ? 'Side legs won'
                      : 'Legs won',
                    stats.legsWon,
                  ],
                  [
                    format === 'team' || format === 'all'
                      ? 'Opposing legs'
                      : 'Legs lost',
                    stats.legsLost,
                  ],
                  ['180s', stats.maximums],
                  ['Highest checkout', stats.highestCheckout || '—'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className={
                      label === '3-dart average' ? 'profile-average' : undefined
                    }
                  >
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
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

              <ScoreEvidence
                coverage={stats.coverage}
                importedMatches={stats.importedMatches}
                ruleVariants={stats.ruleVariants}
                opponentVariants={stats.opponentVariants}
              />
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
        Statistics use decided matches linked to each profile in this browser’s
        retained history (latest 100 matches). Guest games and unfinished or
        abandoned matches do not count. Concessions count as match outcomes
        without adding unplayed legs. Renaming a player keeps the profile link
        and leaves names in old match reports unchanged.
      </p>
    </div>
  );
}
