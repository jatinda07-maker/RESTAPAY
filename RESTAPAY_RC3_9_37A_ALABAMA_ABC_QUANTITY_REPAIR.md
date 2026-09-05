# RESTAPAY RC3.9.37A - Alabama ABC Quantity Repair

Fixes Alabama Alcoholic Beverage Control invoice rows where Gemini captures the correct gross case price, discount per case and printed extended amount but returns Cases / Qty as 0.

For Alabama ABC Case/CS lines only, when printed quantity is missing from the model response, RESTAPAY derives a case count from `Extended / (Gross Case - Discount per Case)` only when the result is a near-exact whole number (within $0.03 line rounding variance). Explicit positive extracted quantities always win.

The repair runs both in the Supabase `gemini-invoice` Edge Function and again in the client review mapper as a fail-safe. Repaired quantity is also written to `shipped_qty` so later invoice normalization cannot revert it to zero. CS is normalized to Case and EA to Each.

Regression examples from SINV-11892624:
- EL TORO: 2 cases; 167.88 - 23.51; extended 288.75; net case 144.38.
- DEKUYPER: 2 cases; 62.94 - 8.81; extended 108.26; net case 54.13.
- GRAND MARNIER: 2 cases; 449.94 - 62.99; extended 773.90; net case 386.95.
