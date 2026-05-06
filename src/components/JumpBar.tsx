'use client'
import { useEffect, useRef } from 'react'

export default function JumpBar() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function update() {
      const hasLeft = el!.scrollLeft > 1
      const hasRight = el!.scrollLeft < el!.scrollWidth - el!.clientWidth - 1
      el!.classList.toggle('scroll-has-left', hasLeft)
      el!.classList.toggle('scroll-has-right', hasRight)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <nav ref={ref} className="ap-jump-bar" aria-label="Page sections">
      <a href="#builder" className="ap-jump-link">The Builder</a>
      <span className="ap-jump-sep">·</span>
      <a href="#why" className="ap-jump-link">Why I Built This</a>
      <span className="ap-jump-sep">·</span>
      <a href="#decisions" className="ap-jump-link">Build Decisions</a>
      <span className="ap-jump-sep">·</span>
      <a href="#features" className="ap-jump-link">Features</a>
      <span className="ap-jump-sep">·</span>
      <a href="#how-it-works" className="ap-jump-link">How It Works</a>
      <span className="ap-jump-sep">·</span>
      <a href="#built-with" className="ap-jump-link">Built With</a>
    </nav>
  )
}
