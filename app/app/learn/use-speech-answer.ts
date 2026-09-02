import { useEffect, useRef, useState } from 'react'

type Alternative = { transcript: string }
type Result = { length: number; isFinal: boolean; [index: number]: Alternative }
type ResultList = { length: number; [index: number]: Result }
type Recognizer = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  abort: () => void
  onresult: ((event: { results: ResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognizerCtor = new () => Recognizer

const MIC_KEY = 'um.mic'
const SILENCE = 'no-speech'

function recognizerCtor(): RecognizerCtor | null {
  if (typeof window === 'undefined') return null
  const engine = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor }
  return engine.SpeechRecognition ?? engine.webkitSpeechRecognition ?? null
}

function loadMic(): boolean {
  try {
    return localStorage.getItem(MIC_KEY) === '1'
  } catch {
    return false
  }
}

function alternatives(result: Result): string[] {
  return Array.from({ length: result.length }, (_, i) => result[i].transcript.trim()).filter(Boolean)
}

export function useSpeechAnswer(active: boolean, onHeard: (heard: string[]) => void) {
  const [supported] = useState(() => recognizerCtor() !== null)
  const [on, setOn] = useState(loadMic)
  const [interim, setInterim] = useState('')
  const heard = useRef(onHeard)
  const listening = supported && on && active

  useEffect(() => {
    heard.current = onHeard
  })

  const setMic = (next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(MIC_KEY, next ? '1' : '0')
    } catch {}
  }

  useEffect(() => {
    const Ctor = recognizerCtor()
    if (!listening || Ctor === null) return
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 5
    let done = false
    const restart = () => {
      if (done) return
      try {
        rec.start()
      } catch {}
    }
    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      if (!result.isFinal) {
        setInterim(result[0].transcript.trim())
        return
      }
      setInterim('')
      const said = alternatives(result)
      if (said.length > 0) heard.current(said)
    }
    rec.onerror = (event) => {
      if (event.error === SILENCE) return
      done = true
      setMic(false)
    }
    rec.onend = restart
    restart()
    return () => {
      done = true
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      rec.abort()
      setInterim('')
    }
  }, [listening])

  return { supported, on, setMic, listening, interim: listening ? interim : '' }
}
