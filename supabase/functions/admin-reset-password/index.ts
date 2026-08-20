import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
Deno.serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization') || ''
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(url, anon, { global:{headers:{Authorization:auth}} })
    const { data:{user} } = await caller.auth.getUser()
    if (!user) return new Response(JSON.stringify({ok:false,message:'Unauthorized'}),{status:401,headers:{'content-type':'application/json'}})
    const adminEmails=(Deno.env.get('RESTAPAY_ADMIN_EMAILS')||user.email||'').toLowerCase().split(',').map(v=>v.trim())
    if (!adminEmails.includes(String(user.email||'').toLowerCase())) return new Response(JSON.stringify({ok:false,message:'Administrator access required'}),{status:403,headers:{'content-type':'application/json'}})
    const {email,password}=await req.json(); if(!email||!password||password.length<8) throw new Error('Manager email and password (8+ characters) are required.')
    const admin=createClient(url,service); const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000}); if(error)throw error
    const target=data.users.find(u=>String(u.email||'').toLowerCase()===String(email).toLowerCase()); if(!target)throw new Error('Manager user not found in Supabase Auth.')
    const {error:updateError}=await admin.auth.admin.updateUserById(target.id,{password,user_metadata:{...(target.user_metadata||{}),restapay_role:'manager'}}); if(updateError)throw updateError
    return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}})
  } catch(error){ return new Response(JSON.stringify({ok:false,message:error?.message||String(error)}),{status:400,headers:{'content-type':'application/json'}}) }
})
