import Link from 'next/link'
import './about.css'

export const metadata = {
  title: 'About — SageSound',
  description: 'SageSound: a browser-based soundboard built with AI as a co-builder. Learn about the project, the stack, and who made it.',
}

const steps = [
  {
    n: '1',
    title: 'Sign in',
    body: 'Create an account to save your board. Sign-in keeps your pad configuration — sounds, labels, and colors — synced in the cloud so your setup is ready on any device, any time.',
  },
  {
    n: '2',
    title: 'Tap to play',
    body: 'Hit any pad on screen or press its keyboard shortcut to fire the sound instantly through your browser.',
  },
  {
    n: '3',
    title: 'Customize your board',
    body: 'Press Edit Pads to enter edit mode, then tap any pad — upload your own audio, pick an emoji, write a label, and choose a color.',
  },
  {
    n: '4',
    title: 'Layer or cut',
    body: 'Toggle Sound Overlap to stack effects freely, or keep it clean — one sound at a time.',
  },
  {
    n: '5',
    title: 'Stop everything',
    body: 'Hit the Stop bar or press Space to cut all audio immediately, even across mixed file types.',
  },
]

const libraries = [
  'Next.js 15 (App Router)',
  'TypeScript',
  'Web Audio API',
  'Supabase JS SDK',
]

const platforms = [
  {
    name: 'Vercel',
    desc: 'Hosts and deploys the app globally via edge CDN. Every commit pushed to GitHub triggers an automatic production deployment with zero configuration.',
  },
  {
    name: 'Supabase',
    desc: 'Powers three things in one: PostgreSQL for pad configs and user settings, Supabase Auth for account management, and object storage for custom audio uploads.',
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
          SageSound
        </Link>
        <Link href="/auth" className="ap-nav-cta">Open the app →</Link>
      </nav>

      {/* ── Hero ── */}
      <section className="ap-hero">
        <div className="ap-hero-inner">
          <span className="ap-badge">Personal Project</span>
          <h1 className="ap-hero-title">SageSound</h1>
          <p className="ap-hero-desc">
            A browser-based soundboard for live meetings, streams, and content creation.
            Map your own audio to keyboard shortcuts and trigger them instantly —
            no plugins, no latency, no fumbling.
          </p>
          <Link href="/auth" className="ap-hero-cta">Open the app →</Link>
        </div>
        {/* App screenshot preview */}
        <div className="ap-hero-preview">
          <div className="ap-screenshot-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sagesound-app.png"
              alt="SageSound soundboard interface"
              className="ap-screenshot-img"
            />
          </div>
        </div>
      </section>

      {/* ── What it does ── */}
      <section className="ap-section">
        <div className="ap-section-inner">
          <p className="ap-label">What it does</p>
          <h2 className="ap-title">A soundboard that lives in your browser</h2>
          <div className="ap-card ap-body-card">
            <p className="ap-body">
              Running a live meeting or stream and want to drop a sound effect at exactly the right moment?
              Most people end up fumbling between apps, playing audio from their phone, or just going without.
              SageSound puts every sound on a single keyboard-mapped grid — available the moment you need it,
              from any browser.
            </p>
            <p className="ap-body">
              You get a 14-pad board modelled on an Apple numeric keypad. Every pad is fully customizable:
              upload your own audio file, set an emoji, a label, and a color. Pads fire on click or keyboard
              shortcut. One tap on the Stop bar — or the spacebar — cuts everything. Your entire configuration
              is saved to your account so it&apos;s ready on any device, any time.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="ap-section ap-section-alt">
        <div className="ap-section-inner">
          <p className="ap-label">How it works</p>
          <h2 className="ap-title">From sign-in to sound in seconds</h2>
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
          <p className="ap-label">Built with</p>
          <h2 className="ap-title">The stack behind it</h2>
          <div className="ap-tech-grid">
            <div className="ap-card">
              <p className="ap-tech-label">Libraries &amp; frameworks</p>
              <ul className="ap-tech-list">
                {libraries.map(item => (
                  <li key={item} className="ap-tech-item">
                    <span className="ap-dot ap-dot-indigo" />
                    {item}
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
          <p className="ap-label">Why I built this</p>
          <h2 className="ap-title">Honestly? I just wanted a soundboard.</h2>
          <div className="ap-card ap-body-card">
            <p className="ap-body">
              My nephew has a toy soundboard — one of those chunky plastic ones with big buttons that each
              play a different sound. He loves it. Watching him mash those buttons got me thinking: a digital
              version of this is totally doable, and I could actually make it <em>better</em>. Upload your own
              audio, map it to a keyboard, use it in a real meeting or stream. Same idea, a few extra features.
            </p>
            <p className="ap-body">
              So I built one.
            </p>
            <p className="ap-body">
              What started as a fun weekend project turned into a genuine exploration of how fast you can go
              from idea to deployed product when you use AI as a co-builder. I used Claude Code throughout —
              describing what I wanted, reviewing what it built, iterating quickly. No engineering team.
              No months of runway. Just a PM with an idea and a surprisingly capable AI.
            </p>
            <p className="ap-body">
              SageSound is proof that the gap between &quot;I have an idea for an app&quot; and &quot;that app is
              live on the internet&quot; is smaller than most people think. Practical, everyday tools can be
              reimagined and shipped quickly — and anyone can do it.
            </p>
          </div>
        </div>
      </section>

      {/* ── Builder card ── */}
      <section className="ap-section ap-section-alt">
        <div className="ap-section-inner">
          <p className="ap-label">The builder</p>
          <div className="ap-builder-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sage.jpg" alt="Sage Ashique" className="ap-builder-photo" />
            <div className="ap-builder-info">
              <div className="ap-builder-name">Sage Ashique</div>
              <div className="ap-builder-role">Senior Product Manager &amp; Builder</div>
              <p className="ap-builder-bio">
                Sage has 8+ years of experience shipping software products — from enterprise platforms
                to consumer tools. He&apos;s focused on the intersection of AI and product: not theorizing
                about what AI can do, but picking up real projects to find out.
              </p>
              <a
                href="https://www.linkedin.com/in/sageashique"
                target="_blank"
                rel="noopener noreferrer"
                className="ap-builder-linkedin"
              >
                LinkedIn →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="ap-footer">
        <span className="ap-footer-copy">© {new Date().getFullYear()} SageSound</span>
        <div className="ap-footer-links">
          <Link href="/auth" className="ap-footer-link">Open the app</Link>
          <a
            href="https://www.linkedin.com/in/sageashique"
            target="_blank"
            rel="noopener noreferrer"
            className="ap-footer-link"
          >
            LinkedIn
          </a>
        </div>
      </footer>

    </div>
  )
}
