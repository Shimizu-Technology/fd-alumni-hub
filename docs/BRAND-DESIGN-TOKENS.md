# FD Alumni Hub — Brand + Design Tokens (V1)

## Visual Direction
**Modern tournament hub with FD heritage**.

- Keep FD identity (maroon + gold)
- Avoid old-school visual clutter
- Prioritize readability, speed, and scanability on mobile
- Sports-media energy, school-brand discipline

## Color Palette
Derived from Father Dueñas site signals + refined for modern UI.

### Core Brand
- `fd-maroon`: `#670F26`
- `fd-gold`: `#D7B885`
- `fd-ink`: `#1F2321`
- `fd-cream`: `#F7F5F1`

### UI Neutrals
- `neutral-900`: `#222222`
- `neutral-700`: `#4B4B4B`
- `neutral-500`: `#7A7A7A`
- `neutral-300`: `#D0D0D0`
- `neutral-100`: `#F1F0F3`

### Status Tokens
- `success`: `#1F8A4C`
- `warning`: `#B7791F`
- `error`: `#C53030`
- `info`: `#2B6CB0`

## Typography
Per Shimizu frontend guide (non-generic fonts):

- Headings: **Sora** (or Space Grotesk)
- Body/UI: **Geist** (or Satoshi)

## Component Style Rules
- SVG icons only (no emoji)
- Border radius: 10–14px, intentional variation
- Shadow: minimal/tinted, avoid default Tailwind look
- Dense data views (schedule/standings) should favor clarity over ornament

## Page Intent
- Home: Hero + today strip + quick actions
- Schedule: scan-first list/table
- Standings: clean, compact data blocks
- Watch: live/upcoming/replay cards
- News: editorial cards linking out
- Sponsors: polished logo rail

## Do / Don’t
### Do
- Use FD maroon as primary CTA/accent
- Use gold sparingly for highlights
- Keep high contrast for tables and game state labels

### Don’t
- No purple/blue startup gradients
- No template-looking centered hero + generic 3 cards
- No pure black backgrounds

## CSS Variables (starter)
```css
:root {
  --fd-maroon: #670F26;
  --fd-gold: #D7B885;
  --fd-ink: #1F2321;
  --fd-cream: #F7F5F1;

  --neutral-900: #222222;
  --neutral-700: #4B4B4B;
  --neutral-500: #7A7A7A;
  --neutral-300: #D0D0D0;
  --neutral-100: #F1F0F3;

  --success: #1F8A4C;
  --warning: #B7791F;
  --error: #C53030;
  --info: #2B6CB0;
}
```


## Implementation Assets
- `design/tokens.css`
- `design/tailwind.theme.snippet.ts`
