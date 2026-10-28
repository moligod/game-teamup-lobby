# Shared UI

`shared/ui` contains presentational components that have no feature, route,
transport, authentication, or translation dependency. Import files directly
instead of adding a barrel export so consumers only load the component they use.

- `Button` and `IconButton` standardize interactive states, sizes and accessibility.
- `Badge`, `SegmentedControl`, and `ThemeToggle` standardize compact status,
  exclusive selection, and appearance control.
- `Panel`, `Notice`, `EmptyState`, and `MetricCard` standardize repeated layout
  primitives without owning page-level data or behaviour.
- Feature-specific components belong under `src/features/<feature>/components`.

Existing CSS class names are intentionally preserved during the migration. This
keeps the visual system stable while consolidating markup and accessibility.

Theme state is owned by `src/shared/theme/ThemeProvider.tsx`; components use
the shared design tokens in `src/styles.css` rather than local color palettes.
