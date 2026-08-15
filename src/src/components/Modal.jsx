import { X } from 'lucide-react'
export default function Modal({open,title,subtitle,onClose,children,footer,size='md'}){
 if(!open)return null
 return <div className="modal-layer" onMouseDown={onClose}><section className={`app-modal modal-${size}`} onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><header><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="modal-close" onClick={onClose}><X size={20}/></button></header><div className="modal-body">{children}</div>{footer&&<footer>{footer}</footer>}</section></div>
}
