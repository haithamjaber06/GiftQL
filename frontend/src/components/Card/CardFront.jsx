import styled from 'styled-components';
import ImageWithFallback from './ImageWithFallback';
import { FlipIcon } from './icons';
import {
  Face, CardTitle, Visit, OutlinedIconButton,
  Media, FrontBody, PriceSlot, FrontActions, TITLE_SLOT_HEIGHT,
} from './styles';
import { formatPrice } from '../../utils/formatPrice';
import { isBlank } from '../../utils/isBlank';

export default function CardFront({ item, inert, onFlip, flipRef }) {
  const hasOccasion = !isBlank(item.occasion);

  return (
    <FrontFace inert={inert}>
      <Media>
        <ImageWithFallback src={item.img_url} />
        <Tags>
          {hasOccasion && <OccasionTag title={item.occasion}>{item.occasion}</OccasionTag>}
          {!isBlank(item.kind) && <KindTag>{item.kind}</KindTag>}
        </Tags>
      </Media>

      <FrontBody>
        <Title>{item.title}</Title>
        <PriceSlot>{formatPrice(item.price, item.currency)}</PriceSlot>

        <FrontActions>
          <Visit href={item.url}>Visit</Visit>
          <OutlinedIconButton
            ref={flipRef}
            data-flip-toggle
            aria-label="Show details"
            onClick={onFlip}
          >
            <FlipIcon />
          </OutlinedIconButton>
        </FrontActions>
      </FrontBody>
    </FrontFace>
  );
}

// In normal flow: the front's content defines the card's height.
const FrontFace = styled(Face)`
  position: relative;
`;

const Tags = styled.div`
  position: absolute;
  top: calc(var(--space-card-padding) + var(--space-tag-inset));
  left: calc(var(--space-card-padding) + var(--space-tag-inset));
  right: calc(var(--space-card-padding) + var(--space-tag-inset));
  display: flex;
  gap: var(--space-tag-gap);
`;

const Tag = styled.span`
  padding: var(--space-tag-padding-y) var(--space-tag-padding-x);
  border-radius: var(--radius-pill);
  background: var(--color-tag-bg);
  -webkit-backdrop-filter: blur(var(--effect-tag-blur));
  backdrop-filter: blur(var(--effect-tag-blur));
  color: var(--color-tag-text);
  font-size: var(--size-tag);
  font-weight: var(--weight-medium);
  white-space: nowrap;
`;

// Gives up space first when both tags don't fit.
const OccasionTag = styled(Tag)`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Never shrinks; stays right-aligned even when there's no occasion tag.
const KindTag = styled(Tag)`
  flex-shrink: 0;
  margin-left: auto;
`;

// Always two lines tall, even for short titles.
const Title = styled(CardTitle)`
  min-height: ${TITLE_SLOT_HEIGHT};
`;
