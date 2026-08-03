# RESTAPAY Universal UI Foundation

This build removes every legacy CSS file from `src` and uses one active stylesheet:

- `src/styles/universal.css`

It also:

- removes the old `Dashboard.css` import;
- changes `src/main.jsx` to load the universal stylesheet only;
- applies a white navigation system;
- implements a four-card desktop Dashboard grid;
- adds the approved hybrid Dashboard summary, insights, and quick actions;
- standardizes controls, forms, tables, cards, filters, and modals;
- preserves the existing business logic and data engines.

## Build verification

The project could not install dependencies in the packaging environment because its npm registry mirror returned a 404 for a transitive package. `APPLY_BUILD_PUSH.ps1` performs the actual production build on the target computer and automatically restores the backed-up `src` folder if the build fails.
