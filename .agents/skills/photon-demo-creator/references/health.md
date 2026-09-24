# Health demos

Use this reference for wellness, recovery, activity, sleep, nutrition, or other health-oriented demos.

Health output must remain explicitly scripted or mock unless the user supplies an authorized real data source. Do not turn demo metrics into medical diagnosis, treatment advice, or unsupported clinical claims.

## Proven Vora pattern

The existing Vora Health demo was intentionally isolated from the travel server and cloud project:

1. `hi` opens with “What would you like to know about your body today?”
2. An activity question returns fixed mock steps, active minutes, calories, timing, and goal percentage, ending with a question about overall health.
3. `yes` or an overall-health request sends all five supplied health cards as one album and no additional interpretation.
4. The flow waits for `‼️` before sending the fixed sleep insight and asking about Vora Pro.
5. A positive upgrade reply sends the public Vora Pro app card; a negative reply returns to open exploration.
6. `reset` returns to the opening question.

The health images are opaque user-supplied assets. The known set is, in order:

1. `01-sleep.png`
2. `02-stress.png`
3. `03-activity.png`
4. `04-nutrition.png`
5. `05-heart.png`

If any required image is absent, block the album and explain the missing set rather than sending a partial snapshot or fabricating a replacement.

## Isolation and mini-app boundary

The historical choice was separate code plus a separate Photon project at `/Users/darshan/Documents/ChatGPT/vora-health-demo`, while adding `/health` to the existing hosted Sites project. This was a user-selected boundary, not a universal rule. Reconfirm the intended code/cloud/Site boundary for a different health brand.

The proven mini-app was a `$90.00` Vora Pro annual plan at the public `/health` route. Keep price, plan, copy, palette, and payment behavior tied to the current prompt. A public HTTPS override may be accepted; reject loopback or non-HTTPS URLs for live app cards.

Known source areas:

- `src/vora-flow.ts` for pure per-space transitions;
- `src/index.ts` for Spectrum effects and grouped attachment delivery;
- `assets/health/` for the required opaque cards;
- the shared Site's `app/health/route.ts` and `lib/health.ts` for the card page.

## Verification

Test greeting/reset, activity wording, yes/no branches, album completeness and order, unrelated reactions, `‼️` gating, public URL validation, and per-space isolation. Validate existing hosted routes when adding `/health` so travel surfaces remain intact. Report mock-data behavior, local checks, startup, hosted route, provider delivery, and phone rendering separately.
