import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const clean=(v:unknown)=>String(v??'').trim()
const domainMap:Record<string,string>={
  'us foods':'usfoods.com','sysco':'sysco.com','pfg':'pfgc.com','performance foodservice':'performancefoodservice.com',
  'cintas':'cintas.com','coca cola':'coca-cola.com','coca-cola':'coca-cola.com','pepsi':'pepsi.com','walmart':'walmart.com',
  'sams club':'samsclub.com',"sam's club":'samsclub.com','publix':'publix.com','toast':'toasttab.com','spire':'spireenergy.com',
  'sparklight':'sparklight.com','alabama abc board':'alabcboard.gov','abc board':'alabcboard.gov'
}
function domainFrom(input:any){
  const explicit=clean(input.websiteDomain||input.website).replace(/^https?:\/\//i,'').split('/')[0].replace(/^www\./i,'')
  if(explicit.includes('.'))return explicit
  const name=clean(input.vendorName).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()
  return domainMap[name]||Object.entries(domainMap).find(([k])=>name.includes(k)||k.includes(name))?.[1]||''
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return reply({ok:false,message:'Method not allowed.'},405)
  try{
    const body=await req.json();const domain=domainFrom(body)
    if(!domain)return reply({ok:false,message:'No trusted company domain was found.'},404)
    const source=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`
    const fetched=await fetch(source,{headers:{'User-Agent':'RestaPayVendorLogo/1.0'}})
    if(!fetched.ok)return reply({ok:false,message:`Logo provider returned ${fetched.status}.`},502)
    const bytes=new Uint8Array(await fetched.arrayBuffer())
    if(!bytes.length)return reply({ok:false,message:'Logo provider returned an empty image.'},502)
    const supabaseUrl=clean(Deno.env.get('SUPABASE_URL'));const serviceKey=clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if(!supabaseUrl||!serviceKey)return reply({ok:false,message:'Supabase service credentials are unavailable.'},500)
    const supabase=createClient(supabaseUrl,serviceKey)
    const slug=clean(body.vendorId||body.vendorName||domain).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)||'vendor'
    const path=`${slug}/domain-logo.png`
    const {error}=await supabase.storage.from('vendor-logos').upload(path,bytes,{contentType:fetched.headers.get('content-type')||'image/png',cacheControl:'86400',upsert:true})
    if(error)throw error
    const {data}=supabase.storage.from('vendor-logos').getPublicUrl(path)
    return reply({ok:true,logo_url:data.publicUrl,logo_source:'supabase-storage-domain',logo_verified:true,website_domain:domain,website:`https://${domain}`})
  }catch(error){console.error(error);return reply({ok:false,message:error instanceof Error?error.message:'Vendor logo persistence failed.'},500)}
})
