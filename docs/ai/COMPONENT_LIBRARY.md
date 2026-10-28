# Project component library

Reusable primitives live in `src/shared/ui/` and are imported by file. Do not
add `index.ts` barrels.

| Component | Use |
|---|---|
| `Button` | Text commands, variants, sizes, loading and full-width state |
| `IconButton` | Icon-only actions with required tooltip/ARIA label |
| `Badge` | Counts and status labels with semantic tones |
| `SegmentedControl` | Small exclusive option sets |
| `ThemeToggle` | Persistent light/dark appearance control |
| `Panel` | Semantically selectable panel container |
| `Notice` | Accessible success/error feedback |
| `EmptyState` | Empty collection state |
| `MetricCard` | Repeated label/value metric |

Shared UI has no translation, authentication, API, feature or page dependency.
Pass already translated labels and rendered icons through props.

Theme state lives in `src/shared/theme/ThemeProvider.tsx`. Use CSS design
tokens from `src/styles.css`; do not add component-local light/dark palettes.

Domain-specific composition belongs in `src/features/<domain>/components/`.
Before adding a primitive, require at least two real consumers or a clear
accessibility/state rule that must be centralized. Preserve existing CSS class
contracts unless visual redesign is explicitly in scope.
