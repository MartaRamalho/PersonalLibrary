# Project guidance for Claude

Personal Library — React + TypeScript (Vite) client, Express + better-sqlite3 server.

## Frontend rules (always follow)

These are hard rules for any frontend work in `client/`. Apply them to every new file
and to any file you touch.

### 1. Always use arrow functions

- Declare components, hooks, and helpers as arrow functions, never `function` declarations.
  ```tsx
  export const BookCard = ({ book }: BookCardProps) => { ... };
  ```
- Use **named exports** for components (e.g. `export const Search = () => {}`), not default
  exports. Import them by name: `import { Cover } from '../components/cover/Cover';`
- Event handlers and callbacks are arrow functions too (`const onSubmit = () => {}`).

### 2. One folder per page and per component

- Every page and every component lives in its **own folder** named after it, with the
  implementation file inside:
  ```
  client/src/components/cover/
    Cover.tsx          // export const Cover = (...) => {...}
    Cover.utils.ts     // utilities/helpers for Cover (see rule 3)
  client/src/pages/picker/
    Picker.tsx
    Picker.utils.ts
  ```
- Import the file directly: `import { Cover } from '../../components/cover/Cover';`.
  Do **not** add `index.ts` barrel files.
- Keep sub-components that are private to a page/component inside that folder.

### 3. Utility functions go in a co-located `.utils` file

- Any pure/utility/helper function for a component or page lives in a sibling
  `<Name>.utils.ts` file — not inline in the `.tsx`.
- Constants, option lists, mappers, and formatting helpers belong there too.
- Example: the Picker's `bookDecade`, `stageValues`, `matchesStage`, `sample`, and the
  `STAGE_ORDER`/`STAGE_LABEL` constants belong in `picker/Picker.utils.ts`; the `.tsx`
  imports them and stays focused on rendering + state.

### 4. Clean-code architecture

- Separate concerns: **rendering** (`.tsx`), **utilities/constants** (`.utils.ts`),
  **server state / data access** (`src/api/` hooks — components never call `fetch`
  directly). Keep API types in `src/api/types.ts`.
- Components should be small and single-responsibility; extract a sub-component or a
  helper rather than growing a large function or deeply nested JSX.
- No duplicated logic — lift shared helpers into a `.utils.ts` or a shared module.
- Prefer clear names over comments; comment only the non-obvious "why".

### 5. Accessibility (a11y) is required

- Use semantic HTML: `button` for actions, `a`/`Link` for navigation, `nav`, `main`,
  `header`, `section`, `ul/li`, real headings in order.
- Every form control has a label (`<label>` or `aria-label`); every image has meaningful
  `alt` text (decorative images use `alt=""`).
- All interactive elements are keyboard-operable and have visible focus states; never put
  click handlers on non-interactive elements.
- Icon-only controls carry an `aria-label`. Use `aria-*` and roles when native semantics
  aren't enough. Don't rely on color alone to convey meaning; keep sufficient contrast.

### 6. Folder names in kebab-case, file names in PascalCase

- **Folder** names are `kebab-case`: `components/star-rating/`, `pages/book-detail/`,
  `pages/reading-year/`.
- **File** names are `PascalCase`, matching the exported component/page — including the
  sibling utils file: `StarRating.tsx` + `StarRating.utils.ts`, `BookDetail.tsx`.
- Example: `client/src/pages/reading-year/ReadingYear.tsx` and its
  `client/src/pages/reading-year/ReadingYear.utils.ts`.

> The `client/src/pages` and `client/src/components` trees use a per-name folder holding
> `<Name>.tsx` (and a `<Name>.utils.ts` where there are utilities) — no barrels. (`src/App.tsx`
> and `src/main.tsx` are the app entry points and stay at the `src` root.)
