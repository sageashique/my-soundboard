import Link from 'next/link'
import './about.css'
import AboutHeroAnimation from '@/components/AboutHeroAnimation'
import JumpBar from '@/components/JumpBar'

export const metadata = {
  title: 'About — [sage]SOUNDS',
  description: '[sage]SOUNDS: a browser-based soundboard built with AI as a co-builder. Learn about the project, the stack, and who made it.',
}

const features = [
  { emoji: '🎵', title: 'Upload your own audio', body: 'Drop any MP3, WAV, or M4A onto a pad. Your sounds, your way.' },
  { emoji: '⌨️', title: 'Keyboard shortcuts', body: 'Every pad maps to a key. Trigger sounds without touching the mouse.' },
  { emoji: '🎛️', title: 'Multiple boards', body: 'Organize sounds into separate boards and switch between them instantly.' },
  { emoji: '🔊', title: 'Sound overlap control', body: 'Stack effects freely, or set it to one sound at a time. Your call.' },
  { emoji: '⏹', title: 'Instant stop', body: 'One tap on the Stop bar — or hit Space — cuts everything mid-playback.' },
  { emoji: '🎨', title: 'Custom labels + colors', body: 'Name each pad and color-code it so you always know what you\'re hitting.' },
  { emoji: '🖼️', title: 'Custom pad icons', body: 'Add an emoji or your own image — instantly recognizable, even under pressure.' },
  { emoji: '☁️', title: 'Cloud sync', body: 'Your entire setup saves to your account and loads on any device.' },
  { emoji: '🎁', title: 'Free to start', body: 'Create an account in seconds. No credit card, no trial expiry.' },
  { emoji: '🌙', title: 'Dark mode', body: 'Defaults to dark. Switch to light anytime from Settings.' },
  { emoji: '📱', title: 'Works everywhere', body: 'Runs in any modern browser on desktop, tablet, or phone.' },
  { emoji: '🎙️', title: 'Live-session ready', body: 'Built for use during live meetings, streams, and recordings.' },
  { emoji: '🎤', title: 'No plugins needed', body: 'No downloads, no installs. Open a tab and go.' },
  { emoji: '🔈', title: 'Low-latency playback', body: 'Web Audio API keeps sounds tight and on-cue.' },
]

