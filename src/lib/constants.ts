import type { PadState } from './types'

export const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','0','-','=','q','w','e','r']

export const SOUNDS = [
  'kick','snare','hihat','clap','rimshot','bass','synth','riser',
  'scratch','airhorn','laugh','vine','bruh','oof','noti','siren',
] as const

export type SoundName = typeof SOUNDS[number]

export const SOUND_ICONS: Record<string, string> = {
  kick:'🥁', snare:'🪘', hihat:'🎵', clap:'👏',
  rimshot:'🎯', bass:'🎸', synth:'🎹', riser:'⬆️',
  scratch:'💿', airhorn:'📯', laugh:'😂', vine:'💥',
  bruh:'😤', oof:'😵', noti:'🔔', siren:'🚨',
}

export const SOUND_LABELS: Record<string, string> = {
  kick:'Kick', snare:'Snare', hihat:'Hi-Hat', clap:'Clap',
  rimshot:'Rimshot', bass:'808 Bass', synth:'Synth', riser:'Riser',
  scratch:'Scratch', airhorn:'Air Horn', laugh:'Laugh', vine:'Vine Boom',
  bruh:'Bruh', oof:'Oof', noti:'Notif', siren:'Siren',
}

export const COLORS = ['red','green','blue','yellow','purple','pink']

export function defaultPads(): PadState[] {
  return SOUNDS.map((sound, i) => ({
    index: i,
    key: PAD_KEYS[i],
    sound,
    label: SOUND_LABELS[sound],
    color: COLORS[i % COLORS.length],
    icon: SOUND_ICONS[sound],
    customTrackPath: null,
    customTrackName: null,
    customBuf: null,
  }))
}
