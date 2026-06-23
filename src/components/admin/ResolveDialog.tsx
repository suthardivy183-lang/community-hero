import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Camera, ShieldCheck, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useIssueMedia } from '@/features/issues/queries'
import { useResolveWithProof, type ResolveResult } from '@/features/admin/mutations'
import { mediaUrl } from '@/lib/supabase'
import { processImage, type ProcessedImage } from '@/lib/image'
import type { IssueView } from '@/lib/issues'
import { Button } from '@/components/ui/Button'

interface ResolveDialogProps {
  issue: IssueView
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResolveDialog({ issue, open, onOpenChange }: ResolveDialogProps) {
  const { session } = useAuth()
  const { data: media } = useIssueMedia(issue.id as string)
  const resolve = useResolveWithProof()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<ProcessedImage | null>(null)
  const [result, setResult] = useState<ResolveResult | null>(null)

  const original = media?.find((m) => m.kind === 'original')

  async function handleFile(file: File) {
    setPhoto(await processImage(file))
    setResult(null)
  }

  async function submit() {
    if (!photo || !session) return
    const res = await resolve.mutateAsync({
      issueId: issue.id as string,
      category: issue.category_name ?? 'general',
      beforeUrl: original ? mediaUrl(original.storage_path) : null,
      beforeMediaId: original?.id ?? null,
      blob: photo.blob,
      validatorId: session.user.id,
    })
    setResult(res)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-pop)]">
          <div className="mb-1 flex items-center justify-between">
            <Dialog.Title className="font-display text-xl font-semibold">Resolve with proof</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted hover:bg-surface-sunk"><X className="size-5" /></Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-muted">
            Upload an "after" photo. AI compares it with the original to verify the fix is genuine.
          </Dialog.Description>

          <div className="grid grid-cols-2 gap-3">
            <figure>
              <figcaption className="mb-1 text-xs font-semibold text-muted">Before</figcaption>
              {original ? (
                <img src={mediaUrl(original.storage_path)} alt="Before" className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <div className="grid aspect-square w-full place-items-center rounded-lg bg-surface-sunk text-xs text-muted">No photo</div>
              )}
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs font-semibold text-muted">After</figcaption>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              {photo ? (
                <img src={photo.previewUrl} alt="After" className="aspect-square w-full cursor-pointer rounded-lg object-cover" onClick={() => fileRef.current?.click()} />
              ) : (
                <button onClick={() => fileRef.current?.click()} className="grid aspect-square w-full place-items-center rounded-lg border-2 border-dashed border-border-strong text-muted hover:border-primary hover:text-primary">
                  <Camera className="size-6" />
                </button>
              )}
            </figure>
          </div>

          {result ? (
            <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: `color-mix(in oklch, var(--color-status-${result.verdict === 'genuine' ? 'resolved' : 'progress'}) 14%, transparent)` }}>
              <p className="flex items-center gap-1.5 font-semibold capitalize" style={{ color: `var(--color-status-${result.verdict === 'genuine' ? 'resolved' : 'progress'})` }}>
                <ShieldCheck className="size-4" /> AI verdict: {result.verdict} ({Math.round(result.confidence * 100)}%)
              </p>
              <p className="mt-1 text-ink-soft">{result.explanation}</p>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            {result ? (
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            ) : (
              <>
                <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
                <Button onClick={submit} disabled={!photo} loading={resolve.isPending}>
                  {resolve.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Verify & resolve
                </Button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
