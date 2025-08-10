# Theme Tokens & Variables

Central source for design tokens. Import tokens instead of hard-coded hex.

## Imports
```ts
import { colors, semantic, gradients, buildTheme } from '@/theme/tokens';
```

## Applying CSS Variables
Use utility to expose semantic + gradient tokens as CSS variables:
```ts
import { applyCssVariables } from '@/theme/applyCssVariables';
import { buildTheme } from '@/theme/tokens';

applyCssVariables(buildTheme('dark'));
```
Variables pattern:
```
--ct-color-bg, --ct-color-textPrimary, ...
--ct-gradient-trigger, --ct-gradient-ai, ...
```

## Adding Tokens
1. Add base in `tokens.ts` (colors).
2. Map to `semantic` (or add new semantic key).
3. (Optional) Add gradient in `gradients`.
4. Update docs + run `npm run theme:scan`.

## No Raw Hex
Components must not introduce new hex strings. Enforcement: `npm run theme:scan`.
