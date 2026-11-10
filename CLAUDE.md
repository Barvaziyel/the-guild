# The Guild

A post-apocalyptic scavenger-guild management game for Android: recruit survivors, gear them up, send crews on expeditions, and watch them change. A personal project, sideloaded as an APK.

**Read `docs/DESIGN.md` before making gameplay changes.** It is the source of truth for mechanics and numbers. If an implementation needs to deviate, update the doc in the same PR.

## Commands

```bash
npm install
npm run dev        # the game in a browser at http://localhost:5173 (also reachable from a phone on the same network)
npm run build      # production build into dist/
npm run check      # typecheck + tests + build (run before every commit)
npm test           # node --test, runs .ts files natively (Node >= 22.18)
npm run typecheck
npm run sample     # print a generated guild; `npm run sample -- <seed>` for a fixed seed
npm run run-sample # simulate one run and print its log; args: <seed> <location> <job> <approach> <retreat>
npm run career     # play a guild through 40 runs and print how its people change; args: <seed> <runs> <maxDanger>
npm run portraits  # write a gallery of portraits to out/portraits.html
npm run balance    # Monte Carlo table of danger and loot per location; args: <runs> <retreat> <approach> <crewSize> [medkit]
```

## Layout

- `src/engine/`: the game simulation. Pure TypeScript with **zero runtime dependencies**.
  - `index.ts`: the public API. The UI imports from here only.
  - `types.ts`: all state types. `constants.ts`: every tunable number.
  - `content/`: data (traits, gear, origins, names). Prefer adding content here over adding code.
  - `expedition/`: runs. `plan.ts` (validation, duration), `sim.ts` (the beat loop and aftermath), `beats.ts`, `combat.ts`, `wounds.ts`, `runs.ts` (start, complete, risk estimate), `context.ts` (shared helpers).
  - `expedition/events.ts`: runs the scripted events in `content/events.ts`.
  - `evolution.ts`: applies the trait evolution rules in `content/evolutions.ts`.
  - `*.test.ts`: tests next to the code. `test-utils.ts` holds the fixtures.
- `src/portrait/`: survivor portraits as layered SVG, composed in code. Zero dependencies; imports types from the engine.
  - `portrait.ts`: `portraitSvg(survivor)`, `portraitLook`, and the layer order. `face.ts`, `hair.ts`, `outfit.ts`, `overlays.ts`: the parts. `palette.ts`: colors.
- `scripts/`: dev scripts run with `node`.
- `src/ui/`: the app, in React and Vite. `index.html` and `vite.config.ts` are at the repo root.
  - Plain `.ts`, tested in Node: `store.ts` (holds the game, saves on every change), `persist.ts` (localStorage, export/import, backup copy), `route.ts` (hash routes), `view.ts` (labels and groupings for survivor screens), `runs-view.ts` (the planner's choices, times, outcomes, reports, notices), `reach-map.ts` (where places sit on the map), `dev.ts` (fast-forward, skip ahead), `prefs.ts` (device-only settings), `time.ts` (clock times).
  - `notify.ts`: "crew is back" notices (browser version; PR 8 adds Capacitor's).
  - React: `main.tsx`, `App.tsx`, `hooks.ts`, `components/`, `screens/`. Styles in `styles.css`.
- `android/` (planned): Capacitor.

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
   - After changing combat, wounds, enemies or locations, run `npm run balance` and compare with the table in `docs/DESIGN.md` §7.5. `expedition/balance.test.ts` fails if the game drifts far from it.
8. **Runs are decided at departure.**
   - `startRun` simulates the whole run on cloned survivors and stores the result. `completeRun` applies it once the crew is back.
   - `simulateRun` must never change the real `GameState`.
   - Inside a simulation, use the helpers in `expedition/context.ts` (`check`, `stress`, `hurt`, `say`). They handle rerolls, practice, hidden-trait reveals and log lines.
   - Run log text lives in `content/flavor.ts`.
9. **Scripted events are data.**
   - They live in `content/events.ts`; `expedition/events.ts` casts and plays them. To add one, append an entry. Add a new effect type only when no existing one fits.
   - Write text so verbs don't have to agree with a pronoun: "{a.first} laughs", not "{a.they} laughs".
   - `events.test.ts` checks references and placeholders, and that every event and both of its outcomes can happen.
   - Events that hurt people or start fights change the balance: run `npm run balance` after adding them.

## Portrait rules

1. **A survivor's face never changes.** It is derived only from `appearance`. Gear, traits, stress and age add layers on top.
2. **New gear needs a look.** Add armor and weapons to `ARMOR_LOOKS` / `WEAPON_LOOKS` in `outfit.ts` (a test fails otherwise). Tools and trinkets are optional.
3. **Hidden traits never show.**
4. Parts are drawn on a 256 x 256 canvas centered on x = 128, with ink `#2b2420` outlines and flat fills from `palette.ts`.
5. After changing a part, run `npm run portraits` and look at the gallery. Tests only catch broken markup, not ugly drawings.
6. Ids inside the SVG are prefixed with the appearance seed, so many portraits can sit on one page.

## UI rules

1. **The UI imports the engine from `src/engine/index.ts` only**, and changes the game only through `store.update(state => ...)` with engine functions. Rules that matter to the save (who can change gear, what a valid name is) belong in the engine, not in components.
2. **Keep logic out of `.tsx`.** If a screen needs a label, grouping or calculation, put it in `view.ts` (or another plain `.ts` file) with a test. Node can't run `.tsx`.
3. `Date.now()` and `Math.random()` are fine in the UI (the clock, new seeds), never in the engine.
4. The engine is type-checked without DOM types; the UI has its own `src/ui/tsconfig.json` with them. `npm run typecheck` runs both.
5. **Look:** steel-green surfaces, bone text, rust for actions (CSS variables at the top of `styles.css`). Big Shoulders Stencil for names, titles and big numbers; Atkinson Hyperlegible Next for everything else. Sentence case, no all-caps labels. Fonts are bundled, nothing loads from the network.
6. **Phone first.** Test at 390 px wide. Touch targets at least 44 px. Respect the safe-area insets.
7. **Crews come home in `App.tsx`** (`completeDueRuns` when the clock passes a return time, including on opening the game). Screens never complete runs themselves.
8. **A new location needs a spot on the map** in `reach-map.ts` (a test fails otherwise). Keep roads from crossing; labels have a paper halo for where a road runs under them.
9. To look at the UI from a cloud session: `npm run build`, `npx vite preview`, then screenshot with headless Chrome (puppeteer is in `/opt/npm-tools/node_modules`). Seed `localStorage['the-guild:save']` with a save that has history; the developer fast-forward in `dev.ts` can make one.

## Workflow

- One PR per roadmap step (`docs/DESIGN.md` §15). Keep `npm run check` green.
- CI (`.github/workflows/ci.yml`) runs the typecheck, tests and build on every PR.
