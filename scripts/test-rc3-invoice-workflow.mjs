import fs from 'node:fs'
import { reconcileInvoiceExtraction } from '../src/core/engines/InvoiceEngine.js'

const invoices = fs.readFileSync(new URL('../src/pages/Invoices.jsx', import.meta.url), 'utf8')
const edge = fs.readFileSync(new URL('../supabase/functions/gemini-invoice/index.ts', import.meta.url), 'utf8')

const recon = reconcileInvoiceExtraction({
  lines:[
    {description:'DEKUYPER TRIPLE SEC',quantity:1,unit_price:62.94,line_total:54.13},
    {description:'EL TORO SILVER TEQUILA',quantity:4,unit_price:167.88,line_total:577.51},
    {description:'GRAND MARNIER',quantity:1,unit_price:449.94,line_total:386.95},
  ],
  printedSubtotal:1018.59,
  printedNet:1018.59,
  printedTotal:1018.59,
  summaryDiscount:0,
})

const checks = [
  ['ABC invoice reconciles to printed total', recon.reconciled && recon.authoritative_total === 1018.59 && recon.line_subtotal === 1018.59],
  ['manual invoice number stays blank by default', /number:''/.test(invoices)],
  ['bulk invoice status actions exist', /bulkActions=\['Draft','Approved','Paid','Unpaid','Void'\]/.test(invoices)],
  ['paid bulk action captures payment details', /payment_date[\s\S]*payment_method[\s\S]*payment_reference/.test(invoices)],
  ['smart upload tracker exists', /Smart Invoice Upload Tracker/.test(invoices) && /tracker-bar/.test(invoices)],
  ['smart upload retry exists', /Retry/.test(invoices) && /parseFile\(retryFile\)/.test(invoices)],
  ['extraction reconciliation blocks silent mismatch', /Total mismatch — Needs Review/.test(invoices)],
  ['printed final total is authoritative', /authoritativeTotal=recon\.authoritative_total/.test(invoices)],
  ['edge extractor requests printed line amount semantics', /Never subtract a printed line discount/.test(edge)],
  ['edge extractor returns subtotal and net fields', /sales_subtotal/.test(edge) && /net_amount/.test(edge) && /total_discount/.test(edge)],
]
let failed=false
for(const [name,ok] of checks){if(!ok){console.error(`FAIL: ${name}`);failed=true}}
if(failed)process.exit(1)
console.log('RC3 invoice workflow regression passed: bulk actions, blank manual number, smart upload tracker, and invoice total reconciliation are wired.')
