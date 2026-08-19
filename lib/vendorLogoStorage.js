import { supabase, isSupabaseReady } from './supabase'

export async function uploadVendorLogoFile(file, vendorId = 'vendor') {
  if (!isSupabaseReady || !supabase) throw new Error('Supabase is not configured.')
  if (!file) throw new Error('Choose a logo image first.')
  if (!String(file.type || '').startsWith('image/')) throw new Error('Vendor logo must be an image file.')
  if (file.size > 3 * 1024 * 1024) throw new Error('Vendor logo must be smaller than 3 MB.')
  const ext = String(file.name || 'logo.png').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'') || 'png'
  const safeId = String(vendorId || 'vendor').replace(/[^a-zA-Z0-9_-]/g,'-')
  const path = `${safeId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('vendor-logos').upload(path, file, { cacheControl:'31536000', upsert:true, contentType:file.type || undefined })
  if (error) throw error
  const { data } = supabase.storage.from('vendor-logos').getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('Supabase did not return a public logo URL.')
  return { logo_url:data.publicUrl, logo_source:'supabase-storage-upload', logo_verified:true }
}

export async function persistVendorDomainLogo(vendor) {
  if (!isSupabaseReady || !supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.functions.invoke('vendor-logo', {
    body: {
      vendorId: vendor?.id || vendor?.name || 'vendor',
      vendorName: vendor?.name || '',
      website: vendor?.website || '',
      websiteDomain: vendor?.websiteDomain || vendor?.website_domain || ''
    }
  })
  if (error) throw error
  if (!data?.ok || !data?.logo_url) throw new Error(data?.message || 'No persistent vendor logo could be created.')
  return data
}
