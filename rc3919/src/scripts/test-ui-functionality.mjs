import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('src')
const files=[]
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.jsx$/.test(ent.name))files.push(p)}}
walk(root)
const problems=[]
for(const file of files){
  const text=fs.readFileSync(file,'utf8')
  const re=/<button\b([^>]*)>/gs
  for(const match of text.matchAll(re)){
    const attrs=match[1]
    if(!/onClick\s*=/.test(attrs)&&!/\bdisabled\b/.test(attrs)&&!/type\s*=\s*["']submit["']/.test(attrs)){
      problems.push(`${path.relative('.',file)} has an inert button: ${match[0].replace(/\s+/g,' ').slice(0,140)}`)
    }
  }
  if(/selectedIds/.test(text)&&!/selectedIds\s*,\s*setSelectedIds|\[selectedIds\s*,\s*setSelectedIds\]/.test(text)){
    problems.push(`${path.relative('.',file)} references selectedIds without a matching state declaration`)
  }
}
const all=files.map(f=>fs.readFileSync(f,'utf8')).join('\n')
for(const phrase of ['Data connection will be enabled during the engine phase','action is available. Data connection will be enabled']){
  if(all.includes(phrase))problems.push(`Obsolete placeholder message remains: ${phrase}`)
}
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`UI functionality audit passed across ${files.length} JSX files.`)
