# RC15.6.1 Vendor Comparison DateEngine Build Fix

Fixed VendorComparison.jsx to use the DateEngine exports that actually exist:

- Replaced `monthToDateRange` with `getPresetRange('thisMonth')`
- Replaced `presetRange(key)` with `getPresetRange(key)`

This resolves the Vite/Rollup build error:

`"monthToDateRange" is not exported by "src/engine/DateEngine.js"`
