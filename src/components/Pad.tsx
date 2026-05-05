'use client'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { PadState } from '@/lib/types'

export interface PadHandle {
  flash: () => void
}

interface Props {
  pad: PadState
  selected: boolean
  editMode: boolean
  onClick: () => void
}

const Pad = forwardRef<PadHandle, Props>(function Pad({ pad, selected, editMode, onClick }, ref) {
  const elRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    flash() {
      const el = elRef.current
      if (!el) return
      el.classList.remove('fire')
      void el.offsetWidth
      el.classList.add('fire')
      setTimeout(() => el.classList.remove('fire'), 700)
    },
  }))

  return (
    <div
      ref={elRef}
      className={`pad ${pad.gridClass} c-${pad.color}${selected ? ' sel' : ''}${editMode ? ' edit-mode' : ''}`}
      onClick={onClick}
      role="button"
      aria-label={`${pad.keyLabel} – ${pad.label}`}
    >
      <span className="pad-key">{pad.keyLabel}</span>
      {pad.customBuf && <span className="custom-dot" aria-hidden />}
      <span className="pad-icon-badge"><span className="pad-icon">{pad.icon}</span></span>
      <span className="pad-label">{pad.label}</span>
      <div className="pad-wave" aria-hidden><span/><span/><span/></div>
    </div>
  )
})

export default Pad
