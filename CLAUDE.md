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
npm run keystore   # once: make the release signing key (android/keystore.properties, git-ignored)
npm run apk        # build out/the-guild-<version>.apk on this machine (needs Android Studio + Java 21); apk:install also installs over USB
npm run android:sync  # build the web app and copy it into android/; android:open opens Android Studio
```

## Layout

- `src/engine/`: the game simulation. Pure TypeScript with **zero runtime dependencies**.
  - `index.ts`: the public API. The UI imports from here only.
  - `types.ts`: all state types. `constants.ts`: every tunable number.
  - `content/`: data (traits, gear, origins, names). Prefer adding content here over adding code.
  - `expedition/`: runs. `plan.ts` (validation, duration), `sim.ts` (the beat loop and aftermath), `beats.ts`, `combat.ts`, `wounds.ts`, `runs.ts` (start, complete, risk estimate), `context.ts` (shared helpers).
  - `expedition/events.ts`: runs the scripted events in `content/events.ts`.
  - `expedition/command.ts`: fights the player commands (§7.13): the moves each person has (from `moves` hooks on traits and gear, defined in `content/moves.ts`), checking an order, and the `FightView` the fight screen shows. A led run (`RunPlan.lead`, needs a Radio Tower) keeps `Run.lead.start`, a copy of what it set out with, and is played again from it with every round given so far (`simulateRun(..., { fights })`); `combat.ts` throws a `FightPause` when a fight under command needs the next round. `takeCommand`, `commandRound`, `letThemFight` and `settleLed` are in `runs.ts`. A fight nobody commands plays exactly as before. A commanded fight also notes each act (`FightAct`: who, at whom, hit or miss, how much) for the battle stage; `fightPreview` shows a waiting fight and `lastFought` the end of the last one.
  - `expedition/radio.ts`: forks (§7.12), data in `content/forks.ts`, sharing roles, checks and effects with events. With a Radio Tower the crew calls home: `simulateRun(..., answer)` replays the run with that order forced, `startRun` stores every order's branch in `Run.radio`, `answerRadio` picks one, `settleRadio` drops the rest once it's too late. Every replay is the same up to the fork because the dice are seeded; anything that rolls dice before a fork must not depend on the answer.
  - `evolution.ts`: applies the trait evolution rules in `content/evolutions.ts`.
  - `vehicles.ts`: vehicles the guild owns, seats and gas for a plan, repairs and building (types in `content/vehicles.ts`). Runs work on copies (`Sim.rides`) and report `VehicleNews`; `completeRun` applies it.
  - `outposts.ts`: outposts (setting up, who lives there, a day out there, raids) and `outpostNear`, which shortens runs and gives crews a rest stop. `locations.ts` holds the levels of a place (`planDepth`, `depthOpen`, `atDepth`, `addExplored`). People at an outpost have `outpost` set: `atDepot` is false for them, so Depot code skips them.
  - `projects.ts`: projects (big multi-stage works, one stage under way at a time, a crew as a post) and what finished ones do; the projects are data in `content/projects.ts`.
  - `rescue.ts`: calls for help over the radio, and who a rescue brings home; `expedition/rescue.ts` plays the rescue on the run.
  - `animals.ts`: the guild's animals (strays at the gate, keepers, what each kind does); the kinds are data in `content/animals.ts`.
  - `leaving.ts`: someone walking out of the guild (kept in `state.departed`).
  - `vultures.ts`: the Vultures, a rival guild (`state.vultures`): standing and strength, camps and turf, their named people, a Vulture day (arriving, growing, new camps, raids on outposts), prisoners, and `applyVultureNews` when a crew is back. `expedition/vultures.ts` plays meetings on runs and the *Hit their camp* job; like nemeses, runs work on a copy (`Sim.vultures`) and report `VultureNews`.
  - `family.ts`: ageing (birthdays, the years telling, dying of old age) and families (a baby on the way, the birth, children growing up). Children live in `state.children`, not `state.survivors`, so runs, posts and events never see them; they join at 16 through `recruit`.
  - `dilemmas.ts`: decisions at the Depot (`playDilemmaDay` from `advanceTime`, `decideDilemma` from the UI); the decisions themselves are data in `content/dilemmas.ts`.
  - `depot/`: the Depot. `buildings.ts` (levels, costs, beds, posts), `day.ts` (one Depot day: food, work, care, rest, drift), `events.ts` (raids, traders, wanderers, fights...), `recruits.ts` (the board, taking people in), `workshop.ts` (making, improving and taking apart gear), `time.ts` (`advanceTime`: plays the days that passed and brings crews home, at most 7 days at once).
  - `content/buildings.ts`, `content/workshop.ts`: building levels and text, recipes and upgrades.
  - `content/stories.ts`: names for nemeses and weapons, and the nickname rules. `expedition/stories.ts`: nemeses in fights, naming weapons and people after a run, and `applyNemesisNews` when a crew is back.
  - `*.test.ts`: tests next to the code. `test-utils.ts` holds the fixtures.
- `src/portrait/`: survivor portraits as layered SVG, composed in code. Zero dependencies; imports types from the engine.
  - `portrait.ts`: `portraitSvg(survivor)`, `portraitLook`, and the layer order. `face.ts`, `hair.ts`, `outfit.ts`, `overlays.ts`: the parts. `palette.ts`: colors.
- `src/scene/`: the yard, the Depot drawn as one SVG (the Depot screen's Yard tab), and the battle stage. Zero dependencies; colors from `src/portrait/palette.ts`. `model.ts` (what it shows), `layout.ts` (where things stand), `buildings.ts` (each building by level), `projects.ts` (projects as they're built), `animals.ts` (the guild's animals), `figures.ts`, `vehicles.ts`, `yard.ts` (back-to-front composition, the light of the hour, tap targets with `data-key`/`data-go`/`data-label`). `src/ui/yard-view.ts` builds the model from the game. A new building needs a drawing, an area and post spots there.
  - The battle stage (§7.13): `battle.ts` (the fight as a side view: where everyone stands, bars and names, rings, an act being played), `fighters.ts` (the crew in their colors and gear, and every enemy, all facing right), `backdrops.ts` (a backdrop for each place). **A new enemy needs a drawing in `fighters.ts`, and a new location a backdrop in `backdrops.ts`** (`battle.test.ts` fails otherwise). `src/ui/battle-view.ts` builds the model, plays a round as frames, and decides what a tap does; `components/BattleStage.tsx` shows it.
- `scripts/`: dev scripts run with `node`. `apk.ts`, `keystore.ts` and `toolchain.ts` (finding Java and the Android SDK) build the app.
- `src/ui/`: the app, in React and Vite. `index.html` and `vite.config.ts` are at the repo root.
  - Plain `.ts`, tested in Node: `store.ts` (holds the game, saves on every change), `persist.ts` (localStorage, export/import, backup copy), `route.ts` (hash routes), `view.ts` (labels and groupings for survivor screens), `runs-view.ts` (the planner's choices, times, outcomes, reports, notices), `depot-view.ts` (buildings with live numbers, posts, the workshop, recruits, the "since you last looked" note), `gear-view.ts` (the Gear screen: the stash, who can take what, who carries what), `reach-map.ts` (where places sit on the map), `dev.ts` (fast-forward, skip ahead), `prefs.ts` (device-only settings, including the tour step), `time.ts` (clock times), `tour.ts` (the tour's parts and steps), `stories-view.ts` (nemeses on the Reach and a survivor's scores to settle), `vehicles-view.ts` (the Vehicles screen, the Depot's panel and the planner's picker), `dilemma-view.ts` (the decision card on the Depot, its deadline and notices), `outposts-view.ts` (a place's levels and Outpost tab, the planner's level choice, outposts on the Depot and the sheet), `projects-view.ts` (the Projects tab's cards, crews and the sheet's post picker), `rescue-view.ts` (the call for help on the Depot, the planner's Rescue job, report lines, notices), `animals-view.ts` (strays at the gate, the Animals panel, the keeper's line), `family-view.ts` (the Roster's children, family lines on a sheet, real-time spans, the no-room line, the due-day notices), `vultures-view.ts` (the Vultures screen, the Reach's panel and turf tags, the planner's *Hit their camp*, report lines), `radio-view.ts` (a crew on the radio: the card, notices, wake times, the report's line, and where a tapped notice opens).
  - `components/Projects.tsx`: the Depot's Projects tab.
  - `components/RadioCard.tsx`: a crew on the radio, on the Depot's Today tab and the run screen.
  - `fight-view.ts`: fights under command: the planner's *Lead the fights* switch, the card when a crew stops at a fight, notices and wake times, the fight screen's picks and orders, the report's line. `components/FightCard.tsx` (the card, on the Depot's Today tab and the run screen) and `screens/Fight.tsx` (`#/fight/<run id>`).
  - `screens/Vultures.tsx`: the Vultures screen (`#/vultures`), opened from the Reach and the Depot's header.
  - `components/ItemDetails.tsx`: an item's name, stats, and a named weapon's kind and story; used by the sheet and the Gear screen.
  - `notify.ts`: "crew is back" notices: `webNotifier` in a browser, `nativeNotifier` (scheduled with Android) in the app.
  - `native.ts`: app-only setup (back button, resume, tapping a notice). `files.ts`: saving a file (download in a browser, share sheet in the app). Both check `Capacitor.isNativePlatform()`, so the browser version is unchanged.
  - React: `main.tsx`, `App.tsx`, `hooks.ts`, `components/`, `screens/`. Styles in `styles.css`.
