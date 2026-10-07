# @scrolled/design

Scrolled's component library, shared by `apps/web` and `apps/navigator`: the
redesign's soft, rounded components (inline styles over CSS custom properties),
the Radix and cmdk primitives (Button, Dialog, Sheet, Command, HoverPopover,
Input, Table), the Tailwind preset, `cn()`, the theme store, and the tokens and
self-hosted fonts they all depend on.

## Use

```ts
import '@scrolled/design/tokens.css'; // variables, keyframes, @font-face
import { Button, SlotTile } from '@scrolled/design';
import { Skull } from 'lucide-react';

<SlotTile icon={Skull} hue={20} size={52} />;
```

| Entry             | Contents                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tokens.css`      | Custom properties, keyframes and fonts.                                                                           |
| `base.css`        | Element styles (`body`, `a`, selection) and the `data-motion` overrides.                                          |
| `styles.css`      | Both of the above.                                                                                                |
| `tailwind-preset` | Tailwind preset mapping the shadcn color names onto the tokens. Add `packages/design/src` to the app's `content`. |

Theme follows `.dark` on `<html>`, the accent follows `data-accent`, and
`data-motion="off"` (with `base.css`) stills every animation.

Icons are Lucide components passed by reference (`icon={Skull}`), never names,
so unused icons tree-shake away.

## Storybook

```sh
nix develop -c pnpm storybook        # http://localhost:6006
nix develop -c pnpm build:storybook  # static build in packages/design/storybook-static
```

Stories live in `stories/<Group>/`. Use Lucide icons and invented names for
sample data — never game sprites or game names.
