import Link from 'next/link'
import './about.css'

export const metadata = {
  title: 'About — [sage]SOUNDS',
  description: '[sage]SOUNDS: a browser-based soundboard built with AI as a co-builder. Learn about the project, the stack, and who made it.',
}

const features = [
  {
    title: 'Trigger sounds instantly',
    body: 'Tap any pad or press its keyboard shortcut to fire audio in real time, with no delay.',
  },
  {
    title: 'Upload your own audio',
    body: 'Drop in any MP3, WAV, or M4A file and map it to any pad — your sounds, your way.',
  },
  {
    title: 'Customize everything',
    body: 'Set a label, color, and emoji for every pad to build a board you can read at a glance.',
  },
  {
    title: 'Synced to your account',
    body: 'Your entire setup saves to the cloud and loads on any device, any time.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Sign in',
    body: 'Create a free account to save your board to the cloud — your setup stays ready on any device.',
  },
  {
    n: '2',
    title: 'Tap to play',
    body: 'Hit any pad on screen or press its keyboard shortcut to fire the sound instantly.',
  },
  {
    n: '3',
    title: 'Customize',
    body: 'Press Edit Pads, tap any pad, and upload audio, pick an emoji, write a label, and choose a color.',
  },
  {
    n: '4',
    title: 'Layer or cut',
    body: 'Toggle Sound Overlap to stack effects freely, or keep it clean — one sound at a time.',
  },
  {
    n: '5',
    title: 'Stop instantly',
    body: 'Hit the Stop bar or press Space to cut all audio immediately, even across mixed file types.',
  },
]

const libraries = [
  { name: 'Next.js 15 (App Router)', desc: 'Full-stack React framework powering routing, SSR, and the build pipeline.' },
  { name: 'TypeScript', desc: 'Type safety across the entire codebase — components, DB types, and audio utilities.' },
  { name: 'Web Audio API', desc: 'Browser-native audio engine for low-latency sound playback and normalization.' },
  { name: 'Supabase JS SDK', desc: 'Client library for auth, database queries, and cloud storage access.' },
]

const platforms = [
  {
    name: 'Vercel',
    desc: 'Hosts and deploys the app globally. Every push to main triggers an automatic production deployment with zero configuration.',
  },
  {
    name: 'Supabase',
    desc: 'Powers three things: PostgreSQL for pad configs and user settings, Auth for account management, and object storage for custom audio uploads.',
  },
  {
    name: 'GitHub',
    desc: 'Version control and CI/CD trigger. The main branch stays in sync with production at all times.',
  },
]

