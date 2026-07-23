# RC4 Sprint 1 — Financial Integrity Foundation

## Completed in this package

- Reconstructed the original React/Vite project structure from the flattened source archive.
- Corrected payroll tip handling so already-net tips are not reduced by withholding a second time.
- Corrected operating labor so server wages, overtime, and extra pay remain operating costs while customer tips stay excluded from profit and prime cost.
- Corrected cash operating payroll to use wages only, preventing customer tips from reducing Cash Remaining.
- Updated Prime Cost dashboard wording to consistently include food COGS, alcohol COGS, and operating labor.

## Financial rules now enforced

- Toast Sales Summary remains the only sales source of truth.
- Customer tips are pass-through funds and do not reduce operating profit, prime cost, or operating cash.
- Server wages are still labor expense; only the tip portion is excluded.
- Prime Cost = Food COGS + Alcohol COGS + Operating Labor.
- Operating Profit = Toast Net Sales − Operating Labor − Vendor/Business Operating Spend.
