import React, { useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import { defaultData, RESTAPAY_KEY } from '../lib/localStore'

export default function Settings({ data, setData }) {
  const [status, setStatus] = useState('Backup and local settings are ready.')
  const fileRef = useRef(null)
  const rate = data.settings?.tipWithholdingRate ?? 3.5
  const geminiKey = import.meta?.env?.VITE_GEMINI_API_KEY || data.settings?.geminiApiKey || ''
  const geminiModel = import.meta?.env?.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

  const allocationRules = data.settings?.financialAllocationRules || {}
  function updateAllocation(key, value) {
    const foodPercent = Math.min(100, Math.max(0, Number(value || 0)))
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        excludeCustomerTipsFromOperatingProfit: true,
        financialAllocationRules: {
          ...(prev.settings?.financialAllocationRules || {}),
          [key]: foodPercent
        }
      }
    }))
    setStatus('Financial allocation rule saved directly to the app data.')
  }

  function updateRate(value) {
    setData(prev => ({ ...prev, settings: { ...prev.settings, tipWithholdingRate: Number(value || 0) } }))
    setStatus('Tip withholding rate saved locally')
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `restapay-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus('Backup exported')
  }

  async function importBackup(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setData({ ...defaultData, ...parsed, settings: { ...defaultData.settings, ...(parsed.settings || {}) } })
      setStatus('Backup imported and saved locally')
    } catch (error) {
      setStatus(`Backup import failed: ${error.message}`)
    }
    event.target.value = ''
  }

  function clearLocalData() {
    localStorage.removeItem(RESTAPAY_KEY)
    setData(defaultData)
    setStatus('Local data reset to starter data')
  }

  return <>
    <div className="page-head"><div><h1>Settings</h1><p>Local-first storage, backup, restore, AI OCR, and payroll import settings.</p></div></div>
    <div className="status-pill">{status}</div>

    <section className="settings-grid">
      <div className="form-card tight-card">
        <h2>Payroll Settings</h2>
        <div className="settings-row"><label>Tip withholding %<input type="number" min="0" step="0.01" value={rate} onChange={e => updateRate(e.target.value)} /></label></div>
        <p className="helper-text">Toast labor import uses this rate to calculate tip withholding before saving payroll.</p>
      </div>

      <div className="form-card tight-card">
        <h2>AI / OCR Settings</h2>
        <div className="settings-status-grid">
          <div><span>Status</span><b className={geminiKey ? 'status-ok' : 'status-warn'}>{geminiKey ? 'Connected' : 'Missing API Key'}</b></div>
          <div><span>Model</span><b>{geminiModel}</b></div>
        </div>
        <p className="helper-text">Gemini key is hidden from the app UI. Add it in your project <b>.env</b> file as <b>VITE_GEMINI_API_KEY</b>, then restart npm run dev.</p>
      </div>


      <div className="form-card tight-card financial-rules-card">
        <h2>Financial Allocation Rules</h2>
        <p className="helper-text">Server tips are always excluded from operating profit. Enter the Food percentage; Alcohol automatically receives the balance.</p>
        <div className="allocation-rule-grid">
          {[
            ['managerFoodPercent', 'Manager salary'],
            ['cleaningFoodPercent', 'Cleaning supplies'],
            ['utilitiesFoodPercent', 'Utilities'],
            ['rentFoodPercent', 'Rent'],
            ['insuranceFoodPercent', 'Insurance'],
            ['accountingFoodPercent', 'Accounting'],
            ['maintenanceFoodPercent', 'Repairs & maintenance'],
            ['sharedFoodPercent', 'Other shared costs']
          ].map(([key, label]) => {
            const food = Number(allocationRules[key] ?? 50)
            return <div className="allocation-rule-row" key={key}>
              <div><b>{label}</b><small>Food {food}% · Alcohol {100 - food}%</small></div>
              <input aria-label={`${label} food allocation percentage`} type="number" min="0" max="100" step="1" value={food} onChange={event => updateAllocation(key, event.target.value)} />
            </div>
          })}
        </div>
        <div className="settings-status-grid allocation-fixed-rules">
          <div><span>Kitchen payroll</span><b>100% Food</b></div>
          <div><span>Manager salary</span><b>{Number(allocationRules.managerFoodPercent ?? 50)}% Food / {100 - Number(allocationRules.managerFoodPercent ?? 50)}% Alcohol</b></div>
          <div><span>Margarita mix / bar mixes</span><b>100% Alcohol</b></div>
          <div><span>Server tips</span><b className="status-ok">Excluded from profit</b></div>
        </div>
      </div>

      <div className="form-card tight-card">
        <h2>Backup / Restore</h2>
        <div className="settings-actions"><button className="btn primary" onClick={exportBackup} type="button"><Icon name="download" /> Export Backup</button><button className="btn secondary" type="button" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Import Backup</button><button className="btn danger" onClick={clearLocalData} type="button">Reset Local</button></div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        <p className="helper-text">Backup includes employees, employee/job types, payroll groups, payroll entries, imports, and settings.</p>
      </div>
    </section>
  </>
}
