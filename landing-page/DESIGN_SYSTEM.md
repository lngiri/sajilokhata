# QR Hisab — Design System

Design tokens pulled from the actual app (`src/app/globals.css`, `layout.tsx`, PWA
manifest). The landing page should reuse these so marketing visuals match the product.

> Exact token values below are extracted where available; where a value could not be
> read directly it is marked `UNKNOWN` and should be read from `globals.css` at build
> time. **Verify hex values against the file before hard-coding.**

---

## 1. Color

### Primary / brand
- **Primary color:** `UNKNOWN-exact-hex` (from `globals.css` CSS variables — read the
  file; e.g. likely a green/emerald or teal suited to "khata" trust).
- Theme color in `layout.tsx` / manifest: check `theme_color` value.

### Neutrals & system
- Use the app's neutral grays for text/borders.
- Semantic colors from the app: success (approved/payment), warning (flags/warnings),
  danger (rejected/defaulter), info (notifications).

**Rule:** verify every hex from `globals.css`; keep a single source of truth. Never mix
palettes between landing and app.

## 2. Typography

- App: default Tailwind v4 stack. Check `globals.css` `--font-*` and `layout.tsx` font
  config for the chosen family (e.g. Inter/system or Nepali-capable fallback).
- **Nepali text requirement:** choose a font with Devanagari support (Noto Sans Devanagari
  or similar) for नेपाली blocks. `UNKNOWN` which is bundled — verify.

### Scale (suggested, landing)
| Token | Usage | Size |
|---|---|---|
| `display` | Hero H1 | ~44–56px |
| `h2` | Section titles | ~30–38px |
| `h3` | Feature headings | ~22–26px |
| `body-lg` | Lead paragraphs | ~18–20px |
| `body` | Default | ~16–17px |
| `caption` | Legal/footnotes | ~13–14px |

## 3. Spacing & layout

- Base unit: `4px` increments (Tailwind default) — matches app.
- Sections: `py-16`–`py-24` equivalent.
- Max content width: ~`max-w-6xl` (1152px); hero slightly wider for phone mockups.
- Mobile-first; single column below 640px; 2-col feature grid at md; 3-col at lg.

## 4. Components

- **Button (primary):** solid brand color, white text, rounded, `px-6 py-3`, focus ring.
- **Button (secondary):** outline/ghost, brand-tinted text.
- **Card:** white, subtle border + soft shadow, `rounded-2xl`, `p-6`.
- **Badge/Chip:** pill, light tinted background (matches app chips e.g. product picker).
- **Phone mockup frame:** rounded-3xl with notch cutout, shadow; screenshots inside.
- **QR visual:** square, brand accent, rounded corners; white background always (QRs need
  contrast).
- **Toast/alert styling:** borrow app's success/warning/danger tints.

## 5. Motion

- Subtle: fade+rise on hero load (~400ms), staggered feature cards on scroll.
- Respect `prefers-reduced-motion`.
- No infinite animations, no autoplay.

## 6. Imagery rules

- Use real app screenshots (`SCREENSHOT_GUIDE.md`) — never fake UI.
- Customer/merchant photos: real, consent-given people only.
- Keep QR codes scannable: quiet zone, no overlap.

## 7. Accessibility

- Contrast ≥ WCAG AA on text (verify brand color on white).
- Focus states visible; all CTAs keyboard-reachable.
- Alt text on every screenshot/photo.
- Language toggle is a real `<button>` (or link), not a JS-only widget.

## 8. Files the design must match

- `src/app/globals.css` — color/typography tokens.
- `src/app/layout.tsx` — theme color, metadata, branding strings.
- `public/manifest.webmanifest` — name, colors, icon set.
- `public/*.png` / favicons — existing iconography.
