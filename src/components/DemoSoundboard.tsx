'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  defaultPads,
  SOUND_ICONS,
  SOUND_LABELS,
  SOUNDS,
  COLORS,
  KEY_TO_INDEX,
} from '@/lib/constants'
import { playSound } from '@/lib/sounds'
import type { PadState } from '@/lib/types'

const EmojiPicker = dynamic(() => import('@emoji-mart/react'), { ssr: false })

type AudioNode = AudioBufferSourceNode | OscillatorNode

// ── Demo Board 1: custom clips (position order = pad index order) ──────────
const BOARD1_CLIPS = [
  { file: 'sage-linkedin-msg.m4a',    label: 'From Sage',        icon: '🙋', color: 'green', iconImg: '/sage.jpg' }, // pos 1  key 7
  { file: 'spongebob-horn.wav',      label: 'Spongebob Horn',   icon: '🧽', color: 'yellow' }, // pos 2  key 8
  { file: 'zelda-open-chest.wav',    label: 'Zelda Chest',      icon: '⚔️', color: 'yellow' }, // pos 3  key 9
  { file: 'a-few-moments-later.mp3', label: 'Moments Later',    icon: '⏰', color: 'blue'   }, // pos 4  key −
  { file: 'dun-dun-dun.wav',         label: 'Dun Dun Dun',      icon: '🎭', color: 'purple' }, // pos 5  key 4
  { file: 'bing-bing-bong.wav',      label: 'Bing Bing Bong',   icon: '🔔', color: 'pink'   }, // pos 6  key 5
  { file: 'whats-going-on-here.mp3', label: "What's Going On?", icon: '🤨', color: 'pink'   }, // pos 7  key 6
  { file: 'crowd-laughing.wav',      label: 'Laughs',           icon: '😂', color: 'yellow' }, // pos 8  key +
  { file: 'sad-trombone.wav',        label: 'Sad Trombone',     icon: '😢', color: 'blue'   }, // pos 9  key 1
  { file: 'sad-violin.wav',          label: 'Sad Violin',       icon: '🎻', color: 'purple' }, // pos 10 key 2
  { file: 'emotional-damage.wav',    label: 'Emotional Damage', icon: '💥', color: 'red'    }, // pos 11 key 3
  { file: 'crowd-cheering.mp3',      label: 'Cheers',           icon: '🎉', color: 'green'  }, // pos 12 key ENT
  { file: 'faaah.wav',               label: 'FAAAH!',           icon: '😮', color: 'pink'   }, // pos 13 key 0
  { file: 'come-on-man.mp3',         label: 'Come On Man',      icon: '🤦', color: 'red'    }, // pos 14 key .
]

function board1Pads(): PadState[] {
  return defaultPads().map((p, i) => ({
    ...p,
    label: BOARD1_CLIPS[i].label,
    icon:  BOARD1_CLIPS[i].icon,
    color: BOARD1_CLIPS[i].color,
  }))
}

// ── Demo Board 2: synthesized sounds (Live Reactions) ─────────────────────
function board2Pads(): PadState[] {
  const overrides = [
    { sound: 'laugh',   icon: '😂', color: 'purple', label: 'Laugh'    },
    { sound: 'clap',    icon: '👏', color: 'yellow', label: 'Clap'     },
    { sound: 'airhorn', icon: '📯', color: 'yellow', label: 'Air Horn' },
    { sound: 'siren',   icon: '🚨', color: 'red',    label: 'Siren'    },
    { sound: 'rimshot', icon: '🎯', color: 'purple', label: 'Rimshot'  },
    { sound: 'noti',    icon: '🔔', color: 'pink',   label: 'Notif'    },
    { sound: 'swoosh',  icon: '💨', color: 'blue',   label: 'Swoosh'   },
    { sound: 'riser',   icon: '⬆️', color: 'green',  label: 'Riser'    },
    { sound: 'kick',    icon: '🥁', color: 'red',    label: 'Kick'     },
    { sound: 'snare',   icon: '🪘', color: 'green',  label: 'Snare'    },
    { sound: 'bass',    icon: '🎸', color: 'pink',   label: '808 Bass' },
    { sound: 'synth',   icon: '🎹', color: 'red',    label: 'Synth'    },
    { sound: 'scratch', icon: '💿', color: 'blue',   label: 'Scratch'  },
    { sound: 'hihat',   icon: '🎵', color: 'blue',   label: 'Hi-Hat'   },
  ]
  return defaultPads().map((p, i) => ({ ...p, ...overrides[i] }))
}

