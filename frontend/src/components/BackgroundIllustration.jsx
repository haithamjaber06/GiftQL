import styled from 'styled-components';
import { theme } from '../theme';
import { belowTablet } from '../utils/media';

const TILE = theme.pattern.tile;   // SVG attributes can't read CSS variables

// Doodle gift outlines, repeated across the viewport as a seamless tile.
// Works only because no ancestor has a background (only <html> does) — spec §7.2.
export default function BackgroundIllustration() {
  return (
    <Layer aria-hidden="true">
      <svg focusable="false">
        <defs>
          <pattern id="gift-pattern" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            <g className="gifts">
              <TallGift x={60} y={40} />
              <SquareGift x={150} y={32} rotate={-6} />
              <LidGift x={240} y={45} rotate={5} />
              <SparkleGift x={50} y={148} rotate={-8} />
              <WideGift x={150} y={140} />
              <SquareGift x={252} y={160} rotate={4} />
              <BowGift x={70} y={232} />
              <TallGift x={160} y={214} rotate={6} />
              <SparkleGift x={252} y={250} rotate={3} />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gift-pattern)" />
      </svg>
    </Layer>
  );
}

// Each gift is drawn around (0, 0) = the top-center of the box, where the bow sits.
const place = (x, y, rotate = 0) => `translate(${x} ${y}) rotate(${rotate})`;

const Bow = ({ scale = 1 }) => (
  <g transform={`scale(${scale})`}>
    <path d="M0 0 C-12 -16 -22 -2 0 0 C22 -2 12 -16 0 0" />
    <path d="M0 0 L-6 8 M0 0 L6 8" />
  </g>
);

function TallGift({ x, y, rotate }) {
  return (
    <g transform={place(x, y, rotate)}>
      <rect x="-14" y="0" width="28" height="40" rx="2" />
      <path d="M0 0 V40" />
      <Bow />
    </g>
  );
}

function SquareGift({ x, y, rotate }) {
  return (
    <g transform={place(x, y, rotate)}>
      <rect x="-16" y="0" width="32" height="26" rx="2" />
      <path d="M0 0 V26 M-16 11 H16" />
      <Bow scale={0.8} />
    </g>
  );
}

function LidGift({ x, y, rotate }) {
  return (
    <g transform={place(x, y, rotate)}>
      <rect x="-21" y="2" width="42" height="10" rx="1" />
      <rect x="-18" y="12" width="36" height="40" rx="1" />
      <path d="M-11 20 V34" />
      <Bow scale={0.9} />
    </g>
  );
}

function SparkleGift({ x, y, rotate }) {
  return (
    <g transform={place(x, y, rotate)}>
      <rect x="-15" y="0" width="30" height="28" rx="2" />
      <path d="M-7 8 V16 M-2 8 V14 M-7 21 V22 M-2 19 V20" />
      <path d="M0 0 L-5 -7 M0 0 V-8 M0 0 L5 -7" />
    </g>
  );
}

function WideGift({ x, y, rotate }) {
  return (
    <g transform={place(x, y, rotate)}>
      <rect x="-45" y="0" width="90" height="22" rx="2" />
      <path d="M-45 11 H45 M0 0 V22" />
      <path d="M0 11 C-9 2 -16 16 0 11 C16 16 9 2 0 11" />
    </g>
  );
}

function BowGift({ x, y, rotate }) {
  return (
    <g transform={place(x, y, rotate)}>
      <path d="M-22 8 H22" />
      <rect x="-20" y="8" width="40" height="26" rx="1" />
      <path d="M0 8 V34" />
      <g transform="translate(0 8)">
        <path d="M0 0 C-16 -18 -28 0 0 0 C28 0 16 -18 0 0" />
        <path d="M0 0 L-14 6 M0 0 L14 6" />
      </g>
    </g>
  );
}

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: var(--z-index-background);
  pointer-events: none;
  opacity: var(--pattern-opacity);

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .gifts {
    fill: none;
    stroke: var(--color-pattern-stroke);
    stroke-width: var(--pattern-stroke);
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  
`;
