import { useEffect, useRef, useState } from 'react';
import { previewCorrection } from './domain/correction';
import type { CorrectionInput, CorrectionPolicy } from './domain/correction';
import { replay } from './domain/match';
import type { Session } from './domain/match';

export type CorrectionReview = {
  session: Session;
  commandIndex: number;
  revision: number;
};
export default function VisitCorrection({
  review,
  currentId,
  onApply,
  onClose,
}: {
  review: CorrectionReview;
  currentId?: string;
  onApply: (
    review: CorrectionReview,
    input: CorrectionInput,
    policy: CorrectionPolicy,
    replaceCurrent: boolean,
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const original = review.session.commands[review.commandIndex];
  if (original.type !== 'visit') throw new Error('Choose a visit.');
  const prefix = replay({
    ...review.session,
    commands: review.session.commands.slice(0, review.commandIndex),
  });
  const [input, setInput] = useState<CorrectionInput>({
    total: original.visit.total,
    darts: original.visit.darts,
    double: original.visit.double,
    ...(!prefix.opened[prefix.turn]
      ? { opens: original.visit.opens ?? false }
      : {}),
  });
  const [policy, setPolicy] = useState<CorrectionPolicy>('keep-following');
  const [preview, setPreview] = useState<ReturnType<
    typeof previewCorrection
  > | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [acknowledged, setAcknowledged] = useState(false),
    [replaceCurrent, setReplaceCurrent] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  function change(patch: Partial<CorrectionInput>) {
    setInput({ ...input, ...patch });
    setPreview(null);
    setError('');
    setAcknowledged(false);
    setReplaceCurrent(false);
  }
  const needsReplacement =
    !!preview?.reopensResult && !!currentId && currentId !== review.session.id;
  return (
    <section className="visit-correction" aria-label="Correct a recorded visit">
      <h2>Review a visit correction</h2>
      <p>
        {
          prefix.sides[prefix.turn].members[prefix.memberCursor[prefix.turn]]
            .name
        }{' '}
        · Leg {prefix.leg} · {original.visit.total} points /{' '}
        {original.visit.darts} darts originally recorded.
      </p>
      <p>
        This is a local correction. Following actions are replayed under the
        same rules and throw order. Total entry replaces any individual dart
        details on this visit.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setPreview(
              previewCorrection(
                review.session,
                review.commandIndex,
                input,
                policy,
              ),
            );
            setError('');
          } catch (e) {
            setPreview(null);
            setError(e instanceof Error ? e.message : 'Review failed.');
          }
        }}
      >
        <div className="correction-fields">
          <label>
            Corrected visit total
            <input
              disabled={busy}
              ref={first}
              type="number"
              min="0"
              max="180"
              required
              value={Number.isFinite(input.total) ? input.total : ''}
              onChange={(e) => change({ total: e.currentTarget.valueAsNumber })}
            />
          </label>
          <label>
            Corrected darts recorded
            <select
              disabled={busy}
              value={input.darts}
              onChange={(e) => change({ darts: Number(e.target.value) })}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(prefix.setup.outRule ?? 'double') === 'double' && (
          <label className="correction-check">
            <input
              disabled={busy}
              type="checkbox"
              checked={input.double}
              onChange={(e) => change({ double: e.target.checked })}
            />
            Finishing dart was a double / bull
          </label>
        )}
        {!prefix.opened[prefix.turn] && (
          <label className="correction-check">
            <input
              disabled={busy}
              type="checkbox"
              checked={input.opens ?? false}
              onChange={(e) => change({ opens: e.target.checked })}
            />
            This visit opened on a double
          </label>
        )}
        <label>
          Following actions
          <select
            disabled={busy}
            value={policy}
            onChange={(e) => {
              setPolicy(e.target.value as CorrectionPolicy);
              setPreview(null);
              setError('');
              setAcknowledged(false);
              setReplaceCurrent(false);
            }}
          >
            <option value="keep-following">
              Keep and replay following actions
            </option>
            <option value="discard-following">
              Remove all following actions
            </option>
          </select>
        </label>
        <button className="button secondary" disabled={busy}>
          Preview correction
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {preview && (
        <div
          className="correction-preview"
          role="region"
          aria-label="Correction consequences"
        >
          <h3>Before applying</h3>
          <p>
            {preview.removedActions} following actions removed ·{' '}
            {preview.changedFollowingVisits}{' '}
            {preview.changedFollowingVisits === 1
              ? 'following visit changes'
              : 'following visits change'}{' '}
            score or outcome.
          </p>
          {preview.after.sides.map((side, i) => (
            <p key={side.id}>
              <strong>{side.name}</strong>: {preview.before.scores[i]} →{' '}
              {preview.after.scores[i]} remaining · {preview.before.legs[i]} →{' '}
              {preview.after.legs[i]} played legs
              {preview.after.setup.setsToWin
                ? ` · ${preview.before.sets[i]} → ${preview.after.sets[i]} sets`
                : ''}
            </p>
          ))}
          <p>
            Match: {preview.before.status} → {preview.after.status}.{' '}
            {preview.after.winner === null
              ? 'No winner after this correction.'
              : `${preview.after.sides[preview.after.winner].name} wins after this correction.`}
          </p>
          {preview.removedSegmentDetails && (
            <p>
              Individual dart details for the edited visit will be removed.
              Other retained visits keep their own details and input labels.
            </p>
          )}
          {preview.reopensResult && (
            <p>
              This result reopens for play and is removed from finished history
              until it is decided again.
            </p>
          )}
          {preview.removedActions > 0 && (
            <label className="correction-check">
              <input
                disabled={busy}
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              Remove {preview.removedActions} following actions, including any
              later scores and match controls
            </label>
          )}
          {needsReplacement && (
            <label className="correction-check">
              <input
                disabled={busy}
                type="checkbox"
                checked={replaceCurrent}
                onChange={(e) => setReplaceCurrent(e.target.checked)}
              />
              Replace the current game with this reopened match. The current
              game is included in the recovery backup.
            </label>
          )}
          <p>
            A recovery copy is saved before the correction. Only the latest copy
            is kept; undo is available until another change is saved.
          </p>
          <button
            type="button"
            className="button primary"
            disabled={
              busy ||
              (preview.removedActions > 0 && !acknowledged) ||
              (needsReplacement && !replaceCurrent)
            }
            onClick={async () => {
              setBusy(true);
              try {
                if (await onApply(review, input, policy, replaceCurrent))
                  onClose();
              } catch (e) {
                setError(
                  e instanceof DOMException
                    ? 'The correction could not be saved. Original saved data is unchanged. When browser storage is available, reload and review the correction again.'
                    : e instanceof Error
                      ? e.message
                      : 'Correction could not be saved.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Saving correction…' : 'Apply reviewed correction'}
          </button>
        </div>
      )}
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={onClose}
      >
        Cancel correction
      </button>
    </section>
  );
}
