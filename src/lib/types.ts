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
  key: string
  customBuf: AudioBuffer | null
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
