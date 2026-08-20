import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const text = value => value == null ? '' : String(value)
const safeName = value => text(value || 'RESTAPAY-Report').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'RESTAPAY-Report'

export function exportReportPdf({ title = 'RESTAPAY Report', subtitle = '', summary = [], sections = [], filename } = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 36
  let y = 42

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(text(title), margin, y)
  y += 18
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(text(subtitle), margin, y)
    y += 20
  }

  if (summary.length) {
    const usable = pageWidth - margin * 2
    const cellWidth = usable / summary.length
    summary.forEach((item, index) => {
      const x = margin + index * cellWidth
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(text(item.label), x, y)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(text(item.value), x, y + 14)
    })
    y += 38
  }

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) y = (doc.lastAutoTable?.finalY || y) + 26
    if (y > doc.internal.pageSize.getHeight() - 90) {
      doc.addPage()
      y = 42
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(text(section.title || 'Section'), margin, y)
    if (section.total != null && section.total !== '') {
      doc.setFontSize(10)
      doc.text(text(section.total), pageWidth - margin, y, { align: 'right' })
    }
    y += 10
    const body = Array.isArray(section.rows) && section.rows.length
      ? section.rows.map(row => row.map(text))
      : [['No data for this section.']]
    const headers = Array.isArray(section.headers) && section.headers.length ? section.headers.map(text) : ['Details']
    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fontStyle: 'bold' },
      theme: 'grid',
      didDrawPage: data => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(`RESTAPAY • ${text(title)}`, margin, doc.internal.pageSize.getHeight() - 18)
        doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 18, { align: 'right' })
      },
    })
    y = doc.lastAutoTable?.finalY || y
  })

  doc.save(`${safeName(filename || title)}.pdf`)
}
