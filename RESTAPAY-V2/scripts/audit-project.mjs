import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const ignored = new Set(['node_modules', 'dist', '.git'])
const textExtensions = new Set(['.js', '.jsx', '.mjs', '.css', '.json', '.sql', '.html', '.md', '.yaml', '.yml'])
const findings = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (textExtensions.has(path.extname(entry.name))) inspect(full)
  }
}

function inspect(file) {
  const content = fs.readFileSync(file, 'utf8')
  const relative = path.relative(root, file)
  if (relative !== 'scripts/audit-project.mjs' && /^(<<<<<<<|=======|>>>>>>>)/m.test(content)) findings.push(`${relative}: unresolved Git conflict marker`)
  if (/packages\.applied-caas-gateway|internal\.api\.openai\.org/.test(content)) findings.push(`${relative}: internal package registry URL`)
  if (/VITE_GEMINI_API_KEY\s*=/.test(content)) findings.push(`${relative}: client-side Gemini secret reference`)
}

walk(root)

const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8')
const mock = fs.readFileSync(path.join(root, 'src/data/mockData.js'), 'utf8')
const navKeys = [...mock.matchAll(/\['([^']+)',\s*'[^']+'\]/g)].map(match => match[1])
for (const key of navKeys) {
  if (!main.includes(`active === '${key}'`) && !['price-increase'].includes(key)) {
    findings.push(`Navigation key "${key}" has no explicit page route in src/main.jsx`)
  }
}

const required = [
  'src/main.jsx', 'src/styles.css', 'src/lib/supabase.js', 'src/lib/localStore.js',
  'src/pages/Dashboard.jsx', 'src/pages/Sales.jsx', 'src/pages/Payroll.jsx',
  'src/pages/Invoices.jsx', 'src/pages/Vendors.jsx', 'src/pages/VendorComparison.jsx',
  'src/pages/MenuCosting.jsx', 'src/pages/MenuIntelligence.jsx', 'src/pages/Diagnostics.jsx'
]
for (const item of required) {
  if (!fs.existsSync(path.join(root, item))) findings.push(`Missing required file: ${item}`)
}

if (findings.length) {
  console.error('PROJECT AUDIT FAILED')
  findings.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log(`PROJECT AUDIT PASSED: ${navKeys.length} navigation entries checked; no conflict markers or internal registry URLs found.`)
