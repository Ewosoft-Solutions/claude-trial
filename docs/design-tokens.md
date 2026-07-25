# Design tokens — colour reference

Single source of truth: [`packages/ui/src/styles/globals.css`](../packages/ui/src/styles/globals.css).
Every colour in the product resolves to one of these CSS custom properties.
**Never hard-code a hex/rgb value in a component** — reference a token (via a
Tailwind utility like `bg-success` / `text-muted-foreground`, or `var(--…)`)
so light, Aurora dark, and Classic Dark stay in lock-step.

The three themes are `:root` (Aurora light), `.dark` (Aurora dark — default),
and `.classic-dark` (preserved flat dark).

## 1 · Surfaces & text (brandable roles)

| Token | Tailwind | Role | Light | Aurora dark |
| --- | --- | --- | --- | --- |
| `--background` | `bg-background` | App canvas (flat) | `#ffffff` | `#07060f` |
| `--foreground` | `text-foreground` | Primary text | `#191b38` | `#eef0ff` |
| `--card` | `bg-card` | Card surface | `rgba(255,255,255,.72)` | `rgba(255,255,255,.05)` |
| `--card-foreground` | `text-card-foreground` | Text on cards | `#191b38` | `#eef0ff` |
| `--popover` | `bg-popover` | Dropdowns / dialogs / flyouts (opaque) | `rgba(255,255,255,.97)` | `#17152a` |
| `--muted` | `bg-muted` | Track / inset fill | `#f2f3f7` | `rgba(255,255,255,.05)` |
| `--muted-foreground` | `text-muted-foreground` | Secondary text | `#565b8c` | `#aab0e6` |
| `--secondary` | `bg-secondary` | Chips / subtle buttons | `#f2f3f7` | `rgba(255,255,255,.06)` |
| `--accent` | `bg-accent` | Hover / active surface | `#eef0fb` | `rgba(255,255,255,.065)` |
| `--border` | `border-border` | Hairlines / dividers | `rgba(40,40,90,.10)` | `rgba(255,255,255,.10)` |
| `--input` | `border-input` | Field borders | `rgba(40,40,90,.12)` | `rgba(255,255,255,.14)` |
| `--ring` | `ring-ring` | Focus ring | `#4f6df5` | `#5b8cff` |
| `--sidebar` | `bg-sidebar` | Nav / chrome surface | `rgba(255,255,255,.62)` | `rgba(255,255,255,.022)` |

## 2 · Semantic status tones

Each has a paired `-foreground` for text on a **solid** fill. For **soft**
pills/bars, use the base token over a tinted background (see components below).

| Token | Tailwind | Meaning | Light | Aurora dark |
| --- | --- | --- | --- | --- |
| `--primary` | `bg-primary` / `text-primary` | Brand / active / CTA | `#4f6df5` | `#5b8cff` |
| `--success` | `bg-success` / `text-success` | Good / paid / present | `#12b886` | `#2ee6a6` |
| `--warning` | `bg-warning` / `text-warning` | Watch / due / at-risk | `#d98a25` | `#ffce5c` |
| `--info` | `bg-info` / `text-info` | Informational / accent-2 | `#ff5fa8` | `#ff6fae` |
| `--destructive` | `bg-destructive` / `text-destructive` | Error / owing / danger | `#f0506e` | `#ff6b81` |

**Canonical consumers** (use these, don't re-invent tints):

- `StatusBadge` (`custom/data-display/status-badge.tsx`) — soft pill: matching
  border + `/12–15` fill + tone text. Tones: `neutral · info · success ·
  warning · destructive`. This is the "Docs needed / Interview / Accepted" style.
- `Meter` (`custom/data-display/meter.tsx`) — progress/ratio bar fill:
  `default · neutral · info · success · warning · destructive`.

## 3 · Chart palette

Ordered series colours; also the source of the neon avatar hues.

| Token | Light | Aurora dark |
| --- | --- | --- |
| `--chart-1` (blue) | `#4f6df5` | `#5b8cff` |
| `--chart-2` (green) | `#12b886` | `#2ee6a6` |
| `--chart-3` (blurple) | `#8c5cff` | `#8c5cff` |
| `--chart-4` (pink) | `#ff5fa8` | `#ff6fae` |
| `--chart-5` (amber) | `#d98a25` | `#ffce5c` |

`TrendChart` cycles `--chart-1..5`; the Aurora skin adds a neon glow via
`--chart-glow`.

## 4 · Gradients & accents

| Token | Use | Classic Dark |
| --- | --- | --- |
| `--grad-primary` | Primary buttons (`Button` default, white text) | `none` → flat `--primary` |
| `--grad-nav-active` | Active nav item wash | `none` → flat `bg-primary/10` |
| `--h1-grad` | Page titles / big stat numbers (bg-clip-text) | flat foreground |
| `--grad-brand` | Rainbow accent (Ask AI orb, brand mark) | kept |

## 5 · Neon avatar palette

People avatars pick a deterministic bright hue from
[`packages/ui/src/lib/avatar-color.ts`](../packages/ui/src/lib/avatar-color.ts)
(`NEON_AVATAR_PALETTE`), keyed by email/name — Teams/Slack style. Schools keep
their brand `color` (with a neon fallback). Never assign avatar colours ad-hoc.

## Rule of thumb

- Text → `foreground` / `muted-foreground` (never a raw grey).
- A status/tone → the semantic token via `StatusBadge` or `Meter`.
- A chart series → `--chart-N`.
- A person → `neonAvatarColor(seed)`.
- Anything brand/CTA → `primary` / `--grad-primary`.
