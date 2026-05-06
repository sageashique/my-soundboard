'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { defaultPads, SOUND_ICONS, SOUND_LABELS, COLORS, KEY_TO_INDEX, getDefaultForIndex } from '@/lib/constants'
import { playSound } from '@/lib/sounds'
import type { Board, ModalState, PadState } from '@/lib/types'
import Pad, { type PadHandle } from './Pad'
import Modal from './Modal'
import dynamic from 'next/dynamic'

const EmojiPicker = dynamic(() => import('@emoji-mart/react'), { ssr: false })
const ImageCropPicker = dynamic(() => import('./ImageCropPicker'), { ssr: false })

const STORAGE_BUCKET = 'custom-tracks'

// Detect audio MIME type from raw bytes (magic numbers)
// Supported formats: MP3, WAV, M4A
function detectAudioMime(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf.slice(0, 12))
  // MP3: ID3 header or sync word
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg'
  if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return 'audio/mpeg'
  // WAV: RIFF header
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'audio/wav'
  // M4A: ftyp box at offset 4
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'audio/mp4'
  return 'audio/mpeg'
}

// K-weighted LUFS normalization (ITU-R BS.1770) — the broadcast/streaming standard
// used by YouTube, Spotify, and Apple Music. Each clip is independently normalized
// to a fixed target of -14 LUFS integrated, so no single clip can affect others.
//
// Why K-weighting instead of raw RMS:
//   - Applies a high-shelf pre-filter (+4 dB at 1682 Hz) and a high-pass filter
//     (100 Hz) that model the frequency sensitivity of human hearing.
//   - A bass-heavy kick and a bright vocal can have equal RMS but very different
//     perceived loudness. K-weighting accounts for this.
//   - A loud clip is attenuated to -14 LUFS; a quiet clip is boosted to -14 LUFS.
//     Neither affects the other — all clips land at the same perceptual level.
//
// Clipping guard: true peak of the ORIGINAL signal is measured and the gain is
// capped so the output never exceeds -1 dBFS (≈ 0.891), leaving headroom for
// the HTMLAudioElement's own volume scaling.
async function computeNormGain(raw: ArrayBuffer, targetLufs = -14): Promise<number> {
  try {
    // Step 1: decode audio (dummy 1-frame context is fine for decoding)
    const decCtx = new OfflineAudioContext(1, 1, 44100)
    const buf = await decCtx.decodeAudioData(raw.slice(0))

    // Step 2: measure true peak of original signal (for clipping guard)
    let peak = 0
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch)
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i])
        if (abs > peak) peak = abs
      }
    }
    if (peak === 0) return 1

    // Step 3: render through K-weighting filters for perceptual loudness measurement
    const kCtx = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate)
    const src = kCtx.createBufferSource()
    src.buffer = buf

    // ITU-R BS.1770 stage 1: high-shelf pre-filter +4 dB at 1682 Hz
    const shelf = kCtx.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 1681.97
    shelf.gain.value = 4.0

    // ITU-R BS.1770 stage 2: high-pass at 100 Hz (removes sub-bass that human
    // hearing is largely insensitive to)
    const hp = kCtx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 100
    hp.Q.value = 0.707

    src.connect(shelf)
    shelf.connect(hp)
    hp.connect(kCtx.destination)
    src.start(0)

    const rendered = await kCtx.startRendering()

    // Step 4: compute mean square of K-weighted signal across all channels
    let sumSq = 0
    let count = 0
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      const data = rendered.getChannelData(ch)
      for (let i = 0; i < data.length; i++) {
        sumSq += data[i] * data[i]
        count++
      }
    }
    if (count === 0) return 1
    const meanSq = sumSq / count
    if (meanSq === 0) return 1

    // LUFS ≈ −0.691 + 10·log₁₀(meanSq)  →  targetMs = 10^((targetLufs + 0.691) / 10)
    const targetMs = Math.pow(10, (targetLufs + 0.691) / 10)
    const gain = Math.sqrt(targetMs / meanSq)

    // Clipping guard: keep true peak below -1 dBFS (0.891) after scaling
    const ceiling = 0.891
    const safeGain = peak * gain > ceiling ? ceiling / peak : gain

    // Cap boost at 8× to prevent amplifying near-silent noise floors
    return Math.min(safeGain, 8)
  } catch {
    return 1   // decode failed (unsupported format) — play at unity gain
  }
}

interface Props { user: User }

