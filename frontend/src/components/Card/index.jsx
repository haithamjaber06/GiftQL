import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import CardFront from './CardFront';
import CardBack from './CardBack';
import PendingCard from './PendingCard';
import { FAILURE_STATUSES, READY_STATUSES } from '../../constants/status';

export default function Card({ item, onRequestDelete, onUpdate }) {
  // Failure first: failure values are also "not ready".
  if (FAILURE_STATUSES.includes(item.status)) {
    return <PendingCard item={item} variant="failed" onRequestDelete={onRequestDelete} />;
  }
  if (!READY_STATUSES.includes(item.status)) {
    return <PendingCard item={item} variant="pending" onRequestDelete={onRequestDelete} />;
  }
  return <FlipCard item={item} onRequestDelete={onRequestDelete} onUpdate={onUpdate} />;
}

function FlipCard({ item, onRequestDelete, onUpdate }) {
  const [flipped, setFlipped] = useState(false);
  const flipRef = useRef(null);
  const closeRef = useRef(null);
  const hasFlipped = useRef(false);

  // Focus follows the flip: the face being hidden becomes inert, so focus
  // would otherwise fall back to the top of the page.
  useEffect(() => {
    if (!hasFlipped.current) return;   // not on first render
    (flipped ? closeRef : flipRef).current?.focus();
  }, [flipped]);

  function flip(next) {
    hasFlipped.current = true;
    setFlipped(next);
  }

  return (
    <FlipContainer>
      <FlipInner $flipped={flipped}>
        <CardFront
          item={item}
          inert={flipped}
          onFlip={() => flip(true)}
          flipRef={flipRef}
        />
        <CardBack
          item={item}
          inert={!flipped}
          onClose={() => flip(false)}
          closeRef={closeRef}
          onRequestDelete={onRequestDelete}
          onUpdate={onUpdate}
        />
      </FlipInner>
    </FlipContainer>
  );
}

const FlipContainer = styled.div`
  perspective: var(--motion-perspective);
  touch-action: manipulation;
`;

const FlipInner = styled.div`
  position: relative;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  transition: transform var(--motion-flip);
  transform: ${({ $flipped }) => ($flipped ? 'rotateY(180deg)' : 'none')};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
