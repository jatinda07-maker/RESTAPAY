# RC13.4 Toast Payment and Month-to-Date Fix

- Sales screen now defaults to the first day of the current month through today.
- Dashboard and date-filtered analysis screens default to month-to-date when no saved range exists.
- Toast Payments Summary now populates daily Cash, Credit/Debit, Gift Card, Other, Tax, and Tips values.
- Other payments are stored in the visible Other column instead of being lost in an unused field.
- Tips show collected, 3.5% withheld, and after-withholding totals.
- Sales History columns now align with the values displayed; hidden tip fields no longer shift the table under the wrong headers.
- Re-importing a Toast range replaces prior rows for the same business dates.

Verified against SalesSummary_2026-06-01_2026-06-30 (1).xlsx:
- Net Sales: $89,009.16
- Cash: $16,783.21
- Credit/Debit: $76,266.74
- Gift Card: $100.00
- Other: $1,255.59
- Tips Collected: $14,798.82
- Tips Withheld (3.5%): $517.96
- Tips After Withholding: $14,280.86
- Tax: $5,361.38
