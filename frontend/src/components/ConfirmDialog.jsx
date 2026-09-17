import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { belowTablet } from '../utils/media';

// A real modal: portal, focus starts on Cancel, Tab is trapped, Escape and
// backdrop click cancel. Rendered only while open.
export default function ConfirmDialog({ message, error, busy, onCancel, onConfirm }) {
  const messageId = useId();
  const panelRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busy) onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const buttons = [...panelRef.current.querySelectorAll('button:not([disabled])')];
      if (buttons.length === 0) {
        event.preventDefault();   // everything disabled mid-request: keep focus here
        return;
      }
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const inside = panelRef.current.contains(document.activeElement);

      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return createPortal(
    <Backdrop
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <Panel ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={messageId}>
        <Message id={messageId}>{message}</Message>
        {error && <Error role="alert">{error}</Error>}
        <Buttons>
          <CancelButton ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </CancelButton>
          <DangerButton type="button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </DangerButton>
        </Buttons>
      </Panel>
    </Backdrop>,
    document.body,
  );
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: var(--z-index-dialog);
  display: grid;
  place-items: center;
  background: var(--color-dialog-backdrop);
`;

const Panel = styled.div`
  width: min(var(--dialog-max-width), 100% - 2 * var(--space-page-gutter));
  display: flex;
  flex-direction: column;
  gap: var(--space-dialog-stack);
  padding: var(--space-dialog-padding);
  border-radius: var(--radius-dialog);
  background: var(--color-dialog-bg);
  box-shadow: var(--shadow-dialog);
  color: var(--color-dialog-text);
  font-family: var(--font-body);
  font-size: var(--size-dialog);
  line-height: var(--line-height-base);

  button:focus-visible {
    outline: var(--border-focus-ring) solid var(--color-focus-ring-on-light);
    outline-offset: var(--space-focus-offset);
  }
`;

const Message = styled.p`
  margin: 0;
  overflow-wrap: anywhere;
`;

const Error = styled.p`
  margin: 0;
  color: var(--color-danger-on-light);
`;

const Buttons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: var(--space-action-gap);
`;

const DialogButton = styled.button`
  min-height: var(--control-dialog-button);
  padding: 0 var(--space-button-padding-x);
  border: none;
  border-radius: var(--radius-button);
  font-size: var(--size-dialog);
  cursor: pointer;

  &:disabled {
    cursor: default;
  }

  ${belowTablet} {
    min-height: var(--control-touch-target);
  }
`;

const CancelButton = styled(DialogButton)`
  background: none;
  color: var(--color-dialog-text);
`;

const DangerButton = styled(DialogButton)`
  background: var(--color-danger-on-light);
  color: var(--color-text-on-filled);
  font-weight: var(--weight-medium);
`;