- `android/`: the Capacitor native project, committed. `capacitor.config.ts` is at the repo root; app icons come from `assets/`. Setup and building: `docs/ANDROID.md`.
  - The APK can't be built from a cloud session (Google's and Gradle's servers are blocked there); build it locally.

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
8. **Time only moves through `advanceTime`.** It plays Depot days in order and brings crews home before the day they're back for. Don't complete runs or play days anywhere else.
   - Depot numbers live in `constants.ts`; building text in `content/buildings.ts` quotes some of them, and `depot.test.ts` checks they agree.
   - After changing food, rest or raid numbers, run the Depot tests: Monte Carlo checks that an idle guild of 4, and a guild of 8 with a level 2 Garden, never go hungry.
9. **Runs are decided at departure.**
   - `startRun` simulates the whole run on cloned survivors and stores the result. `completeRun` applies it once the crew is back.
   - `simulateRun` must never change the real `GameState`.
   - Inside a simulation, use the helpers in `expedition/context.ts` (`check`, `stress`, `hurt`, `say`). They handle rerolls, practice, hidden-trait reveals and log lines.
   - Run log text lives in `content/flavor.ts`.
   - **Coming home merges, it doesn't overwrite.** The run's copy of each crew member was taken at departure, so `completeRun` (`homecoming`) keeps what changed at the Depot while they were out: their post, traits and Chronicle lines added at home (grief, news), and stress changes. `Run.departed` marks what they were like when they left.
   - **Nemeses live in the real state; runs see a copy.** `simulateRun` works on `sim.nemeses` and records what happened as `NemesisNews` in the result; `completeRun` merges it with `applyNemesisNews`, because runs overlap. Names come from `takenNames` and are never reused.
   - **A led run is played again as orders come in** (§7.13). The replay starts from `Run.lead.start` with the names taken at departure (`Run.lead.taken`), so it comes out the same up to the fight under command. Anything that rolls dice before a fight must not depend on the orders.
   - **Runs can be one person.** Text that talks about a group ("the crew", "everyone", "the others") is a `CrewLines` pool with separate solo lines, or a `members.length === 1` branch in code; anything else is written to read right either way. `expedition/solo.test.ts` simulates a few hundred solo runs and fails on group words.
