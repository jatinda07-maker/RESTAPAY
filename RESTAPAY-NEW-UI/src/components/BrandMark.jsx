const brandMap={
 'US Foods':{label:'US',color:'#e31b23',domain:'usfoods.com'},
 Sysco:{label:'S',color:'#0085ca',domain:'sysco.com'},
 PFG:{label:'PFG',color:'#e11b22',domain:'pfgc.com'},
 'ABC Board':{label:'ABC',color:'#1f6a43'},
 Cintas:{label:'C',color:'#e21d2b',domain:'cintas.com'},
 'Coca-Cola':{label:'C',color:'#e41f26',domain:'coca-cola.com'},
 Pepsi:{label:'P',color:'#005cb9',domain:'pepsi.com'},
 Default:{label:'V',color:'#425466'}
}

export default function BrandMark({name,size=34}){
 const brand=brandMap[name]||brandMap.Default
 return <span className="brand-vendor-mark" style={{'--brand-color':brand.color,width:size,height:size}} aria-label={`${name} logo`}>
  {brand.domain&&<img src={`https://logo.clearbit.com/${brand.domain}`} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>}
  <span className="brand-vendor-fallback">{brand.label}</span>
 </span>
}
