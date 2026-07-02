import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import OpenAI from 'openai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 18 * 1024 * 1024 } })

app.use(cors())
app.use(express.json({ limit: '2mb' }))

const SENSITIVE_PATTERNS = [
  /\b(?:account|acct|routing|aba|micr|trace|customer service|telephone banking|internet address)\b[^\n]*/gi,
  /\b\*{2,}\d{2,}\b/g,
  /\b\d{9,17}\b/g,
  /#-?[A-Z0-9-]{6,}/gi,
  /\b(?:balance|ending balance|current balance|average ledger balance|average collected balance)\b[^\n]*/gi,
]

function scrubSensitiveText(value = '') {
  let text = String(value || '')
  for (const pattern of SENSITIVE_PATTERNS) text = text.replace(pattern, '')
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function moneyNumber(value) {
  return Math.abs(Number(String(value ?? '').replace(/[$,()]/g, '')) || 0)
}

function toISODate(value, fallbackYear = new Date().getFullYear()) {
  const raw = String(value || '').trim()
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/)
  if (m) {
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : fallbackYear
    return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10)
}

function statementYearFromText(text = '') {
  const m = String(text).match(/(?:Statement Dates|Date:)\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-])?(\d{2,4})/i)
  if (m) return Number(String(m[1]).length === 2 ? `20${m[1]}` : m[1])
  const any = String(text).match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-](\d{2,4})\b/)
  return any ? Number(String(any[1]).length === 2 ? `20${any[1]}` : any[1]) : new Date().getFullYear()
}

function detectBank(text = '') {
  const t = text.toLowerCase()
  if (t.includes('unionstatebank') || t.includes('union state bank')) return 'Union State Bank'
  if (t.includes('valley bank') || t.includes('valley national bank')) return 'Valley Bank'
  if (t.includes('regions bank')) return 'Regions Bank'
  if (t.includes('bank of america')) return 'Bank of America'
  if (t.includes('wells fargo')) return 'Wells Fargo'
  if (t.includes('chase') || t.includes('jpmorgan')) return 'Chase'
  if (t.includes('truist')) return 'Truist'
  return 'Unknown Bank'
}

function makeRow(row, source = 'backend_local') {
  return {
    id: `bankrow_${Math.random().toString(36).slice(2, 10)}`,
    selected: true,
    date: row.date || new Date().toISOString().slice(0, 10),
    checkNumber: (() => {
      let n = String(row.checkNumber || row.check_number || '').trim()
      if (/^2\d{4}$/.test(n)) n = n.slice(0, 4)
      return n
    })(),
    payee: normalizeText(row.payee || row.memo || row.description || 'Check Payment'),
    amount: moneyNumber(row.amount),
    memo: normalizeText(row.memo || ''),
    category: row.category || 'Needs Review',
    vendor: row.vendor || '',
    employee: row.employee || '',
    sourceType: row.sourceType || 'paper_check',
    source,
    confidence: Number(row.confidence || 75),
    status: row.category && row.category !== 'Needs Review' ? 'Ready' : 'Needs Review',
    duplicate: false,
  }
}

