export interface Board {
  id: string
  name: string
  position: number
}

export interface PadConfig {
  index: number
  sound: string
  label: string
  color: string
  icon: string
  customTrackPath: string | null
  customTrackName: string | null
}

export interface PadState extends PadConfig {
  gridClass: string
  keyLabel: string
  keyTrigger: string
  customBuf: AudioBuffer | null
  customRawBuf: ArrayBuffer | null
  customGain: number   // peak-normalization multiplier; 1.0 = no adjustment
}

export interface ModalState {
  title: string
  body: string
  okLabel: string
  style: 'danger' | 'confirm'
  cb: () => void
}

export interface PendingFile {
  raw: ArrayBuffer
  name: string
  size: number
}
