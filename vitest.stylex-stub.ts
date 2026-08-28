type AnyStyles = Record<string, unknown>

export function create<T extends AnyStyles>(styles: T): T {
  return styles
}

export function defineVars<T extends AnyStyles>(vars: T): T {
  return vars
}

export function createTheme(...args: AnyStyles[]): AnyStyles {
  return { $$theme: args.length }
}

export function keyframes(frames: AnyStyles): string {
  return `keyframes-${Object.keys(frames).length}`
}

export function firstThatWorks(...values: string[]): string[] {
  return values
}

export function props(...styles: unknown[]): { className?: string; style?: Record<string, string> } {
  void styles
  return {}
}
