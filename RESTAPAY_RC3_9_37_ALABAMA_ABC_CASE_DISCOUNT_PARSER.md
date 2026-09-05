# RESTAPAY RC3.9.37 — Alabama ABC Case / Discount Parser

- Alabama ABC `cs` quantities now stay as case quantities.
- Printed Unit Price is retained as gross case price.
- Printed Discount Amount is retained as discount per case/purchased unit.
- Printed line Amount/Extended remains authoritative.
- Net case cost is derived from Extended / Cases, avoiding rounding drift and double discounting.
- Bottle/Each cost is shown only when pack count is known; pack size is never guessed.
- Manual invoice review shows Cases/Qty, Gross/Case, Discount/Case, Net/Case, Pack/Size, Bottle/Each, Extended.
- Adds persistent invoice_items pricing columns through migration 011.
