import type { Lesson, LessonItem, LessonState, TrialEntry } from './lesson';
import { replayLesson } from './lesson';
export type BlockKind = 'narrative' | 'instruction' | 'testing' | 'review';
export type PlannedRow = {
    row: number;
    set: number;
    fp?: string;
};
export type BlockPlan = {
    kind: BlockKind;
    rows: PlannedRow[];
    budgetMs: number;
};
export type SessionPlan = {
    startedAt: number;
    blocks: BlockPlan[];
};
export type Trial = {
    typed: string;
    at: number;
};
export type SessionEvent = {
    kind: 'start';
    plan: SessionPlan;
} | ({
    kind: 'trial';
} & Trial);
export type SessionLog = SessionEvent[];
export type RowOutcome = {
    row: number;
    set: number;
    firm: boolean;
    rightFirstTry: number;
    graded: number;
    endedAt: number;
};
export type BlockState = {
    plan: BlockPlan;
    outcomes: RowOutcome[];
    current: {
        rowIndex: number;
        lesson: Lesson;
        log: TrialEntry[];
        state: LessonState;
    } | null;
    done: boolean;
    cutBy: 'budget' | 'notFirm' | 'stale' | null;
};
export type StaleRow = {
    block: number;
    index: number;
    row: number;
    set: number;
};
export type SessionState = {
    blocks: BlockState[];
    blockIndex: number;
    done: boolean;
    cleared: number;
    rightFirstTry: number;
    graded: number;
    rowsFirmed: number[];
    activeMs: number;
    staleAt: StaleRow | null;
    unreplayed: number;
};
export type RowRecord = {
    row: number;
    timesServed: number;
    firmed: boolean;
    firmedAt: number | null;
    lastServedAt: number | null;
    misses: number;
};
export type RowHistory = Map<number, RowRecord>;
export const SESSION_BLOCKS = 6;
export const TEACH_BUDGET_MS = 150000;
export const REVIEW_BUDGET_MS = 90000;
export const NARRATIVE_BUDGET_MS = 60000;
export const REVIEW_MAX = 6;
export const IDLE_CAP_MS = 60000;
export const SCHEDULE_SLOTS = [
    'teach',
    'narrative',
    'review-1',
    'review-2',
    'review-3',
    'review-4',
    'review-5',
    'review-6',
] as const;
export type ScheduleSlot = (typeof SCHEDULE_SLOTS)[number];
export const DEFAULT_SCHEDULE: readonly ScheduleSlot[] = [
    'review-1',
    'teach',
    'review-2',
    'narrative',
    'review-3',
    'review-4',
    'review-5',
    'review-6',
];
export function rowLesson(lesson: Lesson, planned: PlannedRow, kind: BlockKind): Lesson {
    const items = lesson.items.filter((it) => it.row === planned.row &&
        (it.set ?? 1) === planned.set &&
        it.role === (kind === 'instruction' ? 'model' : 'test'));
    return { ...lesson, items };
}
const FIELD_SEP = '\u001f';
const ITEM_SEP = '\u001e';
const PART_SEP = '\u001d';
function itemPrint(it: LessonItem): string {
    const figures = (it.figures ?? [])
        .map((f) => [
        f.kind,
        f.units,
        f.parts,
        f.counted ?? '',
        f.bounds?.join(' ') ?? '',
        f.equal === undefined ? '' : String(f.equal),
        f.orientation ?? '',
        f.band === undefined ? '' : 'band',
        f.columns ?? '',
        f.unitMarks ?? '',
    ].join(PART_SEP))
        .join(PART_SEP);
    const accept = [...(it.accept ?? [])].sort().join(PART_SEP);
    const frac = it.frac
        ? [it.frac.whole, it.frac.num, it.frac.den].map((s) => (s === null ? '_' : (s ?? ''))).join(PART_SEP)
        : '';
    const numerals = [it.prompt, it.expr ?? ''].join(' ').match(/\d+/g)?.join(PART_SEP) ?? '';
    return [it.row, it.set ?? 1, it.role, it.mode, it.expected, it.count ?? '', figures, accept, frac, numerals].join(FIELD_SEP);
}
function hashLane(text: string, basis: number, prime: number): number {
    let h = basis >>> 0;
    for (let i = 0; i < text.length; i++)
        h = Math.imul(h ^ text.charCodeAt(i), prime) >>> 0;
    return h;
}
function hex32(word: number): string {
    return word.toString(16).padStart(8, '0');
}
export function rowFingerprint(lesson: Lesson, planned: {
    row: number;
    set: number;
}, kind: BlockKind): string {
    const print = rowLesson(lesson, planned, kind).items.map(itemPrint).join(ITEM_SEP);
    return hex32(hashLane(print, 0x811c9dc5, 0x01000193)) + hex32(hashLane(print, 0x9e3779b9, 0x85ebca6b));
}
export function activeMs(trials: Trial[], from: number): number {
    let prev = from;
    let sum = 0;
    for (const t of trials) {
        const gap = t.at - prev;
        sum += Number.isFinite(gap) ? Math.min(Math.max(gap, 0), IDLE_CAP_MS) : 0;
        prev = t.at;
    }
    console.assert(sum >= 0);
    return sum;
}
export function replaySession(lesson: Lesson, plan: SessionPlan, trials: Trial[]): SessionState {
    const blocks: BlockState[] = [];
    let i = 0;
    let live = true;
    let staleAt: StaleRow | null = null;
    for (const bp of plan.blocks) {
        const block: BlockState = { plan: bp, outcomes: [], current: null, done: false, cutBy: null };
        blocks.push(block);
        if (!live)
            continue;
        if (bp.kind === 'narrative') {
            if (i < trials.length) {
                i += 1;
                block.done = true;
            }
            else
                live = false;
            continue;
        }
        const blockFirst = i;
        for (let r = 0; r < bp.rows.length; r++) {
            if (r > 0 && activeMs(trials.slice(blockFirst + 1, i), trials[blockFirst]?.at ?? plan.startedAt) >= bp.budgetMs) {
                block.cutBy = 'budget';
                break;
            }
            if (bp.rows[r].fp !== undefined && bp.rows[r].fp !== rowFingerprint(lesson, bp.rows[r], bp.kind)) {
                block.cutBy = 'stale';
                staleAt = { block: blocks.length - 1, index: r, row: bp.rows[r].row, set: bp.rows[r].set };
                live = false;
                break;
            }
            const served = rowLesson(lesson, bp.rows[r], bp.kind);
            if (served.items.length === 0)
                throw new Error('planned row missing from lesson');
            const rowLog: Trial[] = [];
            let state = replayLesson(served, rowLog);
            while (!state.done && i < trials.length) {
                rowLog.push(trials[i]);
                i += 1;
                state = replayLesson(served, rowLog);
            }
            if (!state.done) {
                block.current = { rowIndex: r, lesson: served, log: rowLog, state };
                live = false;
                break;
            }
            block.outcomes.push({
                row: bp.rows[r].row,
                set: bp.rows[r].set,
                firm: state.firm,
                rightFirstTry: state.rightFirstTry,
                graded: state.gradedCount,
                endedAt: rowLog[rowLog.length - 1]?.at ?? plan.startedAt,
            });
            if (bp.kind === 'testing' && !state.firm) {
                block.cutBy = 'notFirm';
                break;
            }
        }
        block.done = block.current === null && block.cutBy !== 'stale';
    }
    const firstOpen = blocks.findIndex((b) => !b.done);
    if (firstOpen !== -1 && staleAt === null && i < trials.length)
        throw new Error('trial log overruns the session plan');
    const outcomes = blocks.flatMap((b) => b.outcomes);
    const testingFirm = blocks.flatMap((b) => (b.plan.kind === 'testing' ? b.outcomes.filter((o) => o.firm) : []));
    return {
        blocks,
        blockIndex: firstOpen === -1 ? blocks.length : firstOpen,
        done: firstOpen === -1,
        cleared: blocks.filter((b) => b.done && b.cutBy !== 'notFirm').length,
        rightFirstTry: outcomes.reduce((s, o) => s + o.rightFirstTry, 0),
        graded: outcomes.reduce((s, o) => s + o.graded, 0),
        rowsFirmed: [...new Set(testingFirm.map((o) => o.row))],
        activeMs: activeMs(trials, plan.startedAt),
        staleAt,
        unreplayed: trials.length - i,
    };
}
export type LogAudit = {
    history: RowHistory;
    staleRows: number[];
    droppedRows: number[];
    lostRows: number[];
    droppedTrials: number;
    unreadableSessions: number;
    unstamped: boolean;
};
function plannedFrom(plan: SessionPlan, block: number, index: number): number[] {
    const rows: number[] = [];
    for (let b = block; b < plan.blocks.length; b++)
        for (let r = b === block ? index : 0; r < plan.blocks[b].rows.length; r++)
            rows.push(plan.blocks[b].rows[r].row);
    return rows;
}
export function replayLog(lesson: Lesson, log: SessionLog): LogAudit {
    const sessions: {
        plan: SessionPlan;
        trials: Trial[];
    }[] = [];
    for (const ev of log) {
        if (ev.kind === 'start')
            sessions.push({ plan: ev.plan, trials: [] });
        else {
            const open = sessions[sessions.length - 1];
            if (!open)
                throw new Error('trial before any session start');
            open.trials.push({ typed: ev.typed, at: ev.at });
        }
    }
    const history: RowHistory = new Map();
    const stale = new Set<number>();
    const dropped = new Set<number>();
    let droppedTrials = 0;
    let unreadableSessions = 0;
    let unstamped = false;
    for (const s of sessions) {
        let state: SessionState;
        try {
            if (s.plan.blocks.some((b) => b.rows.some((r) => r.fp === undefined)))
                unstamped = true;
            state = replaySession(lesson, s.plan, s.trials);
        }
        catch {
            unreadableSessions += 1;
            droppedTrials += s.trials.length;
            for (const b of s.plan?.blocks ?? [])
                for (const r of b?.rows ?? [])
                    dropped.add(r.row);
            continue;
        }
        if (state.staleAt !== null && state.unreplayed > 0) {
            stale.add(state.staleAt.row);
            droppedTrials += state.unreplayed;
            for (const row of plannedFrom(s.plan, state.staleAt.block, state.staleAt.index))
                dropped.add(row);
        }
        for (const b of state.blocks) {
            if (b.plan.kind === 'instruction')
                continue;
            for (const o of b.outcomes) {
                const rec = history.get(o.row) ?? {
                    row: o.row,
                    timesServed: 0,
                    firmed: false,
                    firmedAt: null,
                    lastServedAt: null,
                    misses: 0,
                };
                rec.timesServed += 1;
                rec.lastServedAt = o.endedAt;
                rec.misses += o.graded - o.rightFirstTry;
                if (b.plan.kind === 'testing' && o.firm && !rec.firmed) {
                    rec.firmed = true;
                    rec.firmedAt = o.endedAt;
                }
                history.set(o.row, rec);
            }
        }
    }
    const asc = (a: number, b: number) => a - b;
    const droppedRows = [...dropped].sort(asc);
    return {
        history,
        staleRows: [...stale].sort(asc),
        droppedRows,
        lostRows: droppedRows.filter((row) => !history.get(row)?.firmed),
        droppedTrials,
        unreadableSessions,
        unstamped,
    };
}
export function rowHistory(lesson: Lesson, log: SessionLog): RowHistory {
    return replayLog(lesson, log).history;
}
export function selectReview(history: RowHistory, newRow: number | null): number[] {
    const pool = [...history.values()].filter((r) => r.firmed);
    const picks: number[] = [];
    if (newRow !== null) {
        const nearest = pool.filter((r) => r.row < newRow).sort((a, b) => b.row - a.row)[0];
        if (nearest)
            picks.push(nearest.row);
    }
    const recentlyFirmed = pool
        .filter((r) => r.lastServedAt === r.firmedAt)
        .sort((a, b) => (b.firmedAt ?? 0) - (a.firmedAt ?? 0));
    picks.push(...recentlyFirmed.slice(0, 2).map((r) => r.row));
    const mostMissed = pool.filter((r) => r.misses > 0).sort((a, b) => b.misses - a.misses)[0];
    if (mostMissed)
        picks.push(mostMissed.row);
    const leastRecent = [...pool].sort((a, b) => (a.lastServedAt ?? 0) - (b.lastServedAt ?? 0));
    picks.push(...leastRecent.slice(0, 2).map((r) => r.row));
    return [...new Set(picks)].slice(0, REVIEW_MAX);
}
function servedSet(lesson: Lesson, history: RowHistory, row: number, kind: BlockKind): number | null {
    const has = (set: number) => rowLesson(lesson, { row, set }, kind).items.length > 0;
    const turn = ((history.get(row)?.timesServed ?? 0) % 2) + 1;
    if (has(turn))
        return turn;
    const shipped = [...new Set(lesson.items.filter((it) => it.row === row).map((it) => it.set ?? 1))];
    return shipped.sort((a, b) => a - b).find(has) ?? null;
}
function plannedRows(lesson: Lesson, history: RowHistory, rs: number[], kind: BlockKind): PlannedRow[] {
    return rs.flatMap((row) => {
        const set = servedSet(lesson, history, row, kind);
        return set === null ? [] : [{ row, set, fp: rowFingerprint(lesson, { row, set }, kind) }];
    });
}
function atomBlocks(lesson: Lesson, history: RowHistory, row: number): BlockPlan[] {
    return (['instruction', 'testing'] as const).flatMap((kind) => {
        const rows = plannedRows(lesson, history, [row], kind);
        return rows.length === 0 ? [] : [{ kind, rows, budgetMs: TEACH_BUDGET_MS }];
    });
}
export function planSession(lesson: Lesson, history: RowHistory, now: number, schedule?: readonly string[]): SessionPlan {
    const rows = [...new Set(lesson.items.map((it) => it.row))];
    const unfirm = rows.filter((r) => !history.get(r)?.firmed);
    const blocks: BlockPlan[] = [];
    if (unfirm.length === rows.length) {
        for (const row of unfirm.slice(0, SESSION_BLOCKS / 2))
            blocks.push(...atomBlocks(lesson, history, row));
    }
    else {
        const newRow = unfirm[0] ?? null;
        const reviewable: RowHistory = new Map([...history].filter(([row]) => servedSet(lesson, history, row, 'review') !== null));
        const review = selectReview(reviewable, newRow).map((row): BlockPlan => ({
            kind: 'review',
            rows: plannedRows(lesson, history, [row], 'review'),
            budgetMs: REVIEW_BUDGET_MS,
        }));
        if (schedule !== undefined && newRow !== null) {
            const slots = [...new Set(schedule)].filter((s): s is ScheduleSlot => (SCHEDULE_SLOTS as readonly string[]).includes(s));
            for (const s of DEFAULT_SCHEDULE)
                if (!slots.includes(s))
                    slots.push(s);
            for (const slot of slots) {
                if (slot === 'teach')
                    blocks.push(...atomBlocks(lesson, history, newRow));
                else if (slot === 'narrative') {
                    if (lesson.narrative !== undefined)
                        blocks.push({ kind: 'narrative', rows: [], budgetMs: NARRATIVE_BUDGET_MS });
                }
                else {
                    const pick = review[Number(slot.slice('review-'.length)) - 1];
                    if (pick)
                        blocks.push(pick);
                }
            }
            return { startedAt: now, blocks };
        }
        if (newRow === null)
            blocks.push(...review);
        else {
            const [first, ...rest] = review;
            if (first)
                blocks.push(first);
            blocks.push(...atomBlocks(lesson, history, newRow), ...rest);
        }
    }
    if (lesson.narrative !== undefined)
        blocks.splice(Math.min(4, blocks.length), 0, { kind: 'narrative', rows: [], budgetMs: NARRATIVE_BUDGET_MS });
    return { startedAt: now, blocks };
}
export function jumpToRow(lesson: Lesson, row: number | null, now: number, kind: 'instruction' | 'testing' = 'instruction', item = 0): {
    plan: SessionPlan;
    trials: Trial[];
} {
    const rows = [...new Set(lesson.items.map((it) => it.row))];
    const empty: RowHistory = new Map();
    const blocks: BlockPlan[] = rows.flatMap((r) => atomBlocks(lesson, empty, r));
    if (lesson.narrative !== undefined)
        blocks.splice(Math.min(4, blocks.length), 0, { kind: 'narrative', rows: [], budgetMs: NARRATIVE_BUDGET_MS });
    const plan: SessionPlan = { startedAt: now, blocks };
    const trials: Trial[] = [];
    let at = now;
    for (const b of plan.blocks) {
        const hit = row === null
            ? b.kind === 'narrative' || lesson.narrative === undefined
            : b.rows.some((r) => r.row === row) && (kind === 'instruction' || b.kind === kind);
        if (hit) {
            if (row !== null) {
                const planned = b.rows.find((r) => r.row === row)!;
                const items = rowLesson(lesson, planned, b.kind).items;
                for (const it of items.slice(0, Math.min(item, items.length - 1)))
                    trials.push({ typed: it.role === 'model' ? '' : it.expected, at: (at += 1000) });
            }
            break;
        }
        if (b.kind === 'narrative') {
            trials.push({ typed: '', at: (at += 1000) });
            continue;
        }
        for (const r of b.rows)
            for (const it of rowLesson(lesson, r, b.kind).items)
                trials.push({ typed: it.role === 'model' ? '' : it.expected, at: (at += 1000) });
    }
    return { plan, trials };
}
