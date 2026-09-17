import { useState } from 'react';
import styled from 'styled-components';
import { httpsUpgrade } from '../../utils/httpsUpgrade';
import { GiftIcon } from './icons';

export default function ImageWithFallback({ src }) {
  const safeSrc = httpsUpgrade(src);
  // Remember *which* URL failed, so a new URL automatically gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = failedSrc === safeSrc;

  if (!safeSrc || failed) {
    return (
      <Fallback>
        <GiftIcon />
      </Fallback>
    );
  }

  return (
    <Img
      src={safeSrc}
      onError={() => setFailedSrc(safeSrc)}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

const box = `
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-image);
`;

const Img = styled.img`
  ${box}
  object-fit: cover;
`;

const Fallback = styled.div`
  ${box}
  display: grid;
  place-items: center;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);

  svg {
    width: var(--size-fallback-icon);
    height: var(--size-fallback-icon);
  }
`;
