import { fireEvent, render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { Lesson } from '@/lib/lesson'
import { FakeAudio, flush, Host, line } from './teach.fixtures'

class FakeRecognition {
  static instances: FakeRecognition[] = []
  static starts = 0
  lang = ''
  continuous = true
  interimResults = false
  maxAlternatives = 0
  onresult: ((event: { results: unknown }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  constructor() {
    FakeRecognition.instances.push(this)
  }
  start(): void {
    FakeRecognition.starts += 1
  }
  abort(): void {}
}

const globals = globalThis as unknown as Record<string, unknown>
globals.webkitSpeechRecognition = FakeRecognition

beforeEach(() => {
  FakeRecognition.instances = []
  FakeRecognition.starts = 0
})
afterEach(() => {
  globals.webkitSpeechRecognition = FakeRecognition
})

const lessonOf = (mode: 'shade' | 'typed', role: 'model' | 'test'): Lesson => ({
  topic: 'x',
  source: 'x',
  items: [{ row: 1, role, mode, prompt: 'Shade it.', expected: '3', demo: 'Three.', figures: [line(4)] }],
})

function said(isFinal: boolean, transcripts: string[]) {
  return {
    results: [
      Object.assign(
        transcripts.map((transcript) => ({ transcript })),
        { isFinal },
      ),
    ],
  }
}

const recognizer = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]
const speak = async (transcripts: string[]) => {
  act(() => recognizer().onresult!(said(true, transcripts)))
  await flush()
}
const verdict = () => document.querySelector('[role="status"] p')?.textContent

async function listening(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByLabelText('Microphone'))
  await flush()
  act(() => FakeAudio.instances[0].onended!())
  await flush()
}

test('a browser with no recognizer offers no microphone at all, and typing is untouched', async () => {
  delete globals.webkitSpeechRecognition
  const view = render(<Host />)
  await flush()
  expect(view.queryByLabelText('Microphone')).toBeNull()
  expect(view.getByLabelText('Your answer')).toBeTruthy()
})

test('the microphone is off until it is asked for, and the choice survives a remount', async () => {
  const view = render(<Host />)
  await flush()
  expect(FakeRecognition.starts).toBe(0)
  fireEvent.click(view.getByLabelText('Microphone'))
  expect(localStorage.getItem('um.mic')).toBe('1')
  view.unmount()
  const again = render(<Host />)
  await flush()
  expect(again.getByLabelText('Microphone').getAttribute('aria-pressed')).toBe('true')
})

test('nothing listens while the lesson is still speaking, so it never hears itself', async () => {
  const view = render(<Host />)
  await flush()
  fireEvent.click(view.getByLabelText('Microphone'))
  await flush()
  expect(FakeRecognition.starts).toBe(0)
  act(() => FakeAudio.instances[0].onended!())
  await flush()
  expect(FakeRecognition.starts).toBe(1)
  expect(recognizer().interimResults).toBe(true)
  expect(recognizer().maxAlternatives).toBe(5)
  expect(recognizer().continuous).toBe(false)
})

test('a spoken answer is graded the moment it is final', async () => {
  const view = render(<Host />)
  await listening(view)
  await speak(['four'])
  expect(verdict()).toBe('correct')
})

test('a later alternative wins when the top one is noise', async () => {
  const view = render(<Host />)
  await listening(view)
  await speak(['for', 'fore', 'four'])
  expect(verdict()).toBe('correct')
})

test('a mishear is submitted exactly as heard and scored honestly', async () => {
  const view = render(<Host />)
  await listening(view)
  await speak(['banana bread'])
  expect(verdict()).toBe('not quite')
  expect((view.getByLabelText('Your answer') as HTMLInputElement).value).toBe('banana bread')
})

test('interim speech is shown while it is still being said, then cleared', async () => {
  const view = render(<Host />)
  await listening(view)
  expect(view.getByText('listening')).toBeTruthy()
  act(() => recognizer().onresult!(said(false, ['fo'])))
  expect(view.getByText('fo')).toBeTruthy()
  await speak(['four'])
  expect(view.queryByText('fo')).toBeNull()
})

test('a silence that ends the recognizer starts it listening again', async () => {
  const view = render(<Host />)
  await listening(view)
  expect(FakeRecognition.starts).toBe(1)
  act(() => recognizer().onend!())
  expect(FakeRecognition.starts).toBe(2)
})

test.each(['not-allowed', 'audio-capture', 'network'])(
  'a microphone that cannot be used (%s) turns itself off instead of retrying forever',
  async (error) => {
    const view = render(<Host />)
    await listening(view)
    const armed = FakeRecognition.starts
    const ended = recognizer().onend!
    act(() => recognizer().onerror!({ error }))
    for (let i = 0; i < 20; i++) act(() => ended())
    await flush()
    expect(FakeRecognition.starts).toBe(armed)
    expect(view.getByLabelText('Microphone').getAttribute('aria-pressed')).toBe('false')
    expect(localStorage.getItem('um.mic')).toBe('0')
    expect(view.queryByText('listening')).toBeNull()
  },
)

test('an ordinary silence is not a refusal: it keeps listening', async () => {
  const view = render(<Host />)
  await listening(view)
  act(() => recognizer().onerror!({ error: 'no-speech' }))
  act(() => recognizer().onend!())
  expect(FakeRecognition.starts).toBe(2)
  expect(view.getByLabelText('Microphone').getAttribute('aria-pressed')).toBe('true')
})

test('shading, modelling and autoplay are never open to a spoken answer', async () => {
  localStorage.setItem('um.mic', '1')
  for (const props of [{ lesson: lessonOf('shade', 'test') }, { lesson: lessonOf('typed', 'model') }, { auto: true }]) {
    const view = render(<Host {...props} />)
    await flush()
    act(() => FakeAudio.instances[0]?.onended?.())
    await flush()
    expect(FakeRecognition.starts).toBe(0)
    view.unmount()
  }
})

const FRAC: Lesson = {
  topic: 'frac',
  source: 'frac',
  items: [
    {
      row: 1,
      role: 'test',
      mode: 'frac',
      prompt: 'Write the fraction.',
      expected: '3/5',
      demo: 'Three fifths.',
      frac: { num: null, den: null },
      figures: [line(5)],
    },
  ],
}

const ALOUD: Lesson = {
  topic: 'aloud',
  source: 'aloud',
  items: [
    {
      row: 1,
      role: 'test',
      mode: 'typed',
      prompt: 'Say the fraction out loud. 4/8',
      expected: 'four eighths',
      demo: 'Four eighths.',
    },
  ],
}

test('a fraction said out loud reaches the symbol form the slots wanted', async () => {
  const view = render(<Host lesson={FRAC} />)
  await listening(view)
  await speak(['three fifths'])
  expect(verdict()).toBe('correct')
})

test('an item that asks for the words wants the words, not the symbol', async () => {
  const view = render(<Host lesson={ALOUD} />)
  await listening(view)
  await speak(['four eighths'])
  expect(verdict()).toBe('correct')
})

test('a microphone already on at mount stays shut until the question has been spoken', async () => {
  localStorage.setItem('um.mic', '1')
  render(<Host />)
  await flush()
  expect(FakeRecognition.starts).toBe(0)
  act(() => FakeAudio.instances[0].onended!())
  await flush()
  expect(FakeRecognition.starts).toBe(1)
})

test('a muted lesson has nothing to overhear, so the mic opens without waiting for the clip', async () => {
  localStorage.setItem('um.mic', '1')
  render(<Host muted />)
  await flush()
  expect(FakeRecognition.starts).toBe(1)
})

test('the interim transcript is shown but never announced, so it cannot babble at a screen reader', async () => {
  const view = render(<Host />)
  await listening(view)
  act(() => recognizer().onresult!(said(false, ['fo'])))
  const node = view.getByText('fo').closest('p')!
  expect(node.getAttribute('aria-live')).toBeNull()
  expect(node.getAttribute('role')).toBeNull()
})

test('speech heard while the page is hidden or the shell is covered is not an answer', async () => {
  const hide = (hidden: boolean) => Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  const view = render(<Host />)
  await listening(view)
  hide(true)
  await speak(['four'])
  expect(verdict()).toBeUndefined()
  hide(false)
  const shell = document.createElement('div')
  shell.setAttribute('data-appshell', '')
  shell.setAttribute('inert', '')
  document.body.append(shell)
  await speak(['four'])
  expect(verdict()).toBeUndefined()
  shell.remove()
  await speak(['four'])
  expect(verdict()).toBe('correct')
})
