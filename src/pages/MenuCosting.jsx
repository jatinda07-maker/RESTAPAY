import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { createId } from '../lib/localStore'

function todayISO() { return new Date().toISOString().slice(0, 10) }
function startOfMonthISO(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10) }
function money(value) { return Number(value || 0).toFixed(2) }
function num(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[$,%]/g, '').trim()
  if (!text) return 0
  if (/^\(.+\)$/.test(text)) return -Number(text.replace(/[()]/g, '')) || 0
  return Number(text) || 0
}
function normKey(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function findValue(row, keys) {
  const mapped = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [normKey(k), v]))
  for (const key of keys) {
    const value = mapped[normKey(key)]
    if (value !== undefined && value !== '') return value
  }
  return ''
}
function formatDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10)
}
function itemSlug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || createId('menu') }
function cleanRows(rows) { return rows.filter(row => Object.values(row || {}).some(value => String(value ?? '').trim() !== '')) }
function sheetObjects(workbook, name) {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return cleanRows(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }))
}
function parseRangeFromFileName(fileName) {
  const match = String(fileName || '').match(/(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2}).*?(\d{4})[-_ ]?(\d{2})[-_ ]?(\d{2})/)
  if (!match) return { start: '', end: '' }
  return { start: `${match[1]}-${match[2]}-${match[3]}`, end: `${match[4]}-${match[5]}-${match[6]}` }
}
function displayMoney(value) { return `$${money(value)}` }
function pct(value) { return `${money(value)}%` }

function isBeerItem(name) {
  const text = String(name || '').toLowerCase()
  return ['beer', 'modelo', 'corona', 'michelob', 'bud light', 'budweiser', 'dos equis', 'xx', 'pacifico', 'tecate', 'negra modelo', 'draft'].some(key => text.includes(key))
}
function isLiquorItem(name) {
  const text = String(name || '').toLowerCase()
  return ['texana', 'tequila', 'vodka', 'rum', 'whiskey', 'corralejo', 'don julio', 'patron', 'casamigos', 'shot', 'liquor'].some(key => text.includes(key))
}
function isMargaritaMixItem(name) {
  const text = String(name || '').toLowerCase()
  return text.includes('marg mix') || text.includes('margarita mix') || text.includes('sweet sour') || text.includes('sour mix')
}
function isMargaritaDrink(name) {
  const text = String(name || '').toLowerCase()
  return text.includes('margarita') && !isMargaritaMixItem(text)
}
function isBuffaloRockItem(name) {
  const text = String(name || '').toLowerCase()
  return ['coke', 'diet', 'sprite', 'tea', 'drink', 'soda', 'coffee', 'lemonade', 'water', 'pepsi', 'mountain dew', 'dr pepper'].some(key => text.includes(key))
}
function isBeverageItem(name) { return isBeerItem(name) || isLiquorItem(name) || isMargaritaDrink(name) || isMargaritaMixItem(name) || isBuffaloRockItem(name) }
function vendorSourceFor(name) {
  if (isLiquorItem(name) || isMargaritaDrink(name)) return 'ABC Store + US Foods'
  if (isBeerItem(name)) return 'Beer Vendor'
  if (isMargaritaMixItem(name)) return 'US Foods'
  if (isBuffaloRockItem(name)) return 'Buffalo Rock'
  return 'US Foods'
}