export default function Soundboard({ user }: Props) {
  const [pads, setPads] = useState<PadState[]>(defaultPads)
  const [selPad, setSelPad] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [selColor, setSelColor] = useState('red')
  const [overlapMode, setOverlapMode] = useState(false)
  const [firingPads, setFiringPads] = useState<Set<number>>(new Set())
  const [volume, setVolume] = useState(0.8)
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  // iOS does not allow JS to set HTMLAudioElement.volume — hardware buttons only.
  // Detect once on mount so we can hide the non-functional slider on iOS devices.
  const [isIOS, setIsIOS] = useState(false)
  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
  }, [])

  // Status
  const [statusMsg, setStatusMsg] = useState('Ready')
  const [statusState, setStatusState] = useState<'idle' | 'active' | 'stopped'>('idle')

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Boards
  const [boards, setBoards] = useState<Board[]>([])
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [showBoardSwitcher, setShowBoardSwitcher] = useState(false)
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')

  // Unified edit panel state
  const [useCustomSource, setUseCustomSource] = useState(false)
  const [pendingBuf, setPendingBuf] = useState<AudioBuffer | null>(null)
  const [pendingFileName, setPendingFileName] = useState<string | null>(null)
  const [pendingGain, setPendingGain] = useState(1)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editSound, setEditSound] = useState('kick')

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  // Help overlay
  const [showHelp, setShowHelp] = useState(false)
  useEffect(() => {
    if (showHelp) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.removeProperty('overflow')
    }
    return () => { document.body.style.removeProperty('overflow') }
  }, [showHelp])

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Icon picker state
  const [iconTab, setIconTab] = useState<'emoji' | 'image'>('emoji')
  const [pendingIconBlob, setPendingIconBlob] = useState<Blob | null>(null)
  const [pendingIconPreview, setPendingIconPreview] = useState<string | null>(null)
  const [replacingIcon, setReplacingIcon] = useState(false)
  const [showResetOptions, setShowResetOptions] = useState(false)
  const boardSwitcherRef = useRef<HTMLDivElement>(null)

  const [modal, setModal] = useState<ModalState | null>(null)
  const [dbLoading, setDbLoading] = useState(true)

  // Audio refs
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | OscillatorNode | null>(null)
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode | OscillatorNode>>(new Set())
  // Tracks HTMLAudioElement instances used by the M4A/AAC fallback path.
  // These are not AudioNodes so they live in a separate set; both sets must be
  // consulted for stop-all and overlap-off logic.
  // Map<element, customGain> so handleVolume can repatch volume on playing elements
  const activeHtmlAudiosRef = useRef<Map<HTMLAudioElement, number>>(new Map())

  // Pad refs for flash animation
  const padRefs = useRef<(PadHandle | null)[]>([])

  // Keyboard held keys
  const heldRef = useRef(new Set<string>())

  // Raw audio buffer + detected MIME type for upload
  const pendingRawRef = useRef<ArrayBuffer | null>(null)
  const pendingFileTypeRef = useRef<string>('audio/mpeg')

  // Drop zone ref
  const dzRef = useRef<HTMLDivElement>(null)

  // ── Audio context ──────────────────────────────────────────────
  function getAC(): AudioContext {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctxRef.current = new AC()
      masterRef.current = ctxRef.current.createGain()
      masterRef.current.gain.value = volume
      masterRef.current.connect(ctxRef.current.destination)
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  // ── Status ─────────────────────────────────────────────────────
  function setStatus(msg: string, state: 'idle' | 'active' | 'stopped' = 'idle') {
    setStatusMsg(msg)
    setStatusState(state)
  }

  // ── Volume ─────────────────────────────────────────────────────
  function handleVolume(v: number) {
    setVolume(v)
    if (masterRef.current) masterRef.current.gain.value = v
    // Repatch volume on every currently-playing HTMLAudioElement so the slider
    // affects audio that's already in flight (custom uploads use HTMLAudioElement,
    // not Web Audio, so they aren't covered by the master gain node above).
    activeHtmlAudiosRef.current.forEach((gain, audio) => {
      audio.volume = Math.min(v * gain, 1)
    })
  }

  // ── Stop All ───────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (masterRef.current && ctxRef.current) {
      const a = ctxRef.current
      masterRef.current.gain.cancelScheduledValues(a.currentTime)
      masterRef.current.gain.setValueAtTime(0, a.currentTime)
      setTimeout(() => {
        if (masterRef.current && ctxRef.current)
          masterRef.current.gain.setValueAtTime(volume, ctxRef.current.currentTime)
      }, 80)
    }
    activeSourcesRef.current.forEach(s => { try { s.stop() } catch { /* already stopped */ } })
    activeSourcesRef.current.clear()
    activeHtmlAudiosRef.current.forEach((_, a) => { try { a.pause(); a.currentTime = 0 } catch { /* already ended */ } })
    activeHtmlAudiosRef.current.clear()
    currentSourceRef.current = null
    padRefs.current.forEach(r => r?.stopFire())
    setFiringPads(new Set())
    setStatus('⏹ Stopped', 'stopped')
  }, [volume])

  // ── Fire a pad ─────────────────────────────────────────────────
  const fire = useCallback((index: number) => {
    const a = getAC()
    const p = pads[index]

    // When overlap is OFF, stop every currently-playing node (not just
    // currentSourceRef — multi-node sounds like Clap/AirHorn/Laugh register
    // several nodes, and stopping only one leaves the rest audible).
    if (!overlapMode) {
      activeSourcesRef.current.forEach(s => { try { s.stop() } catch { /* already ended */ } })
      activeSourcesRef.current.clear()
      activeHtmlAudiosRef.current.forEach((_, a) => { try { a.pause(); a.currentTime = 0 } catch { /* already ended */ } })
      activeHtmlAudiosRef.current.clear()
      currentSourceRef.current = null
      padRefs.current.forEach(r => r?.stopFire())
      setFiringPads(new Set())
    }

    if (p.customRawBuf) {
      // Custom audio — always play via HTMLAudioElement, called synchronously within
      // the user gesture handler so iOS Safari allows it every tap. Web Audio
      // (AudioBufferSourceNode) fails silently on iOS when the AudioContext
      // re-suspends between interactions, even with resume() guards. Volume is
      // applied directly to the element; stop-all still works via activeHtmlAudiosRef.
      try {
        const mime = detectAudioMime(p.customRawBuf)
        const blob = new Blob([p.customRawBuf], { type: mime })
        const url = URL.createObjectURL(blob)
        const htmlAudio = new Audio(url)
        htmlAudio.volume = Math.min(volume * (p.customGain ?? 1), 1)
        activeHtmlAudiosRef.current.set(htmlAudio, p.customGain ?? 1)
        padRefs.current[index]?.startFire()
        setFiringPads(prev => new Set([...prev, index]))
        htmlAudio.play()
          .then(() => setStatus(`${p.icon} ${p.label}`, 'active'))
          .catch(() => {
            padRefs.current[index]?.stopFire()
            setFiringPads(prev => { const s = new Set(prev); s.delete(index); return s })
            setStatus('Could not play audio', 'stopped')
          })
        htmlAudio.onended = () => {
          URL.revokeObjectURL(url)
          activeHtmlAudiosRef.current.delete(htmlAudio)
          padRefs.current[index]?.stopFire()
          setFiringPads(prev => { const s = new Set(prev); s.delete(index); return s })
          if (activeSourcesRef.current.size === 0 && activeHtmlAudiosRef.current.size === 0) setStatus('Ready', 'idle')
        }
      } catch {
        setStatus('Could not play audio', 'stopped')
      }
    } else if (masterRef.current) {
      // Snapshot existing nodes so we can detect exactly what playSound adds
      const prevNodes = new Set(activeSourcesRef.current)
      const src = playSound(p.sound, a, masterRef.current, activeSourcesRef.current)
      // Attach onended to EVERY new node (multi-node sounds like Clap/AirHorn/Laugh
      // add several nodes; only tracking the last one leaves orphans in the set and
      // the status pill stuck on "active" indefinitely).
      const newNodes: AudioBufferSourceNode[] = []
      activeSourcesRef.current.forEach(node => {
        if (!prevNodes.has(node)) newNodes.push(node as AudioBufferSourceNode)
      })
      let remaining = newNodes.length
      newNodes.forEach(node => {
        node.onended = () => {
          activeSourcesRef.current.delete(node)
          if (currentSourceRef.current === node) currentSourceRef.current = null
          remaining--
          if (remaining <= 0) {
            padRefs.current[index]?.stopFire()
            setFiringPads(prev => { const s = new Set(prev); s.delete(index); return s })
          }
          if (activeSourcesRef.current.size === 0 && activeHtmlAudiosRef.current.size === 0) setStatus('Ready', 'idle')
        }
      })
      if (src && !overlapMode) currentSourceRef.current = src
      if (newNodes.length > 0) {
        padRefs.current[index]?.startFire()
        setFiringPads(prev => new Set([...prev, index]))
      }
    }

    setStatus(`${p.icon} ${p.label}`, 'active')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode, volume])

  // ── Board management ────────────────────────────────────────────
  const activeBoard = boards.find(b => b.id === activeBoardId)

  async function loadPadsForBoard(boardId: string) {
    const { data, error } = await supabase
      .from('pad_configs').select('*')
      .eq('user_id', user.id).eq('board_id', boardId)
    if (error) throw error
    const loaded = defaultPads()
    if (data && data.length > 0) {
      for (const row of data) {
        const i: number = row.pad_index
        if (i < 0 || i >= loaded.length) continue
        loaded[i] = {
          ...loaded[i],
          sound: row.sound, label: row.label, color: row.color, icon: row.icon,
          customTrackPath: row.custom_track_path ?? null,
          customTrackName: row.custom_track_name ?? null,
          iconImgPath: row.icon_img_path ?? null,
          customBuf: null, customRawBuf: null, customGain: 1,
        }
      }
    }
    setPads(loaded)
    if (data && data.length > 0) {
      await Promise.all([
        ...data.filter(row => row.custom_track_path)
               .map(row => loadCustomAudio(row.pad_index, row.custom_track_path)),
        ...data.filter(row => row.icon_img_path)
               .map(row => loadIconImage(row.pad_index, row.icon_img_path)),
      ])
    }
  }

  async function switchBoard(boardId: string) {
    if (boardId === activeBoardId) return
    stopAll()
    setDbLoading(true)
    setSelPad(null)
    setEditing(false)
    try {
      setActiveBoardId(boardId)
      await supabase.from('user_settings').upsert(
        { user_id: user.id, active_board_id: boardId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      await loadPadsForBoard(boardId)
      setStatus('Ready')
    } catch (err) {
      console.error('Failed to switch board:', err)
    }
    setDbLoading(false)
  }

  async function handleCreateBoard() {
    if (boards.length >= 5) return
    setShowBoardSwitcher(false)
    const newName = `Board ${boards.length + 1}`
    try {
      const { data: newBoard } = await supabase
        .from('boards')
        .insert({ user_id: user.id, name: newName })
        .select('id, name, created_at').single()
      if (!newBoard) return
      setBoards(prev => [...prev, newBoard])
      setActiveBoardId(newBoard.id)
      setPads(defaultPads())
      setSelPad(null)
      setEditing(false)
      await supabase.from('user_settings').upsert(
        { user_id: user.id, active_board_id: newBoard.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      setStatus(`Created "${newName}"`)
    } catch (err) {
      console.error('Failed to create board:', err)
    }
  }

  function startRename(boardId: string, currentName: string) {
    setRenamingBoardId(boardId)
    setRenameInput(currentName)
  }

  async function commitRename(boardId: string) {
    const val = renameInput.trim()
    setRenamingBoardId(null)
    if (!val) return
    try {
      await supabase.from('boards').update({ name: val }).eq('id', boardId).eq('user_id', user.id)
      setBoards(prev => prev.map(b => b.id === boardId ? { ...b, name: val } : b))
    } catch (err) {
      console.error('Failed to rename board:', err)
    }
  }

  function handleDeleteBoard(boardId: string) {
    if (boards.length <= 1) return
    const board = boards.find(b => b.id === boardId)
    setShowBoardSwitcher(false)
    setModal({
      title: 'Delete board?',
      body: `Delete "${board?.name ?? 'this board'}"? All pad configs and custom audio for this board will be removed. This cannot be undone.`,
      okLabel: 'Delete board',
      style: 'danger',
      cb: async () => {
        try {
          const { data: padRows } = await supabase
            .from('pad_configs').select('custom_track_path')
            .eq('user_id', user.id).eq('board_id', boardId)
          const paths = (padRows ?? []).filter(p => p.custom_track_path).map(p => p.custom_track_path!)
          if (paths.length > 0) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
          await supabase.from('pad_configs').delete().eq('user_id', user.id).eq('board_id', boardId)
          await supabase.from('boards').delete().eq('id', boardId).eq('user_id', user.id)
          const newBoards = boards.filter(b => b.id !== boardId)
          setBoards(newBoards)
          if (boardId === activeBoardId && newBoards.length > 0) {
            await switchBoard(newBoards[0].id)
          }
        } catch (err) {
          console.error('Failed to delete board:', err)
        }
      },
    })
  }
  async function handleThemeToggle(newTheme: 'light' | 'dark') {
    setTheme(newTheme)
    try {
      await supabase.from('user_settings').upsert(
        { user_id: user.id, theme: newTheme, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    } catch (err) {
      console.error('Failed to save theme:', err)
    }
  }

  // ── Pick pad in edit mode ───────────────────────────────────────
  function pickPad(index: number) {
    const p = pads[index]
    setSelPad(index)
    setSelColor(p.color)
    setUseCustomSource(!!p.customBuf || !!(p as PadState & { customRawBuf?: ArrayBuffer }).customRawBuf)
    setEditSound(p.sound || 'kick')
    setEditLabel(p.label)
    setEditEmoji(p.icon)
    setPendingBuf(null)
    setPendingFileName(null)
    pendingRawRef.current = null
    setIconTab(p.iconImgUrl ? 'image' : 'emoji')
    setPendingIconBlob(null)
    setPendingIconPreview(null)
    setReplacingIcon(false)
    setShowResetOptions(false)
    setStatus(`Pad [${p.keyLabel}] selected`)
  }

  // ── Save pad ───────────────────────────────────────────────────
  async function handleSave() {
    if (selPad === null) return
    const p = pads[selPad]

    // Handle icon image upload (independent of sound source)
    let newIconImgPath = p.iconImgPath ?? null
    let newIconImgUrl = p.iconImgUrl ?? null
    if (pendingIconBlob) {
      try {
        const iconPath = `${user.id}/${activeBoardId}/pad-${selPad}-icon.jpg`
        const { error: iconErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(iconPath, pendingIconBlob, { contentType: 'image/jpeg', upsert: true })
        if (!iconErr) {
          if (newIconImgUrl) URL.revokeObjectURL(newIconImgUrl)
          newIconImgPath = iconPath
          newIconImgUrl = URL.createObjectURL(pendingIconBlob)
          setPendingIconBlob(null)
          if (pendingIconPreview) { URL.revokeObjectURL(pendingIconPreview); setPendingIconPreview(null) }
        }
      } catch { /* continue, icon upload is non-critical */ }
    }

    if (useCustomSource) {
      if (!pendingRawRef.current && !p.customBuf) { setStatus('Drop an audio file first'); return }
      const label = editLabel || pendingFileName || 'Custom'
      const emoji = editEmoji.trim() || '🎵'

      if (pendingFileName && pendingRawRef.current) {
        try {
          setStatus('Uploading…')
          const storagePath = `${user.id}/${activeBoardId}/pad-${selPad}`
          // Remove old file if it's at a different path (e.g. migrated from pre-boards era)
          if (p.customTrackPath && p.customTrackPath !== storagePath) {
            try { await supabase.storage.from(STORAGE_BUCKET).remove([p.customTrackPath]) } catch { /* ignore */ }
          }
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, pendingRawRef.current, { contentType: pendingFileTypeRef.current, upsert: true })
          if (upErr) throw upErr

          const rawCopy = pendingRawRef.current.slice(0)
          setPads(prev => prev.map((pd, i) => i === selPad
            ? { ...pd, label, icon: emoji, customBuf: pendingBuf ?? null, customRawBuf: rawCopy, customTrackPath: storagePath, customTrackName: pendingFileName!, color: selColor, customGain: pendingGain, iconImgPath: newIconImgPath, iconImgUrl: newIconImgUrl } as PadState
            : pd
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id, board_id: activeBoardId, pad_index: selPad,
            sound: p.sound, label, color: selColor, icon: emoji,
            custom_track_path: storagePath, custom_track_name: pendingFileName,
            icon_img_path: newIconImgPath,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,board_id,pad_index' })

          setPendingBuf(null); setPendingFileName(null); pendingRawRef.current = null
          setStatus(`Saved → [${p.keyLabel}] ${label}`, 'active')
        } catch (err) {
          setStatus(`Upload failed: ${(err as Error).message}`)
          return
        }
      } else {
        const label2 = editLabel || p.label
        const emoji2 = editEmoji.trim() || p.icon
        setPads(prev => prev.map((pd, i) => i === selPad ? { ...pd, label: label2, icon: emoji2, color: selColor, iconImgPath: newIconImgPath, iconImgUrl: newIconImgUrl } : pd))
        await supabase.from('pad_configs').upsert({
          user_id: user.id, board_id: activeBoardId, pad_index: selPad,
          sound: p.sound, label: label2, color: selColor, icon: emoji2,
          custom_track_path: p.customTrackPath, custom_track_name: p.customTrackName,
          icon_img_path: newIconImgPath,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,board_id,pad_index' })
        setStatus(`Saved → [${p.keyLabel}] ${label2}`, 'active')
      }
    } else {
      const label = editLabel || SOUND_LABELS[editSound]
      const icon = editEmoji.trim() || SOUND_ICONS[editSound] || '🔊'
      // Remove old custom audio file from storage if switching away from custom
      if (p.customTrackPath) {
        try { await supabase.storage.from(STORAGE_BUCKET).remove([p.customTrackPath]) } catch { /* ignore */ }
      }
      setPads(prev => prev.map((pd, i) => i === selPad
        ? { ...pd, sound: editSound, label, icon, color: selColor, customBuf: null, customRawBuf: null, customTrackPath: null, customTrackName: null, customGain: 1, iconImgPath: newIconImgPath, iconImgUrl: newIconImgUrl }
        : pd
      ))
      await supabase.from('pad_configs').upsert({
        user_id: user.id, board_id: activeBoardId, pad_index: selPad,
        sound: editSound, label, color: selColor, icon,
        custom_track_path: null, custom_track_name: null,
        icon_img_path: newIconImgPath,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,board_id,pad_index' })
      setStatus(`Saved → [${p.keyLabel}] ${label}`, 'active')
    }
    setSelPad(null)
  }

  // ── Granular reset handlers ────────────────────────────────────
  function handleClearSound() {
    if (selPad === null) return
    const p = pads[selPad]
    setModal({
      title: 'Clear custom sound?',
      body: 'Remove the custom audio from this pad? It will revert to its default built-in sound.',
      okLabel: 'Clear sound',
      style: 'danger',
      cb: async () => {
        if (p.customTrackPath) {
          try { await supabase.storage.from(STORAGE_BUCKET).remove([p.customTrackPath]) } catch { /* ignore */ }
        }
        const def = getDefaultForIndex(selPad)
        setPads(prev => prev.map((pd, i) => i === selPad
          ? { ...pd, sound: def?.sound ?? 'kick', customBuf: null, customRawBuf: null, customTrackPath: null, customTrackName: null, customGain: 1 }
          : pd
        ))
        await supabase.from('pad_configs').upsert({
          user_id: user.id, board_id: activeBoardId, pad_index: selPad,
          sound: def?.sound ?? 'kick', label: p.label, color: p.color, icon: p.icon,
          custom_track_path: null, custom_track_name: null,
          icon_img_path: p.iconImgPath ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,board_id,pad_index' })
        setUseCustomSource(false)
        setEditSound(def?.sound ?? 'kick')
        setShowResetOptions(false)
        setStatus(`Sound cleared for [${p.keyLabel}]`)
      },
    })
  }

  function handleClearIcon() {
    if (selPad === null) return
    const p = pads[selPad]
    setModal({
      title: 'Clear icon image?',
      body: 'Remove the custom image from this pad? It will revert to the default emoji icon.',
      okLabel: 'Clear icon',
      style: 'danger',
      cb: async () => {
        if (p.iconImgPath) {
          try { await supabase.storage.from(STORAGE_BUCKET).remove([p.iconImgPath]) } catch { /* ignore */ }
        }
        if (p.iconImgUrl) URL.revokeObjectURL(p.iconImgUrl)
        if (pendingIconPreview) { URL.revokeObjectURL(pendingIconPreview); setPendingIconPreview(null) }
        setPendingIconBlob(null)
        setReplacingIcon(false)
        setPads(prev => prev.map((pd, i) => i === selPad
          ? { ...pd, iconImgPath: null, iconImgUrl: null }
          : pd
        ))
        await supabase.from('pad_configs').upsert({
          user_id: user.id, board_id: activeBoardId, pad_index: selPad,
          sound: p.sound, label: p.label, color: p.color, icon: p.icon,
          custom_track_path: p.customTrackPath, custom_track_name: p.customTrackName,
          icon_img_path: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,board_id,pad_index' })
        setIconTab('emoji')
        setShowResetOptions(false)
        setStatus(`Icon cleared for [${p.keyLabel}]`)
      },
    })
  }

  function handleResetPad() {
    if (selPad === null) return
    const p = pads[selPad]
    setModal({
      title: 'Reset pad to default?',
      body: 'Reset everything — sound, icon, label, and color — back to the factory default. This cannot be undone.',
      okLabel: 'Reset pad',
      style: 'danger',
      cb: async () => {
        const def = getDefaultForIndex(selPad)
        if (!def) return
        try {
          const storagePaths: string[] = []
          if (p.customTrackPath) storagePaths.push(p.customTrackPath)
          if (p.iconImgPath) storagePaths.push(p.iconImgPath)
          if (storagePaths.length > 0) await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths)
          if (p.iconImgUrl) URL.revokeObjectURL(p.iconImgUrl)
          if (pendingIconPreview) { URL.revokeObjectURL(pendingIconPreview); setPendingIconPreview(null) }
          setPendingIconBlob(null)
          setPads(prev => prev.map((pd, i) => i === selPad
            ? { ...pd, sound: def.sound, label: def.defaultLabel, icon: def.icon, color: def.color, customBuf: null, customRawBuf: null, customTrackPath: null, customTrackName: null, customGain: 1, iconImgPath: null, iconImgUrl: null }
            : pd
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id, board_id: activeBoardId, pad_index: selPad,
            sound: def.sound, label: def.defaultLabel, color: def.color, icon: def.icon,
            custom_track_path: null, custom_track_name: null,
            icon_img_path: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,board_id,pad_index' })
          setUseCustomSource(false)
          setEditSound(def.sound)
          setEditLabel(def.defaultLabel)
          setEditEmoji('')
          setSelColor(def.color)
          setIconTab('emoji')
          setShowResetOptions(false)
          setStatus(`Pad [${p.keyLabel}] reset to default`)
          setSelPad(null)
        } catch (err) {
          setStatus(`Reset failed: ${(err as Error).message}`)
        }
      },
    })
  }

  // ── Reset all ─────────────────────────────────────────────────
  async function handleResetAll() {
    stopAll()
    setStatus('Resetting…')
    try {
      // Remove all custom audio files from storage
      const storagePaths = pads.filter(p => p.customTrackPath).map(p => p.customTrackPath!)
      if (storagePaths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths)
      }
      // Delete all pad configs for this board so they don't reload on refresh
      await supabase.from('pad_configs').delete().eq('user_id', user.id).eq('board_id', activeBoardId)
    } catch (err) {
      console.error('Failed to clear data from Supabase:', err)
    }
    setPads(defaultPads())
    setSelPad(null)
    setEditing(false)
    setStatus('All pads reset to defaults')
  }

  // ── File upload ────────────────────────────────────────────────
  const MAX_FILE_MB = 10
  async function handleFile(file: File) {
    const isAudio = file.type.startsWith('audio/') || file.type === 'video/mp4'
    if (!isAudio) { setStatus('Unsupported file — use MP3, WAV, or M4A'); return }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { setStatus(`File too large — max ${MAX_FILE_MB} MB`); return }
    try {
      const raw = await file.arrayBuffer()
      const mime = file.type || detectAudioMime(raw)
      pendingFileTypeRef.current = mime
      pendingRawRef.current = raw
      const name = file.name.replace(/\.[^.]+$/, '')
      setPendingFileName(name)
      if (!editLabel) setEditLabel(name.slice(0, 20))
      // Compute normalization gain in the background
      computeNormGain(raw).then(g => setPendingGain(g))
      // Try to decode for immediate playback preview; not all formats decode on all
      // browsers (e.g. M4A on Android Chrome). We still allow upload either way.
      try {
        const a = getAC()
        const buf = await a.decodeAudioData(raw.slice(0))
        setPendingBuf(buf)
      } catch {
        setPendingBuf(null)
        setStatus(`Staged "${name}" — will play via native audio`)
      }
    } catch {
      setStatus('Could not read audio file')
    }
  }

  // ── Load boards + pad configs from Supabase ─────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Load user settings
        const { data: settings } = await supabase
          .from('user_settings').select('board_name, theme, active_board_id')
          .eq('user_id', user.id).single()

        if (settings?.theme === 'light' || settings?.theme === 'dark') {
          setTheme(settings.theme)
        }

        // Load boards
        const { data: boardData } = await supabase
          .from('boards').select('id, name, created_at')
          .eq('user_id', user.id).order('created_at')

        let loadedBoards: Board[] = boardData ?? []
        let resolvedBoardId: string

        if (loadedBoards.length === 0) {
          // ── First-time migration ───────────────────────────────
          // Create a board from the old board_name and link existing pad_configs to it.
          const oldName = settings?.board_name ??
            `${(user.email?.split('@')[0] ?? 'my').toUpperCase()}'S SOUNDBOARD`
          const { data: newBoard } = await supabase
            .from('boards')
            .insert({ user_id: user.id, name: oldName })
            .select('id, name, created_at').single()
          if (!newBoard) throw new Error('Board creation failed')
          // Link existing pad_configs (those without a board_id) to this board
          await supabase.from('pad_configs')
            .update({ board_id: newBoard.id })
            .eq('user_id', user.id)
            .is('board_id', null)
          await supabase.from('user_settings').upsert(
            { user_id: user.id, active_board_id: newBoard.id, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          )
          loadedBoards = [newBoard]
          resolvedBoardId = newBoard.id
        } else {
          // Use saved active board, fall back to first board if stale/missing
          resolvedBoardId =
            (settings?.active_board_id && loadedBoards.some(b => b.id === settings.active_board_id))
              ? settings.active_board_id
              : loadedBoards[0].id
        }

        setBoards(loadedBoards)
        setActiveBoardId(resolvedBoardId)

        // Load pad configs for the active board
        await loadPadsForBoard(resolvedBoardId)
        setDbLoading(false)
      } catch (err) {
        console.error('Failed to load data:', err)
        setDbLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function loadCustomAudio(padIndex: number, storagePath: string) {
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)
      if (error || !data) return
      const raw = await data.arrayBuffer()
      const gain = await computeNormGain(raw)
      setPads(prev => prev.map((p, i) => i === padIndex
        ? { ...p, customRawBuf: raw.slice(0), customGain: gain } as PadState
        : p
      ))
    } catch (err) {
      console.warn(`Could not load audio for pad ${padIndex}:`, err)
    }
  }

  async function loadIconImage(padIndex: number, storagePath: string) {
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)
      if (error || !data) return
      const url = URL.createObjectURL(data)
      setPads(prev => prev.map((p, i) => i === padIndex ? { ...p, iconImgUrl: url } : p))
    } catch (err) {
      console.warn(`Could not load icon for pad ${padIndex}:`, err)
    }
  }

  // ── Keyboard events ─────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (heldRef.current.has(e.key)) return
      heldRef.current.add(e.key)
      if (e.key === ' ') { e.preventDefault(); stopAll(); return }
      const idx = KEY_TO_INDEX[e.key]
      if (idx !== undefined) { e.preventDefault(); editing ? pickPad(idx) : fire(idx) }
    }
    function onKeyUp(e: KeyboardEvent) { heldRef.current.delete(e.key) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode, editing, selPad, stopAll])

  // ── Close emoji picker on outside click ───────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  // ── Close board switcher on outside click ────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boardSwitcherRef.current && !boardSwitcherRef.current.contains(e.target as Node)) {
        setShowBoardSwitcher(false)
        setRenamingBoardId(null)
      }
    }
    if (showBoardSwitcher) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBoardSwitcher])

  // ── Close settings popover on outside click ───────────────────
  useEffect(() => {
    if (!showSettings) return
    function h(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettings(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSettings])

  // ── Sign out ────────────────────────────────────────────────────
  async function handleSignOut() { await supabase.auth.signOut() }

  // ── Cancel edit modal ──────────────────────────────────────────
  function handleCancelEdit() {
    setPendingBuf(null)
    setPendingFileName(null)
    pendingRawRef.current = null
    pendingFileTypeRef.current = 'audio/mpeg'
    setPendingGain(1)
    setShowEmojiPicker(false)
    setPendingIconBlob(null)
    if (pendingIconPreview) { URL.revokeObjectURL(pendingIconPreview); setPendingIconPreview(null) }
    setReplacingIcon(false)
    setShowResetOptions(false)
    setSelPad(null)
  }

  // ── Body scroll lock for edit modal ───────────────────────────
  useEffect(() => {
    if (editing && selPad !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.removeProperty('overflow')
    }
    return () => { document.body.style.removeProperty('overflow') }
  }, [editing, selPad])

  // ── Modal ───────────────────────────────────────────────────────
  function dismissModal() { setModal(null) }
  function confirmModal() { const cb = modal?.cb; setModal(null); cb?.() }

  if (dbLoading) return <div className="loading-screen">Getting your sounds ready…</div>

  const selectedPad = selPad !== null ? pads[selPad] : null

  return (
    <div className="sb-page">
      {modal && <Modal modal={modal} onCancel={dismissModal} onConfirm={confirmModal} />}

      {/* Header */}
      <div className="top">
        {/* Title row: app brand (left) | Built by (right) */}
        <div className="sb-title-row">
          <div className="sb-wordmark-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="sb-logo" />
            <span className="sb-appname"><span className="logo-bracket">[</span><span className="logo-sage">sage</span><span className="logo-bracket">]</span><span className="logo-sounds">SOUNDS</span></span>
          </div>
          <a
            href="https://www.linkedin.com/in/sageashique"
            target="_blank"
            rel="noopener noreferrer"
            className="sb-built-by"
          >
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Built by Sage Ashique
          </a>
        </div>

        {/* Hairline divider under title */}
        <div className="sb-title-divider" />

        {/* Meta row: Board switcher (left) | Help (right) */}
        <div className="top-meta-row">
          <div className="board-switcher" ref={boardSwitcherRef}>
            <button
              className="board-name-btn"
              onClick={() => setShowBoardSwitcher(s => !s)}
            >
              <span className="board-name-text">{activeBoard?.name ?? ''}</span>
              <span className="board-name-chevron">{showBoardSwitcher ? '▲' : '▼'}</span>
            </button>
            {showBoardSwitcher && (
              <div className="board-dropdown">
                {boards.map(board => (
                  <div key={board.id} className={`board-dropdown-item${board.id === activeBoardId ? ' active' : ''}`}>
                    {renamingBoardId === board.id ? (
                      <input
                        className="board-rename-input"
                        value={renameInput}
                        maxLength={30}
                        autoFocus
                        onChange={e => setRenameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename(board.id)
                          if (e.key === 'Escape') setRenamingBoardId(null)
                        }}
                        onBlur={() => commitRename(board.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        className="board-item-name"
                        onClick={() => { switchBoard(board.id); setShowBoardSwitcher(false) }}
                      >
                        {board.id === activeBoardId && <span className="board-active-dot" />}
                        {board.name}
                      </button>
                    )}
                    <div className="board-item-actions">
                      <button
                        className="board-action-btn"
                        title="Rename"
                        onClick={e => { e.stopPropagation(); startRename(board.id, board.name) }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {boards.length > 1 && (
                        <button
                          className="board-action-btn board-action-delete"
                          title="Delete board"
                          onClick={e => { e.stopPropagation(); handleDeleteBoard(board.id) }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {boards.length < 5 && (
                  <button className="board-add-btn" onClick={handleCreateBoard}>
                    + New board
                  </button>
                )}
              </div>
            )}
          </div>
          <button className="help-btn" onClick={() => setShowHelp(true)}>
            <span className="help-btn-badge">?</span>
            Help
          </button>
        </div>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-panel" onClick={e => e.stopPropagation()}>
            <div className="help-header">
              <span className="help-title">How to use your Soundboard</span>
              <button className="help-close" onClick={() => setShowHelp(false)} aria-label="Close">✕</button>
            </div>
            <div className="help-body">
              <div className="help-section">
                <div className="help-section-title">Playing sounds</div>
                <p>Tap any pad to trigger its sound. Each pad also has a keyboard shortcut shown in the top-left corner of the pad.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Stopping sounds</div>
                <p>Press the <strong>Stop</strong> bar or hit <strong>Space</strong> to stop all audio instantly.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Settings</div>
                <p>Tap <strong>⚙️ Settings</strong> at the bottom to adjust volume (desktop), toggle <strong>Sound Overlap</strong> to let sounds layer instead of cutting off, and switch between light and dark mode.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Editing a pad</div>
                <p>Press <strong>Edit Pads</strong> to enter edit mode, then tap any pad to configure it. Switch to <strong>Custom</strong> to upload your own audio file (MP3, WAV, or M4A; max 10 MB) — great for dropping in samples, drops, or any sound you want at your fingertips. On <strong>Built-in</strong>, choose from 14 synthesized sounds. Either way, you can set a custom label, color, and emoji.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Your boards</div>
                <p>Click your board name to open the board switcher. Switch between boards, rename them, or create a new empty board with <strong>+ New board</strong> (up to 5). Each board has its own independent set of 14 pads. Delete a board to remove it and all its sounds permanently.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Saving</div>
                <p>Each pad saves individually when you click <strong>Save</strong> in the edit panel. Your setup persists across devices.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pad grid */}
      {/* onTouchStart handler required for iOS Safari to fire :active on child divs */}
      <div className="numpad" onTouchStart={() => {}}>
        {pads.map((pad, i) => (
          <Pad
            key={i}
            ref={el => { padRefs.current[i] = el }}
            pad={editing && selPad === i ? { ...pad, color: selColor } : pad}
            selected={selPad === i}
            editMode={editing}
            onClick={() => { getAC(); editing ? pickPad(i) : fire(i) }}
          />
        ))}

        {/* Stop bar */}
        <div className="pad-stop" onClick={stopAll}>
          <span className="pad-key">SPACE</span>
          <span className="pad-stop-icon">⏹</span>
          <span className="pad-stop-label">STOP</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        {editing ? (
          <button
            className="btn exit-edit-btn"
            onClick={() => { setEditing(false); setSelPad(null); setStatus('Ready') }}
          >
            Exit Edit Mode
          </button>
        ) : (
          <span className={`status-pill${statusState !== 'idle' ? ` ${statusState}` : ''}`}>
            {firingPads.size > 1 ? '🎛️ Mixing…' : statusMsg}
          </span>
        )}
      </div>

      <div className="divider" />

      {/* Controls row: Edit Pads / Reset All + Settings */}
      <div className="controls-bar controls-bar-split">
        {editing ? (
          <button
            className="btn btn-danger-outline btn-reset-all"
            onClick={() => setModal({
              title: 'Reset All Pads to Default',
              body: 'This will clear all custom sounds, labels, colors, and icons for every pad and restore the original defaults. This cannot be undone.',
              okLabel: 'Yes, reset all pads',
              style: 'danger',
              cb: handleResetAll,
            })}
          >
            Reset All Pads to Default
          </button>
        ) : (
          <button
            className="btn btn-outline"
            onClick={() => setEditing(true)}
          >
            ✏️ Edit Pads
          </button>
        )}
        <div className="settings-wrap" ref={settingsRef}>
          <button
            className={`btn${showSettings ? ' btn-edit-active' : ' btn-outline'}`}
            onClick={() => setShowSettings(s => !s)}
          >
            ⚙️ Settings
          </button>
          {showSettings && (
            <div className="settings-popover settings-popover--up">
              {!isIOS && (
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Volume</div>
                    <div className="settings-sub">Desktop only</div>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05} value={volume}
                    onChange={e => handleVolume(parseFloat(e.target.value))}
                    className="settings-vol-slider"
                  />
                </div>
              )}
              <div className="settings-row">
                <div className="settings-label">Sound overlap</div>
                <label className="toggle">
                  <input
                    type="checkbox" checked={overlapMode}
                    onChange={e => {
                      setOverlapMode(e.target.checked)
                      setStatus(e.target.checked ? 'Sound overlap on' : 'Sound overlap off')
                    }}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>
              <div className="settings-row">
                <div className="settings-label">Light mode</div>
                <label className="toggle">
                  <input
                    type="checkbox" checked={theme === 'light'}
                    onChange={e => handleThemeToggle(e.target.checked ? 'light' : 'dark')}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Edit Pad Modal */}
      {editing && selectedPad && (
        <div className="ep-overlay" onClick={handleCancelEdit}>
          <div className="ep-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="ep-header">
              <span className="ep-title">Edit Pad</span>
              <button className="ep-close" onClick={handleCancelEdit} aria-label="Close">✕</button>
            </div>

            {/* Body */}
            <div className="ep-body">

              {/* Live preview */}
              <div className="ep-preview">
                <div className={`ep-preview-pad c-${selColor}`}>
                  {(() => {
                    const previewSrc = pendingIconPreview ?? (iconTab === 'image' ? pads[selPad!]?.iconImgUrl : null)
                    return previewSrc
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={previewSrc} alt="" className="ep-preview-img" />
                      : <span className="ep-preview-icon">{editEmoji || SOUND_ICONS[editSound] || '🎵'}</span>
                  })()}
                  <span className="ep-preview-label">{editLabel || selectedPad.label}</span>
                </div>
                <p className="ep-preview-hint">Live preview</p>
              </div>

              {/* Controls */}
              <div className="ep-controls">

                {/* Source card */}
                <div className="ep-card">
                  <div className="ep-group">
                    <span className="ep-label">Audio Source</span>
                    <div className="seg-bar">
                      <button className={`seg-btn${useCustomSource ? ' active' : ''}`} onClick={() => setUseCustomSource(true)}>Custom</button>
                      <button className={`seg-btn${!useCustomSource ? ' active' : ''}`} onClick={() => setUseCustomSource(false)}>Built-in</button>
                    </div>
                  </div>

                  {!useCustomSource && (
                    <div className="ep-sub-group">
                      <span className="ep-sub-label">Sound</span>
                      <select value={editSound} onChange={e => {
                        const s = e.target.value
                        setEditSound(s)
                        if (!editLabel || Object.values(SOUND_LABELS).includes(editLabel))
                          setEditLabel(SOUND_LABELS[s] || '')
                        setEditEmoji(SOUND_ICONS[s] || '🎵')
                      }}>
                        <option value="kick">🥁 Kick</option>
                        <option value="snare">🪘 Snare</option>
                        <option value="hihat">🎵 Hi-Hat</option>
                        <option value="clap">👏 Clap</option>
                        <option value="rimshot">🎯 Rimshot</option>
                        <option value="bass">🎸 808 Bass</option>
                        <option value="synth">🎹 Synth</option>
                        <option value="riser">⬆️ Riser</option>
                        <option value="scratch">💿 Scratch</option>
                        <option value="airhorn">📯 Air Horn</option>
                        <option value="laugh">😂 Laugh</option>
                        <option value="noti">🔔 Notif</option>
                        <option value="siren">🚨 Siren</option>
                        <option value="swoosh">💨 Swoosh</option>
                      </select>
                    </div>
                  )}

                  {useCustomSource && (
                    <div className="ep-sub-group">
                      <span className="ep-sub-label">Audio file</span>
                      <div
                        className="drop-zone"
                        ref={dzRef}
                        onDragOver={e => { e.preventDefault(); dzRef.current?.classList.add('over') }}
                        onDragLeave={() => dzRef.current?.classList.remove('over')}
                        onDrop={e => {
                          e.preventDefault()
                          dzRef.current?.classList.remove('over')
                          if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
                        }}
                      >
                        <input
                          type="file"
                          accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,video/mp4"
                          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); (e.target as HTMLInputElement).value = '' }}
                        />
                        <div className="dz-text">
                          {pendingFileName
                            ? <><strong>{pendingFileName}</strong><small>Ready to assign</small></>
                            : <><strong>Drop file here</strong> or click to browse<small>MP3 · WAV · M4A &nbsp;·&nbsp; max 10 MB</small></>
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Icon card */}
                <div className="ep-card">
                  <span className="ep-label">Icon</span>
                  <div className="seg-bar">
                    <button
                      className={`seg-btn${iconTab === 'image' ? ' active' : ''}`}
                      onClick={() => setIconTab('image')}
                    >Image</button>
                    <button
                      className={`seg-btn${iconTab === 'emoji' ? ' active' : ''}`}
                      onClick={() => { setIconTab('emoji'); setShowEmojiPicker(false) }}
                    >Emoji</button>
                  </div>

                  {iconTab === 'emoji' && (
                    <div className="emoji-picker-wrap" ref={emojiPickerRef}>
                      <div className="ep-emoji-row">
                        <button
                          className="emoji-trigger"
                          onClick={() => setShowEmojiPicker(p => !p)}
                          title="Pick emoji"
                        >
                          {editEmoji || SOUND_ICONS[editSound] || '🎵'}
                        </button>
                        <span className="ep-emoji-hint">Click to pick</span>
                      </div>
                      {showEmojiPicker && (
                        <div className="emoji-popover">
                          <EmojiPicker
                            data={async () => (await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data')).json()}
                            onEmojiSelect={(e: { native: string }) => {
                              setEditEmoji(e.native)
                              setShowEmojiPicker(false)
                            }}
                            theme={theme}
                            previewPosition="none"
                            skinTonePosition="none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {iconTab === 'image' && (
                    (pendingIconPreview || pads[selPad!]?.iconImgUrl) && !replacingIcon
                      ? (
                        <div className="icp-preview-wrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pendingIconPreview ?? pads[selPad!]?.iconImgUrl!}
                            alt=""
                            className="icp-preview-img"
                          />
                          <button
                            className="btn btn-outline icp-change-btn"
                            onClick={() => {
                              if (pendingIconPreview) { URL.revokeObjectURL(pendingIconPreview); setPendingIconPreview(null) }
                              setPendingIconBlob(null)
                              setReplacingIcon(true)
                            }}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <ImageCropPicker
                          onCrop={blob => {
                            setPendingIconBlob(blob)
                            setPendingIconPreview(URL.createObjectURL(blob))
                            setReplacingIcon(false)
                          }}
                          onCancel={() => {
                            setReplacingIcon(false)
                            if (!pads[selPad!]?.iconImgUrl) setIconTab('emoji')
                          }}
                        />
                      )
                  )}
                </div>

                {/* Label card */}
                <div className="ep-card">
                  <span className="ep-label">Label <span className="ep-label-cap">(max 20)</span></span>
                  <input
                    type="text" placeholder="Pad label..." maxLength={20}
                    value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  />
                </div>

                {/* Color card */}
                <div className="ep-card">
                  <span className="ep-label">Color</span>
                  <div className="color-row">
                    {COLORS.map(c => (
                      <div
                        key={c}
                        className={`cdot d-${c}${selColor === c ? ' sel' : ''}`}
                        onClick={() => setSelColor(c)}
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="ep-footer">
              {showResetOptions ? (
                <div className="ep-reset-options">
                  <button className="btn btn-danger-outline ep-reset-opt" onClick={handleClearSound}>Clear sound</button>
                  <button className="btn btn-danger-outline ep-reset-opt" onClick={handleClearIcon}>Clear icon</button>
                  <button className="btn btn-danger-outline ep-reset-opt" onClick={handleResetPad}>Reset pad</button>
                  <button className="btn btn-outline ep-reset-opt-cancel" onClick={() => setShowResetOptions(false)}>✕</button>
                </div>
              ) : (
                <>
                  <button className="btn btn-danger-outline" onClick={() => setShowResetOptions(true)}>
                    Reset
                  </button>
                  <div className="ep-footer-right">
                    <button className="btn btn-outline" onClick={handleCancelEdit}>Cancel</button>
                    <button className="btn btn-solid" onClick={handleSave}>Save</button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Bottom bar — email + sign out */}
      <div className="reset-all-section">
        {!showSignOutConfirm ? (
          <div className="bottom-bar">
            <span className="user-email">{user.email}</span>
            <button className="btn btn-outline" onClick={() => setShowSignOutConfirm(true)}>Sign out</button>
          </div>
        ) : (
          <div>
            <span className="reset-confirm-msg">
              You'll be signed out of your soundboard. Are you sure?
            </span>
            <div className="reset-confirm-actions">
              <button className="btn btn-outline" onClick={() => setShowSignOutConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleSignOut}>Yes, sign out</button>
            </div>
          </div>
        )}
      </div>

      {/* Page footer */}
      <footer className="sb-footer">
        <div className="sb-footer-links">
          <a href="/about" className="sb-footer-link sb-footer-link--brand">About the App</a>
          <span className="sb-footer-sep">|</span>
          <a
            href="https://www.linkedin.com/in/sageashique"
            target="_blank"
            rel="noopener noreferrer"
            className="sb-footer-link sb-footer-link--brand"
          >
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Built by Sage Ashique
          </a>
        </div>
      </footer>
    </div>
  )
}
