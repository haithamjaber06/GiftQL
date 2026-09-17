import styled from 'styled-components';
import { belowTablet } from '../../utils/media';

// Shared by both faces (and the pending/failed variants later).

export const Face = styled.article`
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  background: var(--color-card-bg);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  color: var(--color-text-strong);
  font-family: var(--font-body);
  line-height: var(--line-height-base);

  a:focus-visible,
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: var(--border-focus-ring) solid var(--color-focus-ring-on-dark);
    outline-offset: var(--space-focus-offset);
  }
`;

// ---- Front-shaped layout, shared by CardFront and PendingCard so their
// heights match exactly. ----

export const Media = styled.div`
  position: relative;
  padding: var(--space-card-padding) var(--space-card-padding) 0;
`;

export const FrontBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-card-stack);
  padding: var(--space-card-padding);
`;

// Title slot is always exactly two title-lines tall.
export const TITLE_SLOT_HEIGHT =
  'calc(var(--clamp-title) * var(--size-card-title) * var(--line-height-title))';

// Always rendered, so card height doesn't depend on whether there's a price.
export const PriceSlot = styled.p`
  margin: 0;
  height: calc(var(--size-card-price) * var(--line-height-base));
  font-size: var(--size-card-price);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const FrontActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-action-gap);
  min-height: var(--control-flip-button);
  margin-top: var(--space-card-actions-top);
`;

// ----

export const CardTitle = styled.h2`
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--size-card-title);
  font-weight: var(--weight-semibold);
  line-height: var(--line-height-title);
  color: var(--color-text-strong);

  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--clamp-title);
  overflow: hidden;
  overflow-wrap: anywhere;
`;

export const Visit = styled.a.attrs({
  target: '_blank',
  rel: 'noopener noreferrer',
})`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-flip-button);
  padding: 0 var(--space-button-padding-x);
  border-radius: var(--radius-button);
  background: var(--color-visit-bg);
  color: var(--color-visit-text);
  font-size: var(--size-button);
  font-weight: var(--weight-medium);
  text-decoration: none;

  ${belowTablet} {
    min-height: var(--control-touch-target);
  }
`;

export const IconButton = styled.button.attrs({ type: 'button' })`
  position: relative;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;

  svg {
    width: var(--size-icon);
    height: var(--size-icon);
  }

  /* Touch: grow the invisible hit area to 44px; the button looks the same. */
  ${belowTablet} {
    &::after {
      content: '';
      position: absolute;
      inset: calc((100% - var(--control-touch-target)) / 2);
    }
  }
`;

// Square outlined icon button in an action row (the flip button on both faces).
export const OutlinedIconButton = styled(IconButton)`
  width: var(--control-flip-button);
  height: var(--control-flip-button);
  border: var(--border-hairline) solid var(--color-border);
  border-radius: var(--radius-button);
`;

export const DeleteButton = styled.button.attrs({ type: 'button' })`
  padding: 0;
  border: none;
  background: none;
  color: var(--color-danger-on-dark);
  font-size: var(--size-button);
  cursor: pointer;

  /* Reads quiet, still easy to hit. */
  ${belowTablet} {
    min-width: var(--control-touch-target);
    min-height: var(--control-touch-target);
  }
`;
