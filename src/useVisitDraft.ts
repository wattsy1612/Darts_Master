import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyDraft,
  hasDraft,
  openDraftStore,
  turnIdentity,
} from './data/draft';
import type { DraftStore, VisitDraft } from './data/draft';
import type { Session } from './domain/match';

type State = {
  turn: string;
  value: VisitDraft;
  recovery: VisitDraft | null;
  loading: boolean;
};
export function useVisitDraft(
  session: Session | null,
  durable: boolean,
  enabled: boolean,
) {
  const turn = session ? turnIdentity(session) : '';
  const [state, setState] = useState<State>({
    turn: '',
    value: emptyDraft(),
    recovery: null,
    loading: !!session,
  });
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('');
  const store = useRef<DraftStore | null>(null);
  const writable = useRef(false);
  const generation = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(turn);
  latest.current = turn;
  // A new turn is empty synchronously, before effects can clear the previous one.
  const current =
    state.turn === turn
      ? state
      : { turn, value: emptyDraft(), recovery: null, loading: !!session };
  const sessionSnapshot = useMemo(() => session, [turn]);
  useEffect(() => {
    let active = true;
    setNotice('');
    setStatus('');
    writable.current = false;
    generation.current++;
    if (!sessionSnapshot || !enabled) {
      setState({ turn, value: emptyDraft(), recovery: null, loading: false });
      return;
    }
    setState({ turn, value: emptyDraft(), recovery: null, loading: true });
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (!store.current) store.current = await openDraftStore();
        const recovery = await store.current.read(sessionSnapshot);
        if (active) writable.current = true;
        if (active)
          setState({ turn, value: emptyDraft(), recovery, loading: false });
      })
      .catch(() => {
        if (active) {
          setNotice(
            'Draft recovery is unavailable. Keep this tab open until you record your visit.',
          );
          setState({
            turn,
            value: emptyDraft(),
            recovery: null,
            loading: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [turn, enabled, sessionSnapshot]);
  useEffect(() => {
    if (
      !sessionSnapshot ||
      !enabled ||
      !durable ||
      current.loading ||
      current.recovery ||
      !store.current ||
      !writable.current
    )
      return;
    const value = current.value;
    const operation = ++generation.current;
    setStatus(hasDraft(value) ? 'Saving draft…' : '');
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        await store.current!.save(sessionSnapshot, value);
        if (latest.current === turn && operation === generation.current) {
          setNotice('');
          setStatus(hasDraft(value) ? 'Draft saved in this tab' : '');
        }
      })
      .catch((error) => {
        if (latest.current === turn && operation === generation.current) {
          setStatus('');
          setNotice(
            `Draft not saved. ${error instanceof Error ? error.message : 'Keep this page open.'}`,
          );
        }
      });
  }, [
    current.value,
    current.loading,
    current.recovery,
    durable,
    enabled,
    sessionSnapshot,
    turn,
  ]);
  function update(patch: Partial<VisitDraft>) {
    setState((previous) => ({
      turn,
      value: {
        ...(previous.turn === turn ? previous.value : emptyDraft()),
        ...patch,
      },
      recovery: null,
      loading: false,
    }));
  }
  function restore() {
    if (current.recovery)
      setState({
        turn,
        value: current.recovery,
        recovery: null,
        loading: false,
      });
  }
  function discard() {
    setState({ turn, value: emptyDraft(), recovery: null, loading: false });
  }
  return {
    value: current.value,
    recovery: current.recovery,
    loading: current.loading,
    notice,
    status,
    update,
    restore,
    discard,
  };
}
