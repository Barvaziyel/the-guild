# The Guild

A post-apocalyptic scavenger-guild management game for Android: recruit survivors, gear them up, send crews on expeditions, and watch them change. A personal project, sideloaded as an APK.

**Read `docs/DESIGN.md` before making gameplay changes.** It is the source of truth for mechanics and numbers. If an implementation needs to deviate, update the doc in the same PR.

## Commands

```bash
npm install
npm run check      # typecheck + tests (run before every commit)
npm test           # node --test, runs .ts files natively (Node >= 22.18)
npm run typecheck
npm run sample     # print a generated guild; `npm run sample -- <seed>` for a fixed seed
```

## Layout

- `src/engine/`: the game simulation. Pure TypeScript with **zero runtime dependencies**.
  - `index.ts`: the public API. The UI imports from here only.
  - `types.ts`: all state types. `constants.ts`: every tunable number.
  - `content/`: data (traits, gear, origins, names). Prefer adding content here over adding code.
  - `*.test.ts`: tests next to the code. `test-utils.ts` holds the fixtures.
- `scripts/`: dev scripts run with `node`.
- `src/ui/` (planned): React and Vite. `android/` (planned): Capacitor.

## Engine rules

1. **Deterministic.**
   - Never use `Math.random()` or `Date.now()` in `src/engine/`.
   - Randomness comes from an `Rng`: either `withRng(state, rng => ...)` for the main stream, or `rng.fork(label)` for sub-simulations such as runs.
   - Time is passed in as epoch ms.
2. **Engine functions mutate the state they're given.** Callers that need the old state pass `structuredClone(state)`.
3. **State is plain JSON.** No classes, Maps, Sets or functions in `GameState`.
   - When the shape changes, bump `SAVE_VERSION` and add a migration in `save.ts`.
4. **Content drives behavior.**
   - Traits and gear expose `hooks` and `checkMods`, which the simulation reads generically.
   - Don't special-case trait ids in logic when a hook would work. New hook keys go in `types.ts` with a doc comment.
5. **Survivors change over time, and the Chronicle records why.**
   - Use `addTrait` / `addPractice` / `adjustRelationship` / `changeStress`. They write the Chronicle entries.
   - Chronicle text is written without a subject: "Lost an eye at the Drowned Mall."
6. **TypeScript style.**
   - Erasable syntax only (no `enum`, `namespace` or constructor parameter properties).
   - Relative imports end in `.ts`. Type-only imports use `import type`.
7. Balance-sensitive systems (death rate, loot rates) get Monte Carlo tests that simulate thousands of runs and assert a range.

## Workflow

- One PR per roadmap step (`docs/DESIGN.md` §15). Keep `npm run check` green.
- CI (`.github/workflows/ci.yml`) runs the typecheck and tests on every PR.
