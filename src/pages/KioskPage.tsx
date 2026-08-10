import { Link } from 'react-router-dom'
import { Accessibility, Globe2, Mic, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'

/** Staff-assisted, full-screen-friendly entry point for municipal help desks. */
export function KioskPage() {
  return <main className="min-h-screen bg-paper px-4 py-8 sm:px-8"><div className="mx-auto max-w-4xl">
    <div className="flex items-center gap-3"><span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-fg"><MonitorSmartphone className="size-7" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">CommunityHero</p><h1 className="font-display text-3xl font-semibold">Help-desk mode</h1></div></div>
    <p className="mt-5 max-w-2xl text-lg text-ink-soft">A guided, staff-assisted way to lodge and track a grievance. Choose a language, speak or type the concern, then review it with the citizen before submitting.</p>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Option icon={<Mic />} title="Voice-first reporting" body="Dictate a new grievance in English, हिन्दी, ગુજરાતી, or another supported language." action={<Link to="/grievance"><Button size="lg" className="w-full">Report a grievance</Button></Link>} /><Option icon={<Globe2 />} title="Citizen tracking" body="Use a complaint number to open the grievance and follow status updates." action={<Link to="/map"><Button size="lg" variant="outline" className="w-full">Open map</Button></Link>} /><Option icon={<Accessibility />} title="Accessible access" body="Large text and low-bandwidth settings are available from the accessibility button." action={<Link to="/"><Button size="lg" variant="outline" className="w-full">Home</Button></Link>} /></div>
    <div className="mt-7 rounded-2xl border border-status-verified/30 bg-status-verified/5 p-4 text-sm text-ink-soft"><ShieldCheck className="mr-2 inline size-4 text-status-verified" />A help-desk operator should sign in before lodging a complaint, so the citizen receives a traceable reference and can choose confidential handling.</div>
  </div></main>
}

function Option({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) {
  return <Card><CardBody className="flex h-full flex-col"><span className="grid size-11 place-items-center rounded-xl bg-primary-tint text-primary">{icon}</span><h2 className="mt-4 font-display text-xl font-semibold">{title}</h2><p className="mt-2 flex-1 text-sm text-muted">{body}</p><div className="mt-5">{action}</div></CardBody></Card>
}
