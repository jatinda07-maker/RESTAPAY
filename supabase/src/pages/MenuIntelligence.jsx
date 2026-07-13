import React, { useMemo, useState } from 'react'
import DateControls from '../components/DateControls'
import { Icon } from '../components/Icons'

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace(/[$,%(),]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}
function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function percent(value) { return `${Number(value || 0).toFixed(1)}%` }
function recipeCost(recipe) {
  return (recipe?.lines || []).reduce((sum, line) => sum + number(line.totalCost ?? (number(line.qty) * number(line.unitCost))), 0)
}
function inRange(item, start, end) {
  const itemStart = String(item.dateStart || item.date_start || item.business_date || '').slice(0, 10)
  const itemEnd = String(item.dateEnd || item.date_end || itemStart || '').slice(0, 10)
  if (start && itemEnd && itemEnd < start) return false
  if (end && itemStart && itemStart > end) return false
  return true
}
function classifyMatrix(qty, profitEach, avgQty, avgProfit) {
  const popular = qty >= avgQty
  const profitable = profitEach >= avgProfit
  if (popular && profitable) return { label: 'Star', tone: 'green', guidance: 'Protect quality and keep visible.' }
  if (popular && !profitable) return { label: 'Plowhorse', tone: 'orange', guidance: 'Review portion cost or modest price increase.' }
  if (!popular && profitable) return { label: 'Puzzle', tone: 'purple', guidance: 'Promote, rename, or improve menu placement.' }
  return { label: 'Dog', tone: 'red', guidance: 'Consider removing, replacing, or redesigning.' }
}
function presetRange(key) {
  const now = new Date()
  const iso = date => date.toISOString().slice(0, 10)
  if (key === 'today') return { start: iso(now), end: iso(now) }
  if (key === 'thisMonth') return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  if (key === 'lastMonth') return { start: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
  if (key === 'lastWeek') {
    const day = now.getDay() || 7
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - day + 1)
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7)
    const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6)
    return { start: iso(lastMonday), end: iso(lastSunday) }
  }
  return { start: '', end: '' }
}

function RankingCard({ title, subtitle, rows, valueLabel, onOpen, empty }) {
  return <section className="mi-card">
    <header><div><h2>{title}</h2><p>{subtitle}</p></div></header>
    <div className="mi-ranking-list">
      {rows.length ? rows.map((row, index) => <button type="button" key={row.id || `${row.name}-${index}`} onClick={() => onOpen(row)}>
        <span className="mi-rank">{index + 1}</span>
        <span className="mi-rank-copy"><b>{row.name}</b><small>{row.qtySold.toLocaleString()} sold · {money(row.avgPrice)} price</small></span>
        <strong>{valueLabel(row)}</strong>
        <span className="mi-chevron">›</span>
      </button>) : <div className="mi-empty">{empty}</div>}
    </div>
  </section>
}

