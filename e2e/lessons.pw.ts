import { expect, test, type Page } from '@playwright/test'
import type { Lesson, LessonItem } from '../lib/lesson'
import rawLesson from '../public/lessons/NF_Fractions.lesson.json'

const lesson = rawLesson as Lesson

async function openItem(page: Page, item: LessonItem) {
  await page.addInitScript(() => {
    sessionStorage.setItem('um.intro-seen', '1')
    localStorage.setItem('um.cc', '1')
    localStorage.setItem('um.dev', '0')
  })
  await page.route('**/lessons/NF_Fractions.lesson.json', (route) =>
    route.fulfill({
      json: { ...lesson, atoms: { '1': lesson.atoms![String(item.row)] }, items: [{ ...item, row: 1, set: 1 }] },
    }),
  )
  await page.goto('/app/learn')
  await page.getByRole('button', { name: 'Begin session', exact: true }).press('Enter')
  await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeVisible()
}

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test('a leading-dot decimal earns full first-try credit for an equivalent value', async ({ page }) => {
  const item = lesson.items.find((item) => item.match === 'value' && item.expected === '1/5')!
  await openItem(page, item)
  await page.getByRole('textbox', { name: 'Fraction as text' }).fill('.2')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('correct', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('1 of 1 atoms firm', { exact: true })).toBeVisible()
})

for (const width of [320, 1280]) {
  test.describe(`${width}px lessons`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('partitioning, shading, and equivalence form one answer with a clean retry', async ({ page }) => {
      const item = lesson.items.find((i) => i.mode === 'construct')!
      if (item.mode !== 'construct') throw new Error('missing construction fixture')
      await openItem(page, item)
      await page.getByRole('radio', { name: 'Yes', exact: true }).check()
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('not quite', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeDisabled()
      for (const [i, figure] of item.figures.entries()) {
        await page.getByLabel(`Equal parts in diagram ${i + 1}`).selectOption(String(figure.parts))
        const slider = page.getByRole('slider').nth(i)
        await slider.focus()
        for (let n = 0; n < figure.counted; n++) await slider.press('ArrowRight')
      }
      await page.getByRole('radio', { name: 'Yes', exact: true }).check()
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })

    test('six-unit number line keeps every fraction input usable', async ({ page }) => {
      const item = lesson.items.find((i) => i.mode === 'line-fractions' && i.figures[0].units === 6)!
      await openItem(page, item)
      for (const [unit, value] of item.expected.split(' ').entries())
        await page
          .getByRole('group', { name: `At ${unit}`, exact: true })
          .getByRole('textbox')
          .fill(value)
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })

    test('students supply both addends for every distinct decomposition', async ({ page }) => {
      const item = lesson.items.find((i) => i.mode === 'decompose' && i.expr === '7/32')!
      await openItem(page, item)
      const values = item.expected
        .split(';')
        .reverse()
        .flatMap((sum) => sum.split(' ').reverse())
      for (const [index, value] of values.entries()) await page.getByRole('textbox').nth(index).fill(value)
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })

    test('reasoning choices handle fractions accessibly', async ({ page }) => {
      const item = lesson.items.find((i) => i.mode === 'choice' && i.row === 87)!
      await openItem(page, item)
      await page.getByRole('radio', { name: item.expected, exact: true }).check()
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })

    test('fraction controls and long expressions wrap without page overflow', async ({ page }) => {
      const item = lesson.items
        .filter((i) => i.mode === 'frac' && i.role === 'test' && i.expr)
        .sort((a, b) => b.expr!.length - a.expr!.length)[0]
      await openItem(page, item)
      await page.getByRole('textbox', { name: 'Fraction as text' }).fill(item.expected)
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })

    test('whole circles visibly shade and unshade with pointer input', async ({ page }) => {
      const item: LessonItem = {
        row: 1,
        role: 'test',
        mode: 'shade',
        prompt: 'Shade one whole unit.',
        expected: '1',
        demo: 'One unit is shaded.',
        figures: [{ kind: 'circle', units: 2, parts: 1 }],
      }
      await openItem(page, item)
      const cells = page.getByRole('slider').locator('circle')
      const initial = await cells.first().evaluate((el) => getComputedStyle(el).fill)
      await cells.first().click()
      await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '1')
      await expect.poll(() => cells.first().evaluate((el) => getComputedStyle(el).fill)).not.toBe(initial)
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })

    test('grid shading and its fraction are submitted together', async ({ page }) => {
      const item = lesson.items.find((i) => i.mode === 'shade-fraction' && i.figures[0].orientation === 'horizontal')!
      if (item.mode !== 'shade-fraction') throw new Error('missing grid fixture')
      await openItem(page, item)
      const slider = page.getByRole('slider')
      for (let n = 0; n < item.figures[0].counted; n++) await slider.press('ArrowRight')
      await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeDisabled()
      await page.getByRole('textbox', { name: 'numerator' }).fill(String(item.figures[0].counted))
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })

    test('comparison circles retain their different physical sizes on narrow screens', async ({ page }) => {
      const item = lesson.items.find(
        (i) => i.role === 'test' && i.figures?.[1]?.scale && i.figures[0].kind === 'circle',
      )!
      await openItem(page, item)
      const widths = await page
        .locator('[data-lfigs] svg')
        .evaluateAll((figures) => figures.map((figure) => figure.getBoundingClientRect().width))
      expect(widths).toHaveLength(2)
      expect(widths[1] / widths[0]).toBeCloseTo(0.65, 2)
      await fitsViewport(page)
    })

    test('fraction locations share one number line', async ({ page }) => {
      const item = lesson.items.find((i) => i.role === 'test' && i.numberLine?.length === 5)!
      await openItem(page, item)
      await expect(page.getByRole('img', { name: /Number line from zero to ten/ })).toBeVisible()
      const label = page.getByRole('img').locator('text').first()
      expect(await label.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(14)
      await page.getByRole('button', { name: 'Zoom in on the fractions' }).click()
      await expect(page.getByRole('button', { name: 'Show 0 to 10' })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('textbox', { name: 'Your answer' }).fill(item.expected)
      await fitsViewport(page)
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await expect(page.getByText('correct', { exact: true })).toBeVisible()
    })
  })
}
