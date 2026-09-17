import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import Card from './Card';
import ConfirmDialog from './ConfirmDialog';
import { theme } from '../theme';
import { isBlank } from '../utils/isBlank';
import { hostname } from '../utils/hostname';

// onDelete(id) and onUpdate(id, fields) must resolve to true on success, false on failure.
export default function Grid({ items, totalCount, person, otherFiltersActive, onDelete, onUpdate }) {
  const [target, setTarget] = useState(null);   // { item, index, trigger }
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const listRef = useRef(null);
  const emptyRef = useRef(null);
  const focusIndexAfterDelete = useRef(null);

  // After a successful delete, focus the card that took its place.
  useEffect(() => {
    const index = focusIndexAfterDelete.current;
    if (index == null || target) return;
    focusIndexAfterDelete.current = null;

    if (items.length === 0) {
      emptyRef.current?.focus();
      return;
    }
    const li = listRef.current?.children[Math.min(index, items.length - 1)];
    // Flip/close on the visible (non-inert) face, or Delete on a pending card.
    const toggle = [...(li?.querySelectorAll('[data-flip-toggle], [data-card-focus]') ?? [])].find(
      (el) => !el.closest('[inert]'),
    );
    toggle?.focus();
  }, [items, target]);

  function requestDelete(item, index, trigger) {
    setDeleteFailed(false);
    setTarget({ item, index, trigger });
  }

  function cancelDelete() {
    const trigger = target.trigger;
    setTarget(null);
    trigger?.focus();
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteFailed(false);
    const ok = await onDelete(target.item.id);
    setDeleting(false);
    if (!ok) {
      setDeleteFailed(true);
      return;
    }
    focusIndexAfterDelete.current = target.index;
    setTarget(null);
  }

  const dialog = target && (
    <ConfirmDialog
      message={`Delete "${isBlank(target.item.title) ? hostname(target.item.url) : target.item.title}"?`}
      error={deleteFailed ? "Couldn't delete. Try again?" : null}
      busy={deleting}
      onCancel={cancelDelete}
      onConfirm={confirmDelete}
    />
  );

  if (items.length === 0) {
    let message = 'No gifts match these filters.';
    if (totalCount === 0) message = 'Paste a link above to save your first idea.';
    else if (!otherFiltersActive && person) message = `No gifts saved for ${person} yet.`;
    // tabIndex lets focus land here after the last card is deleted.
    return (
      <>
        <Empty ref={emptyRef} tabIndex={-1}>{message}</Empty>
        {dialog}
      </>
    );
  }

  return (
    <>
      <List ref={listRef}>
        {items.map((item, index) => (
          <li key={item.id}>
            <Card
              item={item}
              onRequestDelete={(trigger) => requestDelete(item, index, trigger)}
              onUpdate={onUpdate}
            />
          </li>
        ))}
      </List>
      {dialog}
    </>
  );
}

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--grid-min-card-width), 1fr));
  gap: var(--space-grid-gap);

  @media (max-width: ${theme.breakpoint.phone}) {
    grid-template-columns: 1fr;
  }
`;

const Empty = styled.p`
  margin: 0;
  padding: var(--space-empty-state) 0;
  text-align: center;
  font-family: var(--font-body);
  font-size: var(--size-empty-state);
  color: var(--color-input-text);

  &:focus {
    outline: none;
  }
`;
