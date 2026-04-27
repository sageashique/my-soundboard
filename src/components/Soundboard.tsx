'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { defaultPads, SOUND_ICONS, SOUND_LABELS, PAD_KEYS } from '@/lib/constants'
import { playSound } from '@/lib/sounds'
import type { ModalState, PadState, PendingFile } from '@/lib/types'
import Pad, { type PadHandle } from './Pad'
import EditPanel from './EditPanel'
import CustomTrackSection from './CustomTrackSection'
import Modal from './Modal'

const STORAGE_BUCKET = 'custom-tracks'

interface Props { user: User }

export default function Soundboard({ user }: Props) {
  const [pads, setPads] = useState<PadState[]>(defaultPads)
  const [selPad, setSelPad] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [selColor, setSelColor] = useState('red')
  const [overlapMode, setOverlapMode] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [statusMsg, setStatusMsg] = useState('Ready')
  const [statusActive, setStatusActive] = useState(false)

  // Custom track section state
  const [selectedPadIdx, setSelectedPadIdx] = useState('')
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [trackLabel, setTrackLabel] = useState('')
  const [trackEmoji, setTrackEmoji] = useState('')

  const [modal, setModal] = useState<ModalState | null>(null)
  const [dbLoading, setDbLoading] = useState(true)

  // Audio
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)

  // Pad element refs for animation
  const padRefs = useRef<(PadHandle | null)[]>(Array(16).fill(null))

  // Keyboard held keys
  const heldRef = useRef(new Set<string>())

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
  function setStatus(msg: string, active = false) {
    setStatusMsg(msg)
    setStatusActive(active)
  }

  // ── Volume ─────────────────────────────────────────────────────
  function handleVolume(v: number) {
    setVolume(v)
    if (masterRef.current) masterRef.current.gain.value = v
  }

  // ── Fire a pad ─────────────────────────────────────────────────
  const fire = useCallback((index: number) => {
    const a = getAC()
    const p = pads[index]

    if (!overlapMode && currentSourceRef.current) {
      try { currentSourceRef.current.stop() } catch { /* already stopped */ }
      currentSourceRef.current = null
    }

    let src: AudioBufferSourceNode | null = null
    if (p.customBuf && masterRef.current) {
      const s = a.createBufferSource()
      s.buffer = p.customBuf
      s.connect(masterRef.current)
      s.start()
      src = s
    } else if (masterRef.current) {
      src = playSound(p.sound, a, masterRef.current)
    }

    if (!overlapMode) currentSourceRef.current = src

    padRefs.current[index]?.flash()
    setStatus(`${p.icon} ${p.label}`, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode])

  // ── Pick pad in edit mode ───────────────────────────────────────
  function pickPad(index: number) {
    setSelPad(index)
    setSelColor(pads[index].color)
    setStatus(`Pad ${index + 1} selected`)
  }

  // ── Edit panel handlers ─────────────────────────────────────────
  function handleSoundChange(sound: string) {
    if (selPad === null) return
    setPads(prev => prev.map((p, i) => i === selPad
      ? { ...p, sound, icon: SOUND_ICONS[sound] || '🔊', label: p.label === SOUND_LABELS[p.sound] ? SOUND_LABELS[sound] : p.label }
      : p
    ))
  }

  function handleLabelChange(label: string) {
    if (selPad === null) return
    setPads(prev => prev.map((p, i) => i === selPad ? { ...p, label } : p))
  }

  function handleColorChange(color: string) {
    setSelColor(color)
    if (selPad !== null) {
      setPads(prev => prev.map((p, i) => i === selPad ? { ...p, color } : p))
    }
  }

  async function handleEditSave() {
    if (selPad === null) return
    await savePadConfig(selPad)
    setStatus(`Saved → ${pads[selPad].label}`)
  }

  // ── Custom track section handlers ───────────────────────────────
  function handlePadSelect(idx: string) {
    setSelectedPadIdx(idx)
    setPendingFile(null)
    if (idx !== '') {
      const p = pads[parseInt(idx)]
      setTrackLabel(p.label)
      setTrackEmoji(p.customBuf ? p.icon : '')
    }
  }

  async function handleFileSelect(file: File) {
    if (!file.type.startsWith('audio/')) { setStatus('Not an audio file'); return }
    try {
      const raw = await file.arrayBuffer()
      const name = file.name.replace(/\.[^.]+$/, '')
      setPendingFile({ raw, name, size: file.size })
      if (!trackLabel) setTrackLabel(name.slice(0, 14))
      setStatus(`${name} ready`)
    } catch {
      setStatus('Could not read file')
    }
  }

  function handleAssignTrack() {
    if (!pendingFile || selectedPadIdx === '') return
    const idx = parseInt(selectedPadIdx)
    const pad = pads[idx]
    const label = trackLabel || pendingFile.name.slice(0, 14)
    const emoji = trackEmoji.trim() || '🎵'

    const doAssign = async () => {
      try {
        setStatus('Uploading…')
        const storagePath = `${user.id}/pad-${idx}`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, pendingFile!.raw, {
            contentType: 'audio/mpeg',
            upsert: true,
          })
        if (upErr) throw upErr

        const a = getAC()
        const buf = await a.decodeAudioData(pendingFile!.raw.slice(0))

        setPads(prev => prev.map((p, i) => i === idx
          ? { ...p, label, icon: emoji, customBuf: buf, customTrackPath: storagePath, customTrackName: pendingFile!.name }
          : p
        ))

        // Save updated config (use the new values directly)
        await supabase.from('pad_configs').upsert({
          user_id: user.id,
          pad_index: idx,
          sound: pad.sound,
          label,
          color: pad.color,
          icon: emoji,
          custom_track_path: storagePath,
          custom_track_name: pendingFile!.name,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,pad_index' })

        setPendingFile(null)
        setStatus(`Custom track assigned to pad ${idx + 1}`, true)
      } catch (err) {
        setStatus(`Upload failed: ${(err as Error).message}`)
      }
    }

    // If pad already has a custom track, confirm replace
    if (pad.customBuf) {
      const sameNameMsg = pad.customTrackName === pendingFile.name
        ? `"${pendingFile.name}" is already assigned to this pad.`
        : `This pad already has a custom track "${pad.customTrackName}".`
      setModal({
        title: 'Replace custom track?',
        body: `${sameNameMsg} Replace it with "${pendingFile.name}"?`,
        okLabel: 'Replace',
        style: 'confirm',
        cb: doAssign,
      })
    } else {
      setModal({
        title: 'Assign custom track?',
        body: `Assign "${pendingFile.name}" to pad ${idx + 1}? The label will update to "${label}".`,
        okLabel: 'Assign',
        style: 'confirm',
        cb: doAssign,
      })
    }
  }

  function handleResetPad() {
    if (selectedPadIdx === '') return
    const idx = parseInt(selectedPadIdx)
    const pad = pads[idx]
    setModal({
      title: 'Reset to default?',
      body: `Remove the custom track from pad ${idx + 1} and restore its default sound (${SOUND_LABELS[pad.sound]})?`,
      okLabel: 'Reset',
      style: 'danger',
      cb: async () => {
        try {
          const storagePath = `${user.id}/pad-${idx}`
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
          const defLabel = SOUND_LABELS[pad.sound]
          const defIcon = SOUND_ICONS[pad.sound]
          setPads(prev => prev.map((p, i) => i === idx
            ? { ...p, label: defLabel, icon: defIcon, customBuf: null, customTrackPath: null, customTrackName: null }
            : p
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id,
            pad_index: idx,
            sound: pad.sound,
            label: defLabel,
            color: pad.color,
            icon: defIcon,
            custom_track_path: null,
            custom_track_name: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,pad_index' })
          setTrackLabel(defLabel)
          setTrackEmoji('')
          setStatus(`Pad ${idx + 1} reset to default`)
        } catch (err) {
          setStatus(`Reset failed: ${(err as Error).message}`)
        }
      },
    })
  }

  // ── Save a pad config to Supabase ───────────────────────────────
  async function savePadConfig(index: number) {
    const p = pads[index]
    try {
      await supabase.from('pad_configs').upsert({
        user_id: user.id,
        pad_index: index,
        sound: p.sound,
        label: p.label,
        color: p.color,
        icon: p.icon,
        custom_track_path: p.customTrackPath,
        custom_track_name: p.customTrackName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,pad_index' })
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`)
    }
  }

  // ── Load pad configs from Supabase on mount ─────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('pad_configs')
          .select('*')
          .eq('user_id', user.id)
        if (error) throw error
        if (!data || data.length === 0) { setDbLoading(false); return }

        const loaded = defaultPads()
        for (const row of data) {
          const i: number = row.pad_index
          if (i < 0 || i >= 16) continue
          loaded[i] = {
            ...loaded[i],
            sound: row.sound,
            label: row.label,
            color: row.color,
            icon: row.icon,
            customTrackPath: row.custom_track_path ?? null,
            customTrackName: row.custom_track_name ?? null,
            customBuf: null,
          }
        }
        setPads(loaded)
        setDbLoading(false)

        // Download & decode custom audio files in background
        for (const row of data) {
          if (!row.custom_track_path) continue
          const i: number = row.pad_index
          loadCustomAudio(i, row.custom_track_path)
        }
      } catch (err) {
        console.error('Failed to load pad configs:', err)
        setDbLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function loadCustomAudio(padIndex: number, storagePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(storagePath)
      if (error || !data) return
      const raw = await data.arrayBuffer()
      // Use a temporary context so decoding doesn't require user gesture
      const tempCtx = new AudioContext()
      const buf = await tempCtx.decodeAudioData(raw)
      await tempCtx.close()
      setPads(prev => prev.map((p, i) => i === padIndex ? { ...p, customBuf: buf } : p))
    } catch (err) {
      console.warn(`Could not load audio for pad ${padIndex}:`, err)
    }
  }

  // ── Keyboard events ─────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const k = e.key.toLowerCase()
      if (heldRef.current.has(k)) return
      heldRef.current.add(k)
      const idx = PAD_KEYS.indexOf(k)
      if (idx !== -1) {
        e.preventDefault()
        if (editing && selPad !== idx) {
          pickPad(idx)
        } else if (!editing) {
          fire(idx)
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) { heldRef.current.delete(e.key.toLowerCase()) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode, editing, selPad])

  // ── Sign out ────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  // ── Modal ───────────────────────────────────────────────────────
  function dismissModal() { setModal(null) }
  function confirmModal() {
    const cb = modal?.cb
    setModal(null)
    cb?.()
  }

  // ── Edit mode toggle ────────────────────────────────────────────
  function toggleEditing() {
    if (editing) {
      setEditing(false)
      setSelPad(null)
      setStatus('Ready')
    } else {
      setEditing(true)
      setStatus('Tap a pad to configure it')
    }
  }

  if (dbLoading) return <div className="loading-screen">Loading your board…</div>

  const editedPad = selPad !== null ? pads[selPad] : null

  return (
    <div className="sb-page">
      {modal && <Modal modal={modal} onCancel={dismissModal} onConfirm={confirmModal} />}

      {/* Header */}
      <div className="top">
        <div className="wordmark">Soundboard</div>
        <div className="top-right">
          <div className="user-row">
            <span className="user-email">{user.email}</span>
            <button className="btn btn-outline" onClick={handleSignOut}>Sign out</button>
          </div>
          <div className="vol-row">
            <span>Vol</span>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={volume}
              onChange={e => handleVolume(parseFloat(e.target.value))}
            />
          </div>
          <span className={`status-msg${statusActive ? ' on' : ''}`}>{statusMsg}</span>
        </div>
      </div>

      {/* Pad grid */}
      <div className="numpad">
        {pads.map((pad, i) => (
          <Pad
            key={i}
            ref={el => { padRefs.current[i] = el }}
            pad={pad}
            selected={selPad === i}
            onClick={() => editing ? pickPad(i) : fire(i)}
          />
        ))}
      </div>

      <div className="divider" />

      {/* Controls bar */}
      <div className="controls-bar">
        <button
          className={`btn btn-outline${editing ? ' on' : ''}`}
          onClick={toggleEditing}
        >
          {editing ? 'Done editing' : 'Edit mode'}
        </button>
        <div className="vsep" />
        <div className="toggle-group">
          <span className="toggle-label">Sound overlap</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={overlapMode}
              onChange={e => {
                setOverlapMode(e.target.checked)
                setStatus(e.target.checked ? 'Sound overlap on' : 'Sound overlap off')
              }}
            />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>
      </div>

      {/* Edit panel */}
      {editing && editedPad && (
        <EditPanel
          pad={editedPad}
          selColor={selColor}
          onSoundChange={handleSoundChange}
          onLabelChange={handleLabelChange}
          onColorChange={handleColorChange}
          onSave={handleEditSave}
        />
      )}

      {/* Custom tracks */}
      <CustomTrackSection
        pads={pads}
        selectedPad={selectedPadIdx}
        pendingFile={pendingFile}
        onPadSelect={handlePadSelect}
        onFileSelect={handleFileSelect}
        onLabelChange={setTrackLabel}
        onEmojiChange={setTrackEmoji}
        trackLabel={trackLabel}
        trackEmoji={trackEmoji}
        onAssign={handleAssignTrack}
        onReset={handleResetPad}
      />
    </div>
  )
}
