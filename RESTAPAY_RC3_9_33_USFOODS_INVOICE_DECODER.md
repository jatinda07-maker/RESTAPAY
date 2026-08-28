# RESTAPAY RC3.9.33 - US Foods Invoice Decoder Accuracy

This release hardens US Foods PDF extraction so invoice lines are transcribed row-by-row from the printed INVOICE LINE DETAILS table instead of guessing or carrying values between rows.

## US Foods mapping
- ORD -> ordered quantity
- SHP -> shipped quantity / RESTAPAY Qty
- ADJ -> adjustment quantity
- SALES UNIT -> purchase unit (CS = Case, EA = Each)
- PRODUCT NUMBER -> item number
- DESCRIPTION -> description
- LABEL -> brand
- PACK SIZE -> exact printed pack/size
- WEIGHT -> actual catch weight
- PRICING UNIT -> pricing basis (for example LB)
- UNIT PRICE -> exact printed unit price
- EXTENDED PRICE -> exact printed line total

Weighted meat lines are not forced through `quantity x unit price`. A two-case, 161 lb beef line priced at $5.14/lb can correctly have an $827.54 extended amount. Printed $0.00 adjustment lines remain zero.

The Gemini prompt no longer contains liquor pack-size examples that could leak into food invoices, and the invoice review form now labels Unit Price and Extended Amount more accurately.
