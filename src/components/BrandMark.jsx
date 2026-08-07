import { findVendorDomain, vendorInitials, vendorLogoUrl } from '../lib/vendorLogos'

export default function BrandMark({name,logoUrl,website,domain,size=34}){
 const resolvedDomain=domain||findVendorDomain(name,website)
 const resolvedLogo=logoUrl||vendorLogoUrl(resolvedDomain)
 const initials=vendorInitials(name)
 return <span className="brand-vendor-mark" style={{width:size,height:size}} aria-label={`${name || 'Vendor'} logo`}>
  {resolvedLogo&&<img src={resolvedLogo} alt="" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none'}}/>}
  <span className="brand-vendor-fallback">{initials}</span>
 </span>
}
