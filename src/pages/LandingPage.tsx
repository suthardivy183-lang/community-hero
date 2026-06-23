import { Link } from 'react-router-dom'
import {
  Camera, Sparkles, Users, ShieldCheck, MapPin, Flame, Trophy, Languages,
  Siren, ArrowRight, Quote,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/issue/StatusBadge'
import { SeverityMeter } from '@/components/issue/SeverityMeter'

const img = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`

const HERO = img('photo-1449824913935-59a10b8d2000', 1600)

export function LandingPage() {
  return (
    <div>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <img
          src={HERO}
          alt="City street at dusk"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-ink/90 via-ink/75 to-primary/70" />
        <div
          className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{ backgroundImage: 'radial-gradient(circle at 18% 28%, white 0, transparent 38%), radial-gradient(circle at 82% 70%, white 0, transparent 34%)' }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="flex flex-col justify-center text-white">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] backdrop-blur">
              <Sparkles className="size-3.5" /> AI-powered civic action
            </span>
            <h1 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Your neighbourhood,<br /><span className="text-accent">fixed faster.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Snap a photo of a pothole, leak or broken streetlight. AI categorises it, neighbours
              confirm it, and authorities are held accountable — with photo proof the fix is real.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent">
                <Link to="/report"><Camera className="size-5" /> Report an issue</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                <Link to="/map"><MapPin className="size-5" /> Explore the live map</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/70">
              <Stat n="7-stage" l="transparent tracking" />
              <Stat n="AI" l="before/after proof" />
              <Stat n="3 languages" l="EN · हिं · ગુ" />
            </div>
          </div>

          {/* Floating product preview */}
          <div className="relative hidden lg:block">
            <FloatingPreview />
          </div>
        </div>
      </section>

      {/* ===== What we tackle (image tiles) ===== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead kicker="Every corner of the city" title="One platform for every civic issue" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Tile image={img('photo-1473042904451-00171c69419d')} label="Roads & potholes" />
          <Tile image={img('photo-1542273917363-3b1817f69a2d')} label="Lighting & power" />
          <Tile image={img('photo-1531206715517-5c0ba140b2b8')} label="Community & sanitation" />
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="bg-surface-sunk py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHead kicker="How it works" title="From photo to proven fix" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Step n={1} icon={<Camera />} title="Snap & report" body="Take a photo. Your location is pinned automatically." />
            <Step n={2} icon={<Sparkles />} title="AI triages" body="Gemini categorises it, writes the report and scores severity." />
            <Step n={3} icon={<Users />} title="Community confirms" body="Neighbours upvote and verify — duplicates merge automatically." />
            <Step n={4} icon={<ShieldCheck />} title="Resolved & verified" body="Authorities fix it; AI confirms the repair with before/after proof." />
          </div>
        </div>
      </section>

      {/* ===== Feature bento ===== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHead kicker="Built to win trust" title="Transparency and accountability, by design" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Feature className="md:col-span-2" icon={<ShieldCheck />} title="AI before/after validation"
            body="When a fix is uploaded, AI compares it with the original photo and rules it genuine, insufficient or unrelated — no more 'resolved' without proof." />
          <Feature icon={<Flame />} title="Predictive hotspots" body="Recurring problem zones surface for proactive maintenance." />
          <Feature icon={<Siren />} title="Auto-escalation" body="Unresolved issues escalate after 3 and 7 days." />
          <Feature icon={<MapPin />} title="Live map & heatmap" body="Clustered pins and severity heatmaps, updated in realtime." />
          <Feature icon={<Trophy />} title="Gamified" body="Points, badges and a community leaderboard." />
          <Feature className="md:col-span-2" icon={<Languages />} title="Inclusive & multilingual"
            body="English, हिन्दी and ગુજરાતી out of the box, so every resident can take part." />
        </div>
      </section>

      {/* ===== Quote band ===== */}
      <section className="bg-primary py-16 text-primary-fg">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Quote className="mx-auto size-8 text-accent" />
          <p className="mt-4 font-display text-2xl font-medium leading-snug sm:text-3xl">
            “The problem was never reporting — it was the silence after. Community Hero makes the
            response visible, and the fix provable.”
          </p>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold">
          Be the hero your community needs.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          It takes ten seconds to report. Join your neighbours making the city work.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/report"><Camera className="size-5" /> Report an issue</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/map">See live reports <ArrowRight className="size-4" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        Community Hero — Hyperlocal Problem Solver · built with AI for accountable cities
      </footer>
    </div>
  )
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold text-white">{n}</div>
      <div className="text-xs">{l}</div>
    </div>
  )
}

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{kicker}</p>
      <h2 className="mt-1.5 font-display text-3xl font-semibold sm:text-4xl">{title}</h2>
    </div>
  )
}

function Tile({ image, label }: { image: string; label: string }) {
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)]">
      <img src={image} alt={label} loading="lazy" className="size-full object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
      <span className="absolute bottom-4 left-4 font-display text-xl font-semibold text-white">{label}</span>
    </div>
  )
}

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="relative rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <span className="absolute right-4 top-4 font-mono text-sm font-bold text-border-strong">0{n}</span>
      <span className="grid size-11 place-items-center rounded-xl bg-primary-tint text-primary [&_svg]:size-5">{icon}</span>
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
    </div>
  )
}

function Feature({ icon, title, body, className }: { icon: React.ReactNode; title: string; body: string; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] ${className ?? ''}`}>
      <span className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent-fg [&_svg]:size-5">{icon}</span>
      <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1.5 text-ink-soft">{body}</p>
    </div>
  )
}

/** A faux issue card that mirrors the real product UI — the hero's visual anchor. */
function FloatingPreview() {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="rounded-[var(--radius-card)] border border-white/15 bg-surface p-4 shadow-[var(--shadow-pop)]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary">Pothole / Road Damage</span>
          <StatusBadge status="ai_validated" />
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold">Deep pothole near Alkapuri bus stop</h3>
        <p className="mt-1 text-sm text-ink-soft">A large water-filled pothole spanning the lane, risk to two-wheelers.</p>
        <div className="mt-3"><SeverityMeter severity={8} /></div>
      </div>

      <div className="absolute -bottom-6 -left-6 w-56 rounded-2xl border border-status-resolved/30 bg-surface p-3 shadow-[var(--shadow-pop)]">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-status-resolved">
          <ShieldCheck className="size-4" /> AI fix verified · 94%
        </p>
        <p className="mt-0.5 text-xs text-muted">Resolution photo matches the reported damage.</p>
      </div>
    </div>
  )
}
