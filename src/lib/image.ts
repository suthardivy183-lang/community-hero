const MAX_DIM = 1280
const QUALITY = 0.82
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50 MB

export interface ProcessedMedia {
  kind: 'photo' | 'video'
  /** Primary blob to store (resized jpeg for photos, original file for video). */
  uploadBlob: Blob
  mimeType: string
  ext: string
  previewUrl: string
  /** A jpeg frame used for AI vision analysis (the photo itself, or a video poster). */
  analysisBase64: string
  /** 64-bit average-hash (hex) for perceptual image-similarity comparison. */
  imageHash: string
  /** For video: the poster jpeg, also stored as a photo for thumbnails + AI validation. */
  posterBlob?: Blob
}

/** 64-bit perceptual average-hash (hex) of a canvas frame. */
function averageHash(src: HTMLCanvasElement): string {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 8
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(src, 0, 0, 8, 8)
  const d = ctx.getImageData(0, 0, 8, 8).data
  const gray: number[] = []
  for (let i = 0; i < 64; i++) gray.push((d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3)
  const avg = gray.reduce((a, b) => a + b, 0) / 64
  let hex = ''
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (gray[i + j] >= avg ? 1 : 0)
    hex += nibble.toString(16)
  }
  return hex
}

/** Dispatch on file type. */
export async function processMedia(file: File): Promise<ProcessedMedia> {
  if (file.type.startsWith('video/')) return processVideo(file)
  return processImage(file)
}

/** Downscale + recompress an image in-browser. */
export async function processImage(file: File): Promise<ProcessedMedia> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await canvasToBlob(canvas)
  const base64 = await blobToBase64(blob)
  const imageHash = averageHash(canvas)
  return {
    kind: 'photo',
    uploadBlob: blob,
    mimeType: 'image/jpeg',
    ext: 'jpg',
    previewUrl: URL.createObjectURL(blob),
    analysisBase64: base64,
    imageHash,
  }
}

/** Validate a video and extract a poster frame for AI + thumbnail. */
export async function processVideo(file: File): Promise<ProcessedMedia> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video is too large (max 50 MB). Please trim it and try again.')
  }
  const previewUrl = URL.createObjectURL(file)
  const poster = await extractPosterFrame(previewUrl)
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  return {
    kind: 'video',
    uploadBlob: file,
    mimeType: file.type || 'video/mp4',
    ext,
    previewUrl,
    analysisBase64: poster.base64,
    imageHash: poster.hash,
    posterBlob: poster.blob,
  }
}

async function extractPosterFrame(url: string): Promise<{ blob: Blob; base64: string; hash: string }> {
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Could not read the video file'))
  })
  // Seek a little in to avoid a black first frame.
  video.currentTime = Math.min(1, (video.duration || 2) / 2)
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
  })

  const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale) || MAX_DIM
  canvas.height = Math.round(video.videoHeight * scale) || Math.round((MAX_DIM * 9) / 16)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  const blob = await canvasToBlob(canvas)
  const base64 = await blobToBase64(blob)
  return { blob, base64, hash: averageHash(canvas) }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/jpeg', QUALITY)
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
