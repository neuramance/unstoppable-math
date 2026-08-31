import * as stylex from '@stylexjs/stylex'
import { useEffect, useMemo, useState } from 'react'
import type { Lesson } from '@/lib/lesson'
import type { LogAudit } from '@/lib/session'
import { chrome } from './chrome'
import { NarrativeFilm } from './narrative-film'
import { DevDock } from './session-dev'
import { SessionDone } from './session-done'
import { StackCard } from './session-stack'
import { LessonPlayer } from './teach'
import { EnterKey, shellInert } from './ui'
import { useSessionLog } from './use-session-log'
import { useSessionPhase } from './use-session-phase'

const REGISTER = {
  eyebrow: 'Today · fractions',
  heroTitle: 'Ready to break some blocks?',
  heroSub: (blocks: number) =>
    `Your session is a stack of ${blocks} short blocks. Clear one, smash it, and the next drops down.`,
  begin: 'Begin session',
  staleTag: ' · lesson updated',
  staleNote:
    'Some of these questions changed since your last visit, so those atoms come back for another pass. Everything you kept firm stays firm.',
  resetTag: ' · progress reset',
  resetNote: 'Your saved progress would not load, so this stack starts from the top.',
}

const WIDE = '@media (min-width: 1048px)'
const NARROW = '@media (max-width: 760px)'

const s = stylex.create({
  sess: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '34px',
    width: '100%',
    maxWidth: { default: '1040px', [WIDE]: '1196px' },
    marginBlock: 0,
    marginInline: 'auto',
    flexDirection: { default: 'row', [NARROW]: 'column' },
  },
  sessWithDock: {
    paddingBottom: '344px',
  },
  sessaside: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: { default: '280px', [NARROW]: 'auto' },
    width: { default: null, [NARROW]: '100%' },
    minWidth: 0,
    zoom: { default: null, [WIDE]: 1.15 },
  },
  sessmain: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    zoom: { default: null, [WIDE]: 1.15 },
  },
})

function noticeFor(wiped: boolean, audit: LogAudit | null) {
  if (wiped) return { tag: REGISTER.resetTag, note: REGISTER.resetNote }
  if ((audit?.lostRows.length ?? 0) > 0) return { tag: REGISTER.staleTag, note: REGISTER.staleNote }
  return null
}

export function Session({ lesson, dev, onExit }: { lesson: Lesson; dev: boolean; onExit: () => void }) {
  const log = useSessionLog(lesson)
  const { session, live, history } = log
  const phases = useSessionPhase(session)
  const { phase, shown, playing } = phases
  const [auto, setAuto] = useState(false)

  const plan = phase === 'idle' ? log.preview : (live?.plan ?? log.preview)
  const atomRows = useMemo(() => [...new Set(lesson.items.map((it) => it.row))], [lesson])
  const atomOf = (row: number) => lesson.atoms?.[row] ?? String(row)
  const firmCount = useMemo(() => (history ? [...history.values()].filter((r) => r.firmed).length : 0), [history])
  const notice = noticeFor(log.wiped, log.audit)

  const begin = () => {
    log.begin()
    phases.start()
  }

  const jump = (row: number | null, now: number, kind: 'instruction' | 'testing' = 'instruction', item = 0) => {
    log.jump(row, now, kind, item)
    phases.clear()
  }

  const reset = () => {
    log.reset()
    phases.clear()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key !== 'Enter' || shellInert()) return
      if (phase === 'idle') {
        e.preventDefault()
        begin()
      } else if (phase === 'done') {
        e.preventDefault()
        onExit()
      } else if (phase === 'active' && session && !session.done) {
        if (session.blocks[session.blockIndex].plan.kind === 'narrative') {
          e.preventDefault()
          log.append({ typed: '' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const activeBlock = playing && session ? session.blocks[session.blockIndex] : null
  const cur = activeBlock?.current ?? null
  const atItem = cur?.state.current?.item ?? null

  return (
    <section {...stylex.props(s.sess, dev && s.sessWithDock)}>
      {dev && (
        <DevDock
          lesson={lesson}
          auto={auto}
          onAuto={setAuto}
          onReset={reset}
          onJump={jump}
          playing={playing}
          activeBlock={activeBlock}
          atItem={atItem}
          history={history}
          atomRows={atomRows}
          atomOf={atomOf}
        />
      )}
      <aside {...stylex.props(s.sessaside, chrome.rise)}>
        <StackCard
          plan={plan}
          phase={phase}
          shown={shown}
          entrance={phases.entrance}
          firmCount={firmCount}
          totalRows={atomRows.length}
          atomOf={atomOf}
        />
      </aside>
      <div {...stylex.props(s.sessmain, chrome.rise)}>
        {phase === 'idle' && (
          <section {...stylex.props(chrome.pintro)}>
            <p {...stylex.props(chrome.eyebrow, chrome.rise)}>
              {REGISTER.eyebrow}
              {notice?.tag}
            </p>
            <h1 {...stylex.props(chrome.h1, chrome.rise)}>{REGISTER.heroTitle}</h1>
            <p {...stylex.props(chrome.lede, chrome.rise)}>
              {REGISTER.heroSub(plan.blocks.length)}
              {notice ? ` ${notice.note}` : ''}
            </p>
            <button
              {...stylex.props(chrome.btn, chrome.cta, chrome.gamePrimary, chrome.rise)}
              onClick={begin}
              data-cuelume-press="press"
              data-cuelume-release="release"
            >
              {REGISTER.begin}
              <EnterKey />
            </button>
          </section>
        )}
        {phase === 'active' && activeBlock?.plan.kind === 'narrative' && lesson.narrative && (
          <NarrativeFilm
            key={live?.starts ?? 0}
            file={lesson.narrative}
            auto={auto}
            dev={dev}
            onDone={() => log.append({ typed: '' })}
          />
        )}
        {phase === 'active' && cur && (
          <LessonPlayer
            key={`${live?.starts ?? 0}:${session?.blockIndex ?? 0}:${cur.rowIndex}`}
            lesson={cur.lesson}
            log={cur.log}
            onTrial={log.append}
            auto={auto}
          />
        )}
        {phase === 'done' && session && <SessionDone session={session} onExit={onExit} />}
      </div>
    </section>
  )
}
