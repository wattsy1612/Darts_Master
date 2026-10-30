import { describe, expect, it } from 'vitest';
import {
  gameRegistry,
  parseGameRecord,
  replayGame,
  playableGames,
} from './registry';
import { gameIdOf } from './identity';
import { createCricket, cricketRulesVersion } from './cricket';
import { normaliseSession } from '../session';
import { inspectBackup } from '../../data/backup';
import { replay } from '../match';
import type { Session } from '../match';
const x01: Session = {
  version: 1,
  id: 'old-x01',
  setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
  commands: [],
};
const cricket = {
  game: 'cricket',
  version: 1,
  rulesVersion: cricketRulesVersion,
  id: 'new-cricket',
  setup: createCricket({
    players: ['A', 'B'],
    variant: 'standard',
    bull: 'split',
    legsToWin: 1,
  }).setup,
  commands: [],
};
describe('typed game plugin contract', () => {
  it('keeps historical X01 records untagged and unchanged while recognising explicit X01', () => {
    const before = JSON.stringify(x01),
      old = parseGameRecord(x01),
      tagged = parseGameRecord({ ...x01, game: 'x01' });
    expect(old).toEqual(x01);
    expect(tagged.game).toBe('x01');
    expect(gameIdOf(old)).toBe('x01');
    expect(JSON.stringify(x01)).toBe(before);
    expect(replayGame(old)).toEqual(replay(x01));
  });
  it('dispatches Cricket through its own canonical rules without X01 score arithmetic', () => {
    const record = parseGameRecord(cricket),
      match = replayGame(record);
    expect(record.game).toBe('cricket');
    expect(match).toHaveProperty('marks');
    expect(match).not.toHaveProperty('scores');
    expect(record).not.toHaveProperty('setup.start');
  });
  it('does not silently reinterpret explicit Cricket or unknown game tags as X01', () => {
    for (const game of ['cricket', 'tactics', '', null, 3]) {
      const claimed = { ...x01, game };
      expect(() => normaliseSession(claimed)).toThrow();
      expect(() => replay(claimed as Session)).toThrow();
      expect(() =>
        inspectBackup(
          JSON.stringify({
            format: 'darts-master-match',
            version: 1,
            session: claimed,
          }),
        ),
      ).toThrow();
    }
  });
  it('keeps not-yet-integrated games out of available play choices and persistence', () => {
    expect(playableGames().map((g) => g.id)).toEqual(['x01']);
    expect(gameRegistry.cricket.playable).toBe(false);
    expect(() => normaliseSession(cricket)).toThrow(/Cricket/);
    expect(() =>
      inspectBackup(
        JSON.stringify({
          format: 'darts-master-match',
          version: 1,
          session: cricket,
        }),
      ),
    ).toThrow(/Cricket/);
  });
  it('declares input/format capabilities explicitly and never mixes game-specific metrics', () => {
    expect(gameRegistry.cricket.capabilities).toMatchObject({
      totalEntry: false,
      passTurn: true,
      bots: false,
      sets: false,
      maxSides: 2,
      historicalTotalCorrection: false,
    });
    expect(gameRegistry.x01.capabilities).toMatchObject({
      totalEntry: true,
      passTurn: false,
      bots: true,
      sets: true,
      maxSides: 8,
      historicalTotalCorrection: true,
    });
    const stats = gameRegistry.cricket.stats(
      gameRegistry.cricket.replay(gameRegistry.cricket.normalise(cricket)),
    );
    expect(stats).toMatchObject({
      metricsVersion: 'cricket-recorded-v1',
      marksPerThreeDarts: '—',
      verifiedCompetitiveRecord: false,
    });
    expect(stats).not.toHaveProperty('average');
    expect(gameRegistry.x01.stats(replay(x01))).toMatchObject({
      metricsVersion: 'x01-recorded-v1',
      average: '—',
    });
  });
  it('preserves explicit supported rules versions and rejects unknown X01 semantics', () => {
    const explicit = parseGameRecord({
      ...x01,
      game: 'x01',
      rulesVersion: 'x01-configured-v1',
    });
    expect(explicit).toHaveProperty('rulesVersion', 'x01-configured-v1');
    for (const rulesVersion of ['future', null, 2])
      expect(() => parseGameRecord({ ...x01, rulesVersion })).toThrow(
        /rules version/,
      );
  });
  it('rejects unsupported game identities and malformed records', () => {
    for (const input of [null, [], { game: 'unregistered' }, false])
      expect(() => parseGameRecord(input)).toThrow();
    expect(() =>
      parseGameRecord({ ...cricket, rulesVersion: 'future' }),
    ).toThrow();
  });
});
