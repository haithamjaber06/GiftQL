export const theme = {
  color: {
    // Page — owner changes this often. Keep it first and named clearly.
    // If you change it, re-check inputBorder and focusRingOnLight against it (§8.1).
    pageBg:        '#FFFFFF',

    // Brand blue ramp — derived from the card color, do not substitute other blues
    cardBg:        '#021F93',   // card surface
    surfaceRaised: '#1A3AB8',   // image fallback background, label chips
    border:        '#3D5AC9',   // hairline dividers and outlines inside the card
    textMuted:     '#93A7EE',   // field labels, price on front, secondary icons
    textBody:      '#B9C6F4',   // description text on the back
    textStrong:    '#FFFFFF',   // titles, field values

    // Tag on the card front (light pill on dark card)
    tagBg:         '#EDF0FD',
    tagText:       '#021F93',

    // Visit button (light button on dark card)
    visitBg:       '#FFFFFF',
    visitText:     '#021F93',

    // Controls on the light page background
    inputBg:          '#FFFFFF',
    inputBorder:      '#8482B3',   // 3:1 minimum against both inputBg and pageBg
    inputText:        '#1A1A2E',
    inputPlaceholder: '#6B6996',

    // Dialog
    dialogBg:       '#FFFFFF',
    dialogText:     '#1A1A2E',
    dialogBackdrop: 'rgba(2, 31, 147, 0.4)',

    // Destructive — two variants, because one red cannot pass contrast on both surfaces
    dangerOnDark:  '#FF8A8A',   // Delete text and error messages on the card
    dangerOnLight: '#C4292F',   // Delete button and error messages in the dialog

    // Text on filled buttons (dialog Delete, Save, active pill)
    textOnFilled:  '#FFFFFF',

    // Keyboard focus rings
    focusRingOnLight: '#021F93',   // on page, bars, dialog
    focusRingOnDark:  '#FFFFFF',   // inside cards
  },

  font: {
    display: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body:    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  size: {
    cardTitle:   '16px',
    cardPrice:   '13px',
    tag:         '11px',
    body:        '13px',
    fieldLabel:  '13px',
    chip:        '11px',
    button:      '13px',
    input:       '14px',   // overridden below the tablet breakpoint (responsive)
    cardInput:   '13px',   // edit-mode inputs on the card back; also overridden below tablet
    dialog:      '14px',
    emptyState:  '14px',
    icon:        '16px',   // flip, pen, close
    pageTitle:   'clamp(36px, 7vw, 56px)',   // grows with the screen: 36px phone → 56px desktop
    pill:        '13px',   // person filter pills
    error:       '13px',   // page-level error line
    fallbackIcon: '40%',   // gift icon, relative to the image box
  },

  weight: {
    regular: 400,
    medium:  500,
  },

  lineHeight: {
    title: 1.35,
    body:  1.55,   // description
    base:  1.4,    // everything else
  },

  radius: {
    card:   '12px',
    image:  '8px',
    pill:   '999px',
    button: '8px',
    input:  '8px',
    dialog: '12px',
  },

  border: {
    hairline:  '1px',   // 0.5px renders as 0px or 1px on non-retina screens
    focusRing: '2px',
  },

  space: {
    cardPadding:  '14px',
    gridGap:      '16px',   // overridden below the phone breakpoint
    pageGutter:   '24px',   // overridden below the phone breakpoint
    focusOffset:  '2px',
    cardStack:    '4px',    // title → price
    cardActionsTop: '10px', // price → action row
    actionGap:    '8px',    // between buttons in a row
    buttonPaddingX: '12px',
    tagInset:     '8px',    // tags' distance from the image edge
    tagPaddingX:  '8px',
    tagPaddingY:  '3px',
    tagGap:       '6px',
    emptyState:   '48px',   // vertical space around the empty-state line
    backStack:    '12px',   // between sections on the card back
    fieldRowGap:  '4px',
    chipGap:      '6px',
    chipPaddingX: '8px',
    chipPaddingY: '2px',
    dialogPadding: '20px',
    dialogStack:  '16px',
    inputPaddingX: '6px',
    inputPaddingY: '2px',
    focusRoom:    '4px',
    halo:         '4px',
    titleDepth:   '4px',    // offset of the page title's 3D shadow    // page-colored ring around controls so they stay readable over the pattern    // room so focus rings aren't clipped in scroll containers
    pageBlock:    '32px',   // space above and below the page content
    sectionGap:   '16px',   // between title, input bar, filter bar, grid
    fieldPaddingX: '12px',  // input bar and filter bar controls
    fieldPaddingY: '8px',
    pillPaddingX: '14px',
    pillPaddingY: '6px',
    filterBarPaddingY: '12px',
  },

  control: {
    flipButton:   '32px',
    closeButton:  '26px',   // borderless icon button top-right of the card back (now the edit pen)
    touchTarget:  '44px',
    dialogButton: '36px',
  },

  shadow: {
    card:   '0 1px 3px rgba(2,31,147,0.08), 0 4px 12px rgba(2,31,147,0.06)',
    dialog: '0 8px 32px rgba(2,31,147,0.24)',
  },

  motion: {
    flip: '0.4s',
    titleShimmer: '6s',   // one sweep of the page title gradient
    perspective: '1000px',
  },

  skeleton: {
    titleWidth: '80%',   // placeholder bar widths on the pending card
    priceWidth: '35%',
    shimmer:    '1.4s',  // one sweep of the shimmer
  },

  tracking: {
    title: '-0.02em',   // slightly tighter letters at large size
  },

  clamp: {
    title:       2,   // lines
    description: 3,
  },

  grid: {
    minCardWidth: '240px',
    maxPageWidth: '1200px',
  },

  dialog: {
    maxWidth: '400px',
  },

  pattern: {
    opacity: 0.15,   // background pattern strength; 0 = off, 1 = full color
    stroke:  2,      // line thickness of the gift doodles
    tile:    300,    // px size of one repeating tile
  },

  bar: {
    linkMinWidth:  '220px',   // input bar link field before it wraps
    occasionWidth: '180px',
    priceWidth:    '110px',
    selectWidth:   '180px',   // filter bar selects
  },

  filterBar: {
    maxStickyHeight: '100px',   // on mobile (§7.4.5)
  },

  zIndex: {
    background: -1,
    filterBar:  10,
    dialog:     100,
  },

  // Not written as CSS variables — media query conditions can't use var().
  breakpoint: {
    phone:  '480px',   // single column, compact spacing
    tablet: '768px',   // background illustration hidden below this; touch sizing applies
  },

  // Token overrides applied inside media queries, keyed by breakpoint name.
  // Same shape as the tokens above.
  responsive: {
    tablet: {
      size: { input: '16px', cardInput: '16px' },   // prevents iOS Safari zooming on input focus
    },
    phone: {
      space: { pageGutter: '16px', gridGap: '12px' },
    },
  },
};
