'use client'
import { useEffect, useState } from 'react'

const pads = [
  { img: '/Bored.jpg',    label: 'Boring',  color: 'red'    },
  { emoji: '🎵',          label: 'Hi-Hat',  color: 'blue'   },
  { emoji: '👏',          label: 'Clap',    color: 'green'  },
  { emoji: '📯',          label: 'Horn',    color: 'yellow' },
  { img: '/Surprise.jpg', label: 'No Way!', color: 'purple' },
  { emoji: '🪘',          label: 'Snare',   color: 'pink'   },
  { emoji: '🎹',          label: 'Synth',   color: 'blue'   },
  { emoji: '⬆️',          label: 'Riser',   color: 'green'  },
  { img: '/Sleepy.jpg',   label: 'ZZZ',     color: 'red'    },
]

export default function AboutHeroAnimation() {
  const [activePad, setActivePad] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const recent: number[] = []

    function fire() {
      if (cancelled) return
      let next: number
      do { next = Math.floor(Math.random() * pads.length) }
      while (recent.includes(next))
      recent.push(next)
      if (recent.length > 3) recent.shift()
      setActivePad(next)
      setTimeout(() => {
        if (cancelled) return
        setActivePad(null)
        setTimeout(fire, 600 + Math.random() * 1200)
      }, 1200)
    }

    const t = setTimeout(fire, 600)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  return (
    <div className="auth-device-shell ap-device-shell">
      <div className="auth-device-topbar">
        <div className="auth-device-dot ap-device-dot" />
        <div className="auth-device-pills">
          <div className="auth-device-pill ap-device-pill" />
          <div className="auth-device-pill ap-device-pill" />
          <div className="auth-device-pill ap-device-pill" />
        </div>
      </div>
      <div className="auth-device-grid-wrap">
        <div className="ap-hero-anim-grid">
          {pads.map((pad, i) => (
            <div key={i} className={`auth-demo-pad adp-${pad.color}${activePad === i ? ' adp-active' : ''}`}>
              {'img' in pad
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={pad.img} alt={pad.label} className="auth-demo-pad-img" />
                : <span className="auth-demo-emoji">{pad.emoji}</span>
              }
              <div className="auth-demo-bottom">
                <span className="auth-demo-label">{pad.label}</span>
                <div className="auth-demo-wave" aria-hidden>
                  <span/><span/><span/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
