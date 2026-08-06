import { useNavigate } from 'react-router-dom'

export default function RecentCard({
  icon: Icon,
  title,
  count,
  columns = [],
  rows = [],
  footer,
  to = '/',
}) {
  const navigate = useNavigate()
  const columnCount = Math.max(columns.length, 1)
  const gridStyle = { '--mini-columns': columnCount }

  return (
    <section className="recent-card card-surface">
      <div className="recent-header">
        <div className="recent-title">
          <Icon size={18} aria-hidden="true" />
          <div>
            <h3>{title}</h3>
            <span>{count}</span>
          </div>
        </div>
        <button className="recent-link" type="button" onClick={() => navigate(to)}>
          View all
        </button>
      </div>

      <div className="mini-table" style={gridStyle}>
        <div className="mini-row mini-head" role="row">
          {columns.map((column) => (
            <span key={column} role="columnheader" title={column}>
              {column}
            </span>
          ))}
        </div>

        {rows.map((row, rowIndex) => (
          <button
            className="mini-row mini-data-row"
            key={`${title}-${rowIndex}`}
            type="button"
            onClick={() => navigate(to)}
            aria-label={`Open ${title} entry ${rowIndex + 1}`}
          >
            {row.map((cell, cellIndex) => (
              <span key={cellIndex} title={String(cell ?? '')}>
                {cell}
              </span>
            ))}
          </button>
        ))}
      </div>

      <button className="recent-footer" type="button" onClick={() => navigate(to)}>
        {footer}
      </button>
    </section>
  )
}
