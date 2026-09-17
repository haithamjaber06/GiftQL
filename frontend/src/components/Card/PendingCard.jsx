import styled, { css, keyframes } from 'styled-components';
import {
  Face, DeleteButton,
  Media, FrontBody, PriceSlot, FrontActions, TITLE_SLOT_HEIGHT,
} from './styles';
import { hostname } from '../../utils/hostname';

// Same outline as CardFront, so the grid doesn't shift when enrichment finishes.
// variant: 'pending' (shimmer) | 'failed' (static, with a message).
export default function PendingCard({ item, variant, onRequestDelete }) {
  const failed = variant === 'failed';

  return (
    <Face aria-busy={!failed}>
      <Media>
        <Block $shimmer={!failed} />
      </Media>

      <FrontBody>
        <TitleSlot>
          {failed ? (
            <Message>Couldn't fetch details for this link.</Message>
          ) : (
            <>
              <Bar $width="var(--skeleton-title-width)" $shimmer />
              <VisuallyHidden>Fetching details…</VisuallyHidden>
            </>
          )}
        </TitleSlot>
        <PriceSlot>{!failed && <Bar $width="var(--skeleton-price-width)" $shimmer />}</PriceSlot>

        <Actions>
          <Host title={item.url}>{hostname(item.url)}</Host>
          <DeleteButton data-card-focus onClick={(e) => onRequestDelete(e.currentTarget)}>
            Delete
          </DeleteButton>
        </Actions>
      </FrontBody>
    </Face>
  );
}

const sweep = keyframes`
  from { background-position: 100% 0; }
  to   { background-position: -100% 0; }
`;

const shimmer = css`
  background: linear-gradient(
    90deg,
    var(--color-surface-raised) 25%,
    var(--color-border) 50%,
    var(--color-surface-raised) 75%
  );
  background-size: 200% 100%;
  animation: ${sweep} var(--skeleton-shimmer) linear infinite;

  @media (prefers-reduced-motion: reduce) {
    background: var(--color-surface-raised);
    animation: none;
  }
`;

const Block = styled.div`
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-image);
  background: var(--color-surface-raised);
  ${({ $shimmer }) => $shimmer && shimmer}
`;

const TitleSlot = styled.div`
  position: relative;
  height: ${TITLE_SLOT_HEIGHT};
  overflow: hidden;
`;

const Bar = styled.span`
  display: block;
  width: ${({ $width }) => $width};
  height: 100%;
  max-height: var(--size-card-title);
  border-radius: var(--radius-pill);
  background: var(--color-surface-raised);
  ${({ $shimmer }) => $shimmer && shimmer}
`;

const Message = styled.p`
  margin: 0;
  font-size: var(--size-body);
  line-height: var(--line-height-body);
  color: var(--color-text-body);

  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--clamp-title);
  overflow: hidden;
`;

const Actions = styled(FrontActions)`
  align-items: center;
`;

const Host = styled.span`
  flex: 1;
  min-width: 0;
  font-size: var(--size-card-price);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;
