# RC4 Sprint 1.6 - Tips Withholding and Final Check Fix

- Payroll totals now prefer the stored Toast original tip value when available.
- Missing withholding is recalculated at the configured payroll withholding rate (default 3.5%).
- Net tips are calculated as original tips minus withholding.
- Final checks are recalculated as regular pay plus overtime pay plus net tips plus extra pay.
- Payroll approval and Make Checks use the same corrected final-check calculation.
- Approved entries persist normalized original tips, withheld tips, net tips, and final total to Supabase.
- Production build and Toast labor import tests passed.
