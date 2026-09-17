import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { CloseIcon, FlipIcon, PenIcon } from './icons';
import { Face, CardTitle, Visit, IconButton, OutlinedIconButton, DeleteButton } from './styles';
import { formatPrice } from '../../utils/formatPrice';
import { isBlank } from '../../utils/isBlank';
import { KINDS } from '../../constants/kinds';
import { OCCASION_LIST_ID } from '../../constants/occasions';
import { belowTablet } from '../../utils/media';

const MAX_VISIBLE_LABELS = 4;

// Draft values are strings, exactly as the inputs hold them.
function toDraft(item) {
  return {
    title: item.title ?? '',
    kind: item.kind ?? '',
    occasion: item.occasion ?? '',
    price: item.price == null ? '' : String(item.price),
  };
}

const parsePrice = (text) => (text.trim() === '' ? null : Number(text));

// Only the fields that actually changed, in the shape PATCH expects.
function changedFields(item, draft) {
  const fields = {};
  const title = draft.title.trim();
  const occasion = draft.occasion.trim();
  const price = parsePrice(draft.price);

  if (title !== (item.title ?? '')) fields.title = title;
  if (draft.kind !== (item.kind ?? '')) fields.kind = draft.kind === '' ? null : draft.kind;
  if (occasion !== (item.occasion ?? '')) fields.occasion = occasion;
  if (price !== (item.price ?? null)) fields.price = price;
  return fields;
}