export default function AboutPage() {
  return (
    <div className="ap-page">

      {/* ── Nav ── */}
      <nav className="ap-nav">
        <Link href="/" className="ap-nav-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="ap-nav-logo-icon" />
          [sage]SOUNDS
        </Link>
        <Link href="/auth" className="ap-nav-back">← Back to app</Link>
      </nav>

      {/* ── Hero ── */}
      <section className="ap-hero">
        <div className="ap-hero-inner">
          <span className="ap-badge">Portfolio Project</span>
          <h1 className="ap-hero-title">Drop any sound, instantly.</h1>
          <p className="ap-hero-desc">
            A browser-based soundboard for live meetings, streams, and content creation.
            Map your own audio to keyboard shortcuts and trigger them instantly —
            no plugins, no latency, no fumbling.
          </p>
          <Link href="/auth" className="ap-hero-cta">Try the demo →</Link>
        </div>
        <div className="ap-hero-preview">
          <div className="ap-screenshot-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sagesound-app.png"
              alt="[sage]SOUNDS soundboard interface"
              className="ap-screenshot-img"
            />
          </div>
        </div>
      </section>

      {/* ── What it does ── */}
      <section className="ap-section">
        <div className="ap-section-inner">
          <h2 className="ap-title">What it does</h2>
          <p className="ap-body" style={{ marginBottom: '24px' }}>
            Running a live meeting or stream and want to drop a sound effect at exactly the right moment?
            Most people end up fumbling between apps, playing audio from their phone, or just going without.
            [sage]SOUNDS puts every sound on a single keyboard-mapped grid — available the moment you need it,
            from any browser.
          </p>
          <div className="ap-feature-grid">
            {features.map(f => (
              <div key={f.title} className="ap-feature-card">
                <div className="ap-feature-card-title">{f.title}</div>
                <p className="ap-feature-card-body">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="ap-body" style={{ marginTop: '24px' }}>
            You get a 14-pad board modelled on an Apple numeric keypad. Every pad is fully customizable.
            Pads fire on click or keyboard shortcut. One tap on the Stop bar — or the spacebar — cuts everything.
            Your configuration is saved to your account and ready on any device, any time.
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="ap-section ap-section-alt">
        <div className="ap-section-inner">
          <h2 className="ap-title">How it works</h2>
          <div className="ap-steps">
            {steps.map(s => (
              <div key={s.n} className="ap-step">
                <div className="ap-step-num">{s.n}</div>
                <div className="ap-step-content">
                  <div className="ap-step-title">{s.title}</div>
                  <p className="ap-step-body">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built with ── */}
      <section className="ap-section">
        <div className="ap-section-inner">
          <h2 className="ap-title">Built with</h2>
          <div className="ap-tech-grid">
            <div className="ap-card">
              <p className="ap-tech-label">Libraries &amp; frameworks</p>
              <ul className="ap-tech-list">
                {libraries.map(item => (
                  <li key={item.name} className="ap-tech-item">
                    <span className="ap-dot ap-dot-indigo" />
                    <div>
                      <span className="ap-platform-name">{item.name}</span>
                      <span className="ap-platform-desc"> — {item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ap-card">
              <p className="ap-tech-label">Platforms &amp; services</p>
              <ul className="ap-tech-list">
                {platforms.map(p => (
                  <li key={p.name} className="ap-tech-item ap-tech-platform">
                    <span className="ap-dot ap-dot-violet" />
                    <div>
                      <span className="ap-platform-name">{p.name}</span>
                      <span className="ap-platform-desc"> — {p.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why I built this ── */}
      <section className="ap-section ap-section-alt">
        <div className="ap-section-inner">
          <h2 className="ap-title">Why I built this</h2>
          <p className="ap-body">
            My nephew has a chunky plastic toy soundboard — big buttons, each playing a different sound.
            Watching him mash them got me thinking: a digital version of this is totally doable, and I could
            actually make it <em>better</em>. Upload your own audio, map it to a keyboard, fire it in a live
            meeting or stream. Same idea, more range.
          </p>
          <p className="ap-body">
            What started as a fun weekend project turned into a genuine exploration of how fast you can go from
            idea to deployed product when you use AI as a co-builder. I used Claude Code throughout — describing
            what I wanted, reviewing what it built, iterating quickly. No engineering team. No months of runway.
            Just a PM with a clear idea and a surprisingly capable collaborator.
          </p>
          <p className="ap-body">
            [sage]SOUNDS is proof that the gap between &quot;I have an idea&quot; and &quot;that idea is live on
            the internet&quot; is smaller than most people think. Practical tools can be reimagined and shipped
            quickly — and the skills to do it are more accessible than ever.
          </p>
        </div>
      </section>

      {/* ── Builder card ── */}
      <section className="ap-section">
        <div className="ap-section-inner">
          <p className="ap-label">The builder</p>
          <div className="ap-builder-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sage.jpg" alt="Sage Ashique" className="ap-builder-photo" />
            <div className="ap-builder-info">
              <div className="ap-builder-name">Sage Ashique</div>
              <div className="ap-builder-role">Product Manager &amp; AI Enthusiast</div>
              <p className="ap-builder-bio">
                I build products at the intersection of AI and user experience. This project is part of my
                portfolio demonstrating hands-on technical depth alongside product thinking — from prompt
                design to deployment architecture.
              </p>
              <a
                href="https://www.linkedin.com/in/sageashique"
                target="_blank"
                rel="noopener noreferrer"
                className="ap-builder-linkedin"
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Connect on LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer — matches UI_STANDARDS ── */}
      <footer className="ap-footer-std">
        <a href="/about" className="ap-footer-brand-link">About the App</a>
        <span className="ap-footer-pipe">|</span>
        <a
          href="https://www.linkedin.com/in/sageashique"
          target="_blank"
          rel="noopener noreferrer"
          className="ap-footer-brand-link"
        >
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          Built by Sage Ashique
        </a>
      </footer>

    </div>
  )
}
