import type { Dispatch, SetStateAction } from 'react';
import type { Setup } from './domain/match';
import type { Player } from './domain/players';
import { PlayerField } from './PlayerProfiles';
import {
  changeFormat,
  freshRosterId,
  getSides,
  rosterView,
} from './domain/participants';
import type {
  MatchFormat,
  MatchSide,
  Participant,
} from './domain/participants';
export default function SideSetup({
  setup,
  setSetup,
  players,
  onAdd,
}: {
  setup: Setup;
  setSetup: Dispatch<SetStateAction<Setup>>;
  players: Player[];
  onAdd: (name: string) => Promise<Player | null>;
}) {
  const sides = setup.sides ?? getSides(setup),
    format = setup.format ?? 'singles';
  const team = format === 'pairs' || format === 'teams';
  const update = (
    sideId: string,
    memberId: string,
    patch: Partial<Participant>,
  ) =>
    setSetup((previous) => {
      const roster = previous.sides ?? getSides(previous);
      return rosterView(
        previous,
        roster.map((s) =>
          s.id !== sideId
            ? s
            : {
                ...s,
                members: s.members.map((m) =>
                  m.id === memberId ? { ...m, ...patch } : m,
                ),
              },
        ),
      );
    });
  function moveSide(index: number, delta: number) {
    const roster = [...sides];
    [roster[index], roster[index + delta]] = [
      roster[index + delta],
      roster[index],
    ];
    setSetup(rosterView(setup, roster));
  }
  function changeMembers(sideId: string, members: Participant[]) {
    setSetup(
      rosterView(
        setup,
        sides.map((s) => (s.id === sideId ? { ...s, members } : s)),
      ),
    );
  }
  return (
    <section className="roster-setup" aria-label="Players and sides">
      <label>
        Player format
        <select
          value={format}
          disabled={!!setup.bot}
          onChange={(e) => {
            const chosen = e.target.value as MatchFormat;
            setSetup({
              ...changeFormat(setup, chosen),
              startMethod:
                chosen === 'multiplayer' ? undefined : setup.startMethod,
            });
          }}
        >
          <option value="singles">Two-player singles</option>
          <option value="multiplayer">Three to eight players</option>
          <option value="pairs">Pairs · two per side</option>
          <option value="teams">Teams · two to four per side</option>
        </select>
      </label>
      {team && (
        <p className="muted">
          Sides alternate visits. Members rotate in the listed order, including
          misses and busts. A double opens the whole side. The first listed
          member represents the side in a bull-off.
        </p>
      )}
      {format === 'multiplayer' && (
        <p className="muted">
          Players take turns in the listed order. A withdrawal skips that
          player; the others continue until a checkout wins the match or one
          side remains.
        </p>
      )}
      <div className="roster-sides">
        {sides.map((side, sideIndex) => {
          const offset = sides
            .slice(0, sideIndex)
            .reduce((n, s) => n + s.members.length, 0);
          return (
            <fieldset className="roster-side" key={side.id}>
              <legend>
                {team ? `Side ${sideIndex + 1}` : `Player ${sideIndex + 1}`}
              </legend>
              {team && (
                <label>
                  Side {sideIndex + 1} name
                  <input
                    maxLength={30}
                    required
                    value={side.name}
                    onChange={(e) =>
                      setSetup(
                        rosterView(
                          setup,
                          sides.map((s) =>
                            s.id === side.id
                              ? { ...s, name: e.target.value }
                              : s,
                          ),
                        ),
                      )
                    }
                  />
                </label>
              )}
              {side.members.map((member, memberIndex) => (
                <div className="roster-member" key={member.id}>
                  <PlayerField
                    index={offset + memberIndex}
                    name={member.name}
                    bot={!!setup.bot && sideIndex === 1}
                    profileId={member.profileId}
                    players={players}
                    onName={(name) => update(side.id, member.id, { name })}
                    onSelect={(id) =>
                      update(side.id, member.id, {
                        profileId: id || null,
                        ...(id
                          ? { name: players.find((p) => p.id === id)!.name }
                          : {}),
                      })
                    }
                    onSave={async () => {
                      const saved = await onAdd(member.name);
                      if (!saved) return;
                      setSetup((previous) => {
                        const roster = previous.sides ?? getSides(previous),
                          current = roster
                            .find((s) => s.id === side.id)
                            ?.members.find((m) => m.id === member.id);
                        if (
                          !current ||
                          current.name !== member.name ||
                          current.profileId ||
                          (previous.bot &&
                            roster.findIndex((s) => s.id === side.id) === 1)
                        )
                          return previous;
                        return rosterView(
                          previous,
                          roster.map((s) => ({
                            ...s,
                            members: s.members.map((m) =>
                              m.id === member.id
                                ? {
                                    ...m,
                                    name: saved.name,
                                    profileId: saved.id,
                                  }
                                : m,
                            ),
                          })),
                        );
                      });
                    }}
                  />
                  {team && (
                    <div className="roster-order">
                      <button
                        type="button"
                        className="text-button"
                        disabled={memberIndex === 0}
                        aria-label={`Move player ${offset + memberIndex + 1} up`}
                        onClick={() => {
                          const members = [...side.members];
                          [members[memberIndex - 1], members[memberIndex]] = [
                            members[memberIndex],
                            members[memberIndex - 1],
                          ];
                          changeMembers(side.id, members);
                        }}
                      >
                        ↑ Earlier
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={memberIndex === side.members.length - 1}
                        aria-label={`Move player ${offset + memberIndex + 1} down`}
                        onClick={() => {
                          const members = [...side.members];
                          [members[memberIndex + 1], members[memberIndex]] = [
                            members[memberIndex],
                            members[memberIndex + 1],
                          ];
                          changeMembers(side.id, members);
                        }}
                      >
                        ↓ Later
                      </button>
                      {format === 'teams' && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={side.members.length <= 2}
                          aria-label={`Remove player ${offset + memberIndex + 1}`}
                          onClick={() =>
                            changeMembers(
                              side.id,
                              side.members.filter((m) => m.id !== member.id),
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {format === 'teams' && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={side.members.length >= 4}
                  onClick={() =>
                    changeMembers(side.id, [
                      ...side.members,
                      {
                        id: freshRosterId(),
                        name: `Player ${sides.reduce((n, s) => n + s.members.length, 0) + 1}`,
                        profileId: null,
                      },
                    ])
                  }
                >
                  Add member to side {sideIndex + 1}
                </button>
              )}
              {format === 'multiplayer' && (
                <div className="roster-order">
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Move side ${sideIndex + 1} up`}
                    disabled={sideIndex === 0}
                    onClick={() => moveSide(sideIndex, -1)}
                  >
                    ↑ Earlier
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Move side ${sideIndex + 1} down`}
                    disabled={sideIndex === sides.length - 1}
                    onClick={() => moveSide(sideIndex, 1)}
                  >
                    ↓ Later
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Remove side ${sideIndex + 1}`}
                    disabled={sides.length <= 3}
                    onClick={() =>
                      setSetup(
                        rosterView(
                          setup,
                          sides.filter((s) => s.id !== side.id),
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
      {format === 'multiplayer' && (
        <button
          type="button"
          className="button secondary"
          disabled={sides.length >= 8}
          onClick={() => {
            const side: MatchSide = {
              id: freshRosterId(),
              name: `Player ${sides.length + 1}`,
              members: [
                {
                  id: freshRosterId(),
                  name: `Player ${sides.length + 1}`,
                  profileId: null,
                },
              ],
            };
            setSetup(rosterView(setup, [...sides, side]));
          }}
        >
          Add local player
        </button>
      )}
      {team && (
        <label>
          Member order between legs
          <select
            value={setup.memberRotation ?? 'reset-each-leg'}
            onChange={(e) =>
              setSetup({
                ...setup,
                memberRotation: e.target.value as Setup['memberRotation'],
              })
            }
          >
            <option value="reset-each-leg">
              Restart from first listed member each leg
            </option>
            <option value="continue">
              Continue member rotation across legs
            </option>
          </select>
        </label>
      )}
    </section>
  );
}
