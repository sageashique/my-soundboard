import type { PadState } from './types'

// Apple numpad layout — 14 pads
// Row 1: 7  8  9  −
// Row 2: 4  5  6  +  (+ spans rows 2–3)
// Row 3: 1  2  3  +
// Row 4: 0 (wide)  .  ↵
const PAD_DEFS = [
  { index: 0,  gridClass: 'pad-7',     sound: 'kick',    icon: '🥁', color: 'red',    keyLabel: '7',  keyTrigger: '7',     defaultLabel: 'Kick' },
  { index: 1,  gridClass: 'pad-8',     sound: 'snare',   icon: '🪘', color: 'green',  keyLabel: '8',  keyTrigger: '8',     defaultLabel: 'Snare' },
  { index: 2,  gridClass: 'pad-9',     sound: 'hihat',   icon: '🎵', color: 'blue',   keyLabel: '9',  keyTrigger: '9',     defaultLabel: 'Hi-Hat' },
  { index: 3,  gridClass: 'pad-minus', sound: 'clap',    icon: '👏', color: 'yellow', keyLabel: 'MIN', keyTrigger: '-',     defaultLabel: 'Clap' },
  { index: 4,  gridClass: 'pad-4',     sound: 'rimshot', icon: '🎯', color: 'purple', keyLabel: '4',  keyTrigger: '4',     defaultLabel: 'Rimshot' },
  { index: 5,  gridClass: 'pad-5',     sound: 'bass',    icon: '🎸', color: 'pink',   keyLabel: '5',  keyTrigger: '5',     defaultLabel: '808 Bass' },
  { index: 6,  gridClass: 'pad-6',     sound: 'synth',   icon: '🎹', color: 'red',    keyLabel: '6',  keyTrigger: '6',     defaultLabel: 'Synth' },
  { index: 7,  gridClass: 'pad-plus',  sound: 'riser',   icon: '⬆️', color: 'green',  keyLabel: 'PLUS', keyTrigger: '=',   defaultLabel: 'Riser' },
  { index: 8,  gridClass: 'pad-1',     sound: 'scratch', icon: '💿', color: 'blue',   keyLabel: '1',  keyTrigger: '1',     defaultLabel: 'Scratch' },
  { index: 9,  gridClass: 'pad-2',     sound: 'airhorn', icon: '📯', color: 'yellow', keyLabel: '2',  keyTrigger: '2',     defaultLabel: 'Air Horn' },
  { index: 10, gridClass: 'pad-3',     sound: 'laugh',   icon: '😂', color: 'purple', keyLabel: '3',  keyTrigger: '3',     defaultLabel: 'Laugh' },
  { index: 11, gridClass: 'pad-enter', sound: 'noti',    icon: '🔔', color: 'pink',   keyLabel: 'ENT', keyTrigger: 'Enter', defaultLabel: 'Notif' },
  { index: 12, gridClass: 'pad-0',     sound: 'siren',   icon: '🚨', color: 'red',    keyLabel: '0',  keyTrigger: '0',     defaultLabel: 'Siren' },
  { index: 13, gridClass: 'pad-dot',   sound: 'swoosh',  icon: '💨', color: 'green',  keyLabel: 'DOT', keyTrigger: '.',    defaultLabel: 'Swoosh' },
]

export const PAD_COUNT = PAD_DEFS.length

export const SOUNDS = PAD_DEFS.map(d => d.sound) as string[]

export const SOUND_ICONS: Record<string, string> = {
  kick:'🥁', snare:'🪘', hihat:'🎵', clap:'👏',
  rimshot:'🎯', bass:'🎸', synth:'🎹', riser:'⬆️',
  scratch:'💿', airhorn:'📯', laugh:'😂', noti:'🔔',
  siren:'🚨', swoosh:'💨',
}

export const SOUND_LABELS: Record<string, string> = {
  kick:'Kick', snare:'Snare', hihat:'Hi-Hat', clap:'Clap',
  rimshot:'Rimshot', bass:'808 Bass', synth:'Synth', riser:'Riser',
  scratch:'Scratch', airhorn:'Air Horn', laugh:'Laugh', noti:'Notif',
  siren:'Siren', swoosh:'Swoosh',
}

export const COLORS = ['red','green','blue','yellow','purple','pink']

// Static map from keyboard key to pad index
export const KEY_TO_INDEX: Record<string, number> = Object.fromEntries(
  PAD_DEFS.map(d => [d.keyTrigger, d.index])
)

export function defaultPads(): PadState[] {
  return PAD_DEFS.map(d => ({
    index: d.index,
    gridClass: d.gridClass,
    keyLabel: d.keyLabel,
    keyTrigger: d.keyTrigger,
    sound: d.sound,
    label: d.defaultLabel,
    color: d.color,
    icon: d.icon,
    customTrackPath: null,
    customTrackName: null,
    customBuf: null,
    customRawBuf: null,
    customGain: 1,
  }))
}

export function getDefaultForIndex(index: number) {
  return PAD_DEFS[index]
}