function parseLocalStatement(text = '') {
  const year = statementYearFromText(text)
  const rows = []
  const seen = new Set()
  const full = String(text || '')

  // Bank PDFs often scramble table columns. Instead of relying on one line,
  // locate every CHECK token, then look nearby for the nearest date and debit amount.
  const checkRegex = /CHECK\s*(?:Number)?\s*(?:(\d{4})(?=\d{1,2}\/\d{1,2})|(\d{3,8}))/gi
  let match
  while ((match = checkRegex.exec(full)) !== null) {
    const checkNumber = match[1] || match[2]
    const start = Math.max(0, match.index - 70)
    const stop = Math.min(full.length, match.index + 95)
    const window = full.slice(start, stop).replace(/\n+/g, ' ')

    const dates = [...window.matchAll(/\b(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\b/g)]
    let bestDate = ''
    let bestDateDistance = Infinity
    for (const d of dates) {
      const absolute = start + d.index
      const distance = Math.abs(absolute - match.index)
      if (distance < bestDateDistance) {
        bestDateDistance = distance
        bestDate = d[1]
      }
    }

    const amounts = [...window.matchAll(/-\$?([\d,]+\.\d{2})/g)]
    let bestAmount = 0
    let bestAmountDistance = Infinity
    for (const a of amounts) {
      const absolute = start + a.index
      const distance = Math.abs(absolute - match.index)
      const amount = moneyNumber(a[1])
      // Ignore likely running balances by preferring nearby debit values under $25k.
      if (amount > 0 && amount < 25000 && distance <= 80 && distance < bestAmountDistance) {
        bestAmountDistance = distance
        bestAmount = amount
      }
    }

    if (!bestDate || !bestAmount) continue
    const date = toISODate(bestDate, year)
    const key = `${date}-${checkNumber}-${bestAmount}`
    if (!seen.has(key)) {
      seen.add(key)
      rows.push(makeRow({ date, checkNumber, payee: `Check ${checkNumber}`, amount: bestAmount, confidence: 72 }, 'backend_statement_text'))
    }
  }

  // Also capture electronic debit rows that are useful bookkeeping transactions.
  const debitRegex = /(\d{1,2}\/\d{1,2}).{0,80}?\b(VENDOR PAY\s+US FOODSERVICE|PAYMENT\s+BANK OF AMERICA|PAYMENT\s+SBA EIDL LOAN|ACH Debit\s+HORIZON ACCOUNTI|DIRECT DBT\s+AL-DEPT OF REV|Alabama\.go\s+AL ONESPOT TAX|PURCHASE\s+T\s+Toast, Inc|PYMT PROC\s+SHIFT4|CINTASCORPORATIO|SERVICE CHARGE).{0,180}?-\$?([\d,]+\.\d{2})/gi
  let dm
  while ((dm = debitRegex.exec(full.replace(/\n+/g, ' '))) !== null) {
    const date = toISODate(dm[1], year)
    const description = normalizeText(dm[2])
    const amount = moneyNumber(dm[3])
    let payee = scrubSensitiveText(description)
    if (/US FOODSERVICE/i.test(description)) payee = 'US Foodservice'
    else if (/BANK OF AMERICA/i.test(description)) payee = 'Bank of America'
    else if (/SBA EIDL/i.test(description)) payee = 'SBA EIDL Loan'
    else if (/HORIZON ACCOUNT/i.test(description)) payee = 'Horizon Accounting'
    else if (/AL-DEPT OF REV|ONESPOT TAX/i.test(description)) payee = 'Alabama Dept of Revenue'
    else if (/Toast, Inc/i.test(description)) payee = 'Toast Inc'
    else if (/SHIFT4/i.test(description)) payee = 'Shift4'
    else if (/CINTAS/i.test(description)) payee = 'Cintas Corporation'
    const key = `${date}-${payee}-${amount}`
    if (!seen.has(key) && amount > 0) {
      seen.add(key)
      rows.push(makeRow({ date, checkNumber: '', payee, amount, memo: description, sourceType: 'electronic_debit', confidence: 92 }, 'backend_statement_text'))
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || String(a.checkNumber).localeCompare(String(b.checkNumber)))
}

function sanitizeAiRows(rows = []) {
  return rows.map(row => makeRow({
    date: toISODate(row.date),
    checkNumber: String(row.checkNumber || row.check_number || '').replace(/[^0-9A-Za-z-]/g, '').slice(0, 16),
    payee: scrubSensitiveText(row.payee || '').slice(0, 120),
    amount: row.amount,
    memo: scrubSensitiveText(row.memo || '').slice(0, 160),
    category: row.suggestedCategory || row.category || 'Needs Review',
    vendor: scrubSensitiveText(row.vendor || '').slice(0, 80),
    employee: scrubSensitiveText(row.employee || '').slice(0, 80),
    confidence: row.confidence || 90,
  }, 'ai_provider')).filter(row => row.amount > 0 && row.payee && !/(routing|account|micr|balance)/i.test(`${row.payee} ${row.memo}`))
}

async function analyzeWithOpenAI(safeText, bank, pages) {
  if (!process.env.OPENAI_API_KEY) return null
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = process.env.OPENAI_CHECK_MODEL || 'gpt-4o-mini'
  const prompt = `You are extracting bookkeeping check payment data for a restaurant back-office app.\n\nPrivacy rules: Do NOT return account numbers, routing numbers, MICR data, balances, trace IDs, ACH IDs, signatures, or bank login/contact data. Return only check/payment bookkeeping rows.\n\nFor every paper check you can identify, return: date, checkNumber, payee, amount, memo if useful, suggestedCategory, vendor or employee if obvious, confidence 0-100.\n\nIf payee is unknown from statement text, return payee as "Check <number>" and confidence below 75.\n\nBank detected: ${bank}. Pages read: ${pages}.\n\nReturn only valid JSON with shape: {"checks":[...]}. No markdown.`

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: safeText.slice(0, 90000) }
    ]
  })
  const content = response.choices?.[0]?.message?.content || '{}'
  const parsed = JSON.parse(content)
  return sanitizeAiRows(parsed.checks || parsed.rows || [])
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConnected: Boolean(process.env.OPENAI_API_KEY), provider: process.env.OPENAI_API_KEY ? 'OpenAI' : 'Local extraction only' })
})

