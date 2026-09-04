import { expect, test, type Page } from '@playwright/test'
import type { Lesson } from '../lib/lesson'
import type { SessionLog } from '../lib/session'

const lesson: Lesson = {
  topic: 'progress-test',
  source: 'test',
  items: [
    {
      row: 1,
      role: 'test',
      mode: 'typed',
      prompt: 'How many parts in each whole unit?',
      expected: '4',
      demo: 'Four parts.',
      figures: [{ kind: 'number-line', units: 2, parts: 4 }],
    },
    {
      row: 1,
      role: 'test',
      mode: 'typed',
      prompt: 'How many whole units?',
      expected: '2',
      demo: 'Two whole units.',
      figures: [{ kind: 'number-line', units: 2, parts: 4 }],
    },
  ],
}

test.beforeEach(async ({ page, context }) => {
  await context.route('**/lessons/NF_Fractions.lesson.json', (route) => route.fulfill({ json: lesson }))
  await context.addInitScript(() => localStorage.setItem('um.cc', '1'))
  await page.goto('/app/learn?dev=0')
  await page.getByRole('button', { name: 'Begin session' }).click()
  await expect(page.getByLabel('Your answer')).toBeVisible()
})

async function savedAnswers(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith('um.session.progress-test:'))!
    return (JSON.parse(localStorage.getItem(key)!) as SessionLog)
      .filter((event) => event.kind === 'trial')
      .map((event) => event.typed)
  })
}

test('a second tab waits for the owner, then resumes its committed progress without overwriting it', async ({
  page,
  context,
}) => {
  await page.getByLabel('Your answer').fill('4')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('correct', { exact: true })).toBeVisible()
  const second = await context.newPage()
  await second.goto('/app/learn?dev=0')
  await expect(second.getByRole('status')).toContainText('open in another tab')
  await expect(second.getByLabel('Your answer')).toHaveCount(0)
  await expect(second.getByRole('button', { name: /Learner/ })).toHaveCount(0)
  await page.close()
  await expect(second.locator('p[aria-live]')).toHaveText('How many whole units?')
  expect(await savedAnswers(second)).toEqual(['4'])
  await second.getByLabel('Your answer').fill('2')
  await second.getByRole('button', { name: 'Check', exact: true }).click()
  await second.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(second.getByRole('heading', { name: 'Stack cleared!' })).toBeVisible()
  expect(await savedAnswers(second)).toEqual(['4', '2'])
})

test('reloading after a wrong Check retains the first-try miss and the correction', async ({ page }) => {
  await page.getByLabel('Your answer').fill('-4')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('not quite')).toBeVisible()
  expect(await savedAnswers(page)).toEqual(['-4'])
  await page.reload()
  await expect(page.locator('p[aria-live]')).toHaveText('How many parts in each whole unit?')
  await page.getByLabel('Your answer').fill('4')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.locator('p[aria-live]')).toHaveText('How many whole units?')
  await page.getByLabel('Your answer').fill('2')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Stack done!' })).toBeVisible()
  await expect(page.getByText('50%', { exact: true })).toBeVisible()
  expect(await savedAnswers(page)).toEqual(['-4', '4', '2'])
})

test('rapid Continue clicks through native view transitions never answer the next question', async ({ page }) => {
  await page.getByLabel('Your answer').fill('4')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  const next = page.getByRole('button', { name: 'Continue', exact: true })
  await expect(next).toBeVisible()
  await next.evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })
  await expect(page.locator('p[aria-live]')).toHaveText('How many whole units?')
  await page.getByLabel('Your answer').fill('2')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('correct', { exact: true })).toBeVisible()
  expect(await savedAnswers(page)).toEqual(['4', '2'])
})
