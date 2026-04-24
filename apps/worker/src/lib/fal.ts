import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY! })

export function isFalConfigured(): boolean {
  return Boolean(process.env.FAL_KEY)
}

export async function generateAdvertorialImage(
  prompt: string,
  aspectRatio: '1:1' | '4:5' | '16:9' | '9:16',
): Promise<string> {
  const sizes: Record<string, { width: number; height: number }> = {
    '1:1':  { width: 1024, height: 1024 },
    '4:5':  { width: 1024, height: 1280 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768,  height: 1344 },
  }
  const { width, height } = sizes[aspectRatio] ?? sizes['1:1']
  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: { prompt, image_size: { width, height }, num_images: 1, output_format: 'jpeg' },
    logs: false,
  }) as unknown as { images: { url: string }[] }
  return result.images[0].url
}

export async function generateStaticAd(
  prompt: string,
  format: '1:1' | '4:5' | '9:16'
): Promise<{ imageUrl: string; format: string }> {
  const sizes = {
    '1:1': { width: 1024, height: 1024 },
    '4:5': { width: 1024, height: 1280 },
    '9:16': { width: 768, height: 1365 },
  }
  const { width, height } = sizes[format]
  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: { prompt, image_size: { width, height }, num_images: 1, output_format: 'jpeg' },
    logs: false,
  }) as unknown as { images: { url: string }[] }
  return { imageUrl: result.images[0].url, format }
}

export async function generateVideoDraft(prompt: string, _audioUrl: string): Promise<string> {
  const result = await fal.subscribe('fal-ai/minimax/video-01-live', {
    input: { prompt, duration: 6 },
    logs: false,
  }) as unknown as { video: { url: string } }
  return result.video.url
}

export async function generateVideoFinal(prompt: string): Promise<string> {
  const result = await fal.subscribe('fal-ai/kling-video/v2/master/text-to-video', {
    input: { prompt, duration: '10', aspect_ratio: '9:16' },
    logs: false,
  }) as unknown as { video: { url: string } }
  return result.video.url
}

export async function generateVoiceover(script: string): Promise<string> {
  const result = await fal.subscribe('fal-ai/playai/tts/v3', {
    input: {
      input: script,
      voice: 'Jennifer (English (US)/American)',
      output_format: 'mp3',
    },
    logs: false,
  }) as unknown as { audio: { url: string } }
  return result.audio.url
}
