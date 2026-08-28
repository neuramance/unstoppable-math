import type { CountKind, Figure } from './figures';
export type FracSlots = {
    whole?: string | null;
    num: string | null;
    den: string | null;
};
export type LessonItem = {
    row: number;
    role: 'model' | 'test';
    mode: 'typed' | 'frac' | 'shade';
    set?: number;
    prompt: string;
    expected: string;
    demo: string;
    count?: CountKind;
    figures?: Figure[];
    expr?: string;
    frac?: FracSlots;
    accept?: string[];
};
export type Lesson = {
    topic: string;
    source: string;
    atoms?: Record<string, string>;
    narrative?: string;
    items: LessonItem[];
};
export function lessonSet(lesson: Lesson, set: number): Lesson {
    return { ...lesson, items: lesson.items.filter((it) => (it.set ?? 1) === set) };
}
export const FIRM_SHARE = 1;
const NUMBER_WORDS: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
};
const QUOTED_OPEN = /^["'“”‘’]+/;
const QUOTED_CLOSE = /[.,!?"'“”‘’]+$/;
export function normalizeAnswer(text: string): string {
    return text
        .toLowerCase()
        .replace(/-/g, ' ')
        .split(/\s+/)
        .map((tok) => tok.replace(QUOTED_OPEN, '').replace(QUOTED_CLOSE, ''))
        .filter(Boolean)
        .map((tok) => (NUMBER_WORDS[tok] !== undefined ? String(NUMBER_WORDS[tok]) : tok))
        .join(' ');
}
function numbersOf(text: string): number[] {
    return text
        .split(/[\s/,]+/)
        .filter(Boolean)
        .map(Number);
}
export function gradeItem(item: LessonItem, typed: string): boolean {
    if (item.mode === 'typed') {
        const got = normalizeAnswer(typed);
        return [item.expected, ...(item.accept ?? [])].some((a) => normalizeAnswer(a) === got);
    }
    const want = numbersOf(item.expected);
    const got = numbersOf(typed);
    return got.length === want.length && want.every((w, i) => got[i] === w);
}
export type TrialEntry = {
    typed: string;
};
export type Step = {
    item: number;
    correction: boolean;
};
export type LessonState = {
    current: Step | null;
    done: boolean;
    originalDone: number;
    gradedCount: number;
    rightFirstTry: number;
    firm: boolean;
    lastCorrect: boolean | null;
};
function isFirm(rightFirstTry: number, gradedCount: number): boolean {
    console.assert(gradedCount >= 0);
    console.assert(rightFirstTry >= 0);
    return gradedCount === 0 || rightFirstTry / gradedCount >= FIRM_SHARE;
}
export function replayLesson(lesson: Lesson, log: TrialEntry[]): LessonState {
    const queue: Step[] = lesson.items.map((_, i) => ({ item: i, correction: false }));
    const firstTry = new Map<number, boolean>();
    let originalDone = 0;
    let lastCorrect: boolean | null = null;
    for (const entry of log) {
        const step = queue.shift();
        if (!step)
            throw new Error('trial log overruns the lesson');
        const item = lesson.items[step.item];
        const model = item.role === 'model';
        const correct = model || gradeItem(item, entry.typed);
        if (!step.correction) {
            originalDone += 1;
            if (!model)
                firstTry.set(step.item, correct);
        }
        lastCorrect = model ? null : correct;
        if (!model && !correct) {
            if (step.correction)
                queue.unshift({ item: step.item, correction: true });
            else {
                const insert: Step[] = [{ item: step.item, correction: true }];
                if (step.item > 0)
                    insert.push({ item: step.item - 1, correction: true }, { item: step.item, correction: true });
                queue.unshift(...insert);
            }
        }
    }
    const gradedCount = lesson.items.filter((it) => it.role !== 'model').length;
    const rightFirstTry = [...firstTry.values()].filter(Boolean).length;
    const done = queue.length === 0;
    return {
        current: queue[0] ?? null,
        done,
        originalDone,
        gradedCount,
        rightFirstTry,
        firm: done && isFirm(rightFirstTry, gradedCount),
        lastCorrect,
    };
}
export function spokenLesson(text: string): string {
    return text.replaceAll('*', '');
}
export function clipKey(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    const hex = (h >>> 0).toString(16).padStart(8, '0');
    const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
        .replace(/-+$/, '');
    return slug === '' ? hex : `${slug}-${hex}`;
}