const DEMO_BOARDS = [
  { id: 'demo-0', name: 'DEMO BOARD 1' },
  { id: 'demo-1', name: 'DEMO BOARD 2' },
]

// ── Component ──────────────────────────────────────────────────────────────
export default function DemoSoundboard() {
  const [loading, setLoading] = useState(true)
  const [boardPads, setBoardPads] = useState<[PadState[], PadState[]]>([
    board1Pads(),
    board2Pads(),
  ])
  const [activeBoardIdx, setActiveBoardIdx] = useState(0)
  const [showBoardSwitcher, setShowBoardSwitcher] = useState(false)
  const boardSwitcherRef = useRef<HTMLDivElement>(null)

  const [dark, setDark] = useState(true)
  const [volume, setVolume] = useState(0.8)
  const [overlapMode, setOverlapMode] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selPad, setSelPad] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const [firingPads, setFiringPads] = useState<Set<number>>(new Set())
  const [firingStop, setFiringStop] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('red')
  const [editIcon, setEditIcon] = useState('')
  const [editSound, setEditSound] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [demoIconTab, setDemoIconTab] = useState<'emoji' | 'image'>('emoji')

  // Audio refs
  const audioCtxRef   = useRef<AudioContext | null>(null)
  const gainRef       = useRef<GainNode | null>(null)
  const activeSrcsRef = useRef<Set<AudioNode>>(new Set())
  const clipAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  const pads = boardPads[activeBoardIdx]

  // ── Loading screen — brief delay so audio preloads ─────────────────────
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(t)
  }, [])

  // ── iOS detection ──────────────────────────────────────────────────────
  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
  }, [])

  // ── Dark mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '')
  }, [dark])

  // ── Click outside board switcher ───────────────────────────────────────
  useEffect(() => {
    if (!showBoardSwitcher) return
    const h = (e: MouseEvent) => {
      if (boardSwitcherRef.current && !boardSwitcherRef.current.contains(e.target as Node))
        setShowBoardSwitcher(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showBoardSwitcher])

  // ── Click outside settings popover ────────────────────────────────────
  useEffect(() => {
    if (!showSettings) return
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettings(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSettings])

  // ── Preload Board 1 clips as HTMLAudioElements (most reliable on iOS) ──
  useEffect(() => {
    BOARD1_CLIPS.forEach(({ file }) => {
      const audio = new Audio(`/demo-clips/${file}`)
      audio.preload = 'auto'
      clipAudiosRef.current.set(file, audio)
    })
  }, [])

  // ── Web Audio context for Board 2 synth sounds ────────────────────────
  function getCtx(): { ctx: AudioContext; gain: GainNode } {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AC = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx  = new AC()
      const gain = ctx.createGain()
      gain.gain.value = volume
      gain.connect(ctx.destination)
      audioCtxRef.current = ctx
      gainRef.current     = gain
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return { ctx: audioCtxRef.current, gain: gainRef.current! }
  }

  function addFiring(idx: number) {
    setFiringPads(prev => new Set([...prev, idx]))
  }
  function removeFiring(idx: number) {
    setFiringPads(prev => { const s = new Set(prev); s.delete(idx); return s })
  }

  function stopAll() {
    activeSrcsRef.current.forEach(n => { try { n.stop() } catch {} })
    activeSrcsRef.current.clear()
    clipAudiosRef.current.forEach(a => { a.pause(); a.currentTime = 0 })
    setFiringPads(new Set())
    setStatus(null)
    setFiringStop(true)
    setTimeout(() => setFiringStop(false), 140)
  }

  // ── Board 1: HTMLAudioElement — reliable on all iOS ───────────────────
  function triggerClipPad(idx: number, pad: PadState) {
    const clip = BOARD1_CLIPS[idx]
    if (!overlapMode) {
      activeSrcsRef.current.forEach(n => { try { n.stop() } catch {} })
      activeSrcsRef.current.clear()
      clipAudiosRef.current.forEach(a => { a.pause(); a.currentTime = 0 })
      setFiringPads(new Set())
    }

    const audio = clipAudiosRef.current.get(clip.file) ?? new Audio(`/demo-clips/${clip.file}`)
    clipAudiosRef.current.set(clip.file, audio)
    audio.volume = volume
    audio.currentTime = 0
    addFiring(idx)
    audio.play()
      .then(() => {
        setStatus(`▶ ${pad.label}`)
        audio.addEventListener('ended', () => {
          removeFiring(idx)
          setStatus(prev => prev === `▶ ${pad.label}` ? null : prev)
        }, { once: true })
      })
      .catch(err => {
        removeFiring(idx)
        console.error('clip play failed:', clip.file, err)
      })
  }

  // ── Board 2: Web Audio synth ───────────────────────────────────────────
  function triggerSynthPad(idx: number, pad: PadState) {
    const { ctx, gain } = getCtx()
    if (!overlapMode) {
      activeSrcsRef.current.forEach(n => { try { n.stop() } catch {} })
      activeSrcsRef.current.clear()
      clipAudiosRef.current.forEach(a => { a.pause(); a.currentTime = 0 })
      setFiringPads(new Set())
    }
    const node = playSound(pad.sound, ctx, gain, activeSrcsRef.current)
    if (node) {
      addFiring(idx)
      setStatus(`▶ ${pad.label}`)
      node.onended = () => {
        removeFiring(idx)
        setStatus(prev => prev === `▶ ${pad.label}` ? null : prev)
      }
    }
  }

  // ── Main trigger ───────────────────────────────────────────────────────
  function triggerPad(idx: number) {
    const pad = pads[idx]
    if (activeBoardIdx === 0) triggerClipPad(idx, pad)
    else                      triggerSynthPad(idx, pad)
  }

  // ── Volume ─────────────────────────────────────────────────────────────
  function handleVolume(v: number) {
    setVolume(v)
    if (gainRef.current) gainRef.current.gain.value = v
    clipAudiosRef.current.forEach(a => { a.volume = v })
  }

  // ── Edit ───────────────────────────────────────────────────────────────
  function openEdit(idx: number) {
    const pad = pads[idx]
    setSelPad(idx); setEditLabel(pad.label); setEditColor(pad.color)
    setEditIcon(pad.icon); setEditSound(pad.sound); setShowEmojiPicker(false)
    setDemoIconTab('emoji')
  }
  function closeEdit() { setSelPad(null); setShowEmojiPicker(false); setDemoIconTab('emoji') }
  function saveEdit() {
    if (selPad === null) return
    const updated = boardPads.map((arr, bi) =>
      bi === activeBoardIdx
        ? arr.map((p, i) => i === selPad
            ? { ...p, label: editLabel, color: editColor, icon: editIcon, sound: editSound }
            : p)
        : arr
    ) as [PadState[], PadState[]]
    setBoardPads(updated)
    closeEdit()
  }

  function handlePadClick(idx: number) {
    if (editMode) { openEdit(idx); return }
    triggerPad(idx)
  }

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const idx = KEY_TO_INDEX[e.key]
      if (idx !== undefined) { e.preventDefault(); triggerPad(idx) }
      if (e.key === ' ') { e.preventDefault(); stopAll() }
      if (e.key === 'Escape') { setSelPad(null); setEditMode(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isModalOpen = editMode && selPad !== null
  const editPad = selPad !== null ? pads[selPad] : null

  // ── Loading screen ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="demo-loading">
        <div className="demo-loading-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="sb-logo" />
          <span className="sb-appname"><span className="logo-bracket">[</span><span className="logo-sage">sage</span><span className="logo-bracket">]</span><span className="logo-sounds">SOUNDS</span></span>
        </div>
        <div className="demo-mode-pill">🎛️ Demo Mode</div>
        <div className="demo-loading-row">
          <div className="demo-spinner" />
          <span className="demo-loading-text">Getting your sounds ready…</span>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="sb-page">

        {/* Header */}
        <div className="top">
          {/* Row 1: Wordmark + Built by */}
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
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Built by Sage Ashique
            </a>
          </div>

          {/* Bold divider — matches user mode */}
          <div className="sb-title-divider" />

          {/* Row 2: Board switcher + Help */}
          <div className="top-meta-row">
            <div className="board-switcher" ref={boardSwitcherRef}>
              <button
                className="board-name-btn"
                onClick={() => setShowBoardSwitcher(s => !s)}
              >
                <span className="board-name-text">{DEMO_BOARDS[activeBoardIdx].name}</span>
                <span className="board-name-chevron">{showBoardSwitcher ? '▲' : '▼'}</span>
              </button>
              {showBoardSwitcher && (
                <div className="board-dropdown">
                  {DEMO_BOARDS.map((board, idx) => (
                    <div key={board.id} className={`board-dropdown-item${activeBoardIdx === idx ? ' active' : ''}`}>
                      <button
                        className="board-item-name"
                        onClick={() => {
                          stopAll(); setActiveBoardIdx(idx)
                          setSelPad(null); setEditMode(false); setShowBoardSwitcher(false)
                        }}
                      >
                        {activeBoardIdx === idx && <span className="board-active-dot" />}
                        {board.name}
                      </button>
                    </div>
                  ))}
                  <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--border)' }}>
                    <Link href="/auth" style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
                      + Create your own boards →
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <button className="help-btn" onClick={() => setHelpOpen(true)}>
              <span className="help-btn-badge">?</span> Help
            </button>
          </div>
        </div>

        {/* Pad grid */}
        <div className="numpad">
          {pads.map((pad) => (
            <div
              key={pad.index}
              className={[
                'pad', pad.gridClass, `c-${pad.color}`,
                editMode && pad.index === selPad ? 'sel' : '',
                firingPads.has(pad.index) ? 'fire' : '',
                editMode && pad.index !== selPad ? 'edit-mode' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handlePadClick(pad.index)}
              onContextMenu={e => { e.preventDefault(); openEdit(pad.index) }}
            >
              <span className="pad-key">{pad.keyLabel}</span>
              {activeBoardIdx === 0 && BOARD1_CLIPS[pad.index]?.iconImg
                ? <span className="pad-icon-badge"><img src={BOARD1_CLIPS[pad.index].iconImg} alt="" className="pad-icon-img" /></span>
                : <span className="pad-icon-badge"><span className="pad-icon">{pad.icon}</span></span>
              }
              <span className="pad-label">{pad.label}</span>
              <div className="pad-wave" aria-hidden><span/><span/><span/></div>
            </div>
          ))}

          <div className={`pad-stop${firingStop ? ' fire' : ''}`} onClick={stopAll}>
            <span className="pad-key">SPACE</span>
            <span className="pad-stop-icon">⏹</span>
            <span className="pad-stop-label">STOP</span>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          {editMode
            ? <button className="exit-edit-btn btn" onClick={() => { setEditMode(false); setSelPad(null) }}>
                Exit Edit Mode
              </button>
            : <div className={`status-pill${(status || firingPads.size > 1) ? ' active' : ''}`}>
                {firingPads.size > 1 ? '🎛️ Mixing…' : (status || 'Tap a pad or press a numpad key to play')}
              </div>
          }
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Controls row: Edit pads + Settings (below the grid, matching user mode position) */}
        <div className={`controls-bar ${editMode ? 'controls-bar-end' : 'controls-bar-split'}`}>
          {!editMode && (
            <button
              className="btn btn-outline"
              onClick={() => { setEditMode(true); setSelPad(null) }}
            >
              ✏️ Edit pads
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
                      type="range" min={0} max={1} step={0.01} value={volume}
                      onChange={e => handleVolume(Number(e.target.value))}
                      className="settings-vol-slider"
                    />
                  </div>
                )}
                <div className="settings-row">
                  <div className="settings-label">Sound overlap</div>
                  <label className="toggle">
                    <input type="checkbox" checked={overlapMode} onChange={e => setOverlapMode(e.target.checked)} />
                    <span className="toggle-track" />
                    <span className="toggle-thumb" />
                  </label>
                </div>
                <div className="settings-row">
                  <div className="settings-label">Light mode</div>
                  <label className="toggle">
                    <input type="checkbox" checked={!dark} onChange={e => setDark(!e.target.checked)} />
                    <span className="toggle-track" />
                    <span className="toggle-thumb" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Demo CTA banner */}
        <div className="demo-cta-banner">
          <div className="demo-cta-text">
            <span>
              <span className="demo-cta-heading">🎛️ Demo Mode</span>
              {' — '}Changes aren&apos;t saved.
            </span>
            <span>Sign up to save your boards and upload custom sounds.</span>
          </div>
          <Link href="/auth" className="demo-banner-link">Sign up free →</Link>
        </div>

        {/* Footer */}
        <footer className="sb-footer">
          <div className="sb-footer-links">
            <Link href="/about" className="sb-footer-link sb-footer-link--brand">About the App</Link>
            <span className="sb-footer-sep">|</span>
            <a
              href="https://www.linkedin.com/in/sageashique"
              target="_blank"
              rel="noopener noreferrer"
              className="sb-footer-link sb-footer-link--brand"
            >
              <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Built by Sage Ashique
            </a>
          </div>
        </footer>

      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────── */}
      {isModalOpen && editPad && (
        <div className="ep-overlay" onClick={e => { if (e.target === e.currentTarget) closeEdit() }}>
          <div className="ep-modal">
            <div className="ep-header">
              <span className="ep-title">Edit pad</span>
              <div className="ep-header-preview">
                <div className={`ep-preview-pad c-${editColor}`}>
                  <span className="ep-preview-icon">{editIcon}</span>
                  <span className="ep-preview-label">{editLabel || '—'}</span>
                </div>
                <p className="ep-preview-hint">Preview</p>
              </div>
              <button className="ep-close" onClick={closeEdit}>✕</button>
            </div>
            <div className="ep-body">
              <div className="ep-preview">
                <div className={`ep-preview-pad c-${editColor}`}>
                  <span className="ep-preview-icon">{editIcon}</span>
                  <span className="ep-preview-label">{editLabel || '—'}</span>
                </div>
                <p className="ep-preview-hint">Preview</p>
              </div>
              <div className="ep-controls">
                {activeBoardIdx === 1 && (
                  <div className="ep-card">
                    <div className="ep-label">Sound</div>
                    <select value={editSound} onChange={e => setEditSound(e.target.value)}>
                      {SOUNDS.map(s => <option key={s} value={s}>{SOUND_ICONS[s]} {SOUND_LABELS[s]}</option>)}
                    </select>
                  </div>
                )}
                <div className="ep-card">
                  <div className="ep-label">Label <span className="ep-label-cap">(max 20)</span></div>
                  <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    placeholder="Pad label" maxLength={20} />
                </div>
                <div className="ep-card">
                  <div className="ep-label">Icon</div>
                  <div className="seg-bar">
                    <button
                      className={`seg-btn${demoIconTab === 'image' ? ' active' : ''}`}
                      onClick={() => setDemoIconTab('image')}
                    >Image</button>
                    <button
                      className={`seg-btn${demoIconTab === 'emoji' ? ' active' : ''}`}
                      onClick={() => setDemoIconTab('emoji')}
                    >Emoji</button>
                  </div>
                  {demoIconTab === 'emoji' && (
                    <div className="ep-emoji-row">
                      <div className="emoji-picker-wrap">
                        <button className="emoji-trigger" onClick={() => setShowEmojiPicker(p => !p)} title="Pick emoji">
                          {editIcon}
                        </button>
                        {showEmojiPicker && (
                          <div className="emoji-popover">
                            <EmojiPicker theme={dark ? 'dark' : 'light'}
                              onEmojiSelect={(em: { native: string }) => { setEditIcon(em.native); setShowEmojiPicker(false) }} />
                          </div>
                        )}
                      </div>
                      <span className="ep-emoji-hint">Click to pick</span>
                    </div>
                  )}
                  {demoIconTab === 'image' && (
                    <div className="icp-demo-locked">
                      <span className="icp-lock-icon">🔒</span>
                      <span className="icp-lock-text">Custom image icons require an account.</span>
                      <Link href="/auth" className="icp-lock-cta">Sign up free →</Link>
                    </div>
                  )}
                </div>
                <div className="ep-card">
                  <div className="ep-label">Color</div>
                  <div className="color-row">
                    {COLORS.map(c => (
                      <div key={c} className={`cdot d-${c}${editColor === c ? ' sel' : ''}`} onClick={() => setEditColor(c)} />
                    ))}
                  </div>
                </div>
                <div className="ep-demo-note">
                  <span className="ep-demo-note-heading">🎛️ Demo Mode</span>
                  <span>
                    Changes are session only.{' '}
                    <Link href="/auth" style={{ color: '#6366f1', fontWeight: 600 }}>Sign up free</Link>
                    {' '}to save boards &amp; upload custom audio.
                  </span>
                </div>
              </div>
            </div>
            <div className="ep-footer">
              <div />
              <div className="ep-footer-right">
                <button className="btn btn-outline" onClick={closeEdit}>Cancel</button>
                <button className="btn btn-solid" onClick={saveEdit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Help Panel ─────────────────────────────────────────────────── */}
      {helpOpen && (
        <div className="help-overlay" onClick={e => { if (e.target === e.currentTarget) setHelpOpen(false) }}>
          <div className="help-panel">
            <div className="help-header">
              <span className="help-title">🎛️ [sage]SOUNDS — Demo</span>
              <button className="help-close" onClick={() => setHelpOpen(false)}>✕</button>
            </div>
            <div className="help-body">
              <div className="help-section">
                <div className="help-section-title">Playing sounds</div>
                <p>Tap any pad to play. Use <strong>numpad keys</strong> for hands-free control. Press <strong>Space</strong> or the Stop bar to stop all audio.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Your boards</div>
                <p><strong>Demo Board 1</strong> has custom sound clips. <strong>Demo Board 2</strong> has synthesized drum &amp; reaction sounds. Switch between them using the board name at the top.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Editing pads</div>
                <p>Tap <strong>✏️ Edit pads</strong> then tap any pad to change its label, icon, or color. Right-click any pad to edit directly. Changes are session-only in demo mode.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Settings</div>
                <p>Tap <strong>⚙️ Settings</strong> at the bottom to adjust volume (desktop), toggle <strong>Sound Overlap</strong> to let sounds stack instead of cutting off, and switch between light and dark mode.</p>
              </div>
              <div className="help-section">
                <div className="help-section-title">Want more?</div>
                <p><Link href="/auth" style={{ color: '#4f46e5', fontWeight: 600 }}>Sign up free</Link> to upload your own audio, save boards across devices, and create up to 5 personal soundboards.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
