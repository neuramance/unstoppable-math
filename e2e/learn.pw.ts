import { execSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'

async function seedSeenIntro(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('um.intro-seen', '1'))
}

async function openLearn(page: Page) {
  await seedSeenIntro(page)
  await page.goto('/app/learn')
  await expect(page.getByRole('heading', { name: 'Ready to break some blocks?' })).toBeVisible()
}

test('/ and /app redirect to the learn page, which carries the title and the paper theme', async ({ page }) => {
  await seedSeenIntro(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/app\/learn$/)
  await expect(page).toHaveTitle('Learn · Unstoppable Math')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(248, 247, 243)')
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app\/learn$/)
})

test.skip('the intro film plays on a first visit, Skip lands on the page, and it stays gone for the session', async ({
  page,
}) => {
  await page.goto('/app/learn')
  const skip = page.getByRole('button', { name: 'Skip', exact: true })
  await expect(skip).toBeVisible()
  await skip.click()
  await expect(page.getByRole('heading', { name: 'Ready to break some blocks?' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ready to break some blocks?' })).toBeVisible()
})

test('a session runs: Enter begins, models advance, a miss re-serves, a hit is affirmed', async ({ page }) => {
  await openLearn(page)
  await page.keyboard.press('Enter')
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await expect(next).toBeVisible({ timeout: 10_000 })
  while (await next.isVisible()) {
    await next.click()
    await page.waitForTimeout(250)
  }
  const answer = page.getByRole('textbox', { name: 'Your answer' })
  await expect(answer).toBeVisible()
  const firstPrompt = await page.locator('p[aria-live]').textContent()
  await answer.fill('definitely wrong')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('not quite')).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.locator('p[aria-live]')).toHaveText(firstPrompt ?? '', { timeout: 5_000 })
  await answer.fill('four')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('correct', { exact: true })).toBeVisible()
})

test('dev autoplay clears a whole session to the done screen, and Done returns to a fresh intro', async ({ page }) => {
  test.setTimeout(240_000)
  await openLearn(page)
  await page.getByRole('button', { name: 'Begin session' }).click()
  await page.getByRole('button', { name: 'Autoplay session' }).click()
  const done = page.getByRole('heading', { name: /Stack cleared!|Stack done!/ })
  await expect(done).toBeVisible({ timeout: 220_000 })
  await expect(page.getByText('blocks cleared')).toBeVisible()
  await expect(page.getByText('atoms firmed')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Ready to break some blocks?' })).toBeVisible({ timeout: 15_000 })
})

test('a dev jump chip lands on its atom, and the story chip mounts the film stage with a dev Skip', async ({
  page,
}) => {
  await openLearn(page)
  await page.getByRole('button', { name: 'Begin session' }).click()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'atom 2 checking', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'story', exact: true }).click()
  await expect(page.locator('video')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.locator('video')).not.toBeVisible({ timeout: 10_000 })
})

test('the theme picker switches to Pure Dark, restyles the page, and survives a reload', async ({ page }) => {
  await openLearn(page)
  await page.getByRole('button', { name: /Learner/ }).click()
  await page.getByRole('menuitem', { name: /Theme/ }).click()
  await page.getByRole('menuitemradio', { name: 'Pure Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pure')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(0, 0, 0)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pure')
  const bg2 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg2).toBe('rgb(0, 0, 0)')
})

test('captions preference persists on the device', async ({ page }) => {
  await openLearn(page)
  await page.getByRole('button', { name: 'Begin session' }).click()
  const cc = page.getByRole('button', { name: 'Captions' })
  await expect(cc).toBeVisible({ timeout: 10_000 })
  const before = await cc.getAttribute('aria-pressed')
  await cc.click()
  const after = await cc.getAttribute('aria-pressed')
  expect(after).not.toBe(before)
  const stored = await page.evaluate(() => localStorage.getItem('um.cc'))
  expect(stored).toBe(after === 'true' ? '1' : '0')
})

test('progress survives a reload and mirrors to app_state', async ({ page }) => {
  await openLearn(page)
  await page.getByRole('button', { name: 'Begin session' }).click()
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await expect(next).toBeVisible({ timeout: 10_000 })
  await next.click()
  await page.waitForTimeout(700)
  const key = await page.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('um.session.nf-fractions:')))
  expect(key).toBeTruthy()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ready to break some blocks?' })).not.toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/block \d+ of \d+/)).toBeVisible()
  const uid = await page.evaluate(() => localStorage.getItem('um.uid'))
  expect(uid).toBeTruthy()
  await expect
    .poll(
      () =>
        execSync(
          `docker exec supabase_db_unstoppable-math psql -U postgres -tAc "select count(*) from app_state where user_id = '${uid}' and key like 'um.session.nf-fractions:%'"`,
          { encoding: 'utf8' },
        ).trim(),
      { timeout: 15_000 },
    )
    .not.toBe('0')
})

test('a failed lesson fetch shows the retry gate, and a stale lesson shows the reload gate', async ({ page }) => {
  await seedSeenIntro(page)
  await page.route('**/lessons/NF_Fractions.lesson.json', (route) => route.fulfill({ status: 500, body: 'nope' }))
  await page.goto('/app/learn')
  await expect(page.getByText("The lesson didn't load.", { exact: false })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await page.unroute('**/lessons/NF_Fractions.lesson.json')
  await page.route('**/lessons/NF_Fractions.lesson.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ topic: 'nf-fractions', source: 'x', items: [{ mode: 'bogus' }] }),
    }),
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('lesson file that doesn', { exact: false })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
})

test('a spoken answer is heard and graded in the browser, and the choice persists', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    let live: ((event: unknown) => void) | null = null
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 0
      onresult: ((event: unknown) => void) | null = null
      onerror: (() => void) | null = null
      onend: (() => void) | null = null
      start() {
        live = this.onresult
      }
      abort() {
        live = null
      }
    }
    w.SpeechRecognition = FakeRecognition
    w.webkitSpeechRecognition = FakeRecognition
    w.__say = (transcripts: string[], isFinal: boolean) =>
      live?.({
        results: [
          Object.assign(
            transcripts.map((transcript) => ({ transcript })),
            { isFinal },
          ),
        ],
      })
  })
  await openLearn(page)
  await page.getByRole('button', { name: 'Begin session' }).click()
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await expect(next).toBeVisible({ timeout: 10_000 })
  while (await next.isVisible()) {
    await next.click()
    await page.waitForTimeout(250)
  }
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeVisible()

  const mic = page.getByRole('button', { name: 'Microphone' })
  await mic.click()
  await expect(page.getByText('listening', { exact: true })).toBeVisible({ timeout: 10_000 })
  expect(await page.evaluate(() => localStorage.getItem('um.mic'))).toBe('1')

  await page.evaluate(() => (window as unknown as { __say: (t: string[], f: boolean) => void }).__say(['fo'], false))
  await expect(page.getByText('fo', { exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __say: (t: string[], f: boolean) => void }).__say(['four'], true))
  await expect(page.getByText('correct', { exact: true })).toBeVisible({ timeout: 10_000 })
})
