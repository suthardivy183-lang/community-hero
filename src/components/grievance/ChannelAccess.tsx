import { MessageCircle, PhoneCall, MonitorSmartphone } from 'lucide-react'
import { Link } from 'react-router-dom'

const whatsappNumber = (import.meta.env.VITE_WHATSAPP_GRIEVANCE_NUMBER as string | undefined)?.replace(/\D/g, '')
const ivrNumber = import.meta.env.VITE_IVR_GRIEVANCE_NUMBER as string | undefined

/** Entry links only become live when the municipality configures real channels. */
export function ChannelAccess() {
  const message = encodeURIComponent('Hello CommunityHero, I want to lodge a grievance.')
  return <div className="mt-4 grid gap-2 sm:grid-cols-3">
    {whatsappNumber ? <a href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noreferrer" className="channel-card"><MessageCircle className="size-4 text-status-resolved" /> WhatsApp</a> : <span className="channel-card opacity-60" title="A municipal WhatsApp number has not been configured yet"><MessageCircle className="size-4" /> WhatsApp soon</span>}
    {ivrNumber ? <a href={`tel:${ivrNumber}`} className="channel-card"><PhoneCall className="size-4 text-primary" /> Call IVR</a> : <span className="channel-card opacity-60" title="An IVR helpline has not been configured yet"><PhoneCall className="size-4" /> IVR soon</span>}
    <Link to="/kiosk" className="channel-card"><MonitorSmartphone className="size-4 text-accent-fg" /> Help desk</Link>
  </div>
}