const baseCosts = {
  tortilla: .18, flourTortilla: .22, cornTortilla: .12, cheese: .48, chicken: 1.58, steak: 2.65, beef: 1.85, pork: 1.70,
  shrimp: 2.95, fish: 2.35, rice: .23, beans: .24, lettuce: .15, tomato: .18, onion: .10, pepper: .22, sauce: .20,
  chips: .35, queso: .85, sourCream: .22, guacamole: .75, avocado: .95, shell: .28, egg: .32, beverage: .42,
  liquor: 1.80, beer: 1.65, margaritaMix: .55, lime: .12, salt: .03, salsa: .18, seasoning: .08, oil: .06
}
const ingredientNames = {
  tortilla: 'Tortilla', flourTortilla: 'Flour tortilla', cornTortilla: 'Corn tortilla', cheese: 'Cheese', chicken: 'Chicken', steak: 'Steak', beef: 'Ground beef', pork: 'Pork', shrimp: 'Shrimp', fish: 'Fish', rice: 'Rice', beans: 'Beans', lettuce: 'Lettuce', tomato: 'Tomato', onion: 'Onion', pepper: 'Peppers', sauce: 'Sauce', chips: 'Chips', queso: 'Queso', sourCream: 'Sour cream', guacamole: 'Guacamole', avocado: 'Avocado', shell: 'Taco shell', egg: 'Egg', beverage: 'Beverage syrup/cup', liquor: 'Liquor pour', beer: 'Beer cost', margaritaMix: 'Margarita mix', lime: 'Fresh lime', salt: 'Rim salt', salsa: 'Salsa', seasoning: 'Seasoning', oil: 'Cooking oil'
}
function ing(key, qty, unit = 'portion', cost = baseCosts[key], vendor = 'US Foods') {
  return { id: createId('recipe-line'), ingredient: ingredientNames[key] || key, qty, unit, vendor, unitCost: Number(cost || 0), totalCost: Number(cost || 0) * Number(qty || 1), source: 'Estimated' }
}
function recipeTemplate(name, avgPrice = 0) {
  const text = String(name || '').toLowerCase()
  let lines = []
  if (isBeverageItem(text)) {
    if (isMargaritaDrink(text)) {
      lines = [ing('liquor', 1.5, 'oz', baseCosts.liquor, 'ABC Store'), ing('margaritaMix', 4, 'oz', baseCosts.margaritaMix / 4, 'US Foods'), ing('lime', 1, 'wedge', baseCosts.lime, 'US Foods'), ing('salt', 1, 'rim', baseCosts.salt, 'US Foods')]
    } else if (isLiquorItem(text)) {
      lines = [ing('liquor', 1.5, 'oz', baseCosts.liquor, 'ABC Store')]
    } else if (isBeerItem(text)) {
      lines = [ing('beer', 1, 'bottle/draft', baseCosts.beer, 'Beer Vendor')]
    } else if (isMargaritaMixItem(text)) {
      lines = [ing('margaritaMix', 1, 'serving', baseCosts.margaritaMix, 'US Foods')]
    } else {
      lines = [ing('beverage', 1, 'serving', baseCosts.beverage, 'Buffalo Rock')]
    }
  } else if (text.includes('fajita')) {
    const protein = text.includes('shrimp') ? 'shrimp' : text.includes('steak') || text.includes('beef') ? 'steak' : 'chicken'
    lines = [ing(protein, 7, 'oz'), ing('pepper', 2, 'oz'), ing('onion', 2, 'oz'), ing('flourTortilla', 3, 'each'), ing('rice', 4, 'oz'), ing('beans', 4, 'oz'), ing('lettuce', 1, 'oz'), ing('tomato', 1, 'oz'), ing('sourCream', 1, 'oz'), ing('guacamole', 1, 'oz'), ing('seasoning', 1, 'portion')]
  } else if (text.includes('burrito') || text.includes('burro')) {
    const protein = text.includes('steak') || text.includes('beef') ? 'beef' : text.includes('chicken') ? 'chicken' : 'beef'
    lines = [ing('flourTortilla', 1, 'each'), ing(protein, 5, 'oz'), ing('rice', 3, 'oz'), ing('beans', 3, 'oz'), ing('cheese', 1.5, 'oz'), ing('sauce', 1, 'portion'), ing('lettuce', 1, 'oz'), ing('tomato', 1, 'oz')]
  } else if (text.includes('chimichanga')) {
    lines = [ing('flourTortilla', 1, 'each'), ing('chicken', 5, 'oz'), ing('rice', 2, 'oz'), ing('beans', 2, 'oz'), ing('cheese', 1.5, 'oz'), ing('sauce', 1, 'portion'), ing('oil', 1, 'portion'), ing('sourCream', 1, 'oz')]
  } else if (text.includes('quesadilla')) {
    const protein = text.includes('steak') ? 'steak' : text.includes('chicken') ? 'chicken' : null
    lines = [ing('flourTortilla', 1, 'each'), ing('cheese', 3, 'oz'), ...(protein ? [ing(protein, 4, 'oz')] : []), ing('sourCream', 1, 'oz'), ing('salsa', 1, 'portion')]
  } else if (text.includes('taco')) {
    const protein = text.includes('fish') ? 'fish' : text.includes('steak') || text.includes('asada') ? 'steak' : text.includes('chicken') ? 'chicken' : 'beef'
    lines = [ing('cornTortilla', 2, 'each'), ing(protein, 3, 'oz'), ing('lettuce', 1, 'oz'), ing('cheese', .75, 'oz'), ing('tomato', .75, 'oz'), ing('salsa', 1, 'portion')]
  } else if (text.includes('enchilada')) {
    lines = [ing('cornTortilla', 3, 'each'), ing('chicken', 4, 'oz'), ing('cheese', 2, 'oz'), ing('sauce', 2, 'portion'), ing('rice', 3, 'oz'), ing('beans', 3, 'oz')]
  } else if (text.includes('nacho')) {
    lines = [ing('chips', 3, 'oz'), ing('queso', 2, 'oz'), ing('beef', 4, 'oz'), ing('beans', 3, 'oz'), ing('cheese', 1.5, 'oz'), ing('sourCream', 1, 'oz'), ing('guacamole', 1, 'oz')]
  } else if (text.includes('avocado')) {
    lines = [ing('avocado', 1, 'each'), ing('lettuce', 1, 'oz'), ing('tomato', .5, 'oz')]
  } else if (text.includes('rice') || text.includes('arroz')) {
    lines = [ing('rice', text.includes('large') || text.includes('grande') ? 12 : 5, 'oz'), ing('seasoning', 1, 'portion')]
  } else if (text.includes('bean') || text.includes('frijol')) {
    lines = [ing('beans', text.includes('large') || text.includes('grande') ? 12 : 5, 'oz'), ing('cheese', .5, 'oz')]
  } else if (text.includes('chile relleno')) {
    lines = [ing('pepper', 1, 'each'), ing('cheese', 3, 'oz'), ing('egg', 1, 'each'), ing('sauce', 1, 'portion'), ing('rice', 3, 'oz'), ing('beans', 3, 'oz')]
  } else {
    const targetCost = Math.max(Number(avgPrice || 0) * .30, 1.25)
    lines = [ing('tortilla', 1, 'base', .25), ing('chicken', 3, 'oz', targetCost * .45), ing('rice', 3, 'oz', targetCost * .18), ing('beans', 3, 'oz', targetCost * .18), ing('cheese', 1, 'oz', targetCost * .19)]
  }
  return lines.map(line => ({ ...line, totalCost: Number(line.totalCost || (Number(line.qty || 1) * Number(line.unitCost || 0))) }))
}
function dishCost(recipe = []) { return recipe.reduce((acc, line) => acc + num(line.totalCost), 0) }
function suggestedPrice(cost, targetFoodCost = 30) { return targetFoodCost ? cost / (targetFoodCost / 100) : 0 }
function classifyItem(qty, grossProfit, avgQty, avgProfit) {
  const popular = qty >= avgQty
  const profitable = grossProfit >= avgProfit
  if (popular && profitable) return { label: 'Star', tone: 'green', note: 'High popularity and high profit' }
  if (!popular && profitable) return { label: 'Puzzle', tone: 'blue', note: 'High profit but low sales' }
  if (popular && !profitable) return { label: 'Plow Horse', tone: 'orange', note: 'Popular but margin needs review' }
  return { label: 'Dog', tone: 'red', note: 'Low sales and low profit' }
}
function parseProductMix(workbook, fileName) {
  const range = parseRangeFromFileName(fileName)
  const rows = sheetObjects(workbook, 'Items')
  return rows.map((row) => {
    const name = String(findValue(row, ['Item', 'Item, open item', 'Open item', 'Name'])).trim()
    const qty = num(findValue(row, ['Qty sold', 'Quantity sold', 'Qty']))
    const avgPrice = num(findValue(row, ['Avg. price', 'Avg price', 'Average price']))
    const gross = num(findValue(row, ['Gross item amt', 'Gross item amount', 'Gross sales']))
    const net = num(findValue(row, ['Net item amt', 'Net item amount', 'Net sales'])) || gross
    if (!name || !qty) return null
    const toastDepartment = String(findValue(row, ['Sales Category', 'Sales category', 'Department', 'Menu Group', 'Menu group', 'Category']) || '').trim()
    return {
      id: itemSlug(`${name}-${range.start || fileName}`),
      name,
      department: toastDepartment || ((isLiquorItem(name) || isMargaritaDrink(name)) ? 'Liquor' : isBeerItem(name) ? 'Beer' : isBeverageItem(name) ? 'Beverage' : 'Food'),
      category: toastDepartment || ((isLiquorItem(name) || isMargaritaDrink(name)) ? 'Liquor' : isBeerItem(name) ? 'Beer' : isBeverageItem(name) ? 'Beverage' : 'Food'),
      vendorSource: vendorSourceFor(name),
      qtySold: qty,
      avgPrice,
      grossSales: gross,
      netSales: net,
      dateStart: range.start,
      dateEnd: range.end,
      sourceFile: fileName,
      importedAt: new Date().toISOString(),
      status: 'Estimated'
    }
  }).filter(Boolean)
}
function matchInvoiceIngredient(ingredient, invoiceItems = []) {
  const target = String(ingredient || '').toLowerCase()
  if (!target) return null
  const matches = invoiceItems.filter(item => String(item.item_name || item.description || item.name || '').toLowerCase().includes(target.split(' ')[0]))
  if (!matches.length) return null
  const latest = matches[matches.length - 1]
  return { name: latest.item_name || latest.description || ingredient, unitCost: num(latest.unit_price || latest.price || latest.cost), vendor: latest.vendor_name || latest.vendor || 'Invoice history' }
}

