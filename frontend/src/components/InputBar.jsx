import { useState } from 'react';
import styled from 'styled-components';
import { PEOPLE } from '../constants/people';
import { OCCASIONS, OCCASION_LIST_ID } from '../constants/occasions';
import { belowPhone, belowTablet } from '../utils/media';
import { fieldStyles } from './fieldStyles';

// onAdd({ url, person, occasion, price }) resolves true when the item was saved.
export default function InputBar({ onAdd }) {
  const [url, setUrl] = useState('');
  const [person, setPerson] = useState('');
  const [occasion, setOccasion] = useState('');
  const [price, setPrice] = useState('');

  async function submit(event) {
    event.preventDefault();
    const saved = await onAdd({ url, person, occasion, price });
    if (saved) {
      // Person is kept: saving several links for one person is common.
      setUrl('');
      setOccasion('');
      setPrice('');
    }
  }

  return (
    // noValidate: type="url" is only for the phone keyboard; the old free-text
    // behavior (no browser URL check) is kept.
    <Form onSubmit={submit} noValidate>
      <LinkInput
        aria-label="Link"
        type="url"
        inputMode="url"
        placeholder="Paste a link"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)}>
        <option value="">Person</option>
        {PEOPLE.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </Select>
      <OccasionInput
        aria-label="Occasion"
        list={OCCASION_LIST_ID}
        placeholder="Occasion"
        value={occasion}
        onChange={(e) => setOccasion(e.target.value)}
      />
      <datalist id={OCCASION_LIST_ID}>
        {OCCASIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <PriceInput
        aria-label="Price"
        type="number"
        inputMode="decimal"
        min="0"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <SaveButton type="submit">Save</SaveButton>
    </Form>
  );
}

const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-action-gap);

  /* Phone: every control full width, one per row. */
  /* && raises specificity above each field's own flex rule. */
  ${belowPhone} {
    && > * {
      flex: 1 1 100%;
    }
  }
`;

const LinkInput = styled.input`
  ${fieldStyles}
  flex: 1 1 var(--bar-link-min-width);
`;

const Select = styled.select`
  ${fieldStyles}
`;

const OccasionInput = styled.input`
  ${fieldStyles}
  flex: 0 1 var(--bar-occasion-width);
`;

const PriceInput = styled.input`
  ${fieldStyles}
  flex: 0 1 var(--bar-price-width);
`;

// The only filled control in the bar.
const SaveButton = styled.button`
  padding: var(--space-field-padding-y) var(--space-field-padding-x);
  border: var(--border-hairline) solid var(--color-accent);
  border-radius: var(--radius-button);
  background: var(--color-accent);
  color: var(--color-text-on-filled);
  font-size: var(--size-input);
  font-weight: var(--weight-medium);
  line-height: var(--line-height-base);
  box-shadow: 0 0 0 var(--space-halo) var(--color-page-bg);
  cursor: pointer;

  ${belowTablet} {
    min-height: var(--control-touch-target);
  }
`;
