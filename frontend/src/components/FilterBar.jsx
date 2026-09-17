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
  return (
    <Bar>
      <Selects>
        <Select
          aria-label="Filter by person"
          value={person}
          onChange={(e) => onPersonChange(e.target.value)}
        >
          <option value="">All people</option>
          {PEOPLE.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </Select>

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

const Selects = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-action-gap);
`;

const Select = styled.select`
  ${fieldStyles}
  flex: 0 1 var(--bar-select-width);

  /* Narrow screens: share the row, wrapping when they no longer fit. */
  ${belowTablet} {
    flex: 1 1 40%;
    min-height: var(--control-touch-target);
  }
`;
