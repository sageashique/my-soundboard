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

interface Props { user: User }

export default function Soundboard({ user }: Props) {
  const [pads, setPads] = useState<PadState[]>(defaultPads)
  const [selPad, setSelPad] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [selColor, setSelColor] = useState('red')
  const [overlapMode, setOverlapMode] = useState(false)
  const [volume, setVolume] = useState(0.8)

  // Status: idle | active | stopped
  const [statusMsg, setStatusMsg] = useState('Ready')
  const [statusState, setStatusState] = useState<'idle' | 'active' | 'stopped'>('idle')

  // Unified edit panel state
  const [useCustomSource, setUseCustomSource] = useState(false)
  const [pendingBuf, setPendingBuf] = useState<AudioBuffer | null>(null)
  const [pendingFileName, setPendingFileName] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editSound, setEditSound] = useState('kick')

  // Reset all confirm
  const [showResetConfirm, setShowResetConfirm] = useState(false)

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

  // Pad refs for flash animation
  const padRefs = useRef<(PadHandle | null)[]>([])

  // Keyboard held keys
  const heldRef = useRef(new Set<string>())

  // Raw audio buffer for upload
  const pendingRawRef = useRef<ArrayBuffer | null>(null)

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
    currentSourceRef.current = null
    setStatus('⏹ Stopped', 'stopped')
  }, [volume])

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
    } else if (p.customRawBuf && masterRef.current) {
      // First tap after load — decode using the live AudioContext (requires user gesture)
      const raw = p.customRawBuf
      const master = masterRef.current
      const capturedIndex = index
      a.decodeAudioData(raw.slice(0)).then(buf => {
        // Cache so subsequent fires skip decoding
        setPads(prev => prev.map((pd, i) => i === capturedIndex ? { ...pd, customBuf: buf } : pd))
        const s = a.createBufferSource()
        s.buffer = buf
        s.connect(master)
        s.start()
        activeSourcesRef.current.add(s)
        if (!overlapMode) currentSourceRef.current = s
        s.onended = () => {
          activeSourcesRef.current.delete(s)
          if (activeSourcesRef.current.size === 0) { setStatusMsg('Ready'); setStatusState('idle') }
        }
      }).catch(() => { setStatusMsg('Could not decode audio'); setStatusState('idle') })
      setStatus(`${p.icon} ${p.label}`, 'active')
      return
    } else if (masterRef.current) {
      src = playSound(p.sound, a, masterRef.current)
    }

    if (src) {
      activeSourcesRef.current.add(src)
      src.onended = () => {
        activeSourcesRef.current.delete(src!)
        if (activeSourcesRef.current.size === 0) setStatus('Ready', 'idle')
      }
    }

    if (!overlapMode) currentSourceRef.current = src
    setStatus(`${p.icon} ${p.label}`, 'active')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, overlapMode])

  // ── Pick pad in edit mode ───────────────────────────────────────
  function pickPad(index: number) {
    const p = pads[index]
    setSelPad(index)
    setSelColor(p.color)
    setUseCustomSource(!!(p.customBuf || p.customRawBuf))
    setEditSound(p.sound || 'kick')
    setEditLabel(p.label)
    setEditEmoji(p.customBuf ? p.icon : '')
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
      if (!pendingBuf && !p.customBuf) { setStatus('Drop an audio file first'); return }
      const label = editLabel || pendingFileName || 'Custom'
      const emoji = editEmoji.trim() || '🎵'

      if (pendingBuf && pendingFileName && pendingRawRef.current) {
        try {
          setStatus('Uploading…')
          const storagePath = `${user.id}/pad-${selPad}`
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, pendingRawRef.current, { contentType: 'audio/mpeg', upsert: true })
          if (upErr) throw upErr

          setPads(prev => prev.map((pd, i) => i === selPad
            ? { ...pd, label, icon: emoji, customBuf: pendingBuf!, customRawBuf: pendingRawRef.current, customTrackPath: storagePath, customTrackName: pendingFileName!, color: selColor }
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
        // Update label/emoji/color only on existing custom track
        setPads(prev => prev.map((pd, i) => i === selPad ? { ...pd, label, icon: emoji, color: selColor } : pd))
        await supabase.from('pad_configs').upsert({
          user_id: user.id, pad_index: selPad,
          sound: p.sound, label, color: selColor, icon: emoji,
          custom_track_path: p.customTrackPath, custom_track_name: p.customTrackName,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,pad_index' })
        setStatus(`Saved → [${p.keyLabel}] ${label}`, 'active')
      }
    } else {
      // Built-in sound
      const label = editLabel || SOUND_LABELS[editSound]
      const icon = SOUND_ICONS[editSound] || '🔊'
      setPads(prev => prev.map((pd, i) => i === selPad
        ? { ...pd, sound: editSound, label, icon, color: selColor, customBuf: null, customRawBuf: null, customTrackPath: null, customTrackName: null }
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
  }

  // ── Reset pad ──────────────────────────────────────────────────
  function handleResetPad() {
    if (selPad === null) return
    const p = pads[selPad]
    setModal({
      title: 'Reset pad?',
      body: `Remove custom track from [${p.keyLabel}] and restore its default sound?`,
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
            ? { ...pd, sound: def.sound, label: def.defaultLabel, icon: def.icon, color: def.color, customBuf: null, customRawBuf: null, customTrackPath: null, customTrackName: null }
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
        } catch (err) {
          setStatus(`Reset failed: ${(err as Error).message}`)
        }
      },
    })
  }

  // ── Reset all ─────────────────────────────────────────────────
  function handleResetAll() {
    stopAll()
    setPads(defaultPads)
    setSelPad(null)
    setEditing(false)
    setShowResetConfirm(false)
    setStatus('All pads reset to defaults')
  }

  // ── File upload ────────────────────────────────────────────────
  async function handleFile(file: File) {
    if (!file.type.startsWith('audio/')) { setStatus('Not an audio file'); return }
    try {
      const raw = await file.arrayBuffer()
      const a = getAC()
      const buf = await a.decodeAudioData(raw.slice(0))
      pendingRawRef.current = raw
      setPendingBuf(buf)
      const name = file.name.replace(/\.[^.]+$/, '')
      setPendingFileName(name)
      if (!editLabel) setEditLabel(name.slice(0, 14))
    } catch {
      setStatus('Could not decode audio file')
    }
  }

  // ── Load pad configs from Supabase on mount ─────────────────────
  useEffect(() => {
    async function load() {
      try {
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
      // Store raw bytes only — decode happens on first fire after a user gesture
      setPads(prev => prev.map((p, i) => i === padIndex ? { ...p, customRawBuf: raw } : p))
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

  // ── Modal ───────────────────────────────────────────────────────
  function dismissModal() { setModal(null) }
  function confirmModal() { const cb = modal?.cb; setModal(null); cb?.() }

  if (dbLoading) return <div className="loading-screen">Loading your board…</div>

  const selectedPad = selPad !== null ? pads[selPad] : null

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
        <span className={`status-pill${statusState !== 'idle' ? ` ${statusState}` : ''}`}>
          {statusMsg}
        </span>
      </div>

      <div className="divider" />

      {/* Controls bar: vol + sound overlap */}
      <div className="controls-bar">
        <div className="vol-row">
          <span>Vol</span>
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={e => handleVolume(parseFloat(e.target.value))}
          />
        </div>
        <div className="vsep" />
        <div className="toggle-group">
          <span className="toggle-label">Sound overlap</span>
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
      </div>

      <div className="divider" />

      {/* Edit mode toggle */}
      <div className="controls-bar">
        <button
          className={`btn btn-outline${editing ? ' on' : ''}`}
          onClick={() => {
            if (editing) { setEditing(false); setSelPad(null); setStatus('Ready') }
            else { setEditing(true); setStatus('Tap a pad to configure it') }
          }}
        >
          {editing ? 'Done' : 'Edit mode'}
        </button>
        {editing && <span className="edit-hint">Tap a pad to configure it</span>}
      </div>

      {/* Unified config panel */}
      {editing && selectedPad && (
        <div className="edit-panel">
          <div className="panel-header">
            <span className="panel-title">Pad [{selectedPad.keyLabel}] — {selectedPad.label}</span>
          </div>

          {/* Source toggle */}
          <div className="panel-group source-toggle-group">
            <span className="panel-label">Source</span>
            <div className="source-toggle">
              <button className={`src-btn${!useCustomSource ? ' active' : ''}`} onClick={() => setUseCustomSource(false)}>Built-in</button>
              <button className={`src-btn${useCustomSource ? ' active' : ''}`} onClick={() => setUseCustomSource(true)}>Custom</button>
            </div>
          </div>

          {/* Built-in fields */}
          {!useCustomSource && (
            <div className="panel-group">
              <span className="panel-label">Sound</span>
              <select value={editSound} onChange={e => {
                setEditSound(e.target.value)
                if (!editLabel || Object.values(SOUND_LABELS).includes(editLabel))
                  setEditLabel(SOUND_LABELS[e.target.value] || '')
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

          {/* Custom upload fields */}
          {useCustomSource && (
            <div className="custom-fields">
              <div className="panel-group">
                <span className="panel-label">Audio</span>
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
                    type="file" accept="audio/*"
                    onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); (e.target as HTMLInputElement).value = '' }}
                  />
                  <div className="dz-text">
                    {pendingFileName
                      ? <><strong>{pendingFileName}</strong><small>Ready to assign</small></>
                      : <><strong>Drop file here</strong> or click to browse<small>MP3 · WAV · OGG · M4A</small></>
                    }
                  </div>
                </div>
              </div>
              <div className="panel-group" style={{ marginTop: 12 }}>
                <span className="panel-label">Emoji</span>
                <div className="emoji-picker-wrap" ref={emojiPickerRef}>
                  <button
                    className="emoji-trigger"
                    onClick={() => setShowEmojiPicker(p => !p)}
                    title="Pick emoji"
                  >
                    {editEmoji || '🎵'}
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
            </div>
          )}

          {/* Shared fields */}
          <div className="panel-group">
            <span className="panel-label">Label</span>
            <input
              type="text" placeholder="Pad label..." maxLength={14}
              value={editLabel} onChange={e => setEditLabel(e.target.value)}
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
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="panel-actions">
            <button
              className="btn btn-danger-outline"
              disabled={!selectedPad.customBuf && !selectedPad.customRawBuf}
              onClick={handleResetPad}
            >
              Reset pad
            </button>
            <button className="btn btn-solid" onClick={handleSave}>Save</button>
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
          <div>
            <span className="reset-confirm-msg">
              This will clear all custom sounds, labels, and colors. Are you sure?
            </span>
            <div className="reset-confirm-actions">
              <button className="btn btn-outline" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleResetAll}>Yes, reset everything</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
