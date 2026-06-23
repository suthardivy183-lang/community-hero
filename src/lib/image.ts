const MAX_DIM = 1280
const QUALITY = 0.82

export interface ProcessedImage {
  blob: Blob
  base64: string
  mimeType: string
  previewUrl: string
}

/** Downscale + recompress an image file in-browser, returning blob + base64. */
export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const mimeType = 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encode failed'))), mimeType, QUALITY)
  })

  const base64 = await blobToBase64(blob)
  return { blob, base64, mimeType, previewUrl: URL.createObjectURL(blob) }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
