import { useState, useLayoutEffect, useCallback, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react'

// Bumped whenever the tutorial content changes substantially, so existing
// users see the updated tour once.
export const TUTORIAL_SEEN_KEY = 'netviz.tutorial.seen.v3'

interface Step {
  title: string
  /** CSS selector of the element to spotlight. Omit for a centered card. */
  target?: string
  body: React.ReactNode
}

const STEPS: Step[] = [
  {
    title: 'Welcome to the Network Builder',
    body: (
      <>
        <p>This is an interactive lab where you design a network the way real ones are built, then watch real packets travel through it hop by hop.</p>
        <p className="mt-2">This quick tour shows you how a real network is <b>layered</b>, and how to <b>add devices</b>, <b>connect &amp; name links</b>, <b>configure services</b> (routing, firewall, DHCP, DNS) and <b>send packets</b>.</p>
        <p className="mt-2 text-[var(--text-muted)]">Use <b>Next</b> / <b>Back</b> to move, or <b>Skip</b> to jump straight in — you can reopen this any time from the <GraduationCap size={11} className="inline -mt-0.5" /> button.</p>
      </>
    ),
  },
  {
    title: '1 · How a real network is layered',
    target: '[data-tour="canvas"]',
    body: (
      <>
        <p>Almost every real enterprise site follows the same chain, from the outside in:</p>
        <p className="mt-2 font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed">
          Internet ↔ Edge router ↔ Firewall ↔ Core switch ↔ Access switch ↔ Devices
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--text-secondary)]">
          <li>The <b>edge router</b> terminates the ISP uplink and does the routing (NAT, BGP, multi-WAN)</li>
          <li>The <b>perimeter firewall</b> sits right behind it — every packet in or out of the LAN is inspected before it reaches anything internal</li>
          <li><b>DHCP / DNS servers</b> live in a server segment on the core switch</li>
          <li>Anything the public may reach (a web server) goes in a <b>DMZ</b> — its own firewall leg, isolated from the LAN</li>
        </ul>
        <p className="mt-2 text-[var(--text-muted)]">The guided <b>Build</b> exercise walks you through exactly this layout.</p>
      </>
    ),
  },
  {
    title: '2 · The Device Palette',
    target: '[data-tour="palette"]',
    body: (
      <>
        <p>Every building block lives here, grouped into categories:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--text-secondary)]">
          <li><b>Routing &amp; Switching</b> — router, L3/L2 switch, hub</li>
          <li><b>Security</b> — firewall, IDS/IPS, VPN gateway</li>
          <li><b>Traffic &amp; Delivery</b> — load balancer, reverse proxy, API gateway</li>
          <li><b>Servers &amp; Services</b> — server, DNS, DHCP, mail, file, database, VM host</li>
          <li><b>Storage / Endpoints / Internet</b> — NAS, PC, laptop, phone, IoT, ISP, WWW…</li>
        </ul>
        <p className="mt-2 text-[var(--text-muted)]">Each device has real icons, capabilities (NIC, Wi-Fi card…) and its own configuration.</p>
      </>
    ),
  },
  {
    title: '3 · Add a device',
    target: '[data-tour="palette"]',
    body: (
      <>
        <p><b>Drag</b> a device from the palette and <b>drop</b> it on the canvas.</p>
        <p className="mt-2">New devices arrive <b>powered off</b> and with no IP — just like unboxing real hardware. They show a grey <b>“needs IP”</b> hint until they join a network.</p>
        <p className="mt-2 text-[var(--text-muted)]">To remove a device, select it and press <b>Delete</b> in the toolbar.</p>
      </>
    ),
  },
  {
    title: '4 · Connect two devices',
    target: '[data-tour="canvas"]',
    body: (
      <>
        <p>Hover a device — four <b>connection dots</b> appear (top, bottom, left, right).</p>
        <p className="mt-2"><b>Click &amp; drag from any dot</b> to another device to draw a link (a cable). Start from any side, drop on any side — the finished link automatically attaches to the sides that face each other.</p>
        <p className="mt-2 text-[var(--text-muted)]">Links are how packets flow. A device with no link — or behind a powered-off switch — can't be reached.</p>
      </>
    ),
  },
  {
    title: '5 · Power on → automatic DHCP',
    target: '[data-tour="canvas"]',
    body: (
      <>
        <p>Every device has a <b>power button</b> (top-left corner, and in its panel).</p>
        <p className="mt-2">Power a client on and — if it's wired to a network with a <b>DHCP server</b> — it automatically broadcasts a real <b>DORA</b> exchange:</p>
        <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">Discover → Offer → Request → ACK</p>
        <p className="mt-2">…and receives its IP, gateway and DNS. Power on several at once — they all request <b>in parallel</b>. A device without an IP never sends application traffic.</p>
      </>
    ),
  },
  {
    title: '6 · Name & configure a link',
    target: '[data-tour="canvas"]',
    body: (
      <>
        <p><b>Click a line</b> to open its panel on the right. There you can:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--text-secondary)]">
          <li>Give it a <b>name / label</b> (e.g. “LAN trunk”, “WAN uplink”) — shown on the diagram</li>
          <li>Set <b>bandwidth</b> and <b>latency</b> (latency is added to each hop crossing it)</li>
          <li>Toggle the link <b>up / down</b></li>
        </ul>
      </>
    ),
  },
  {
    title: '7 · Configure a device',
    target: '[data-tour="canvas"]',
    body: (
      <>
        <p><b>Click a device</b> to open its (resizable) Properties panel. Tabs depend on the device type:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--text-secondary)]">
          <li><b>Info</b> — name, model, and its <b>hardware</b> (NIC, Wi-Fi card, CPU…)</li>
          <li><b>Interfaces</b> — IP, mask, MAC, speed</li>
          <li><b>Services</b> — open ports &amp; run services (HTTP, SSH, DB…) — <i>servers only</i></li>
          <li><b>Routing / Firewall / DHCP / DNS</b> — for the devices that support them</li>
        </ul>
        <p className="mt-2 text-[var(--text-muted)]">Drag the panel's left edge to resize it. A normal PC can't host services — only server-class devices can.</p>
      </>
    ),
  },
  {
    title: '8 · Open ports & host services',
    target: '[data-tour="canvas"]',
    body: (
      <>
        <p>Select a <b>server</b> → <b>Services</b> tab to control it like the real thing:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--text-secondary)]">
          <li><b>Quick-add</b> common services, or <b>add a custom service</b> on any port</li>
          <li>Edit each service's <b>name, port, protocol, version, description</b></li>
          <li>Toggle a service to <b>open/close its port</b>; host a <b>web page</b> for HTTP</li>
        </ul>
        <p className="mt-2 text-[var(--text-muted)]">In a trace, an open port answers with a real banner; a closed port returns <b>connection refused (RST)</b>.</p>
      </>
    ),
  },
  {
    title: '9 · Infrastructure services',
    target: '[data-tour="palette"]',
    body: (
      <>
        <p>Real networks run on dedicated service devices — place them where they belong:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--text-secondary)]">
          <li><b>DHCP</b> — pool, gateway, DNS &amp; lease time; lives in the server segment and hands every endpoint its address</li>
          <li><b>DNS</b> — A / CNAME / MX records and upstream forwarders</li>
          <li><b>Firewall</b> — allow/deny rules at the perimeter (and in front of the DMZ)</li>
          <li><b>WWW / Cloud</b> — represents the public Internet</li>
        </ul>
        <p className="mt-2 text-[var(--text-muted)]">Their config lives in the <b>DHCP</b>, <b>DNS</b> and <b>Firewall</b> tabs of the Properties panel.</p>
      </>
    ),
  },
  {
    title: '10 · Send a packet',
    target: '[data-tour="sender"]',
    body: (
      <>
        <p>Pick a <b>From</b> and <b>To</b> device, choose a <b>protocol</b> (ICMP / TCP / UDP) and an optional <b>port</b>, then hit <b>Send</b>.</p>
        <p className="mt-2">The packet is routed hop by hop through your topology, evaluating routing tables and firewall rules at each device — try tracing a PC out to the Internet and watch it cross the firewall and the edge router.</p>
      </>
    ),
  },
  {
    title: '11 · Slow it down or pause',
    target: '[data-tour="speed"]',
    body: (
      <>
        <p>Packets can move fast — use <b>Fast / Normal / Slow</b> to set the pace, and <b>Pause</b> to freeze the dot mid-flight so you can study a hop.</p>
        <p className="mt-2 text-[var(--text-muted)]">Resume continues from exactly where it stopped.</p>
      </>
    ),
  },
  {
    title: '12 · Read the result',
    target: '[data-tour="canvas"]',
    body: (
      <>
        <p>Watch the dot travel each link. The right panel lists every <b>hop</b> with the action taken (L2 forward, L3 route, firewall allow/deny, delivered).</p>
        <p className="mt-2">A <span className="text-[var(--green)] font-semibold">green</span> path means delivered. A <span className="text-[var(--red)] font-semibold">red</span> stop shows exactly where — and why — a packet was blocked.</p>
      </>
    ),
  },
  {
    title: '13 · Live network traffic',
    target: '[data-tour="speed"]',
    body: (
      <>
        <p>The <b>Live</b> button keeps the network alive: addressed hosts continuously exchange realistic, labelled traffic — <b>DNS</b> lookups, <b>HTTPS</b>, <b>SMTP</b>, <b>SQL</b>, pings — many packets flowing <b>at once</b>.</p>
        <p className="mt-2 text-[var(--text-muted)]">A request to a server is preceded by a <b>DNS query</b>, just like real life. Only powered hosts that already hold an IP generate traffic.</p>
      </>
    ),
  },
  {
    title: '14 · Save your work',
    target: '[data-tour="toolbar"]',
    body: (
      <>
        <p><b>Save</b> persists your topology to the backend. <b>Reset</b> reloads the sample enterprise network.</p>
        <p className="mt-3 font-semibold text-[var(--text-primary)]">That's it — you're ready to build!</p>
      </>
    ),
  },
]

