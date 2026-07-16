import { calculateDepartmentCosts } from '../src/engine/DepartmentCostEngine.js'

const result = calculateDepartmentCosts({
  spendRows: [
    { id: 'bank', _source_table: 'expenses', vendor: 'BANK OF AMERICA', category: 'Liquor', amount: 1500, date: '2026-06-10' },
    { id: 'beer', _source_table: 'invoice_items', vendor: 'ABC STORE', category: 'Beer', description: 'Bottled beer', amount: 100 },
    { id: 'wine', _source_table: 'invoice_items', vendor: 'ABC STORE', category: 'Liquor', description: 'Wine case', amount: 200 },
    { id: 'marg', _source_table: 'invoice_items', vendor: 'US Foods', category: 'Margarita Mix', description: 'Margarita mix', amount: 50 }
  ]
})
if (result.beerPurchases !== 100) throw new Error(`Beer expected 100, got ${result.beerPurchases}`)
if (result.liquorPurchases !== 200) throw new Error(`Liquor expected 200, got ${result.liquorPurchases}`)
if (result.margaritaMix !== 50) throw new Error(`Margarita expected 50, got ${result.margaritaMix}`)
if (result.directAlcoholCost !== 350) throw new Error(`Direct alcohol expected 350, got ${result.directAlcoholCost}`)
if ((result.spendDetails.beer || []).some(r => r.id === 'bank') || (result.spendDetails.liquor || []).some(r => r.id === 'bank')) throw new Error('Bank payment leaked into alcohol cost')
console.log('PASS actual costing: invoice lines total $350.00; BANK OF AMERICA expense excluded from alcohol COGS.')
