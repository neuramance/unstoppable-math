# NARRATION-RUN

Recording the lesson voice for atoms 6 through 97. Everything below is measured against this
repository and this ElevenLabs account, not recalled from documentation.

## The command

```sh
bun scripts/narrate-lesson.ts            # reports and spends nothing
bun scripts/narrate-lesson.ts 6-97       # records
```

A run with no row range is the estimator: it reads the lesson, names what is unrecorded, prices it
in characters, and makes no request. A run must name its rows, because recording all 97 atoms is a
decision with a bill attached rather than a default.

## Three things to settle first

**The current plan cannot finish the run.** The account is Starter: 40,000 credits a month, 37,468
left, `can_extend_character_limit: false`. Starter has no overage — generation simply stops. The run
needs about 90,000 credits, so it would die around 40% through. Creator at $22/month carries 121,000
credits and covers it in one cycle with headroom. Upgrade before starting.

**The run adds about 170 MB of mp3 to the repository**, taking committed lesson audio to roughly
173 MB. That is measured: the 62 existing clips are 1,114 bytes per character of speech. umath_1 hit
this same wall and moved its media out of the repository (`be1c9520 Remove publicly served lesson
media`, leaving only `alignment.json` behind and a storage manifest beside it). Decide the storage
question before the run, not after: undoing a 170 MB commit means rewriting history or carrying the
blobs forever.

**Two pronunciations are conventions rather than transcriptions.** Everything else the renderer says
is drawn from Kristopher's own prose, but the corpus never writes "square root" and never spells the
algebraic forms. About 25 lines in rows 39, 40 and 59 are affected — `√` read as "square root of",
and `3x` / `a over b`. Listen to a few of those before trusting the whole batch.

## Cost

|                                                               | credits    |
| ------------------------------------------------------------- | ---------- |
| 2,054 clips, 152,390 characters, at 0.5 credits per character | 76,195     |
| plus takes rejected by the audio gate                         | **89,919** |
| — the rejected takes alone                                    | 13,724     |

About $22, being one month of Creator. The published Multilingual v2 rate of $0.10 per 1,000
characters puts it at $15 to $18, which agrees.

Measured from the account's own history (205 generations, 84 distinct texts) and one 6-character
probe:

- **0.501 credits per character** over 4,908 characters. Half rate, not the 1:1 the docs describe.
- **`previous_text` is not billed.** A 6-character text sent with 227 characters of conditioning
  billed 3 credits — half of 6, nothing for the context. 1,040 of the clips carry conditioning, so
  this is an 89,335-character question, and the answer is that it is free.
- **Retries are 1.12x on lines of 20 characters or more, and 4.59x below that.** `"Sixths."` took 30
  takes; `"Six parts."` and `"Sevenths."` took 18 each. One-word answers synthesise flush at their
  sibilant edges and keep failing the edge gate. This is the whole of the 18% retry overhead.

## What the run does

Roughly **4 hours**, sequential. Sequential is deliberate: each clip's mp3 and index entry are
written as it lands, which is what makes the run resumable, and it stays clear of concurrency
limits. Expect about 155 minutes of speech.

Per clip it synthesises with Eleanor (`U1xXYn8cDFT02st4a5oq`, `eleven_multilingual_v2`,
`mp3_44100_128`), conditioning a demo on its own prompt; measures the take with ffmpeg and rejects
one that is flush with a phoneme at either edge or degenerately quiet; retries three times
conditioned then three times plain; normalises the survivor to the house level; forced-aligns it;
checks that the aligner's words rebuild the clip's own key; then writes the mp3 and the index entry.

Progress prints as `[i/N] wrote <key> · "<line>"`.

Requires `ELEVENLABS_API_KEY` in `.env.local` (gitignored) and `ffmpeg` on `PATH`. Both are checked
before the first request, so a missing tool costs nothing. **Rotate the key** — it was shared in a
chat transcript.

## If it stops

Re-run the same command. Nothing is lost and nothing is repeated: a clip counts as recorded only
when both its mp3 and its index entry exist, so the next run picks up exactly what is missing.

- **Quota exhausted** arrives as a 401, which fails immediately rather than burning five backoff
  attempts. Upgrade, re-run.
- **Transient failures** (429, 5xx, network) retry five times with exponential backoff.
- **A clip that fails every take** is named on stderr, skipped, and the run continues; the failures
  are re-raised together at the end. It does not head-of-line block.

Expect a slice of the 200 short clips to fail per run — the cap is six takes and they average 4.59,
with one historically needing 30. Just re-run. **The credits are spent either way**: a rejected take
bills whether it happens in this run or the next, so raising `ATTEMPTS` costs nothing extra and only
saves you re-invoking. Consider raising it to 8 before a long unattended run.

## After the run

```sh
scripts/agent-verify                     # must exit 0
PORT=3517 bun run test:e2e               # port 3000 is held by another project
```

Expected end state: **2,116 mp3 files and 2,116 alignment entries, reconciled exactly.** The library
is content-addressed, so identical speech shares one clip — this is why 2,116 is fewer than the
2,154 written lines. Nine different displayed expressions share the one clip
`"Write the correct symbol into the blank space."`

Two suites cover the result, both currently green:

- `lib/narration.test.ts` — every entry names a committed mp3, its sha256 matches, its words run
  forward in time, its key round-trips through `clipKey`, and the spoken form is idempotent on it so
  no recorded clip can orphan.
- `content/content.test.ts` — every line the whole lesson speaks renders to speech the library can
  hold, with no bar, box or operator left behind; and the honed first five still speak 124 of 124.

**One gate is worth adding once the run lands:** coverage is currently scoped to rows 1 to 5. Widen
it to the whole lesson so the corpus cannot silently lose clips later. It cannot be added before the
run, because a red gate is a broken build.

## Invariants not to break

- **Do not widen `SPEAKABLE`** to make a clip pass. It is the one predicate the recorder and the
  library share; widening it admits text the aligner will mis-tokenise.
- **Do not edit `narrated()` after clips exist** without re-recording. Clip keys are content hashes
  of the spoken line, so changing the reading orphans every clip it touches. `lib/narration.test.ts`
  will catch it, which is the point.
- **Do not edit `content/umath1-set1.baseline.json`.** It is umath_1's served Set 1, frozen as the
  independent baseline for the honed first five atoms.
- **Do not run unscoped.**

## Rollback

The clips are content-addressed and committed, so `git revert` of the recording commit removes both
the mp3s and their entries together and leaves the library reconciled. If only the reading is wrong,
fix `narrated()`, delete the affected clips and their entries, and re-run — the recorder treats a
missing clip as work to do.
