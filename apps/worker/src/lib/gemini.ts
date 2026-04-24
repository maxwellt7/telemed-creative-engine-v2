import { GoogleGenAI } from '@google/genai'

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.5-pro'
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.0-flash-preview-image-generation'

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
}

export interface CallGeminiTextOptions {
  model?: string
  system: string
  prompt: string
  maxOutputTokens?: number
  temperature?: number
}

export async function callGeminiText(opts: CallGeminiTextOptions): Promise<string> {
  const ai = getClient()
  const response = await ai.models.generateContent({
    model: opts.model ?? GEMINI_TEXT_MODEL,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      temperature: opts.temperature ?? 0.7,
    },
  })
  const text = response.text
  if (!text) throw new Error('Empty Gemini text response')
  return text
}

export interface CallGeminiImageOptions {
  model?: string
  prompt: string
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9' | '3:2'
  numberOfImages?: number
}

export async function callGeminiImage(
  opts: CallGeminiImageOptions,
): Promise<{ imageBase64: string; mimeType: string }> {
  const ai = getClient()
  const model = opts.model ?? GEMINI_IMAGE_MODEL

  // Imagen 3 path
  if (model.includes('imagen')) {
    const response = await (ai.models as any).generateImages({
      model,
      prompt: opts.prompt,
      config: {
        numberOfImages: opts.numberOfImages ?? 1,
        aspectRatio: opts.aspectRatio ?? '1:1',
        outputMimeType: 'image/jpeg',
      },
    })
    const img = response?.generatedImages?.[0]?.image
    if (!img?.imageBytes) throw new Error('No image bytes from Imagen response')
    const bytes = img.imageBytes
    const base64 = typeof bytes === 'string' ? bytes : Buffer.from(bytes).toString('base64')
    return { imageBase64: base64, mimeType: 'image/jpeg' }
  }

  // Gemini native image output path
  const response = await ai.models.generateContent({
    model,
    contents: opts.prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'] as any,
    },
  })
  const part = (response as any).candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData?.mimeType?.startsWith('image/'),
  )
  if (!part?.inlineData) throw new Error('No image part in Gemini response')
  return {
    imageBase64: part.inlineData.data as string,
    mimeType: part.inlineData.mimeType as string,
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}