10. **Scripted events are data.**
   - They live in `content/events.ts`; `expedition/events.ts` casts and plays them. To add one, append an entry. Add a new effect type only when no existing one fits.
   - Survivors are male or female, so `{a.they}` is always "he" or "she" and the verb is singular: "{a.They} laughs".
   - `events.test.ts` checks references and placeholders, and that every event and both of its outcomes can happen.
   - Events that hurt people or start fights change the balance: run `npm run balance` after adding them.
11. **Decisions are data too.**
   - They live in `content/dilemmas.ts`; `dilemmas.ts` picks who they're about, plays the answer, and settles them when the player doesn't answer in time. To add one, append an entry.
   - Each answer's outcomes are tried in order and the last always fits. What an answer leads to shouldn't be obvious from its wording, and the unanswered outcomes are usually worse than a good answer.
   - `dilemmas.test.ts` checks references and placeholders, and that every outcome of every answer, and of leaving it, can happen.

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
   - When a screen grows long (the Depot did), split it into tabs or reorganize it rather than adding to the scroll.
7. **Time passes in `App.tsx`:** `advanceTime` runs when the clock reaches a crew's return or a new Depot day, and on opening the game. Screens never complete runs or play days themselves.
8. **The tour explains the game** (`tour.ts`, shown by `components/TourCard.tsx`). A step opens a screen and may outline an element marked `data-tour="..."`; a test fails if a step points at something no screen has. When a step adds something a new player needs to understand (a resource, a building, vehicles), add or update a tour step in the same PR.
9. **A new location needs a spot on the map** in `reach-map.ts` (a test fails otherwise). Keep roads from crossing; labels have a paper halo for where a road runs under them.
10. To look at the UI from a cloud session: `npm run build`, `npx vite preview`, then screenshot with headless Chrome (puppeteer is in `/opt/npm-tools/node_modules`). Seed `localStorage['the-guild:save']` with a save that has history; the developer fast-forward in `dev.ts` can make one. A fresh install starts the tour and opens on the Depot; tap *Skip tour* (or set `tour: null` in `localStorage['the-guild:prefs']`) before testing another screen.

## Workflow

- One PR per roadmap step (`docs/DESIGN.md` §15). Keep `npm run check` green.
- **Every PR: check whether the tour needs a new or changed step** (UI rule 8), and say in the PR what you decided.
- Bump `version` in `package.json` (shown in Settings → About and as the Android version name) with each PR that changes the game: the minor number for a roadmap step (1.2.0), the patch number for a fix (1.1.1). PRs 9 and 10 were made together and share 1.1.0. Taking command of a fight (turn-based fights, §15) makes it 2.0.0 (Aviel, 2026-11-13).
- CI (`.github/workflows/ci.yml`) runs the typecheck, tests and build on every PR.
