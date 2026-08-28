import { z } from 'zod';
export interface NarrativeCue {
    readonly index: number;
    readonly start: number;
    readonly end: number;
    readonly lines: readonly string[];
}
export interface NarrativeCues {
    readonly film: string;
    readonly durationSec: number;
    readonly cues: readonly NarrativeCue[];
}
const cueSchema = z
    .object({
    index: z.number().int().nonnegative(),
    start: z.number().nonnegative(),
    end: z.number().positive(),
    lines: z.array(z.string().min(1)).min(1).max(2),
})
    .strict();
const cuesSchema = z
    .object({
    film: z.string().min(1),
    durationSec: z.number().positive(),
    cues: z.array(cueSchema),
})
    .strict();
export function parseNarrativeCues(raw: unknown): NarrativeCues {
    return cuesSchema.parse(raw);
}
export function cueAt(cues: readonly NarrativeCue[], seconds: number): NarrativeCue | null {
    console.assert(Number.isFinite(seconds));
    console.assert(seconds >= 0);
    for (const cue of cues) {
        if (seconds < cue.start)
            return null;
        if (seconds < cue.end)
            return cue;
    }
    return null;
}
