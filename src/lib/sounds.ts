type GN = GainNode
type AudioNode = AudioBufferSourceNode | OscillatorNode

// `active` receives every node this sound creates so the caller can stop them all.
export function playSound(
  name: string,
  ctx: AudioContext,
  master: GN,
  active: Set<AudioNode>,
): AudioNode | null {
  const t = ctx.currentTime
  function reg<T extends AudioNode>(n: T): T { active.add(n); return n }

  switch (name) {
    case 'kick': {
      const o = reg(ctx.createOscillator()), g = ctx.createGain()
      o.connect(g); g.connect(master)
      o.frequency.setValueAtTime(150, t)
      o.frequency.exponentialRampToValueAtTime(0.01, t + 0.4)
      g.gain.setValueAtTime(1, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      o.start(); o.stop(t + 0.4)
      return o
    }
    case 'snare': {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const s = reg(ctx.createBufferSource()), g = ctx.createGain(), f = ctx.createBiquadFilter()
      f.type = 'highpass'; f.frequency.value = 2000
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(master)
      g.gain.setValueAtTime(0.8, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      s.start(); s.stop(t + 0.2)
      return s
    }
    case 'hihat': {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const s = reg(ctx.createBufferSource()), g = ctx.createGain(), f = ctx.createBiquadFilter()
      f.type = 'highpass'; f.frequency.value = 7000
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(master)
      g.gain.setValueAtTime(0.6, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
      s.start(); s.stop(t + 0.08)
      return s
    }
    case 'clap': {
      let last: AudioBufferSourceNode | null = null
      for (let i = 0; i < 3; i++) {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1
        const s = reg(ctx.createBufferSource()), g = ctx.createGain(), f = ctx.createBiquadFilter()
        f.type = 'bandpass'; f.frequency.value = 1200
        s.buffer = buf; s.connect(f); f.connect(g); g.connect(master)
        const st = t + i * 0.015
        g.gain.setValueAtTime(0.7, st)
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.05)
        s.start(st); s.stop(st + 0.06)
        last = s
      }
      return last
    }
    case 'rimshot': {
      const o = reg(ctx.createOscillator()), g = ctx.createGain()
      o.connect(g); g.connect(master)
      o.type = 'triangle'; o.frequency.value = 400
      g.gain.setValueAtTime(0.9, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      o.start(); o.stop(t + 0.05)
      return o
    }
    case 'bass': {
      const o = reg(ctx.createOscillator()), g = ctx.createGain(), f = ctx.createBiquadFilter()
      f.type = 'lowpass'; f.frequency.value = 200
      o.connect(f); f.connect(g); g.connect(master)
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(60, t)
      o.frequency.exponentialRampToValueAtTime(30, t + 0.5)
      g.gain.setValueAtTime(1, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      o.start(); o.stop(t + 0.5)
      return o
    }
    case 'synth': {
      const o = reg(ctx.createOscillator()), g = ctx.createGain()
      o.connect(g); g.connect(master)
      o.type = 'square'; o.frequency.value = 440
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      o.start(); o.stop(t + 0.3)
      return o
    }
    case 'riser': {
      const o = reg(ctx.createOscillator()), g = ctx.createGain()
      o.connect(g); g.connect(master)
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(80, t)
      o.frequency.exponentialRampToValueAtTime(2000, t + 1.2)
      g.gain.setValueAtTime(0.3, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
      o.start(); o.stop(t + 1.4)
      return o
    }
    case 'scratch': {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.sin(i * 0.5) * Math.random()
      const s = reg(ctx.createBufferSource()), g = ctx.createGain(), f = ctx.createBiquadFilter()
      f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 5
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(master)
      g.gain.setValueAtTime(0.8, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      s.start(); s.stop(t + 0.2)
      return s
    }
    case 'airhorn': {
      let last: OscillatorNode | null = null
      ;[233, 311, 466].forEach(fr => {
        const o = reg(ctx.createOscillator()), g = ctx.createGain()
        o.connect(g); g.connect(master)
        o.type = 'sawtooth'; o.frequency.value = fr
        g.gain.setValueAtTime(0.25, t)
        g.gain.setValueAtTime(0.25, t + 0.6)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
        o.start(); o.stop(t + 0.9)
        last = o
      })
      return last
    }
    case 'laugh': {
      let last: OscillatorNode | null = null
      for (let i = 0; i < 5; i++) {
        const o = reg(ctx.createOscillator()), g = ctx.createGain()
        o.connect(g); g.connect(master)
        o.type = 'sine'
        const st = t + i * 0.12
        o.frequency.setValueAtTime(220 + i * 20, st)
        o.frequency.exponentialRampToValueAtTime(180, st + 0.1)
        g.gain.setValueAtTime(0, st)
        g.gain.linearRampToValueAtTime(0.4, st + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.1)
        o.start(st); o.stop(st + 0.12)
        last = o
      }
      return last
    }
    case 'noti': {
      let last: OscillatorNode | null = null
      ;[880, 1100].forEach((fr, i) => {
        const o = reg(ctx.createOscillator()), g = ctx.createGain()
        o.connect(g); g.connect(master)
        o.type = 'sine'; o.frequency.value = fr
        const st = t + i * 0.1
        g.gain.setValueAtTime(0.4, st)
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.1)
        o.start(st); o.stop(st + 0.1)
        last = o
      })
      return last
    }
    case 'siren': {
      const o = reg(ctx.createOscillator()), g = ctx.createGain()
      o.connect(g); g.connect(master)
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(600, t)
      o.frequency.linearRampToValueAtTime(1200, t + 0.4)
      o.frequency.linearRampToValueAtTime(600, t + 0.8)
      g.gain.setValueAtTime(0.3, t)
      g.gain.setValueAtTime(0.3, t + 0.75)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
      o.start(); o.stop(t + 0.85)
      return o
    }
    case 'swoosh': {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length)
      const s = reg(ctx.createBufferSource()), g = ctx.createGain(), f = ctx.createBiquadFilter()
      f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.8
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(master)
      g.gain.setValueAtTime(0.5, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      s.start(); s.stop(t + 0.38)
      return s
    }
    default:
      return null
  }
}