const steps = [
  {
    n: '1',
    title: 'Sign in',
    body: 'Create a free account or continue with Google. Your setup saves to the cloud and follows you to any device.',
  },
  {
    n: '2',
    title: 'Tap to play',
    body: 'Hit any pad on screen or press its keyboard shortcut to fire the sound instantly.',
  },
  {
    n: '3',
    title: 'Switch boards',
    body: 'Open the board selector to move between your saved soundboards. Each board holds 14 pads and has its own name.',
  },
  {
    n: '4',
    title: 'Customize',
    body: 'Press Edit Pads, tap any pad, and upload audio, pick an emoji, write a label, and choose a color.',
  },
  {
    n: '5',
    title: 'Layer or cut',
    body: 'Open Settings to toggle Sound Overlap — stack effects freely, or keep it clean with one sound at a time.',
  },
  {
    n: '6',
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
    name: 'Google Cloud',
    desc: 'Provides OAuth via Google Sign-In, enabling one-click account creation and sign-in without passwords.',
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
          <span><span className="logo-bracket">[</span><span className="logo-sage">sage</span><span className="logo-bracket">]</span><span className="logo-sounds">SOUNDS</span></span>
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
          <Link href="/demo" className="ap-hero-cta">Try the demo →</Link>
        </div>
        <div className="ap-hero-preview">
          <AboutHeroAnimation />
        </div>
      </section>

      {/* ── Jump links ── */}
      <JumpBar />

      {/* ── Builder card ── */}
      <section id="builder" className="ap-section ap-section-alt">
        <div className="ap-section-inner">
          <p className="ap-label">The builder</p>
          <div className="ap-builder-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sage.jpg" alt="Sage Ashique" className="ap-builder-photo" />
            <div className="ap-builder-info">
              <div className="ap-builder-name">Sage Ashique</div>
              <div className="ap-builder-role">Product Manager &amp; AI Enthusiast</div>
              <p className="ap-builder-bio">
                Product manager with a background in enterprise platforms and internal tools. I built [sage]SOUNDS
                end-to-end, from idea to deployment, using AI as a co-builder throughout. I wanted to show what a
                PM can do when they take full ownership, not just define requirements and hand things off. This is
                the project that shows it.
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

      {/* ── Why I built this ── */}
      <section id="why" className="ap-section">
        <div className="ap-section-inner">
          <h2 className="ap-title">Why I built this</h2>
          <div className="ap-body-stack">
            <p className="ap-body">
              My nephew had a chunky plastic toy soundboard. Big buttons, each one playing a different sound.
              Watching him mash them got me thinking: how hard would it be to build a digital version of this,
              but make it better? Start with generic sounds, then go beyond that. Upload your own audio, map it
              to a keyboard, organize sounds across multiple boards, fire them during a live meeting or stream.
              Same idea, more range. I wanted to see how fast I could build my own version. Challenge set.
              Challenge accepted.
            </p>
            <p className="ap-body">
              I used Claude Code throughout the build. Described what I wanted, reviewed what it built, iterated
              quickly. Features that would have taken days to scope and hand off went live in hours. No engineering
              team. No months of runway. Just a PM with a clear idea and a tool that could keep up. That combination
              turned out to be more powerful than I expected.
            </p>
            <p className="ap-body">
              Clarity is still the bottleneck. You still need to know what you want, break it into something
              buildable, and hold the line on what matters. AI didn&apos;t change that. If anything, it made it
              more obvious. Fuzzy inputs produce fuzzy outputs. Sharp ones produce something you can ship.
              That&apos;s a skill set I&apos;ve been building for years, and it translated directly.
            </p>
            <p className="ap-body">
              [sage]SOUNDS isn&apos;t a prototype. It has auth, cloud storage, a real database, and deployment
              infrastructure. I built it to show what&apos;s possible when a PM takes ownership of the full stack,
              not just the roadmap. You don&apos;t have to write every line of code to ship something real.
              You just have to know what you&apos;re building and care enough to see it through.
            </p>
          </div>
        </div>
      </section>

      {/* ── Build decisions ── */}
      <section id="decisions" className="ap-section ap-section-alt">
        <div className="ap-section-inner">
          <h2 className="ap-title">Build decisions</h2>
          <div className="ap-body-stack">
            <p className="ap-body">
              This started as an experiment. No plan, no spec — just an idea I wanted to see if I could
              actually pull off. I moved fast at first, figuring things out as I went. Once it started
              clicking, I got serious — real stack, user accounts, a database, a deployment pipeline. If I
              was going to keep building on it, it had to be built right.
            </p>
            <p className="ap-body">
              Early on I had a QWERTY keyboard layout. It worked, but every time I looked at it something
              felt off — too many keys, too much noise. I switched to a numpad grid. It let me trigger
              sounds directly from my keyboard, it looks way cleaner on mobile, and most people already
              know how a numpad works. Getting it to hold across different screen sizes was genuinely
              painful — it kept breaking in ways I didn&apos;t expect — but once I cracked it, it held.
            </p>
            <p className="ap-body">
              Custom audio was the whole point. Generic clips are fine, but custom is where the fun really
              begins. I was inspired by watching podcasters run their own soundboards — custom drops, inside
              jokes, bits they&apos;d built up over time. That&apos;s what I wanted to make digital. Once I committed
              to that, mobile became the real challenge. iOS has strict rules about when audio is allowed to
              play, and most things that work fine on desktop just silently break on mobile. It took a lot
              of iteration to find something that actually worked — and once I did, I documented it so I
              couldn&apos;t accidentally undo it six weeks later.
            </p>
            <p className="ap-body">
              The details started stacking up. Volume normalization was a practical one — if you&apos;re pulling
              clips from different sources, you can&apos;t have one blow everyone&apos;s ears out mid-stream. Custom
              image icons started as something dumb: I thought it&apos;d be funny to put photos of our friends
              on the soundboard with the phrases they repeat constantly. I was the only customer, and
              customers drive the product — so I ran with it. What I thought would be a quick feature
              turned into a full redesign of the edit flow — image picker, crop tool, cloud storage, a
              rendering layer that handles photos, emoji, and the absence of both. What started as
              entertainment ended up being one of the most genuinely useful things in the app.
            </p>
            <p className="ap-body">
              The name took a while to land. I went through a few generic options before realizing I wanted
              something that could stretch across more than one app. &quot;[sage]&quot; felt like the right way to
              tie things together — a shared identity instead of a one-off name. &quot;[sage]SOUNDS&quot; is the
              first one I&apos;ve shipped, but it won&apos;t be the last. There&apos;s a personal story behind the
              brackets too, but that one&apos;s better over coffee. Dark mode was the default from day one —
              the people who&apos;d actually use this are in dim rooms, on video calls, streaming late at night.
            </p>
            <p className="ap-body">
              The visual side came together later. Once I had a clear sense of what the app was, I built
              out a proper style guide — something I could make decisions against instead of just eyeballing
              things. That carried through everything: the soundboard, the auth page, the marketing site.
              The auth page was its own design problem. How do you get someone from landing to actually
              using the app without losing them in a sign-up flow? I landed on showing them a working demo
              first. Let them play before asking them to commit. Testing was done on MacBook with Chrome,
              iPhone and iPad with Safari. Android wasn&apos;t covered — Apple family, no apologies.
            </p>
            <p className="ap-body">
              V1 of this is unrecognizable. That&apos;s what actually moving on something looks like. You figure
              things out the hard way, you write it down so you don&apos;t accidentally undo it later, and you
              keep going. That&apos;s how I work on every product I build. [sage]SOUNDS is just the first one
              you can get your hands on.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="ap-section">
        <div className="ap-section-inner ap-section-inner-wide">
          <h2 className="ap-title">Features</h2>
          <div className="ap-features-grid">
            {features.map(f => (
              <div key={f.title} className="ap-feature-item">
                <div className="ap-feature-header">
                  <span className="ap-feature-emoji">{f.emoji}</span>
                  <div className="ap-feature-item-title">{f.title}</div>
                </div>
                <p className="ap-feature-item-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="ap-section">
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
      <section id="built-with" className="ap-section ap-section-alt">
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

      {/* ── Footer ── */}
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
