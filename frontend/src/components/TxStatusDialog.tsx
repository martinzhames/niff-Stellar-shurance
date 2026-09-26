import { useEffect, useRef } from 'react';
import type { TxState } from '../hooks/useContractTx';

/**
 * Human-readable copy for each lifecycle step. Kept in sync with the
 * `TxState` union so the dialog can render every transition.
 */
const STEP_LABELS: Record<TxState, string> = {
  idle: 'Ready',
  building: 'Building transaction…',
  'awaiting-signature': 'Waiting for wallet signature…',
  submitting: 'Submitting transaction…',
  confirming: 'Confirming on-chain…',
  success: 'Transaction confirmed',
  error: 'Transaction failed',
};

/** Ordered steps used to render the progress list. */
const ORDERED_STEPS: TxState[] = [
  'building',
  'awaiting-signature',
  'submitting',
  'confirming',
  'success',
];

const STEP_INDEX: Record<TxState, number> = {
  idle: -1,
  building: 0,
  'awaiting-signature': 1,
  submitting: 2,
  confirming: 3,
  success: 4,
  error: -1,
};

export interface TxStatusDialogProps {
  /** Current lifecycle state from `useContractTx`. */
  state: TxState;
  /** Whether the dialog is visible. */
  open: boolean;
  /** Explorer URL for the confirmed transaction, if available. */
  explorerUrl?: string | null;
  /** Human-readable error message, if the transaction failed. */
  error?: string | null;
  /** Retry handler shown when the transaction failed. */
  onRetry?: () => void;
  /** Close handler. Closing never cancels an in-flight transaction. */
  onClose: () => void;
}

/**
 * Reusable status dialog for the contract transaction lifecycle.
 *
 * Closing the dialog mid-flow does not cancel the transaction: the hook keeps
 * tracking it in the background and the caller can re-open this dialog to see
 * the final state.
 */
export function TxStatusDialog({
  state,
  open,
  explorerUrl,
  error,
  onRetry,
  onClose,
}: TxStatusDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog when it opens for accessibility.
  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const activeIndex = STEP_INDEX[state];
  const isError = state === 'error';
  const isSuccess = state === 'success';

  return (
    <div
      className="tx-status-dialog__backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="tx-status-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Transaction status"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="tx-status-dialog__header">
          <h2 className="tx-status-dialog__title">Transaction status</h2>
          <button
            type="button"
            className="tx-status-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <ol className="tx-status-dialog__steps">
          {ORDERED_STEPS.map((step, index) => {
            const isDone = isSuccess || (activeIndex > index && !isError);
            const isActive = !isError && activeIndex === index;
            return (
              <li
                key={step}
                className={[
                  'tx-status-dialog__step',
                  isDone ? 'is-done' : '',
                  isActive ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="tx-status-dialog__step-marker" aria-hidden="true">
                  {isDone ? '✓' : index + 1}
                </span>
                <span className="tx-status-dialog__step-label">
                  {STEP_LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>

        {isError && (
          <p className="tx-status-dialog__error" role="alert">
            {error ?? 'Something went wrong. Please try again.'}
          </p>
        )}

        {isSuccess && explorerUrl && (
          <a
            className="tx-status-dialog__explorer"
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on explorer ↗
          </a>
        )}

        <footer className="tx-status-dialog__footer">
          {isError && onRetry && (
            <button
              type="button"
              className="tx-status-dialog__retry"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
          <button
            type="button"
            className="tx-status-dialog__dismiss"
            onClick={onClose}
          >
            {isSuccess || isError ? 'Close' : 'Continue in background'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default TxStatusDialog;
