# RC12.6.2 Alcohol Reference Permanent Fix

- Removed the `explicitAlcoholSales` temporary variable entirely.
- Department detection now checks the actual Toast alcohol sources directly.
- Rebuilt production assets.
- New production bundle: `dist/assets/index-BKuAHrZy.js`.
- This fixes the blank screen caused by `ReferenceError: explicitAlcoholSales is not defined`.
