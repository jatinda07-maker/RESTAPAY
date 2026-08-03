export function classifyToastFile(fileName = '') {
  const name = fileName.toLowerCase()
  if (name.includes('labor') || name.includes('timeentr') || name.includes('time_entries')) return 'labor'
  if (name.includes('product') || name.includes('allitems') || name.includes('itemselection') || name.includes('item_selection')) return 'product_mix'
  if (name.includes('menu')) return 'menu'
  if (name.includes('cash') || name.includes('closeout')) return 'cash_closeout'
  if (name.includes('payment')) return 'payments'
  if (name.includes('order')) return 'orders'
  if (name.includes('sales')) return 'sales'
  return 'unknown'
}