const PAD = 8

export default function Tutorial({ open, onClose, onStartBuild }: { open: boolean; onClose: () => void; onStartBuild?: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const step = STEPS[i]

  const finish = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, '1') } catch { /* ignore */ }
    onClose()
  }, [onClose])

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); return }
    const el = document.querySelector(step.target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    // Re-measure shortly after, in case a panel animated in
    const t = setTimeout(measure, 120)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  // Reset to first step whenever reopened
  useEffect(() => { if (open) setI(0) }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') setI(v => Math.min(STEPS.length - 1, v + 1))
      else if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, finish])

  if (!open) return null

  const isLast = i === STEPS.length - 1
  const isFirst = i === 0

  // Tooltip card position (clamped so it never overflows a narrow viewport)
  const cardW = Math.min(340, window.innerWidth - 24)
  const cardH = 260
  let cardStyle: React.CSSProperties
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom
    const placeBelow = spaceBelow > cardH + 24
    const top = placeBelow ? rect.bottom + PAD + 10 : Math.max(12, rect.top - cardH - PAD - 10)
    let left = rect.left + rect.width / 2 - cardW / 2
    left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12))
    cardStyle = { top, left, width: cardW }
  } else {
    cardStyle = {
      top: '50%', left: '50%', width: cardW,
      transform: 'translate(-50%, -50%)',
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* Backdrop + spotlight hole */}
      {rect ? (
        <div
          style={{
            position: 'absolute',
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(2,6,12,0.78)',
            border: '2px solid var(--accent)',
            pointerEvents: 'none',
            transition: 'all 0.25s ease',
          }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,12,0.78)' }} />
      )}

      {/* Click-catcher so the tour stays in focus */}
      <div style={{ position: 'absolute', inset: 0 }} onClick={finish} />

      {/* Tooltip card */}
      <div
        className="card"
        style={{
          position: 'absolute',
          ...cardStyle,
          background: 'var(--bg-800)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          padding: 0,
          animation: 'slideDown 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <GraduationCap size={15} className="text-[var(--accent)]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)] flex-1">{step.title}</span>
          <button onClick={finish} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 text-[12px] leading-relaxed text-[var(--text-secondary)] max-h-[320px] overflow-y-auto">
          {step.body}
        </div>

        {/* Hands-on CTA (welcome & final steps) */}
        {onStartBuild && (isFirst || isLast) && (
          <div className="px-4 pb-1 -mt-1">
            <button
              onClick={() => { finish(); onStartBuild() }}
              className="btn-success w-full justify-center text-[11px]"
            >
              <GraduationCap size={12} /> Build it yourself — guided exercise
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)]">
          {/* progress dots */}
          <div className="flex items-center gap-1 flex-1">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                className="rounded-full transition-all"
                style={{
                  width: idx === i ? 16 : 6, height: 6,
                  background: idx === i ? 'var(--accent)' : 'var(--bg-600)',
                }}
                aria-label={`Step ${idx + 1}`}
              />
            ))}
          </div>

          <span className="text-[10px] text-[var(--text-muted)] font-mono mr-1">{i + 1}/{STEPS.length}</span>

          {!isFirst && (
            <button onClick={() => setI(v => v - 1)} className="btn-ghost text-[11px] h-7 px-2.5">
              <ChevronLeft size={12} /> Back
            </button>
          )}
          {isLast ? (
            <button onClick={finish} className="btn-primary text-[11px] h-7 px-3">Got it</button>
          ) : (
            <button onClick={() => setI(v => v + 1)} className="btn-primary text-[11px] h-7 px-3">
              Next <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
