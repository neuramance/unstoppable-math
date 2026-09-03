import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Words } from './lesson-text'

const stacks = (root: HTMLElement) => [...root.querySelectorAll('span > span > span:first-child')]

test('numeric and box fractions stack even when glued to a minus sign or an ellipsis, and everything around them survives intact', () => {
  const text = '5/8-3/8 = ▢/▢. 4/5… a/10 (5-3)/8 2 7/10-1'
  const view = render(<Words text={text} />)
  expect(view.container.textContent).toBe('58-38 = ▢▢. 45… a/10 (5-3)/8 2 710-1')
  expect(stacks(view.container).map((n) => n.textContent)).toEqual(['5', '3', '▢', '4', '7'])
})
