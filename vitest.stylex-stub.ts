type AnyStyles = Record<string, unknown>

export function create<T extends AnyStyles>(styles: T): T {
  return styles
}

export function defineVars<T extends AnyStyles>(vars: T): T {
  return vars
}

export function defineConsts<T extends AnyStyles>(consts: T): T {
  return consts
}

export function createTheme(...args: AnyStyles[]): AnyStyles {
  return { $$theme: args.length }
}

export function keyframes(frames: AnyStyles): string {
  return `keyframes-${Object.keys(frames).length}`
}

export function props(...styles: unknown[]): { className?: string; style?: Record<string, string> } {
  void styles
  return {}
}
