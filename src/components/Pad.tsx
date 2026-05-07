'use client'
import { forwardRef, memo, useImperativeHandle, useRef } from 'react'
import type { PadState } from '@/lib/types'

export interface PadHandle {
  startFire: () => void
  stopFire: () => void
}

interface Props {
  pad: PadState
  selected: boolean
  editMode: boolean
  onClick: () => void
}

const Pad = memo(forwardRef<PadHandle, Props>(function Pad({ pad, selected, editMode, onClick }, ref) {
  const elRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    startFire() { elRef.current?.classList.add('fire') },
    stopFire()  { elRef.current?.classList.remove('fire') },
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
      <span className="pad-icon-badge">
        {pad.iconImgUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={pad.iconImgUrl} alt="" className="pad-icon-img" />
          : <span className="pad-icon">{pad.icon}</span>
        }
      </span>
      <span className="pad-label">{pad.label}</span>
      <div className="pad-wave" aria-hidden><span/><span/><span/></div>
    </div>
  )
}))

export default Pad