// onUpdate(id, fields) must resolve to true on success, false on failure.
export default function CardBack({ item, inert, onClose, closeRef, onRequestDelete, onUpdate }) {
  const [draft, setDraft] = useState(null);   // null = not editing
  const [priceBadInput, setPriceBadInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const formId = useId();
  const occasionRef = useRef(null);
  const editRef = useRef(null);
  const focusNext = useRef(null);   // 'occasion' | 'edit' | null

  const editing = draft !== null;

  useEffect(() => {
    const target = { occasion: occasionRef, edit: editRef }[focusNext.current];
    focusNext.current = null;
    target?.current?.focus();
  }, [editing]);

  const labels = item.labels ?? [];
  const visibleLabels = labels.slice(0, MAX_VISIBLE_LABELS);
  const hiddenCount = labels.length - visibleLabels.length;

  let canSave = false;
  if (editing) {
    const price = parsePrice(draft.price);
    const priceInvalid = priceBadInput || (price !== null && (!Number.isFinite(price) || price < 0));
    const titleCleared = isBlank(draft.title) && !isBlank(item.title);
    canSave = !saving && !priceInvalid && !titleCleared;
  }

  function startEdit() {
    setSaveFailed(false);
    setPriceBadInput(false);
    setDraft(toDraft(item));
    focusNext.current = 'occasion';
  }

  function cancelEdit({ refocus = true } = {}) {
    setSaveFailed(false);
    setDraft(null);
    if (refocus) focusNext.current = 'edit';
  }

  function close() {
    if (editing) cancelEdit({ refocus: false });   // closing mid-edit = Cancel
    onClose();
  }

  async function save(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaveFailed(false);

    const fields = changedFields(item, draft);
    if (Object.keys(fields).length === 0) {
      cancelEdit();
      return;
    }

    setSaving(true);
    const ok = await onUpdate(item.id, fields);
    setSaving(false);
    setDraft(null);
    setSaveFailed(!ok);
    focusNext.current = 'edit';
  }

  const update = (field) => (event) =>
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <BackFace
      inert={inert}
      $editing={editing}
      onKeyDown={(event) => {
        if (editing && !saving && event.key === 'Escape') cancelEdit();
      }}
    >
      {editing && <form id={formId} onSubmit={save} hidden />}

      <Header>
        {editing ? (
          <>
            <Input
              form={formId}
              aria-label="Title"
              value={draft.title}
              onChange={update('title')}
            />
            <HeaderButton
              aria-label="Cancel editing"
              onClick={() => cancelEdit()}
              disabled={saving}
            >
              <CloseIcon />
            </HeaderButton>
          </>
        ) : (
          <>
            <CardTitle>{item.title}</CardTitle>
            <HeaderButton ref={editRef} aria-label="Edit" onClick={startEdit}>
              <PenIcon />
            </HeaderButton>
          </>
        )}
      </Header>

      {!isBlank(item.description) && <Description>{item.description}</Description>}

      <Fields>
        <dt>For</dt>
        <dd>{isBlank(item.person) ? '' : item.person}</dd>

        {editing && (
          <>
            <dt><label htmlFor={`${formId}-kind`}>Kind</label></dt>
            <dd>
              <Select
                id={`${formId}-kind`}
                form={formId}
                value={draft.kind}
                onChange={update('kind')}
              >
                <option value="">None</option>
                {KINDS.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </Select>
            </dd>
          </>
        )}

        <dt>
          {editing ? <label htmlFor={`${formId}-occasion`}>Occasion</label> : 'Occasion'}
        </dt>
        <dd>
          {editing ? (
            <Input
              ref={occasionRef}
              id={`${formId}-occasion`}
              form={formId}
              list={OCCASION_LIST_ID}
              value={draft.occasion}
              onChange={update('occasion')}
            />
          ) : isBlank(item.occasion) ? '' : item.occasion}
        </dd>

        <dt>
          {editing ? <label htmlFor={`${formId}-price`}>Price</label> : 'Price'}
        </dt>
        <dd>
          {editing ? (
            <Input
              id={`${formId}-price`}
              form={formId}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={draft.price}
              onChange={(event) => {
                setPriceBadInput(event.target.validity.badInput);
                update('price')(event);
              }}
            />
          ) : (
            formatPrice(item.price, item.currency)
          )}
        </dd>
      </Fields>

      {labels.length > 0 && (
        <Chips>
          {visibleLabels.map((label, i) => (
            <li key={`${i}-${label}`}>{label}</li>
          ))}
          {hiddenCount > 0 && <li>+{hiddenCount}</li>}
        </Chips>
      )}

      <Footer>
        {saveFailed && <ErrorLine role="alert">Couldn't save changes.</ErrorLine>}
        <Actions>
          <Visit href={item.url}>Visit</Visit>
          {editing ? (
            <OutlineButton type="submit" form={formId} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save'}
            </OutlineButton>
          ) : (
            <OutlinedIconButton
              ref={closeRef}
              data-flip-toggle
              aria-label="Hide details"
              onClick={close}
            >
              <FlipIcon />
            </OutlinedIconButton>
          )}
          <DeleteButton onClick={(e) => onRequestDelete(e.currentTarget)}>Delete</DeleteButton>
        </Actions>
      </Footer>
    </BackFace>
  );
}

// Sits on top of the front; scrolls if its content is taller.
const BackFace = styled(Face)`
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  display: flex;
  flex-direction: column;
  gap: var(--space-back-stack);
  padding: var(--space-card-padding);

  > * {
    flex-shrink: 0;
  }

  /* Edit mode: still scrollable, but no visible scrollbar. */
  ${({ $editing }) => $editing && `
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  `}
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-action-gap);

  > :first-child {
    flex: 1;
    min-width: 0;
  }
`;

// Top-right of the back: the edit pen, or the cancel X while editing.
const HeaderButton = styled(IconButton)`
  width: var(--control-close-button);
  height: var(--control-close-button);
`;

const Description = styled.p`
  margin: 0;
  font-size: var(--size-body);
  line-height: var(--line-height-body);
  color: var(--color-text-body);

  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--clamp-description);
  overflow: hidden;
`;

const Fields = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-field-row-gap) var(--space-action-gap);
  font-size: var(--size-field-label);

  dt {
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    min-width: 0;
    text-align: right;
    color: var(--color-text-strong);
    overflow-wrap: anywhere;
  }
`;

const fieldControl = `
  width: 100%;
  min-width: 0;
  padding: var(--space-input-padding-y) var(--space-input-padding-x);
  border: var(--border-hairline) solid var(--color-input-border);
  border-radius: var(--radius-input);
  background: var(--color-input-bg);
  color: var(--color-input-text);
  font-family: var(--font-body);
  font-size: var(--size-card-input);
  line-height: var(--line-height-base);
`;

const Input = styled.input`
  ${fieldControl}
`;

const Select = styled.select`
  ${fieldControl}
`;

const Chips = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-chip-gap);

  li {
    padding: var(--space-chip-padding-y) var(--space-chip-padding-x);
    border-radius: var(--radius-pill);
    background: var(--color-surface-raised);
    color: var(--color-text-body);
    font-size: var(--size-chip);
  }
`;

// Pinned to the bottom; the error line sits directly above the divider.
const Footer = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-card-stack);
`;

const ErrorLine = styled.p`
  margin: 0;
  font-size: var(--size-body);
  color: var(--color-danger-on-dark);
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-action-gap);
  padding-top: var(--space-card-padding);
  border-top: var(--border-hairline) solid var(--color-border);
`;

const OutlineButton = styled.button`
  min-height: var(--control-flip-button);
  padding: 0 var(--space-button-padding-x);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-button);
  background: transparent;
  color: var(--color-text-body);
  font-size: var(--size-button);
  cursor: pointer;

  &:disabled {
    cursor: default;
  }

  ${belowTablet} {
    min-height: var(--control-touch-target);
  }
`;
