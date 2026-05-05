'use client'
import { useEffect, useState } from 'react'

const pads = [
  { emoji: '🥁', label: 'Kick',    color: 'red'    },
  { emoji: '🎵', label: 'Hi-Hat',  color: 'blue'   },
  { emoji: '👏', label: 'Clap',    color: 'green'  },
  { emoji: '📯', label: 'Horn',    color: 'yellow' },
  { emoji: '🎸', label: '808',     color: 'pink'   },
  { emoji: '🪘', label: 'Snare',   color: 'purple' },
  { emoji: '🎹', label: 'Synth',   color: 'blue'   },
  { emoji: '⬆️', label: 'Riser',   color: 'green'  },
  { emoji: '🎯', label: 'Rimshot', color: 'red'    },
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
    <div className="ap-hero-grid">
      {pads.map((pad, i) => (
        <div key={i} className={`ap-demo-pad ap-demo-${pad.color}${activePad === i ? ' fire' : ''}`}>
          <span className="ap-demo-emoji">{pad.emoji}</span>
          <div className="ap-demo-bottom">
            <span className="ap-demo-label">{pad.label}</span>
            <div className="ap-demo-wave" aria-hidden>
              <span/><span/><span/>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