export default function MenuCosting({ data, setData }) {
  const menuItems = data.menuItems || []
  const menuRecipes = data.menuRecipes || []
  const [selectedId, setSelectedId] = useState(menuItems[0]?.id || '')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [dateStart, setDateStart] = useState(() => startOfMonthISO())
  const [dateEnd, setDateEnd] = useState(() => todayISO())
  const [targetFoodCost, setTargetFoodCost] = useState(Number(data.settings?.targetFoodCost || 30))
  const [targetBeerCost, setTargetBeerCost] = useState(Number(data.settings?.targetBeerCost || 24))
  const [targetLiquorCost, setTargetLiquorCost] = useState(Number(data.settings?.targetLiquorCost || 20))
  const [targetBeverageCost, setTargetBeverageCost] = useState(Number(data.settings?.targetBeverageCost || 18))
  const [status, setStatus] = useState('Import Toast Product Mix to create dishes and estimated recipes.')

  function applyPreset(key) {
    const now = new Date()
    if (key === 'today') { const t = now.toISOString().slice(0, 10); setDateStart(t); setDateEnd(t); return }
    if (key === 'lastWeek') {
      const day = now.getDay() || 7
      const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - day + 1)
      const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7)
      const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6)
      setDateStart(lastMonday.toISOString().slice(0, 10)); setDateEnd(lastSunday.toISOString().slice(0, 10)); return
    }
    if (key === 'lastMonth') { setDateStart(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)); setDateEnd(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)); return }
    if (key === 'thisMonth') { setDateStart(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)); setDateEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)); return }
    setDateStart(''); setDateEnd('')
  }

  async function handleProductMixUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const items = parseProductMix(workbook, file.name)
      if (!items.length) { setStatus('No menu items found. Make sure this is a Toast Product Mix file with an Items sheet.'); return }
      const existingRecipes = new Set((data.menuRecipes || []).map(row => row.menuItemId))
      const recipes = items.filter(item => !existingRecipes.has(item.id)).map(item => ({ id: createId('recipe'), menuItemId: item.id, menuItemName: item.name, targetFoodCost, confidence: 'Estimated', lines: recipeTemplate(item.name, item.avgPrice), updatedAt: new Date().toISOString() }))
      setData(prev => ({
        ...prev,
        menuItems: [...(prev.menuItems || []).filter(row => !items.some(item => item.id === row.id)), ...items],
        menuRecipes: [...(prev.menuRecipes || []), ...recipes],
        menuImports: [...(prev.menuImports || []), { id: createId('menu-import'), fileName: file.name, rowCount: items.length, importedAt: new Date().toISOString() }],
        settings: { ...(prev.settings || {}), targetFoodCost }
      }))
      setSelectedId(items[0]?.id || selectedId)
      setStatus(`Imported ${items.length} menu items and created ${recipes.length} estimated recipes.`)
    } catch (error) {
      console.error(error)
      setStatus('Product Mix import failed. Please check the file format.')
    } finally {
      event.target.value = ''
    }
  }

  function buildMissingRecipes() {
    const existing = new Set(menuRecipes.map(row => row.menuItemId))
    const missing = menuItems.filter(item => !existing.has(item.id)).map(item => ({ id: createId('recipe'), menuItemId: item.id, menuItemName: item.name, targetFoodCost, confidence: 'Estimated', lines: recipeTemplate(item.name, item.avgPrice), updatedAt: new Date().toISOString() }))
    if (!missing.length) { setStatus('All imported menu items already have recipes.'); return }
    setData(prev => ({ ...prev, menuRecipes: [...(prev.menuRecipes || []), ...missing] }))
    setStatus(`Created ${missing.length} estimated recipes.`)
  }

  function updateRecipeLine(recipeId, lineId, field, value) {
    setData(prev => ({
      ...prev,
      menuRecipes: (prev.menuRecipes || []).map(recipe => recipe.id !== recipeId ? recipe : {
        ...recipe,
        confidence: 'Edited',
        lines: (recipe.lines || []).map(line => {
          if (line.id !== lineId) return line
          const next = { ...line, [field]: ['qty', 'unitCost', 'totalCost'].includes(field) ? Number(value || 0) : value }
          if (field === 'qty' || field === 'unitCost') next.totalCost = Number(next.qty || 0) * Number(next.unitCost || 0)
          return next
        }),
        updatedAt: new Date().toISOString()
      })
    }))
  }
  function deleteRecipeLine(recipeId, lineId) {
    setData(prev => ({
      ...prev,
      menuRecipes: (prev.menuRecipes || []).map(recipe => recipe.id !== recipeId ? recipe : {
        ...recipe,
        confidence: 'Edited',
        lines: (recipe.lines || []).filter(line => line.id !== lineId),
        updatedAt: new Date().toISOString()
      })
    }))
  }
  function addRecipeLine(recipeId, ingredientKey = 'chicken') {
    const newLine = ing(ingredientKey, 1, 'portion', baseCosts[ingredientKey] || 0, ingredientKey === 'beer' ? 'Beer Vendor' : ingredientKey === 'liquor' ? 'ABC Store' : ingredientKey === 'margaritaMix' ? 'US Foods' : 'US Foods')
    setData(prev => ({
      ...prev,
      menuRecipes: (prev.menuRecipes || []).map(recipe => recipe.id !== recipeId ? recipe : {
        ...recipe,
        confidence: 'Edited',
        lines: [...(recipe.lines || []), newLine],
        updatedAt: new Date().toISOString()
      })
    }))
  }
  function approveRecipe(recipeId) {
    setData(prev => ({ ...prev, menuRecipes: (prev.menuRecipes || []).map(recipe => recipe.id === recipeId ? { ...recipe, confidence: 'Approved', updatedAt: new Date().toISOString() } : recipe) }))
  }

  function targetForCategory(itemCategory) {
    if (itemCategory === 'Liquor') return targetLiquorCost
    if (itemCategory === 'Beer') return targetBeerCost
    if (itemCategory === 'Beverage') return targetBeverageCost
    return targetFoodCost
  }

  function saveCostTargets() {
    setData(prev => ({ ...prev, settings: { ...(prev.settings || {}), targetFoodCost, targetBeerCost, targetLiquorCost, targetBeverageCost } }))
    setStatus('Food and alcohol cost targets saved.')
  }

  const recipesByItem = useMemo(() => Object.fromEntries(menuRecipes.map(recipe => [recipe.menuItemId, recipe])), [menuRecipes])
  const enrichedItems = useMemo(() => {
    const rows = menuItems.map(item => {
      const recipe = recipesByItem[item.id]
      const cost = dishCost(recipe?.lines || [])
      const foodCostPct = item.avgPrice ? (cost / item.avgPrice) * 100 : 0
      const profitEach = Number(item.avgPrice || 0) - cost
      const totalProfit = profitEach * Number(item.qtySold || 0)
      const targetCostPct = targetForCategory(item.category)
      return { ...item, recipe, dishCost: cost, foodCostPct, targetCostPct, profitEach, totalProfit, suggestedPrice: suggestedPrice(cost, targetCostPct) }
    })
    const avgQty = rows.reduce((acc, row) => acc + row.qtySold, 0) / Math.max(rows.length, 1)
    const avgProfit = rows.reduce((acc, row) => acc + Math.max(row.profitEach, 0), 0) / Math.max(rows.length, 1)
    return rows.map(row => ({ ...row, matrix: classifyItem(row.qtySold, row.profitEach, avgQty, avgProfit) }))
  }, [menuItems, recipesByItem, targetFoodCost, targetBeerCost, targetLiquorCost, targetBeverageCost])
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim()
    return enrichedItems.filter(item => {
      if (q && !String(item.name).toLowerCase().includes(q) && !String(item.vendorSource).toLowerCase().includes(q) && !String(item.matrix?.label).toLowerCase().includes(q)) return false
      if (category !== 'all' && item.category !== category) return false
      if (dateStart && item.dateStart && item.dateStart < dateStart) return false
      if (dateEnd && item.dateEnd && item.dateEnd > dateEnd) return false
      return true
    }).sort((a, b) => b.totalProfit - a.totalProfit)
  }, [enrichedItems, search, category, dateStart, dateEnd])
  const selected = enrichedItems.find(item => item.id === selectedId) || filteredItems[0] || enrichedItems[0]
  const selectedRecipe = selected?.recipe
  const totals = filteredItems.reduce((acc, item) => {
    acc.sales += num(item.netSales || item.grossSales)
    acc.qty += num(item.qtySold)
    acc.cost += num(item.dishCost) * num(item.qtySold)
    acc.profit += num(item.totalProfit)
    acc.atRisk += item.foodCostPct > item.targetCostPct ? 1 : 0
    if (item.category === 'Food') { acc.foodSales += num(item.netSales || item.grossSales); acc.foodCost += num(item.dishCost) * num(item.qtySold) }
    else { acc.alcoholSales += num(item.netSales || item.grossSales); acc.alcoholCost += num(item.dishCost) * num(item.qtySold) }
    return acc
  }, { sales: 0, qty: 0, cost: 0, profit: 0, atRisk: 0, foodSales: 0, foodCost: 0, alcoholSales: 0, alcoholCost: 0 })

  return (
    <div className="menu-costing-page">
      <section className="form-card menu-hero-card">
        <div>
          <span className="eyebrow">Menu Engineering</span>
          <h2>Recipe Costing & Dish Profit</h2>
          <p>Import Toast Product Mix, estimate recipes, connect food to US Foods, beer to your beer vendor, liquor to ABC Store, and soft drinks to Buffalo Rock. Calculate food cost, beer cost, liquor cost, gross profit, and suggested menu price.</p>
        </div>
        <div className="actions">
          <label className="btn primary file-action"><Icon name="upload" size={16} /> Import Product Mix<input type="file" accept=".xlsx,.xls,.csv" onChange={handleProductMixUpload} /></label>
          <button className="btn secondary" onClick={buildMissingRecipes} type="button"><Icon name="utensils" size={16} /> Build Missing Recipes</button>
        </div>
      </section>

      <section className="filter-card menu-filter-card">
        <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={() => setStatus('Date filter applied.')} onPreset={applyPreset} applyLabel="Apply" />
        <label><span>Search Dish / Vendor</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tacos, fajitas, Buffalo Rock..." /></label>
        <label><span>Category</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All</option><option>Food</option><option>Beverage</option><option>Beer</option><option>Liquor</option></select></label>
        <label><span>Food Target %</span><input type="number" min="1" max="90" value={targetFoodCost} onChange={e => setTargetFoodCost(Number(e.target.value || 0))} /></label>
        <label><span>Beer Target %</span><input type="number" min="1" max="90" value={targetBeerCost} onChange={e => setTargetBeerCost(Number(e.target.value || 0))} /></label>
        <label><span>Liquor Target %</span><input type="number" min="1" max="90" value={targetLiquorCost} onChange={e => setTargetLiquorCost(Number(e.target.value || 0))} /></label>
        <label><span>Soft Drink Target %</span><input type="number" min="1" max="90" value={targetBeverageCost} onChange={e => setTargetBeverageCost(Number(e.target.value || 0))} /></label>
        <button className="btn secondary compact" type="button" onClick={saveCostTargets}><Icon name="save" size={15} /> Save Targets</button>
      </section>

      <p className="status-pill">{status}</p>

      <div className="metric-grid menu-costing-metrics">
        <div className="metric-card tone-blue"><span className="metric-icon"><Icon name="utensils" /></span><span className="metric-label">Menu Items</span><strong>{filteredItems.length}</strong><small>From Product Mix</small></div>
        <div className="metric-card tone-green"><span className="metric-icon"><Icon name="dollar" /></span><span className="metric-label">Estimated Sales</span><strong>{displayMoney(totals.sales)}</strong><small>Selected range</small></div>
        <div className="metric-card tone-orange"><span className="metric-icon"><Icon name="package" /></span><span className="metric-label">Food Cost</span><strong>{displayMoney(totals.foodCost)}</strong><small>{pct(totals.foodSales ? totals.foodCost / totals.foodSales * 100 : 0)} of food sales</small></div>
        <div className="metric-card tone-purple"><span className="metric-icon"><Icon name="wine" /></span><span className="metric-label">Alcohol & Beverage Cost</span><strong>{displayMoney(totals.alcoholCost)}</strong><small>{pct(totals.alcoholSales ? totals.alcoholCost / totals.alcoholSales * 100 : 0)} of beverage sales</small></div>
        <div className="metric-card tone-red"><span className="metric-icon"><Icon name="alert" /></span><span className="metric-label">Items Above Target</span><strong>{totals.atRisk}</strong><small>Compared with category targets</small></div>
      </div>

      <div className="menu-workspace-grid">
        <section className="table-card">
          <header><h2>Imported Dishes</h2><span className="badge neutral">Click a dish to review recipe</span></header>
          <div className="table-wrap menu-table-wrap">
            <table>
              <thead><tr><th>Dish</th><th>Qty</th><th>Avg Price</th><th>Dish Cost</th><th>Food Cost</th><th>Profit</th><th>Class</th></tr></thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} className={selected?.id === item.id ? 'selected-row' : ''} onClick={() => setSelectedId(item.id)}>
                    <td><b>{item.name}</b><br /><small>{item.vendorSource} · {item.recipe?.confidence || 'Needs recipe'}</small></td>
                    <td>{item.qtySold}</td>
                    <td>{displayMoney(item.avgPrice)}</td>
                    <td>{displayMoney(item.dishCost)}</td>
                    <td><span className={`food-cost-chip ${item.foodCostPct > item.targetCostPct ? 'bad' : 'good'}`}>{pct(item.foodCostPct)}</span></td>
                    <td>{displayMoney(item.totalProfit)}</td>
                    <td><span className={`tag ${item.matrix?.tone || 'neutral'}`}>{item.matrix?.label}</span></td>
                  </tr>
                ))}
                {!filteredItems.length && <tr><td colSpan="7">No Product Mix items imported yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-card recipe-detail-card">
          <header className="section-card-header">
            <div><h2>{selected?.name || 'Select a dish'}</h2><small>{selected ? `${selected.vendorSource} source · ${selected.category}` : 'Import Product Mix to begin'}</small></div>
            {selectedRecipe && <button className="btn primary compact" type="button" onClick={() => approveRecipe(selectedRecipe.id)}><Icon name="shield" size={15} /> Approve Recipe</button>}
          </header>
          {selected ? <div className="section-card-body">
            <div className="recipe-score-grid">
              <div><small>Selling Price</small><strong>{displayMoney(selected.avgPrice)}</strong></div>
              <div><small>Dish Cost</small><strong>{displayMoney(selected.dishCost)}</strong></div>
              <div><small>{selected.category === 'Food' ? 'Food Cost' : selected.category + ' Cost'}</small><strong className={selected.foodCostPct > selected.targetCostPct ? 'danger-text' : 'good-text'}>{pct(selected.foodCostPct)}</strong><small>Target {pct(selected.targetCostPct)}</small></div>
              <div><small>Suggested Price</small><strong>{displayMoney(selected.suggestedPrice)}</strong></div>
            </div>
            <div className="table-wrap recipe-lines-table">
              <table>
                <thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Vendor</th><th>Unit Cost</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {(selectedRecipe?.lines || []).map(line => {
                    const invoiceMatch = matchInvoiceIngredient(line.ingredient, data.invoiceItems || [])
                    return <tr key={line.id}>
                      <td><input list="ingredient-options" value={line.ingredient} onChange={e => updateRecipeLine(selectedRecipe.id, line.id, 'ingredient', e.target.value)} /></td>
                      <td><input type="number" value={line.qty} onChange={e => updateRecipeLine(selectedRecipe.id, line.id, 'qty', e.target.value)} /></td>
                      <td><input value={line.unit} onChange={e => updateRecipeLine(selectedRecipe.id, line.id, 'unit', e.target.value)} /></td>
                      <td><input value={invoiceMatch?.vendor || line.vendor} onChange={e => updateRecipeLine(selectedRecipe.id, line.id, 'vendor', e.target.value)} /></td>
                      <td><input type="number" step="0.01" value={line.unitCost} onChange={e => updateRecipeLine(selectedRecipe.id, line.id, 'unitCost', e.target.value)} /></td>
                      <td><b>{displayMoney(line.totalCost)}</b></td>
                      <td><button className="icon-btn danger" title="Delete ingredient" type="button" onClick={() => deleteRecipeLine(selectedRecipe.id, line.id)}>×</button></td>
                    </tr>
                  })}
                  {!selectedRecipe && <tr><td colSpan="7">No recipe yet. Click Build Missing Recipes.</td></tr>}
                </tbody>
              </table>
            </div>
            {selectedRecipe && <div className="recipe-add-bar">
              <datalist id="ingredient-options">
                {Object.entries(ingredientNames).map(([key, label]) => <option key={key} value={label} />)}
              </datalist>
              <span>Add common ingredient:</span>
              {['chicken','steak','beef','cheese','rice','beans','flourTortilla','liquor','margaritaMix','lime','salt','beer','beverage'].map(key => (
                <button key={key} className="btn soft compact" type="button" onClick={() => addRecipeLine(selectedRecipe.id, key)}>{ingredientNames[key]}</button>
              ))}
            </div>}
            <div className="recipe-footer-note">
              <b>{selectedRecipe?.confidence || 'Estimated'}</b> recipes are first-pass estimates. Edit portions once and RestaPay saves your restaurant version for future Product Mix uploads.
            </div>
          </div> : <div className="section-card-body">Select an item to see recipe costing.</div>}
        </section>
      </div>
    </div>
  )
}
