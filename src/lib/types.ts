// ── Supabase DB row types ─────────────────────────────────────────────────────

export interface DbBoard {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface DbPadConfig {
  id: string
  user_id: string
  board_id: string | null
  pad_index: number
  sound: string
  label: string
  color: string
  icon: string
  custom_track_path: string | null
  custom_track_name: string | null
  icon_img_path: string | null
  updated_at: string
}

export interface DbUserSettings {
  user_id: string
  board_name: string | null
  theme: string | null
  active_board_id: string | null
  updated_at: string
}

// ── App-layer types ───────────────────────────────────────────────────────────

export interface Board {
  id: string
  name: string
  created_at: string
}

export interface PadConfig {
  index: number
  sound: string
  label: string
  color: string
  icon: string
  customTrackPath: string | null
  customTrackName: string | null
  iconImgPath?: string | null
}

export interface PadState extends PadConfig {
  gridClass: string
  keyLabel: string
  keyTrigger: string
  customBuf: AudioBuffer | null
  customRawBuf: ArrayBuffer | null
  customGain?: number
  iconImgUrl?: string | null
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
