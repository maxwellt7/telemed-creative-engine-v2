import { fal } from '@fal-ai/client'

export async function uploadImage(
  key: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const buffer = Buffer.from(base64, 'base64')
  const filename = key.split('/').pop() ?? 'image.jpg'
  const file = new File([buffer], filename, { type: mimeType })
  const url = await fal.storage.upload(file)
  return url
}
