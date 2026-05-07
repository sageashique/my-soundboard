import DemoSoundboard from '@/components/DemoSoundboard'
import ErrorBoundary from '@/components/ErrorBoundary'

export const metadata = {
  title: '[sage]SOUNDS — Demo',
  description: 'Try the soundboard — no account needed.',
}

export default function DemoPage() {
  return <ErrorBoundary><DemoSoundboard /></ErrorBoundary>
}
