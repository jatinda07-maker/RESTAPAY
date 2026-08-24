# Employee Base Pay Mapping Fix

Fixed the live Supabase employee adapter so existing `employees.base_pay` values are mapped to the UI `basePay` field and saved back correctly.

Also aligned Supabase employee fields with the current UI aliases for job type, employee type, payment method, and status.

This is non-destructive. Existing base pay values in Supabase are not changed; the UI now reads them correctly.
