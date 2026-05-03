'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { defaultPads, SOUND_ICONS, SOUND_LABELS, COLORS, KEY_TO_INDEX, getDefaultForIndex } from '@/lib/constants'
import { playSound } from '@/lib/sounds'
import type { ModalState, PadState } from '@/lib/types'
import Pad, { type PadHandle } from './Pad'
import Modal from './Modal'
import dynamic from 'next/dynamic'

const EmojiPicker = dynamic(() => import('@emoji-mart/react'), { ssr: false })

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
  const [volume, setVolume] = useState(0.8)

  // Status
  const [statusMsg, setStatusMsg] = useState('Ready')
  const [statusState, setStatusState] = useState<'idle' | 'active' | 'stopped'>('idle')

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Board name
  const emailPrefix = user.email?.split('@')[0] ?? 'my'
  const defaultBoardName = `${emailPrefix.toUpperCase()}'S SOUNDBOARD`
  const [boardName, setBoardName] = useState(defaultBoardName)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(defaultBoardName)

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
  const activeHtmlAudiosRef = useRef<Set<HTMLAudioElement>>(new Set())

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
    activeHtmlAudiosRef.current.forEach(a => { try { a.pause(); a.currentTime = 0 } catch { /* already ended */ } })
    activeHtmlAudiosRef.current.clear()
    currentSourceRef.current = null
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
      activeHtmlAudiosRef.current.forEach(a => { try { a.pause(); a.currentTime = 0 } catch { /* already ended */ } })
      activeHtmlAudiosRef.current.clear()
      currentSourceRef.current = null
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
        activeHtmlAudiosRef.current.add(htmlAudio)
        htmlAudio.play()
          .then(() => setStatus(`${p.icon} ${p.label}`, 'active'))
          .catch(() => setStatus('Could not play audio', 'stopped'))
        htmlAudio.onended = () => {
          URL.revokeObjectURL(url)
          activeHtmlAudiosRef.current.delete(htmlAudio)
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
      activeSourcesRef.current.forEach(node => {
        if (!prevNodes.has(node)) {
          node.onended = () => {
            activeSourcesRef.current.delete(node)
            if (currentSourceRef.current === node) currentSourceRef.current = null
            if (activeSourcesRef.current.size === 0 && activeHtmlAudiosRef.current.size === 0) setStatus('Ready', 'idle')
          }
        }
      })
      if (src && !overlapMode) currentSourceRef.current = src
    }

    setStatus(`${p.icon} ${p.label}`, 'active')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode, volume])

  // ── Board name ─────────────────────────────────────────────────
  function startEditName() {
    setNameInput(boardName)
    setEditingName(true)
  }
  async function saveNameHandler() {
    const val = nameInput.trim().toUpperCase() || defaultBoardName
    setBoardName(val)
    setEditingName(false)
    try {
      await supabase.from('user_settings').upsert(
        { user_id: user.id, board_name: val, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    } catch (err) {
      console.error('Failed to save board name:', err)
    }
  }
  function cancelEditName() {
    setEditingName(false)
    setNameInput(boardName)
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
    setStatus(`Pad [${p.keyLabel}] selected`)
  }

  // ── Save pad ───────────────────────────────────────────────────
  async function handleSave() {
    if (selPad === null) return
    const p = pads[selPad]

    if (useCustomSource) {
      if (!pendingRawRef.current && !p.customBuf) { setStatus('Drop an audio file first'); return }
      const label = editLabel || pendingFileName || 'Custom'
      const emoji = editEmoji.trim() || '🎵'

      if (pendingFileName && pendingRawRef.current) {
        try {
          setStatus('Uploading…')
          const storagePath = `${user.id}/pad-${selPad}`
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, pendingRawRef.current, { contentType: pendingFileTypeRef.current, upsert: true })
          if (upErr) throw upErr

          const rawCopy = pendingRawRef.current.slice(0)
          setPads(prev => prev.map((pd, i) => i === selPad
            ? { ...pd, label, icon: emoji, customBuf: pendingBuf ?? null, customRawBuf: rawCopy, customTrackPath: storagePath, customTrackName: pendingFileName!, color: selColor, customGain: pendingGain } as PadState
            : pd
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id, pad_index: selPad,
            sound: p.sound, label, color: selColor, icon: emoji,
            custom_track_path: storagePath, custom_track_name: pendingFileName,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,pad_index' })

          setPendingBuf(null); setPendingFileName(null); pendingRawRef.current = null
          setStatus(`Saved → [${p.keyLabel}] ${label}`, 'active')
        } catch (err) {
          setStatus(`Upload failed: ${(err as Error).message}`)
          return
        }
      } else {
        const label2 = editLabel || p.label
        const emoji2 = editEmoji.trim() || p.icon
        setPads(prev => prev.map((pd, i) => i === selPad ? { ...pd, label: label2, icon: emoji2, color: selColor } : pd))
        await supabase.from('pad_configs').upsert({
          user_id: user.id, pad_index: selPad,
          sound: p.sound, label: label2, color: selColor, icon: emoji2,
          custom_track_path: p.customTrackPath, custom_track_name: p.customTrackName,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,pad_index' })
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
        ? { ...pd, sound: editSound, label, icon, color: selColor, customBuf: null, customRawBuf: null, customTrackPath: null, customTrackName: null, customGain: 1 }
        : pd
      ))
      await supabase.from('pad_configs').upsert({
        user_id: user.id, pad_index: selPad,
        sound: editSound, label, color: selColor, icon,
        custom_track_path: null, custom_track_name: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,pad_index' })
      setStatus(`Saved → [${p.keyLabel}] ${label}`, 'active')
    }
    setSelPad(null)
  }

  // ── Reset pad ──────────────────────────────────────────────────
  function handleResetPad() {
    if (selPad === null) return
    const p = pads[selPad]
    setModal({
      title: 'Reset pad?',
      body: `Reset this pad to its default sound? Your custom audio will be removed.`,
      okLabel: 'Reset',
      style: 'danger',
      cb: async () => {
        const def = getDefaultForIndex(selPad)
        if (!def) return
        try {
          if (p.customTrackPath) {
            await supabase.storage.from(STORAGE_BUCKET).remove([p.customTrackPath])
          }
          setPads(prev => prev.map((pd, i) => i === selPad
            ? { ...pd, sound: def.sound, label: def.defaultLabel, icon: def.icon, color: def.color, customBuf: null, customRawBuf: null, customTrackPath: null, customTrackName: null, customGain: 1 }
            : pd
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id, pad_index: selPad,
            sound: def.sound, label: def.defaultLabel, color: def.color, icon: def.icon,
            custom_track_path: null, custom_track_name: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,pad_index' })
          setUseCustomSource(false)
          setEditSound(def.sound)
          setEditLabel(def.defaultLabel)
          setEditEmoji('')
          setSelColor(def.color)
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
      // Delete all pad configs from DB so they don't reload on refresh
      await supabase.from('pad_configs').delete().eq('user_id', user.id)
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

  // ── Load pad configs + board name from Supabase ─────────────────
  useEffect(() => {
    async function load() {
      try {
        // Load user settings
        const { data: settings } = await supabase
          .from('user_settings').select('board_name, theme').eq('user_id', user.id).single()
        if (settings?.board_name) {
          setBoardName(settings.board_name)
          setNameInput(settings.board_name)
        }
        if (settings?.theme === 'light' || settings?.theme === 'dark') {
          setTheme(settings.theme)
        }

        // Load pad configs
        const { data, error } = await supabase
          .from('pad_configs').select('*').eq('user_id', user.id)
        if (error) throw error
        if (!data || data.length === 0) { setDbLoading(false); return }

        const loaded = defaultPads()
        for (const row of data) {
          const i: number = row.pad_index
          if (i < 0 || i >= loaded.length) continue
          loaded[i] = {
            ...loaded[i],
            sound: row.sound, label: row.label, color: row.color, icon: row.icon,
            customTrackPath: row.custom_track_path ?? null,
            customTrackName: row.custom_track_name ?? null,
            customBuf: null,
          }
        }
        setPads(loaded)

        // Download all custom audio and compute normalization gain before
        // revealing the board — user sees a ready, fully-normalized board.
        await Promise.all(
          data
            .filter(row => row.custom_track_path)
            .map(row => loadCustomAudio(row.pad_index, row.custom_track_path))
        )
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
            <span className="sb-appname">[sage]SOUNDS</span>
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

        {/* Meta row: Board name (left) | Help (right) */}
        {!editingName ? (
          <div className="top-meta-row">
            <span className="wordmark" onClick={startEditName} title="Click to rename">
              {boardName}
            </span>
            <button className="help-btn" onClick={() => setShowHelp(true)}>
              <span className="help-btn-badge">?</span>
              Help
            </button>
          </div>
        ) : (
          <div className="wordmark-edit">
            <input
              className="wordmark-input"
              value={nameInput}
              maxLength={30}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveNameHandler(); if (e.key === 'Escape') cancelEditName() }}
              autoFocus
            />
            <button className="btn btn-solid btn-sm" onClick={saveNameHandler}>Save</button>
            <button className="btn btn-outline btn-sm" onClick={cancelEditName}>Cancel</button>
          </div>
        )}
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
                <div className="help-section-title">Volume &amp; overlap</div>
                <p>Use the volume slider to control master output. Toggle <strong>Sound Overlap</strong> to let sounds layer on top of each other instead of cutting off.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Editing a pad</div>
                <p>Press <strong>Edit Pads</strong> to enter edit mode, then tap any pad to configure it. Switch to <strong>Custom</strong> to upload your own audio file (MP3, WAV, or M4A; max 10 MB) — great for dropping in samples, drops, or any sound you want at your fingertips. On <strong>Built-in</strong>, choose from 14 synthesized sounds. Either way, you can set a custom label, color, and emoji.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Board name</div>
                <p>Click your board name in the top-left to rename it. Changes save automatically.</p>
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
          <span className="pad-stop-icon">⏹</span>
          <span className="pad-stop-label">Stop</span>
          <span className="pad-stop-key">Space</span>
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
            {statusMsg}
          </span>
        )}
      </div>

      <div className="divider" />

      {/* Controls row 1: Sound Overlap (left) + Volume (right) */}
      <div className="controls-bar controls-bar-split">
        <div className="toggle-group">
          <span className="toggle-label">Sound Overlap</span>
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
        <div className="vol-pill">
          <span className="vol-label">Vol</span>
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={e => handleVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="divider" />

      {/* Controls row 2: Theme toggle + Edit Pads */}
      <div className="controls-bar controls-bar-split">
        <div className="ctrl-toggle">
          <button
            className={`ctrl-btn${theme === 'light' ? ' active' : ''}`}
            onClick={() => handleThemeToggle('light')}
          >Light</button>
          <button
            className={`ctrl-btn${theme === 'dark' ? ' active' : ''}`}
            onClick={() => handleThemeToggle('dark')}
          >Dark</button>
        </div>
        <button
          className={`btn${editing ? ' btn-edit-active' : ' btn-outline'}`}
          onClick={() => {
            if (editing) { setEditing(false); setSelPad(null); setStatus('Ready') }
            else setEditing(true)
          }}
        >
          Edit Pads
        </button>
      </div>

      {/* Reset All — only visible in edit mode, lives under theme/edit controls */}
      {editing && (
        <div className="controls-bar controls-reset-row">
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
        </div>
      )}

      {/* Edit Pad Modal */}
      {editing && selectedPad && (
        <div className="ep-overlay" onClick={handleCancelEdit}>
          <div className="ep-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="ep-header">
              <span className="ep-title">
                Edit Pad <span className="ep-key">[{selectedPad.keyLabel}]</span>
              </span>
              <button className="ep-close" onClick={handleCancelEdit} aria-label="Close">✕</button>
            </div>

            {/* Body */}
            <div className="ep-body">

              {/* Live preview */}
              <div className="ep-preview">
                <div className={`ep-preview-pad c-${selColor}`}>
                  <span className="ep-preview-key">{selectedPad.keyLabel}</span>
                  <span className="ep-preview-icon">
                    {editEmoji || SOUND_ICONS[editSound] || '🎵'}
                  </span>
                  <span className="ep-preview-label">{editLabel || selectedPad.label}</span>
                </div>
                <p className="ep-preview-hint">Live preview</p>
              </div>

              {/* Controls */}
              <div className="ep-controls">

                {/* Source */}
                <div className="ep-group">
                  <span className="ep-label">Source</span>
                  <div className="ep-source-toggle">
                    <button className={`ep-src-btn${!useCustomSource ? ' active' : ''}`} onClick={() => setUseCustomSource(false)}>Built-in</button>
                    <button className={`ep-src-btn${useCustomSource ? ' active' : ''}`} onClick={() => setUseCustomSource(true)}>Custom</button>
                  </div>
                </div>

                {/* Built-in sound */}
                {!useCustomSource && (
                  <div className="ep-group">
                    <span className="ep-label">Sound</span>
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

                {/* Custom audio upload */}
                {useCustomSource && (
                  <div className="ep-group">
                    <span className="ep-label">Audio</span>
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

                {/* Emoji */}
                <div className="ep-group">
                  <span className="ep-label">Emoji</span>
                  <div className="emoji-picker-wrap" ref={emojiPickerRef}>
                    <button
                      className="emoji-trigger"
                      onClick={() => setShowEmojiPicker(p => !p)}
                      title="Pick emoji"
                    >
                      {editEmoji || SOUND_ICONS[editSound] || '🎵'}
                    </button>
                    {showEmojiPicker && (
                      <div className="emoji-popover">
                        <EmojiPicker
                          data={async () => (await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data')).json()}
                          onEmojiSelect={(e: { native: string }) => {
                            setEditEmoji(e.native)
                            setShowEmojiPicker(false)
                          }}
                          theme="light"
                          previewPosition="none"
                          skinTonePosition="none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Label */}
                <div className="ep-group">
                  <span className="ep-label">Label</span>
                  <input
                    type="text" placeholder="Pad label..." maxLength={20}
                    value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  />
                </div>

                {/* Color */}
                <div className="ep-group">
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
              <button className="btn btn-danger-outline" onClick={handleResetPad}>
                Reset Pad
              </button>
              <div className="ep-footer-right">
                <button className="btn btn-outline" onClick={handleCancelEdit}>Cancel</button>
                <button className="btn btn-solid" onClick={handleSave}>Save</button>
              </div>
            </div>

          </div>
        </div>
      )}

      <div className="divider" />

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
      </footer>
    </div>
  )
}