function DetailModal({ item, onClose }) {
  if (!item) return null
  const ingredients = item.recipe?.lines || []
  const ingredientTotal = ingredients.reduce((sum, line) => sum + number(line.totalCost ?? number(line.qty) * number(line.unitCost)), 0)
  return <div className="mi-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="mi-modal" role="dialog" aria-modal="true" aria-label={`${item.name} menu intelligence details`}>
      <header>
        <div><span className="eyebrow">Menu Intelligence Detail</span><h2>{item.name}</h2><p>{item.category || item.department || 'Menu item'} · {item.matrix.label}</p></div>
        <button className="btn primary" type="button" onClick={onClose}>Close</button>
      </header>
      <div className="mi-modal-metrics">
        <div><small>Quantity Sold</small><strong>{item.qtySold.toLocaleString()}</strong></div>
        <div><small>Selling Price</small><strong>{money(item.avgPrice)}</strong></div>
        <div><small>Recipe Cost</small><strong>{money(item.dishCost)}</strong></div>
        <div><small>Profit / Plate</small><strong>{money(item.profitEach)}</strong></div>
        <div><small>Total Revenue</small><strong>{money(item.revenue)}</strong></div>
        <div><small>Total Gross Profit</small><strong>{money(item.totalProfit)}</strong></div>
        <div><small>Cost %</small><strong>{percent(item.costPercent)}</strong></div>
        <div><small>Gross Margin</small><strong>{percent(item.marginPercent)}</strong></div>
      </div>
      <div className="mi-recommendation"><b>{item.matrix.label}:</b> {item.matrix.guidance}</div>
      <div className="table-wrap mi-ingredient-table">
        <table>
          <thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Vendor</th><th>Unit Cost</th><th>Plate Cost</th></tr></thead>
          <tbody>
            {ingredients.map((line, index) => <tr key={line.id || index}>
              <td>{line.ingredient || line.name || 'Ingredient'}</td>
              <td>{number(line.qty)}</td>
              <td>{line.unit || '-'}</td>
              <td>{line.vendor || '-'}</td>
              <td>{money(line.unitCost)}</td>
              <td>{money(line.totalCost ?? number(line.qty) * number(line.unitCost))}</td>
            </tr>)}
            {!ingredients.length && <tr><td colSpan="6">No approved recipe lines are available for this item.</td></tr>}
          </tbody>
          <tfoot><tr><th colSpan="5">Recipe Cost Subtotal</th><th>{money(ingredientTotal)}</th></tr></tfoot>
        </table>
      </div>
      <footer>
        <span>Source: {item.sourceFile || 'Toast Product Mix'}</span>
        <span>{item.dateStart || 'All dates'}{item.dateEnd && item.dateEnd !== item.dateStart ? ` – ${item.dateEnd}` : ''}</span>
      </footer>
    </section>
  </div>
}

