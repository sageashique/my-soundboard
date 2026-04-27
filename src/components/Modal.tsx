'use client'
import type { ModalState } from '@/lib/types'

interface Props {
  modal: ModalState
  onCancel: () => void
  onConfirm: () => void
}

export default function Modal({ modal, onCancel, onConfirm }: Props) {
  return (
    <div className="modal-wrap" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h3>{modal.title}</h3>
        <p>{modal.body}</p>
        <div className="modal-btns">
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${modal.style === 'danger' ? 'btn-danger' : 'btn-confirm'}`}
            onClick={onConfirm}
          >
            {modal.okLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
