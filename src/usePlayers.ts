import { useState } from 'react';
import {
  addPlayer,
  playersKey,
  readPlayers,
  renamePlayer,
} from './domain/players';
import type { Player } from './domain/players';
function load() {
  try {
    return {
      players: readPlayers(localStorage.getItem(playersKey)),
      problem: '',
      locked: false,
    };
  } catch {
    return {
      players: [],
      problem:
        'Saved players could not be loaded. Their data is preserved until you choose to reset it.',
      locked: true,
    };
  }
}
export function usePlayers() {
  const [initial] = useState(load);
  const [players, setPlayers] = useState<Player[]>(initial.players);
  const [problem, setProblem] = useState(initial.problem);
  const [locked, setLocked] = useState(initial.locked);
  function save(next: Player[]) {
    localStorage.setItem(
      playersKey,
      JSON.stringify({ version: 1, players: next }),
    );
    setPlayers(next);
    setProblem('');
  }
  function add(name: string): Player | null {
    if (locked) return null;
    try {
      const next = addPlayer(players, name);
      save(next);
      return next.at(-1)!;
    } catch (e) {
      setProblem(
        e instanceof DOMException
          ? 'Player could not be saved. Browser storage may be unavailable or full.'
          : e instanceof Error
            ? e.message
            : 'Could not save player.',
      );
      return null;
    }
  }
  function rename(id: string, name: string): boolean {
    if (locked) return false;
    try {
      save(renamePlayer(players, id, name));
      return true;
    } catch (e) {
      setProblem(
        e instanceof DOMException
          ? 'Player could not be renamed. Browser storage may be unavailable or full.'
          : e instanceof Error
            ? e.message
            : 'Could not rename player.',
      );
      return false;
    }
  }
  function reset() {
    if (
      !window.confirm(
        'Reset the unreadable saved players? This cannot be undone. Match history will remain.',
      )
    )
      return;
    try {
      localStorage.removeItem(playersKey);
      setPlayers([]);
      setLocked(false);
      setProblem('');
    } catch {
      setProblem(
        'Browser storage is unavailable. Saved players could not be reset.',
      );
    }
  }
  return { players, problem, locked, add, rename, reset };
}