export default function MenuIntelligence({ data }) {
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)
  const [bottomLimit, setBottomLimit] = useState(10)

  const recipesByItem = useMemo(() => Object.fromEntries((data.menuRecipes || []).map(recipe => [recipe.menuItemId, recipe])), [data.menuRecipes])
  const items = useMemo(() => {
    const base = (data.menuItems || []).filter(item => inRange(item, dateStart, dateEnd)).map(item => {
      const recipe = recipesByItem[item.id]
      const qtySold = number(item.qtySold ?? item.qty_sold ?? item.quantity)
      const avgPrice = number(item.avgPrice ?? item.avg_price ?? item.price)
      const revenue = number(item.netSales ?? item.net_sales ?? item.grossSales ?? item.gross_sales) || qtySold * avgPrice
      const dishCost = recipeCost(recipe)
      const profitEach = avgPrice - dishCost
      const totalProfit = profitEach * qtySold
      const costPercent = avgPrice > 0 ? dishCost / avgPrice * 100 : 0
      const marginPercent = avgPrice > 0 ? profitEach / avgPrice * 100 : 0
      return { ...item, recipe, qtySold, avgPrice, revenue, dishCost, profitEach, totalProfit, costPercent, marginPercent }
    })
    const avgQty = base.reduce((sum, item) => sum + item.qtySold, 0) / Math.max(base.length, 1)
    const avgProfit = base.reduce((sum, item) => sum + item.profitEach, 0) / Math.max(base.length, 1)
    return base.map(item => ({ ...item, matrix: classifyMatrix(item.qtySold, item.profitEach, avgQty, avgProfit) }))
  }, [data.menuItems, recipesByItem, dateStart, dateEnd])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(item => {
      if (category !== 'all' && String(item.category || item.department || '').toLowerCase() !== category.toLowerCase()) return false
      if (q && !String(item.name || '').toLowerCase().includes(q) && !String(item.category || item.department || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, category])

  const sortedMost = [...filtered].sort((a, b) => b.qtySold - a.qtySold).slice(0, 10)
  const sortedLeast = [...filtered].filter(item => item.qtySold > 0).sort((a, b) => a.qtySold - b.qtySold).slice(0, bottomLimit)
  const highestCost = [...filtered].sort((a, b) => b.dishCost - a.dishCost).slice(0, 10)
  const highestProfit = [...filtered].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 10)
  const lowestProfit = [...filtered].sort((a, b) => a.totalProfit - b.totalProfit).slice(0, 10)

  const ingredientRows = useMemo(() => {
    const map = new Map()
    filtered.forEach(item => {
      ;(item.recipe?.lines || []).forEach(line => {
        const name = line.ingredient || line.name || 'Unnamed ingredient'
        const key = name.toLowerCase()
        const perPlate = number(line.totalCost ?? number(line.qty) * number(line.unitCost))
        const current = map.get(key) || { id: key, name, plateCost: 0, totalUsageCost: 0, usedIn: new Set(), qtySold: 0, avgPrice: 0 }
        current.plateCost = Math.max(current.plateCost, perPlate)
        current.totalUsageCost += perPlate * item.qtySold
        current.usedIn.add(item.name)
        current.qtySold += item.qtySold
        map.set(key, current)
      })
    })
    return [...map.values()].map(row => ({ ...row, usedInCount: row.usedIn.size })).sort((a, b) => b.totalUsageCost - a.totalUsageCost).slice(0, 10)
  }, [filtered])

  const totals = filtered.reduce((acc, item) => {
    acc.revenue += item.revenue
    acc.cost += item.dishCost * item.qtySold
    acc.profit += item.totalProfit
    acc.qty += item.qtySold
    return acc
  }, { revenue: 0, cost: 0, profit: 0, qty: 0 })
  const avgCost = totals.revenue > 0 ? totals.cost / totals.revenue * 100 : 0
  const categories = [...new Set(items.map(item => item.category || item.department).filter(Boolean))].sort()
  const bestSeller = sortedMost[0]
  const leastSeller = sortedLeast[0]
  const mostExpensive = highestCost[0]
  const topProfit = highestProfit[0]

  function applyPreset(key) {
    const range = presetRange(key)
    setDateStart(range.start)
    setDateEnd(range.end)
  }

  return <div className="menu-intelligence-page">
    <section className="mi-hero">
      <div><span className="eyebrow">Restaurant Menu Engineering</span><h2>Menu Intelligence</h2><p>See the most sold, least sold, highest-cost, and highest-profit dishes using Toast Product Mix, recipes, and vendor ingredient costs.</p></div>
      <div className="mi-hero-badge"><Icon name="trending" size={20} /><span>{filtered.length} analyzed items</span></div>
    </section>

    <section className="filter-card mi-filters">
      <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={() => {}} onPreset={applyPreset} applyLabel="Apply" />
      <label><span>Search Item</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search dish or drink..." /></label>
      <label><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All Categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </section>

    <div className="mi-summary-grid">
      <button type="button" onClick={() => bestSeller && setSelectedItem(bestSeller)}><span>Best Selling Item</span><strong>{bestSeller?.name || 'No data'}</strong><small>{bestSeller ? `${bestSeller.qtySold.toLocaleString()} sold` : 'Import Product Mix'}</small></button>
      <button type="button" onClick={() => leastSeller && setSelectedItem(leastSeller)}><span>Least Sold Item</span><strong>{leastSeller?.name || 'No data'}</strong><small>{leastSeller ? `${leastSeller.qtySold.toLocaleString()} sold · ${money(leastSeller.dishCost)} cost` : 'Import Product Mix'}</small></button>
      <button type="button" onClick={() => mostExpensive && setSelectedItem(mostExpensive)}><span>Highest-Cost Plate</span><strong>{mostExpensive?.name || 'No data'}</strong><small>{mostExpensive ? `${money(mostExpensive.dishCost)} recipe cost` : 'Build recipes'}</small></button>
      <button type="button" onClick={() => topProfit && setSelectedItem(topProfit)}><span>Highest Total Profit</span><strong>{topProfit?.name || 'No data'}</strong><small>{topProfit ? `${money(topProfit.totalProfit)} gross profit` : 'Build recipes'}</small></button>
      <div><span>Menu Revenue</span><strong>{money(totals.revenue)}</strong><small>{totals.qty.toLocaleString()} items sold</small></div>
      <div><span>Estimated Recipe Cost</span><strong>{money(totals.cost)}</strong><small>{percent(avgCost)} of menu revenue</small></div>
      <div><span>Estimated Gross Profit</span><strong>{money(totals.profit)}</strong><small>{percent(totals.revenue ? totals.profit / totals.revenue * 100 : 0)} margin</small></div>
    </div>

    <div className="mi-grid">
      <RankingCard title="Most Sold Items" subtitle="Highest quantity sold in the selected period" rows={sortedMost} valueLabel={row => `${row.qtySold.toLocaleString()} sold`} onOpen={setSelectedItem} empty="No Product Mix sales are available." />
      <RankingCard title="Least Sold Items" subtitle="Lowest non-zero quantity sold, including cost and profit" rows={sortedLeast} valueLabel={row => money(row.totalProfit)} onOpen={setSelectedItem} empty="No sold items are available." />
      <RankingCard title="Highest-Cost Plates" subtitle="Largest recipe cost per plate" rows={highestCost} valueLabel={row => money(row.dishCost)} onOpen={setSelectedItem} empty="Build recipes to calculate plate cost." />
      <RankingCard title="Highest Total Profit" subtitle="Largest gross profit contribution" rows={highestProfit} valueLabel={row => money(row.totalProfit)} onOpen={setSelectedItem} empty="Build recipes to calculate profit." />
      <RankingCard title="Lowest Total Profit" subtitle="Items that may need repricing, promotion, or removal" rows={lowestProfit} valueLabel={row => money(row.totalProfit)} onOpen={setSelectedItem} empty="Build recipes to calculate profit." />
      <section className="mi-card">
        <header><div><h2>Most Expensive Ingredients</h2><p>Ingredient cost impact across sold plates</p></div></header>
        <div className="mi-ranking-list">
          {ingredientRows.length ? ingredientRows.map((row, index) => <div className="mi-ingredient-row" key={row.id}>
            <span className="mi-rank">{index + 1}</span>
            <span className="mi-rank-copy"><b>{row.name}</b><small>Used in {row.usedInCount} menu item{row.usedInCount === 1 ? '' : 's'}</small></span>
            <strong>{money(row.totalUsageCost)}</strong>
          </div>) : <div className="mi-empty">Add recipe ingredients to see ingredient cost impact.</div>}
        </div>
      </section>
    </div>

    <section className="mi-matrix-card">
      <header><div><h2>Menu Engineering Matrix</h2><p>Popularity compared with profit per plate</p></div></header>
      <div className="mi-matrix-grid">
        {['Star', 'Plowhorse', 'Puzzle', 'Dog'].map(label => {
          const rows = filtered.filter(item => item.matrix.label === label).sort((a, b) => b.totalProfit - a.totalProfit)
          return <div key={label} className={`mi-matrix-column ${label.toLowerCase()}`}><h3>{label}</h3><small>{rows.length} item{rows.length === 1 ? '' : 's'}</small>{rows.slice(0, 8).map(row => <button key={row.id} type="button" onClick={() => setSelectedItem(row)}><span>{row.name}</span><b>{money(row.profitEach)}/plate</b></button>)}</div>
        })}
      </div>
    </section>

    <div className="mi-bottom-control"><label>Least-sold list size <select value={bottomLimit} onChange={event => setBottomLimit(Number(event.target.value))}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label></div>
    <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
  </div>
}
