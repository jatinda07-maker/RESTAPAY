import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const money = (value: string | number | undefined) => {
  const parsed = Number(String(value ?? '').replace(/[$,]/g,''))
  return Number.isFinite(parsed) ? parsed : 0
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders})
  try {
    const body = await req.json().catch(()=>({}))
    const query = String(body?.query || '').trim()
    if (!query) return new Response(JSON.stringify({error:'query is required'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}})
    const url = `https://www.samsclub.com/s/${encodeURIComponent(query)}`
    const response = await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; RestaPayPriceBenchmark/1.0)','accept':'text/html,application/xhtml+xml'}})
    const html = await response.text()
    if (!response.ok) throw new Error(`Sam's Club returned ${response.status}`)

    const candidates: Array<{name:string,price:number,url?:string}> = []
    const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    for (const match of jsonLd) {
      try {
        const parsed = JSON.parse(match[1])
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          const list = item?.itemListElement || item?.mainEntity?.itemListElement || []
          for (const entry of Array.isArray(list)?list:[]) {
            const product = entry?.item || entry
            const price = money(product?.offers?.price || product?.offers?.lowPrice || product?.price)
            if (price) candidates.push({name:String(product?.name||query),price,url:product?.url})
          }
          const price = money(item?.offers?.price || item?.offers?.lowPrice)
          if (price) candidates.push({name:String(item?.name||query),price,url:item?.url})
        }
      } catch { /* ignore malformed embedded json */ }
    }
    if (!candidates.length) {
      const priceMatch = html.match(/\$([0-9]{1,5}(?:\.[0-9]{2})?)/)
      if (priceMatch) candidates.push({name:query,price:money(priceMatch[1]),url})
    }
    const best = candidates.filter(x=>x.price>0).sort((a,b)=>a.price-b.price)[0]
    if (!best) return new Response(JSON.stringify({available:false,url,note:"No public price could be parsed automatically. Open the Sam's Club search to verify local/member pricing."}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
    return new Response(JSON.stringify({available:true,item:best.name,price:best.price,unit_price:best.price,url:best.url||url,note:"Public online benchmark only. Club, membership, pickup and delivery pricing may differ."}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
  } catch (error) {
    return new Response(JSON.stringify({available:false,error:error?.message||'Lookup failed'}),{status:200,headers:{...corsHeaders,'Content-Type':'application/json'}})
  }
})
