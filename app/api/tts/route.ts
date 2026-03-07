import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim()
}

const NEURAL2_VOICES: Record<string, string> = {
  'en-IN': 'en-IN-Neural2-A',
  'ta-IN': 'ta-IN-Neural2-A',
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return NextResponse.json(
      { error: 'Google Cloud TTS not configured. Set GOOGLE_APPLICATION_CREDENTIALS.' },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const text = stripMarkdown(String(body.text ?? '').slice(0, 5000))
  const lang = body.lang === 'ta-IN' ? 'ta-IN' : 'en-IN'
  if (!text.trim()) {
    return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 })
  }

  try {
    const { TextToSpeechClient } = await import('@google-cloud/text-to-speech')
    const client = new TextToSpeechClient()
    const voiceName = NEURAL2_VOICES[lang] ?? 'en-IN-Neural2-A'
    const [response] = await client.synthesizeSpeech({
      input: { text: text.trim() },
      voice: { languageCode: lang, name: voiceName },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.9,
        pitch: 1,
      },
    })
    const audio = response.audioContent
    if (!audio || !(audio as Buffer).length) {
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 })
    }
    return new NextResponse(audio as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'TTS failed', details: message },
      { status: 500 },
    )
  }
}
