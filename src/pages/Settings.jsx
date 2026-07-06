import React, { useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import { defaultData, RESTAPAY_KEY } from '../lib/localStore'

export default function Settings({ data, setData }) {
  const [status, setStatus] = useState('Backup and local settings are ready.')
  const fileRef = useRef(null)
  const rate = data.settings?.tipWithholdingRate ?? 3.5
  const geminiKey = import.meta?.env?.VITE_GEMINI_API_KEY || data.settings?.geminiApiKey || ''
  const geminiModel = import.meta?.env?.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

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

      <div className="form-card tight-card">
        <h2>Backup / Restore</h2>
        <div className="settings-actions"><button className="btn primary" onClick={exportBackup} type="button"><Icon name="download" /> Export Backup</button><button className="btn secondary" type="button" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Import Backup</button><button className="btn danger" onClick={clearLocalData} type="button">Reset Local</button></div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        <p className="helper-text">Backup includes employees, employee/job types, payroll groups, payroll entries, imports, and settings.</p>
      </div>
    </section>
  </>
}
