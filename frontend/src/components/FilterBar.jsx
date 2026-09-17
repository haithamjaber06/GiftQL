import { useId, useState } from 'react';
import styled from 'styled-components';
import { PEOPLE } from '../constants/people';
import { PRICE_RANGES } from '../utils/filterItems';
import { belowTablet } from '../utils/media';
import { fieldStyles } from './fieldStyles';

// All values are strings; '' means "no filter".
export default function FilterBar({
  person, onPersonChange,
  occasion, onOccasionChange, occasionOptions,
  price, onPriceChange,
}) {
  // Mobile only: pills + both selects would exceed the 100px sticky budget,
  // so the selects sit behind a toggle. On wider screens they're always shown.
  const [open, setOpen] = useState(false);
  const selectsId = useId();
  const activeCount = (occasion ? 1 : 0) + (price ? 1 : 0);

  return (
    <Bar>
      <TopRow>
        <Pills role="group" aria-label="Filter by person">
          {['', ...PEOPLE].map((name) => (
            <Pill
              key={name || 'all'}
              type="button"
              aria-pressed={person === name}
              onClick={() => onPersonChange(name)}
            >
              {name || 'All'}
            </Pill>
          ))}
        </Pills>

        <Toggle
          type="button"
          aria-expanded={open}
          aria-controls={selectsId}
          onClick={() => setOpen((o) => !o)}
        >
          Filters{activeCount > 0 && ` (${activeCount})`}
        </Toggle>
      </TopRow>

      <Selects id={selectsId} $open={open}>
        <Select
          aria-label="Filter by occasion"
          value={occasion}
          onChange={(e) => onOccasionChange(e.target.value)}
        >
          <option value="">All occasions</option>
          {occasionOptions.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>

        <Select
          aria-label="Filter by price"
          value={price}
          onChange={(e) => onPriceChange(e.target.value)}
        >
          {PRICE_RANGES.map(({ value, label }) => (
            <option key={value || 'any'} value={value}>{label}</option>
          ))}
        </Select>
      </Selects>
    </Bar>
  );
}

// Sticky. No background: each control carries its own page-colored halo.
const Bar = styled.div`
  position: sticky;
  top: 0;
  z-index: var(--z-index-filter-bar);
  display: flex;
  flex-direction: column;
  gap: var(--space-action-gap);
  padding: var(--space-filter-bar-padding-y) 0;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-action-gap);
`;

const Pills = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-action-gap);

  /* One horizontally scrolling row. The padding/negative margin gives focus
     rings room so the scroll container doesn't clip them. */
  ${belowTablet} {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
    padding: var(--space-focus-room);
    margin: calc(-1 * var(--space-focus-room));
    margin-right: 0;   /* keep the normal gap before the Filters toggle */

    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

const pillLook = `
  padding: var(--space-pill-padding-y) var(--space-pill-padding-x);
  border: var(--border-hairline) solid var(--color-input-border);
  border-radius: var(--radius-pill);
  background: var(--color-input-bg);
  color: var(--color-input-text);
  font-size: var(--size-pill);
  line-height: var(--line-height-base);
  white-space: nowrap;
  box-shadow: 0 0 0 var(--space-halo) var(--color-page-bg);
  cursor: pointer;
`;

const Pill = styled.button`
  ${pillLook}

  &[aria-pressed='true'] {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-text-on-filled);
  }

  ${belowTablet} {
    flex-shrink: 0;
    min-height: var(--control-touch-target);
    scroll-snap-align: start;
  }
`;

const Toggle = styled.button`
  ${pillLook}
  display: none;
  flex-shrink: 0;

  ${belowTablet} {
    display: block;
    min-height: var(--control-touch-target);
  }
`;

const Selects = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-action-gap);

  ${belowTablet} {
    display: ${({ $open }) => ($open ? 'flex' : 'none')};
    flex-wrap: nowrap;
  }
`;

const Select = styled.select`
  ${fieldStyles}
  flex: 0 1 var(--bar-select-width);

  ${belowTablet} {
    flex: 1;
  }
`;
