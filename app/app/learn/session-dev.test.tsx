import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { replaySession, type Trial } from '@/lib/session'
import { lesson } from '@/lib/session.fixtures'
import { DevDock } from './session-dev'

test('the item strip lights the served item by identity, so a review block of tests points at the right dot', () => {
  const plan = { startedAt: 0, blocks: [{ kind: 'review' as const, rows: [{ row: 1, set: 1 }], budgetMs: 90000 }] }
  const tests = lesson.items.filter((it) => it.row === 1 && it.role === 'test')
  const trials: Trial[] = tests.slice(0, 4).map((it, i) => ({ typed: it.expected, at: i + 1 }))
  const session = replaySession(lesson, plan, trials)
  const block = session.blocks[0]
  const now = block.current!.lesson.items[block.current!.state.current!.item]
  const view = render(
    <DevDock
      lesson={lesson}
      auto={false}
      onAuto={() => {}}
      onReset={() => {}}
      onJump={() => {}}
      playing
      activeBlock={block}
      now={now}
      history={null}
      atomRows={[1]}
      atomOf={String}
    />,
  )
  const lit = [...view.container.querySelectorAll('[aria-current="step"]')]
  expect(lit.map((b) => b.getAttribute('aria-label'))).toEqual([`atom 1 checking 5 of ${tests.length}`])
})