app.post('/api/ai/check-processing/analyze', upload.single('statement'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No statement file uploaded.' })
    const filename = req.file.originalname || 'statement'
    const isPdf = /\.pdf$/i.test(filename) || req.file.mimetype === 'application/pdf'
    let rawText = ''
    let pages = 0

    if (isPdf) {
      const parsed = await pdfParse(req.file.buffer)
      rawText = parsed.text || ''
      pages = parsed.numpages || 0
    } else {
      rawText = req.file.buffer.toString('utf8')
      pages = 1
    }

    const safeText = scrubSensitiveText(rawText)
    const bank = detectBank(rawText)
    const localRows = parseLocalStatement(safeText)
    let aiRows = null
    let engine = 'Backend Local Text Extraction'
    let aiMessage = 'OPENAI_API_KEY not configured. Used privacy-safe backend local extraction.'

    if (process.env.OPENAI_API_KEY) {
      try {
        aiRows = await analyzeWithOpenAI(safeText, bank, pages)
        engine = 'AI Document Extraction'
        aiMessage = 'AI provider connected. Sensitive statement data scrubbed before response and not stored.'
      } catch (error) {
        console.error('AI extraction failed:', error)
        aiMessage = 'AI provider failed; used privacy-safe backend local extraction fallback.'
      }
    }

    const rows = (aiRows && aiRows.length ? aiRows : localRows).map(row => ({ ...row, bank }))

    res.json({
      ok: true,
      bank,
      engine,
      aiConnected: Boolean(process.env.OPENAI_API_KEY),
      message: aiMessage,
      privacy: {
        storedSensitiveFields: false,
        discarded: ['account number', 'routing number', 'MICR line', 'balances', 'trace IDs', 'signature images', 'original statement file'],
        retainedAfterApprovalOnly: ['date', 'checkNumber', 'payee', 'amount', 'memo', 'category', 'vendor', 'employee']
      },
      stats: {
        pages,
        rowsFound: rows.length,
        localRowsFound: localRows.length,
        needsReview: rows.filter(r => r.category === 'Needs Review').length,
        matched: rows.filter(r => r.vendor || r.employee).length,
      },
      rows,
      safePreview: process.env.RESTAPAY_DEBUG_SAFE_TEXT === 'true' ? safeText.slice(0, 3000) : undefined,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Statement analysis failed.', detail: error.message })
  }
})

const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))

const port = Number(process.env.PORT || 4173)
app.listen(port, () => console.log(`RestaPay server running on port ${port}`))
