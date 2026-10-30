import { useRef, useState } from 'react';
import type { Player } from './domain/players';
import type { LocalRepository } from './data/repository';
export function usePlayers(repository: LocalRepository) {
  const [players, setPlayers] = useState<Player[]>(
    repository.document.data.players,
  );
  const [problem, setProblem] = useState(repository.legacyErrors.players ?? '');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const locked = repository.mode !== 'database';
  async function add(name: string): Promise<Player | null> {
    if (locked || inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    try {
      const player = await repository.addPlayer(name);
      setPlayers(repository.document.data.players);
      setProblem('');
      return player;
    } catch (e) {
      setProblem(
        e instanceof DOMException
          ? 'Player could not be saved. Browser storage may be unavailable or full.'
          : e instanceof Error
            ? e.message
            : 'Could not save player.',
      );
      return null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  async function rename(id: string, name: string): Promise<boolean> {
    if (locked || inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    try {
      await repository.renamePlayer(id, name);
      setPlayers(repository.document.data.players);
      setProblem('');
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
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  async function reset() {
    if (
      !window.confirm(
        'Reset the unreadable saved players? This cannot be undone. Match history will remain.',
      )
    )
      return;
    try {
      await repository.resetLegacy('players');
      window.location.reload();
    } catch {
      setProblem(
        'Browser storage is unavailable. Saved players could not be reset.',
      );
    }
  }
  return { players, problem, locked, pending, add, rename, reset };
}
