'use client'
import { useRef, useState } from 'react'
import type { PadState, PendingFile } from '@/lib/types'

interface Props {
  pads: PadState[]
  selectedPad: string
  pendingFile: PendingFile | null
  onPadSelect: (idx: string) => void
  onFileSelect: (file: File) => void
  onLabelChange: (label: string) => void
  onEmojiChange: (emoji: string) => void
  trackLabel: string
  trackEmoji: string
  onAssign: () => void
  onReset: () => void
}

export default function CustomTrackSection({
  pads, selectedPad, pendingFile,
  onPadSelect, onFileSelect,
  onLabelChange, onEmojiChange,
  trackLabel, trackEmoji,
  onAssign, onReset,
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pad = selectedPad !== '' ? pads[parseInt(selectedPad)] : null

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    e.target.value = ''
  }

  return (
    <div className="upload-section">
      <div className="section-label">Custom tracks</div>
      <div className="track-config">

        <div className="config-row">
          <span className="panel-label">Pad</span>
          <select
            className="pad-select"
            value={selectedPad}
            onChange={e => onPadSelect(e.target.value)}
          >
            <option value="">— Select a pad —</option>
            {pads.map((p, i) => (
              <option key={i} value={String(i)}>
                {p.key.toUpperCase()}. {p.icon} {p.label}{p.customBuf ? ' ●' : ''}
              </option>
            ))}
          </select>
          {pad && (
            <span className="current-track-info">
              {pad.customBuf
                ? <>Custom: <strong>{pad.customTrackName}</strong></>
                : <>Default: <strong>{pad.label}</strong></>}
            </span>
          )}
        </div>

        {pad && (
          <>
            <div className="config-row">
              <span className="panel-label">Audio</span>
              <div
                className={`drop-zone${dragOver ? ' over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                />
                <div className="dz-text">
                  {pendingFile ? (
                    <>
                      <strong>{pendingFile.name}</strong>
                      <small>{(pendingFile.size / 1024).toFixed(0)} KB · Ready to assign</small>
                    </>
                  ) : (
                    <>
                      <strong>Drop file here</strong> or click to browse
                      <small>MP3 · WAV · OGG · M4A</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="config-row">
              <span className="panel-label">Label</span>
              <input
                type="text"
                value={trackLabel}
                onChange={e => onLabelChange(e.target.value)}
                placeholder="Custom label…"
                maxLength={14}
              />
              <span className="panel-label" style={{ marginLeft: 4 }}>Emoji</span>
              <input
                type="text"
                className="emoji-input"
                value={trackEmoji}
                onChange={e => onEmojiChange(e.target.value)}
                placeholder="🎵"
                maxLength={2}
              />
            </div>

            <div className="config-actions">
              <span className="current-track-info" />
              <button
                className="btn btn-danger-outline"
                disabled={!pad.customBuf}
                onClick={onReset}
              >
                Reset to default
              </button>
              <button
                className="btn btn-solid"
                disabled={!pendingFile}
                onClick={onAssign}
              >
                Assign to pad
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
