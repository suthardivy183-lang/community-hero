import { useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bell } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useNotifications, useMarkAllRead, useRealtimeNotifications } from '@/features/notifications/queries'
import { timeAgo } from '@/lib/utils'

export function NotificationBell() {
  const { session } = useAuth()
  const userId = session?.user.id
  useRealtimeNotifications(userId)
  const { data: notifications } = useNotifications(userId)
  const markRead = useMarkAllRead(userId)
  const navigate = useNavigate()

  if (!session) return null
  const unread = (notifications ?? []).filter((n) => !n.read).length

  return (
    <DropdownMenu.Root onOpenChange={(open) => { if (open && unread > 0) markRead.mutate() }}>
      <DropdownMenu.Trigger asChild>
        <button className="relative grid size-9 place-items-center rounded-lg border border-border bg-surface text-ink-soft transition-colors hover:border-border-strong" aria-label="Notifications">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-status-rejected px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-pop)]">
          <p className="px-2.5 py-2 text-sm font-semibold">Notifications</p>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {notifications && notifications.length > 0 ? (
            notifications.map((n) => (
              <DropdownMenu.Item
                key={n.id}
                onSelect={() => n.issue_id && navigate(`/issue/${n.issue_id}`)}
                className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-surface-sunk"
              >
                <span className="line-clamp-1 font-medium">{n.title}</span>
                <span className="text-xs text-ink-soft">{n.body}</span>
                <span className="text-[11px] text-muted">{timeAgo(n.created_at)}</span>
              </DropdownMenu.Item>
            ))
          ) : (
            <p className="px-2.5 py-6 text-center text-sm text-muted">No notifications yet.</p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
