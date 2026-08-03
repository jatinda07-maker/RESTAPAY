import React, { useState } from 'react'
import { Icon } from './Icons'

export default function UploadBar({
  label,
  accept,
  onChange,
  inputRef,
  disabled = false,
  action,
  className = '',
  icon = 'upload',
  multiple = false,
  capture,
}) {
  const [fileName, setFileName] = useState('No file chosen')

  const handleChange = event => {
    const files = Array.from(event.target.files || [])
    setFileName(files.length ? files.map(file => file.name).join(', ') : 'No file chosen')
    onChange?.(event)
  }

  return (
    <div className={`rv2-upload-bar ${className}`.trim()}>
      <div className="rv2-upload-main">
        <span className="rv2-upload-label"><Icon name={icon} size={16} />{label}</span>
        <label className={`rv2-upload-picker${disabled ? ' is-disabled' : ''}`}>
          <span>Choose File</span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={disabled}
            multiple={multiple}
            capture={capture}
            onChange={handleChange}
          />
        </label>
        <span className="rv2-upload-filename" title={fileName}>{fileName}</span>
      </div>
      {action ? <div className="rv2-upload-action">{action}</div> : null}
    </div>
  )
}
