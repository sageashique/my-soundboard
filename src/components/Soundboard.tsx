'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { defaultPads, SOUNDS, SOUND_ICONS, SOUND_LABELS, COLORS, KEY_TO_INDEX, getDefaultForIndex } from '@/lib/constants'
import { playSound } from '@/lib/sounds'
import type { ModalState, PadState, PendingFile } from '@/lib/types'
import Pad, { type PadHandle } from './Pad'
import Modal from './Modal'

const STORAGE_BUCKET = 'custom-tracks'

interface Props { user: User }
type StatusState = 'idle' | 'active' | 'stopped'

export default function Soundboard({ user }: Props) {
  const [pads, setPads] = useState<PadState[]>(defaultPads)
  const [selPad, setSelPad] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [selColor, setSelColor] = useState('red')
  const [overlapMode, setOverlapMode] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [statusMsg, setStatusMsg] = useState('Ready')
  const [statusState, setStatusState] = useState<StatusState>('idle')

  // Unified edit panel state
  const [useCustomSource, setUseCustomSource] = useState(false)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [dzDragOver, setDzDragOver] = useState(false)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editSound, setEditSound] = useState('kick')

  const [modal, setModal] = useState<ModalState | null>(null)
  const [dbLoading, setDbLoading] = useState(true)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Audio refs
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const volumeRef = useRef(0.8)
  const currentSourceRef = useRef<AudioBufferSourceNode | OscillatorNode | null>(null)
  const activeSourcesRef = useRef(new Set<AudioBufferSourceNode | OscillatorNode>())

  // DOM refs
  const padRefs = useRef<(PadHandle | null)[]>(Array(14).fill(null))
  const stopBarRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const heldRef = useRef(new Set<string>())

  // ── Audio context ──────────────────────────────────────────────
  function getAC(): AudioContext {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctxRef.current = new AC()
      masterRef.current = ctxRef.current.createGain()
      masterRef.current.gain.value = volumeRef.current
      masterRef.current.connect(ctxRef.current.destination)
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  function handleVolume(v: number) {
    setVolume(v)
    volumeRef.current = v
    if (masterRef.current) masterRef.current.gain.value = v
  }

  // ── Stop all ───────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (masterRef.current && ctxRef.current) {
      const t = ctxRef.current.currentTime
      const restore = volumeRef.current
      masterRef.current.gain.cancelScheduledValues(t)
      masterRef.current.gain.setValueAtTime(0, t)
      setTimeout(() => {
        if (masterRef.current && ctxRef.current)
          masterRef.current.gain.setValueAtTime(restore, ctxRef.current.currentTime)
      }, 80)
    }
    activeSourcesRef.current.forEach(s => { try { s.stop() } catch { /* already stopped */ } })
    activeSourcesRef.current.clear()
    currentSourceRef.current = null
    const el = stopBarRef.current
    if (el) { el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire'); setTimeout(() => el.classList.remove('fire'), 200) }
    setStatusMsg('⏹ Stopped')
    setStatusState('stopped')
  }, [])

  // ── Fire a pad ─────────────────────────────────────────────────
  const fire = useCallback((index: number) => {
    const a = getAC()
    const p = pads[index]

    if (!overlapMode && currentSourceRef.current) {
      try { currentSourceRef.current.stop() } catch { /* already stopped */ }
      currentSourceRef.current = null
    }

    let src: AudioBufferSourceNode | OscillatorNode | null = null
    if (p.customBuf && masterRef.current) {
      const s = a.createBufferSource()
      s.buffer = p.customBuf
      s.connect(masterRef.current)
      s.start()
      src = s
    } else if (masterRef.current) {
      src = playSound(p.sound, a, masterRef.current)
    }

    if (src) {
      activeSourcesRef.current.add(src)
      const captured = src
      src.onended = () => {
        activeSourcesRef.current.delete(captured)
        if (activeSourcesRef.current.size === 0) {
          setStatusMsg('Ready')
          setStatusState('idle')
        }
      }
    }
    if (!overlapMode) currentSourceRef.current = src

    padRefs.current[index]?.flash()
    setStatusMsg(`${p.icon} ${p.label}`)
    setStatusState('active')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode])

  // ── Pick pad in edit mode ───────────────────────────────────────
  function pickPad(index: number) {
    const p = pads[index]
    setSelPad(index)
    setSelColor(p.color)
    setUseCustomSource(!!p.customBuf)
    setEditLabel(p.label)
    setEditEmoji(p.customBuf ? p.icon : '')
    setEditSound(p.sound || 'kick')
    setPendingFile(null)
    setStatusMsg(`Pad [${p.keyLabel}] selected`)
    setStatusState('idle')
  }

  // ── Unified save ───────────────────────────────────────────────
  async function handleSave() {
    if (selPad === null) return
    const pad = pads[selPad]
    const label = editLabel.trim()

    if (useCustomSource) {
      if (!pendingFile && !pad.customBuf) { setStatusMsg('Drop an audio file first'); return }

      const doSave = async () => {
        try {
          let buf = pad.customBuf
          let storagePath = pad.customTrackPath ?? `${user.id}/pad-${selPad}`
          let trackName = pad.customTrackName ?? ''

          if (pendingFile) {
            setStatusMsg('Uploading…')
            storagePath = `${user.id}/pad-${selPad}`
            const { error: upErr } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(storagePath, pendingFile.raw, { contentType: 'audio/mpeg', upsert: true })
            if (upErr) throw upErr
            const tempCtx = new AudioContext()
            buf = await tempCtx.decodeAudioData(pendingFile.raw.slice(0))
            await tempCtx.close()
            trackName = pendingFile.name
          }

          const finalLabel = label || trackName || 'Custom'
          const finalEmoji = editEmoji.trim() || '🎵'

          setPads(prev => prev.map((p, i) => i === selPad
            ? { ...p, label: finalLabel, icon: finalEmoji, color: selColor, customBuf: buf, customTrackPath: storagePath, customTrackName: trackName }
            : p
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id, pad_index: selPad,
            sound: pad.sound, label: finalLabel, color: selColor,
            icon: finalEmoji, custom_track_path: storagePath, custom_track_name: trackName,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,pad_index' })

          setPendingFile(null)
          setStatusMsg(`Saved → [${pad.keyLabel}] ${finalLabel}`)
          setStatusState('active')
        } catch (err) {
          setStatusMsg(`Save failed: ${(err as Error).message}`)
          setStatusState('idle')
        }
      }

      if (pendingFile && pad.customBuf) {
        setModal({
          title: 'Replace custom track?',
          body: `Replace "${pad.customTrackName}" with "${pendingFile.name}"?`,
          okLabel: 'Replace', style: 'confirm', cb: doSave,
        })
      } else {
        await doSave()
      }
    } else {
      // Built-in mode
      const doSave = async () => {
        try {
          const finalLabel = label || SOUND_LABELS[editSound]
          const finalIcon = SOUND_ICONS[editSound] || '🔊'

          if (pad.customBuf && pad.customTrackPath)
            await supabase.storage.from(STORAGE_BUCKET).remove([pad.customTrackPath])

          setPads(prev => prev.map((p, i) => i === selPad
            ? { ...p, sound: editSound, label: finalLabel, icon: finalIcon, color: selColor, customBuf: null, customTrackPath: null, customTrackName: null }
            : p
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id, pad_index: selPad,
            sound: editSound, label: finalLabel, color: selColor,
            icon: finalIcon, custom_track_path: null, custom_track_name: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,pad_index' })

          setStatusMsg(`Saved → [${pad.keyLabel}] ${finalLabel}`)
          setStatusState('active')
        } catch (err) {
          setStatusMsg(`Save failed: ${(err as Error).message}`)
          setStatusState('idle')
        }
      }

      if (pad.customBuf) {
        setModal({
          title: 'Switch to built-in?',
          body: `This will remove "${pad.customTrackName}" and switch to ${SOUND_LABELS[editSound]}.`,
          okLabel: 'Switch', style: 'danger', cb: doSave,
        })
      } else {
        await doSave()
      }
    }
  }

  // ── Reset single pad ───────────────────────────────────────────
  function handleResetPad() {
    if (selPad === null) return
    const pad = pads[selPad]
    const def = getDefaultForIndex(selPad)
    setModal({
      title: 'Reset pad?',
      body: `Remove custom track from [${pad.keyLabel}] and restore default (${def.defaultLabel})?`,
      okLabel: 'Reset', style: 'danger',
      cb: async () => {
        try {
          if (pad.customTrackPath)
            await supabase.storage.from(STORAGE_BUCKET).remove([pad.customTrackPath])
          setPads(prev => prev.map((p, i) => i === selPad
            ? { ...p, sound: def.sound, label: def.defaultLabel, icon: def.icon, color: def.color, customBuf: null, customTrackPath: null, customTrackName: null }
            : p
          ))
          await supabase.from('pad_configs').upsert({
            user_id: user.id, pad_index: selPad,
            sound: def.sound, label: def.defaultLabel, color: def.color,
            icon: def.icon, custom_track_path: null, custom_track_name: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,pad_index' })
          setSelColor(def.color)
          setUseCustomSource(false)
          setEditSound(def.sound)
          setEditLabel(def.defaultLabel)
          setEditEmoji('')
          setPendingFile(null)
          setStatusMsg(`Pad [${pad.keyLabel}] reset to default`)
          setStatusState('idle')
        } catch (err) {
          setStatusMsg(`Reset failed: ${(err as Error).message}`)
        }
      },
    })
  }

  // ── Reset all to defaults ──────────────────────────────────────
  async function handleResetAll() {
    stopAll()
    const paths = pads.filter(p => p.customTrackPath).map(p => p.customTrackPath!)
    if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    await supabase.from('pad_configs').delete().eq('user_id', user.id)
    setPads(defaultPads())
    setSelPad(null)
    setEditing(false)
    setShowResetConfirm(false)
    setStatusMsg('All pads reset to defaults')
    setStatusState('idle')
  }

  // ── File drop / select in edit panel ──────────────────────────
  async function handleFileSelect(file: File) {
    if (!file.type.startsWith('audio/')) { setStatusMsg('Not an audio file'); return }
    try {
      const raw = await file.arrayBuffer()
      const name = file.name.replace(/\.[^.]+$/, '')
      setPendingFile({ raw, name, size: file.size })
      if (!editLabel) setEditLabel(name.slice(0, 14))
      setStatusMsg(`${name} ready`)
    } catch {
      setStatusMsg('Could not read file')
    }
  }

  // ── Load pad configs on mount ──────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from('pad_configs').select('*').eq('user_id', user.id)
        if (error) throw error
        if (!data || data.length === 0) { setDbLoading(false); return }
        const loaded = defaultPads()
        for (const row of data) {
          const i: number = row.pad_index
          if (i < 0 || i >= 14) continue
          loaded[i] = { ...loaded[i], sound: row.sound, label: row.label, color: row.color, icon: row.icon, customTrackPath: row.custom_track_path ?? null, customTrackName: row.custom_track_name ?? null, customBuf: null }
        }
        setPads(loaded)
        setDbLoading(false)
        for (const row of data) {
          if (!row.custom_track_path) continue
          loadCustomAudio(row.pad_index, row.custom_track_path)
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
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)
      if (error || !data) return
      const raw = await data.arrayBuffer()
      const tempCtx = new AudioContext()
      const buf = await tempCtx.decodeAudioData(raw)
      await tempCtx.close()
      setPads(prev => prev.map((p, i) => i === padIndex ? { ...p, customBuf: buf } : p))
    } catch (err) {
      console.warn(`Could not load audio for pad ${padIndex}:`, err)
    }
  }

  // ── Keyboard events ────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (heldRef.current.has(e.key)) return
      heldRef.current.add(e.key)
      if (e.key === ' ') { e.preventDefault(); stopAll(); return }
      const idx = KEY_TO_INDEX[e.key]
      if (idx !== undefined) {
        e.preventDefault()
        if (editing && selPad !== idx) pickPad(idx)
        else if (!editing) fire(idx)
      }
    }
    function onKeyUp(e: KeyboardEvent) { heldRef.current.delete(e.key) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode, editing, selPad, fire, stopAll])

  // ── Modal + auth ───────────────────────────────────────────────
  function dismissModal() { setModal(null) }
  function confirmModal() { const cb = modal?.cb; setModal(null); cb?.() }
  async function handleSignOut() { await supabase.auth.signOut() }

  function toggleEditing() {
    if (editing) { setEditing(false); setSelPad(null); setStatusMsg('Ready'); setStatusState('idle') }
    else { setEditing(true); setStatusMsg('Tap a pad to configure it'); setStatusState('idle') }
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
        </div>
      </div>

      {/* Pad grid — row 5 is stop bar */}
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
        <div ref={stopBarRef} className="pad-stop" onClick={stopAll}>
          <span className="pad-stop-icon">⏹</span>
          <span className="pad-stop-label">Stop</span>
          <span className="pad-stop-key">Space</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <span className={`status-pill${statusState !== 'idle' ? ` ${statusState}` : ''}`}>{statusMsg}</span>
      </div>

      <div className="divider" />

      {/* Controls */}
      <div className="controls-bar">
        <div className="toggle-group">
          <span className="toggle-label">Sound overlap</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={overlapMode}
              onChange={e => {
                setOverlapMode(e.target.checked)
                setStatusMsg(e.target.checked ? 'Sound overlap on' : 'Sound overlap off')
              }}
            />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>
      </div>

      <div className="divider" />

      {/* Edit mode toggle */}
      <div className="controls-bar">
        <button className={`btn btn-outline${editing ? ' on' : ''}`} onClick={toggleEditing}>
          {editing ? 'Done' : 'Edit mode'}
        </button>
        {editing && <span className="edit-hint">Tap a pad to configure it</span>}
      </div>

      {/* Unified edit panel */}
      {editing && editedPad && (
        <div className="edit-panel">
          <div className="panel-header">
            <span className="panel-title">Pad [{editedPad.keyLabel}] — {editedPad.label}</span>
          </div>

          {/* Source toggle */}
          <div className="panel-group source-toggle-group">
            <span className="panel-label">Source</span>
            <div className="source-toggle">
              <button
                className={`src-btn${!useCustomSource ? ' active' : ''}`}
                onClick={() => setUseCustomSource(false)}
              >Built-in</button>
              <button
                className={`src-btn${useCustomSource ? ' active' : ''}`}
                onClick={() => setUseCustomSource(true)}
              >Custom</button>
            </div>
          </div>

          {/* Built-in fields */}
          {!useCustomSource && (
            <div className="panel-group">
              <span className="panel-label">Sound</span>
              <select value={editSound} onChange={e => {
                const s = e.target.value
                setEditSound(s)
                if (!editLabel || Object.values(SOUND_LABELS).includes(editLabel))
                  setEditLabel(SOUND_LABELS[s] || '')
              }}>
                {SOUNDS.map(s => (
                  <option key={s} value={s}>{SOUND_ICONS[s]} {SOUND_LABELS[s]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom fields */}
          {useCustomSource && (
            <div className="custom-fields">
              <div className="panel-group">
                <span className="panel-label">Audio</span>
                <div
                  className={`drop-zone${dzDragOver ? ' over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDzDragOver(true) }}
                  onDragLeave={() => setDzDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDzDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
                  />
                  <div className="dz-text">
                    {pendingFile ? (
                      <><strong>{pendingFile.name}</strong><small>{(pendingFile.size / 1024).toFixed(0)} KB · Ready to assign</small></>
                    ) : (
                      <><strong>Drop file here</strong> or click to browse<small>MP3 · WAV · OGG · M4A</small></>
                    )}
                  </div>
                </div>
              </div>
              <div className="panel-group" style={{ marginTop: 8 }}>
                <span className="panel-label">Emoji</span>
                <input
                  type="text"
                  className="emoji-input"
                  value={editEmoji}
                  onChange={e => setEditEmoji(e.target.value)}
                  placeholder="🎵"
                  maxLength={2}
                />
              </div>
            </div>
          )}

          {/* Shared fields */}
          <div className="panel-group">
            <span className="panel-label">Label</span>
            <input
              type="text"
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
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
                  onClick={() => setSelColor(c)}
                  role="radio"
                  aria-checked={selColor === c}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="panel-actions">
            <button
              className="btn btn-danger-outline"
              disabled={!editedPad.customBuf}
              onClick={handleResetPad}
            >Reset pad</button>
            <button
              className="btn btn-solid"
              disabled={useCustomSource && !pendingFile && !editedPad.customBuf}
              onClick={handleSave}
            >Save</button>
          </div>
        </div>
      )}

      <div className="divider" />

      {/* Reset all */}
      <div className="reset-all-section">
        {!showResetConfirm ? (
          <button className="btn btn-danger-outline" onClick={() => setShowResetConfirm(true)}>
            Reset all to defaults
          </button>
        ) : (
          <>
            <span className="reset-confirm-msg">This will clear all custom sounds, labels, and colors. Are you sure?</span>
            <div className="reset-confirm-actions">
              <button className="btn btn-outline" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleResetAll}>Yes, reset everything</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
