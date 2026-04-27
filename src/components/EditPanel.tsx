'use client'
import { SOUNDS, SOUND_ICONS, SOUND_LABELS, COLORS } from '@/lib/constants'
import type { PadState } from '@/lib/types'

interface Props {
  pad: PadState
  selColor: string
  onSoundChange: (sound: string) => void
  onLabelChange: (label: string) => void
  onColorChange: (color: string) => void
  onSave: () => void
}

export default function EditPanel({
  pad, selColor, onSoundChange, onLabelChange, onColorChange, onSave
}: Props) {
  return (
    <div className="edit-panel">
      <div className="panel-group">
        <span className="panel-label">Sound</span>
        <select value={pad.sound} onChange={e => onSoundChange(e.target.value)}>
          {SOUNDS.map(s => (
            <option key={s} value={s}>{SOUND_ICONS[s]} {SOUND_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="panel-group">
        <span className="panel-label">Label</span>
        <input
          type="text"
          value={pad.label}
          onChange={e => onLabelChange(e.target.value)}
          placeholder="Pad label…"
          maxLength={14}
        />
      </div>

      <div className="panel-group">
        <span className="panel-label">Color</span>
        <div className="color-row">
          {COLORS.map(c => (
            <div
              key={c}
              className={`cdot d-${c}${selColor === c ? ' sel' : ''}`}
              onClick={() => onColorChange(c)}
              role="radio"
              aria-checked={selColor === c}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="vsep" />
      <button className="btn btn-solid" onClick={onSave}>Save</button>
    </div>
  )
}
