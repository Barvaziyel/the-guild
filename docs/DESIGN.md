# The Guild — Game Design Document

> Version 0.2 · 2026-11-10 · Living document. Numbers are starting points for tuning, not promises.

## 1. Pitch

You run a scavenger guild out of a ruined rail depot, forty years after the Burn. You recruit drifters, gear them up and send crews out into the Reach. When they come back, you read what happened to them.

Every survivor is changed by what they live through. They gain scars, new traits, friendships and feuds, get better at what they actually do, and very occasionally they don't come back.

Inspirations: Fallout Shelter (individual characters, gear, base rooms), Civ 5 (planning, expansion) and Darkest Dungeon's hamlet (stress, quirks).

## 2. Design pillars

1. **Every survivor is a story.** Characters are shaped by events: practice-based stat growth, earned traits, scars, relationships and a personal Chronicle.
2. **Plan, send, read.** The decisions happen before a run: crew, gear, supplies and standing orders. The payoff is reading the run report afterwards.
3. **Two-minute check-ins.** Runs resolve in real time while the phone is in your pocket.
4. **Buildable solo.** No real-time action and no physics. The simulation is deterministic, and the content is data-driven.

## 3. Setting

- **The Burn.** A war and the fallout that followed, about 40 years ago. The lore stays light and is discovered through locations and events.
- **The Depot.** An old rail depot, home of the player's guild.
- **The Reach.** The region around the Depot, laid out as a map of linked locations.
- **Threats.** Raiders, Ferals (mutated animals), Hollows (irradiated husks), Scrapbots (old security machines), and a rival guild, the Vultures (phase 2).
- **Tone.** Grim but warm: found family in the ruins. Dark humor is welcome.

## 4. Survivors

### 4.1 Identity

| Field | Notes |
|---|---|
| Name, pronouns | Generated; player can rename |
| Nickname | Earned through feats (phase 2), e.g. *Dex "Two-Shot" Arlo* |
| Origin | Bunker-born, Caravan Kid, City Rat, Farmhand, Ex-Raider, Old Medic, Scrapper. Tilts stats, may grant a trait |
| Backstory | One generated line |
| Appearance | Seed and parameters for the layered portrait (§14) |

### 4.2 Stats

Five stats, each on a 1–10 scale:

| Stat | Used for |
|---|---|
| **Grit** | Health, resisting injury and radiation, death saves |
| **Brawn** | Melee weapons, carrying loot, forcing doors |
| **Aim** | Ranged weapons, hunting |
| **Wits** | Scavenging, spotting traps and ambushes, tech, medicine |
| **Nerve** | Stress resistance, leadership, intimidation and negotiation |

- **Generation.** Every stat starts at 2. Then 10 more points are spread, weighted by origin, for a total of 20. The maximum at creation is 7 and the absolute maximum is 10.
- **Derived values.**
  - Max HP = 8 + Grit × 2
  - Carry = 2 + Brawn loot units
  - Stress gains are multiplied by (1 − Nerve / 20)

**Checks.** Roll d10 + stat + modifiers and compare it to a difficulty (DC):

| Difficulty | DC | Odds at stat 4 | Odds at stat 8 |
|---|---|---|---|
| Easy | 7 | 80% | 100% |
| Normal | 10 | 50% | 90% |
| Hard | 13 | 20% | 60% |
| Brutal | 16 | 0% | 30% |

Danger raises DCs: most checks add the location's danger, and scavenging adds half of it (rounded down), so that dangerous places still pay. Checks are always shown in the log, e.g. *Wits 6+5 vs 10 ✔*.

### 4.3 Growth through practice

Characters get better at what they actually do.

- Every check a character makes earns **practice** in that stat: +1, or +2 if the check was Hard or worse. Attack rolls count.
- Raising a stat from N to N+1 takes **8 × N practice**. For example, going from 4 to 5 takes 32.
- A protégé earns +1 extra practice per check while their mentor is in the crew (§5).
- Depot jobs give slow practice in that job's stat (§9).

Survivors therefore specialize according to the jobs you give them. Nobody spends stat points by hand.

### 4.4 Traits

| Kind | Source | Examples |
|---|---|---|
| **Personality** | 1–2 at recruitment; one may be **hidden** until revealed after a few runs | Brave, Cowardly, Loyal, Loner, Greedy, Generous, Hothead, Calm, Curious, Cautious, Optimist, Cynic, Tinkerer, Patcher, Lucky, Unlucky, Glutton, Animal Lover |
| **Earned** | From experience (§4.5) | Veteran, Rad-Hardened, Survivor, Dead-Eye, Scav, Steady, Tough as Nails, Hardened, Vengeful (vs one enemy type), Beast-Friend |
| **Stress** | From hitting a breaking point (§6) | Jittery, Paranoid, Drinker, Haunted, *or* Unshakable |
| **Scar** | Permanent injuries | Lost Eye, Bad Leg, Burn Scars, Missing Fingers, Scarred Face |
| **Condition** | Temporary | Wounded, Rad Sickness, Grieving, Exhausted |

Each trait is a piece of data. It can carry:

- stat modifiers
- situational check modifiers, e.g. +2 Wits against Scrapbots
- behavior hooks, e.g. a chance to flee, a loot bonus, a chance to pocket loot
- relationship affinity with other traits
- an opposite trait that it replaces
- evolution rules (§4.5)

A survivor can hold at most **6** personality, earned, stress and scar traits combined. Conditions don't count toward the limit.

Some trait behaviors:

- **Brave**: never flees and draws enemy attention. **Cowardly**: may flee when hurt or when an ally goes down.
- **Loyal**: tries to save downed allies, with a big bonus for Bonded friends.
- **Greedy**: finds more loot and may pocket some of it. Getting caught hurts relationships.
- **Hothead**: +1 to melee, starts arguments, and clashes with other Hotheads.
- **Lucky**: rerolls one failed check per run. **Unlucky**, usually hidden, rerolls one *success* per run.
- **Animal Lover**: Ferals sometimes back off, and a stray may follow them home (phase 2: pets).

### 4.5 Traits that evolve (the "change over time" engine)

Each survivor keeps **life counters**: runs, combats survived, kills by enemy type, times downed, near deaths, radiation absorbed, allies lost, allies saved, successful scavenges, ranged and melee kills, and days at the Depot.

Evolution rules are data, checked after every run and every Depot day:

| Rule | Trigger |
|---|---|
| Cowardly → **Steady** | 5 or more combats survived, then a 25% chance after each further combat |
| Gain **Veteran** | 10 runs survived (guaranteed) |
| Gain **Rad-Hardened** | 150 or more radiation absorbed (50% chance after each run with radiation) |
| Gain **Tough as Nails** | Downed 3 or more times and survived (30% chance) |
| Gain **Dead-Eye** | 15 or more ranged kills |
| Gain **Scav** | 20 or more successful scavenges |
| Haunted → **Hardened** | Each Depot day with a Bonded friend present (5% chance) |
| Gain **Vengeful** (vs X) | A friend was killed by X (50% chance) |
| Hidden trait revealed | The moment it visibly acts (fleeing, getting caught stealing, a reroll), or after 1–3 runs (34%, 50%, then certain) |

Every trait gained, lost or revealed writes a **Chronicle** entry that includes the cause.

### 4.6 Chronicle

Each survivor has a life log made of a day number, text and tags. It records only the key moments: joining the guild, the first run, traits, scars, stat increases, bonds formed or broken, being saved or saving someone, notable kills, and losing friends.

The survivor sheet shows the Chronicle as their story. When a survivor dies, their Chronicle moves to the **Memorial Wall**.

## 5. Relationships

- Every pair of survivors has a **score from −100 to +100**. It starts from trait affinity ±10 (random).
- **Labels:**
  - Feud: −60 or lower
  - Rival: −59 to −20
  - Neutral: −19 to +19
  - Friend: +20 to +59
  - Bonded: +60 or higher
- **Flags** add special relationships:
  - *Owes a Life* (one-way)
  - *Mentor / Protégé*: a survivor with 10+ runs who is friends with a newcomer (3 runs or fewer). The protégé learns faster on runs with their mentor
  - *Partners*: romance, optional (see open questions)

**What changes a relationship:**

| Event | Change |
|---|---|
| Run together | +1 + 2 × trait affinity (so −3 to +5). Loner halves gains |
| Survive a combat together | +3 (once per run) |
| Quiet talk on the road | +5 |
| Saved by them | +30, plus the *Owes a Life* flag |
| Argument (Hothead, rival events) | −10 |
| Caught stealing | −25 |
| Shared rations, covered for them | +8 / +10 |
| Fled while they were downed | −40 (−5 with everyone else in the crew) |
| Same Depot job | Drift of +1 per day × affinity |

**What relationships change:**

- **Bonded in the same crew:** +1 to all checks, 20% less stress, and +5 to each other's wound rolls.
- **Rival in the crew:** +2 stress per beat and a chance of argument events.
- **Feud:** the run planner shows a warning, and the pair may refuse to go together. At the Depot they may fight, causing a Wounded condition. Rarely, one of them **leaves the guild**; Loners, Greedy survivors and Hotheads are more likely to go.
- **Crew cohesion** is the average pair score in a crew. It adds −2 to +2 to every crew check.
- **When a friend dies:** their friends become Grieving. A Bonded friend either becomes Haunted (50%) or Vengeful against the killer's type (50%).

## 6. Stress

- Stress runs from **0 to 100**.
- **Gains** (all reduced by Nerve and traits):
  - combat: 8–20, halved by passing a Nerve check as the fight starts
  - taking damage: +1 per HP lost
  - an ally downed: 15
  - an ally killed: 30
  - a rout: 30
  - a failed hazard: 5–10
  - every beat in a dangerous place: danger − 1
  - a rival in the crew: +2 per beat
  - a starving Depot: +10 per day
- **Relief:**
  - Depot rest: −5 per day
  - Firepit or Bar: −5 more per day
  - a Bonded friend at the Depot
  - trinkets such as an Old Photo
- Above 70 stress, a survivor takes −1 to all checks, and it shows on the portrait.
- At 100, the survivor hits a **breaking point**:
  - 70%: they gain a negative stress trait (Jittery, Paranoid, Drinker or Haunted)
  - 30%: they gain Unshakable or Hardened
  - either way, stress resets to 40

## 7. Expeditions

### 7.1 The Reach

The Reach is a map of locations connected around the Depot. Each location has:

- **Biome:** Ruined Suburb, Drowned Mall, Hospital, Rail Yard, Military Checkpoint, Irradiated Swamp, Water Plant, Radio Station and others
- **Danger** from 1 to 5, **radiation** from 0 to 3, and **distance**, which sets the run duration
- an enemy table, a loot table and an event deck
- **Explored, 0–100%.** Each finished run explores more of the location: Scout 10–15%, Scavenge 4–6%, Hunt 2–4% (half if the crew turns back). At 100%, the player can build an **outpost** there (phase 2). Deeper areas with more danger and better loot are a phase 2 idea.
- **Discovered or hidden.** Each location lists the places it leads to. Discovery beats reveal them, and Scout runs find them three times as often. The Radio Tower and events can reveal them too.

The guild starts with 3 known locations (The Rail Yard, Maple Street, Kessler Farm). There are 12 in all, from danger 1 up to The Glow at danger 5.

### 7.2 Planning a run

1. **Location**
2. **Crew** of 1–4 ready survivors
3. **Job:**
   - Scavenge: loot
   - Scout: explore the location and discover new ones
   - Hunt: fight, get rations from Ferals, clear threats
   - Rescue: only available when an event spawns a survivor to save (not built yet)
4. **Supplies:** meds and ammo. Rations are packed automatically: one per crew member per game day away.
5. **Standing orders:**
   - **Approach:**
     - Sneaky: +2 to spotting enemies, and the crew tries to slip past them (except when hunting). Runs take 15% longer.
     - Balanced: no modifiers.
     - Aggressive: +1 to attacks, −2 to spotting enemies.
   - **Retreat:** when anyone is below half HP (Wounded), when anyone is Downed, or never. Whatever the order, the crew heads home after a fight in which someone went down.
   - **Loot priority:** the resource to keep when there's more than the crew can carry.

The planner shows the duration, warnings (rivals or feuds in the crew, injuries, high stress, guns without ammo) and a **simulated risk**. To get it, the engine quietly runs the same run with 50 different seeds and reports how often someone goes down or dies. The result is shown as Low, Moderate, High or Deadly.

### 7.3 Resolution

- When the crew **departs**, the engine picks a seed and simulates the entire run immediately into a list of **beats** with timestamps spread across the duration.
- The beats are revealed in the run log as time passes. You can peek mid-run.
- When the crew **returns**, the effects apply all at once on the report screen, and a local notification fires.
- The result is fixed at departure, so the game can't be save-scummed. The simulation only depends on the crew, gear and supplies at departure.

A run has **3–8 beats**, depending on distance. Each beat is a type, weighted by job and location:

- **Travel:** flavor text and minor hazards
- **Scavenge:** a Wits check, then loot rolls
- **Hazard:** radiation, collapses or storms, with Grit or Wits checks
- **Combat** (§7.4)
- **Social:** trait-driven crew interactions
- **Discovery:** a stash, a survivor to rescue, a new location or lore
- **Return trip:** always last. Fatigue sets in, and a badly hurt crew risks one more hazard

### 7.4 Combat (auto-resolved)

1. **Ambush check.** The crew's best Wits (helped by Cautious and Binoculars) is checked against the enemy's stealth.
   - Fail: the enemy gets a free round.
   - Beat it by 3 or more: the crew gets a free round.
   - **Sneaking past.** A Sneaky crew that spots the enemy (and isn't hunting) tries to slip by. The crew member with the *lowest* Wits rolls against 6 + danger. Heavy armor makes it harder.
   - **Talking it down.** Raiders can be stared down with a Nerve check against 12 + danger. Ferals can be calmed, but only by someone with a way with animals.
2. **Rounds** (up to 6). Every combatant attacks: d10 + attack stat + weapon bonus vs. the target's defense of 7 + armor.
   - Ranged attacks use Aim and spend ammo. Melee attacks use Brawn.
   - A hit deals weapon damage minus armor soak, at least 1.
   - Enemies pick targets at random, weighted toward Brave survivors. Survivors prefer enemies that are already hurt.
3. **Trait hooks.** Cowardly survivors may flee. Hotheads charge in. Loyal survivors cover downed Bonded friends. Lucky survivors reroll.
4. **Enemy morale.** Raiders and Ferals run once more than half the group is dead. Hollows and Scrapbots never break.
5. **Retreat orders.** When the crew's standing order triggers, they attempt to withdraw with a group check. Failing gives the enemy one more round. A Vengeful survivor facing their sworn enemy blocks the retreat.
   - Enemy group size comes from a threat budget: (5 + 1.5 × danger) × a crew-size factor (0.6 / 0.85 / 1.1 / 1.35 for 1–4), up to 6 enemies.
6. **Log.** The log summarizes the fight rather than listing every swing, e.g. *"Rad-hounds burst out of the dark. Dex drops one with two shots. Mara is bitten (−5 HP)."*

### 7.5 Downed, injuries and (rare) death

When a survivor's HP hits 0, they are **Downed**. Once the fight ends, each downed survivor makes a wound roll:

**Wound roll** = d100 + Grit × 2 + modifiers:

- a Patcher ally still standing: +10
- a Loyal ally still standing: +5
- a Bonded friend still standing: +5
- Survivor trait: +10, Tough as Nails: +5

| Result | Outcome |
|---|---|
| 45 or more | **Wounded**: temporary, heals in 2–5 days |
| 20–44 | **Serious**: Badly Wounded for 4–8 days, plus a 50% chance of a permanent **scar** |
| Under 20 | **Mortal** → death save |

The wounded can't be sent on runs until they heal. If an ally's help lifted the result into a better row, that ally is credited with the **rescue**: +30 relationship, an *Owes a Life* flag, and an entry in both Chronicles.

**Death save.** If a standing ally can reach a Medkit (theirs or the casualty's), it is used up and the survivor lives. A Medkit gives no bonus to the wound roll itself: it is one guaranteed life. Otherwise the survivor makes a Grit check against DC 12. If they fail, **they die**. Anyone who survives a mortal wound gains the **Survivor** trait.

- **Target:** about 1 death per 30–50 runs at moderate danger with sensible orders. Reckless play at Deadly danger is much worse. Monte Carlo balance tests (`balance.test.ts`) simulate thousands of runs and check these rates stay in range.
- **Measured** (fresh crew of 3, scavenging, Balanced, retreat when Downed, no Medkit; `npm run balance`):

  | Danger | Someone goes down | Deaths |
  |---|---|---|
  | 1 | 1% of runs | almost never |
  | 2 | 6–17% | 1 per 90–290 runs |
  | 3 | 23–39% | 1 per 30–45 runs |
  | 4 | 49–67% | 1 per 14–21 runs |
  | 5 | 76% | 1 per 14 runs |

  A Medkit in the crew cuts deaths by 60–85%. Never retreating and attacking aggressively at danger 4–5 costs a life every 8 runs.
- **Whole crew downed (a rout):** with nobody standing, nobody can help. Wound rolls get no ally bonuses and Medkits can't be used. The crew loses all loot and everyone gains +30 stress. In a crew of two or more, at least one member always survives to drag the others home, so there are no total wipes. A survivor who goes out **alone** has no such guarantee.
- **Death:** the survivor goes to the Memorial Wall with their portrait, name, days survived, cause of death and Chronicle. Their gear comes home with the survivors.
- **Mercy mode:** an optional setting where survivors are never killed and mortal wounds become scars instead. It's off by default.

### 7.6 Loot

- Loot comes as resource units and gear drops.
- The crew can carry the sum of everyone's Carry. Anything beyond that is left behind.
- Gear quality, from worst to best: **Rusty (−1) · Common · Solid (+1) · Prime (+2) · Relic (+2 and a unique perk)**. Relics come from deep locations and named enemies.

## 8. Gear

Every survivor has four slots: **Weapon · Armor · Tool · Trinket**

| Slot | Items (starting set) |
|---|---|
| Weapon, melee (Brawn) | Pipe (2 dmg), Machete (3), Sledge (5, −1 to hit), Shock Baton (3, +2 vs Scrapbots) |
| Weapon, ranged (Aim, uses ammo) | Pipe Pistol (3), Hunting Rifle (5), Crossbow (4, silent, no ammo), Scattergun (6, close range) |
| Armor | Leather Jacket (1), Scrap Vest (2), Riot Gear (3, −1 when sneaking), Hazmat Suit (1, −75% radiation) |
| Tool | Crowbar (+2 scavenging), Geiger Counter (avoid radiation hazards), Medkit (automatic death save, used up), Binoculars (+2 vs ambush and to scouting), Lockpicks (find more stashes), Multitool (+2 tech) |
| Trinket | Lucky Coin, Old Photo (−stress), Dog Tags (+1 Nerve), Music Box (−stress for the whole crew), Rabbit's Foot |

- **Cherished trinkets.** After 5 runs with the same trinket, it becomes *Cherished* and its effect doubles. Losing it gives +30 stress and a Chronicle entry.
- **Workshop.** Crafts and upgrades gear using Scrap and Tech.
- **Named gear** (phase 2). A weapon with 10 kills earns a name and a history.

## 9. The Depot

**Resources:** Scrap · Rations · Meds · Ammo · Tech

| Building | Effect (levels 1/2/3) | Workers use |
|---|---|---|
| Bunks | Population cap of 4 / 8 / 12 | — |
| Garden | Produces rations each day | Wits |
| Infirmary | Faster healing; cures rad sickness (uses meds) | Wits |
| Workshop | Crafts and upgrades gear; makes ammo | Wits |
| Firepit → Bar | Stress relief; relationships drift upward | Nerve |
| Radio Tower | Reveals locations; more and better recruits | Wits |
| Watchtower | Defends the Depot; early warning of raids | Aim |
| Training Yard | Turns Depot days into practice | Any stat |

- **Workers.** Idle survivors are assigned to buildings, 2–3 per building. They gain slow practice in the building's stat, and their relationships drift with their co-workers.
- **Depot events** are rolled each day:
  - a wanderer arrives (a recruit offer)
  - a trader caravan
  - a raid on the Depot
  - a fight between feuding survivors
  - a celebration
  - a sickness
  - a stray dog
- **Upkeep:** 1 ration per survivor per day. If rations run out, everyone gains +10 stress per day, but nobody starves to death.

## 10. Recruitment

- **Recruit board.** Shows 2–3 candidates and refreshes daily. A better Radio Tower brings more and better candidates.
- **Candidate info.** Each candidate shows their origin, stats, visible traits and one **hidden** trait slot. Low Radio Tower levels show stats only as rough ranges.
- **Rescue jobs** can bring in free recruits. They start with *Owes a Life* toward their rescuer.
- **New game.** The guild starts with 4 generated survivors, 3 known locations, and level 1 Bunks, Garden and Firepit.

## 11. Time model

- The game runs on real time and keeps going while the app is closed.
- **1 game day = 1 real hour** (a tunable constant). A developer setting can speed time up.
- Runs take 5–60 minutes for nearby locations and up to 3 hours for far ones.
- **Catch-up.** When the app opens, the elapsed Depot days are simulated in a batch. The batch is capped at 7 days, so a long absence never spirals out of control.

## 12. Screens

1. **Depot (home):** resource bar, buildings and their workers, active runs (countdown plus the latest beat), event inbox.
2. **Roster:** survivor cards showing portrait, name, status, HP and stress bars, and top traits.
3. **Survivor sheet:** portrait wearing their gear, stats with practice bars, traits (tap for an explanation and how it was gained), relationships, gear slots and Chronicle.
4. **Reach map:** locations with explored %, danger and radiation. Tap a location for details and to plan a run.
5. **Run planner** (§7.2).
6. **Run report:** a beat-by-beat log, then a summary of what changed. For example: *"Mara gained Rad-Hardened"*, *"Dex & Ava are now Friends"*, and the loot.
7. **Memorial Wall.**
8. **Settings:** time scale (developer), export and import save, mercy mode, reset.

## 13. Tech architecture

- **TypeScript everywhere.** Use only erasable syntax (no `enum` or `namespace`). Imports use `.ts` extensions.
- **`src/engine/`** is pure, deterministic and has **zero runtime dependencies**.
  - No DOM, `Date.now()` or `Math.random()`. Time and randomness are passed in.
  - A seeded RNG (sfc32) whose state lives in the save.
  - All content is typed data in `src/engine/content/`.
- **`src/ui/`** uses React and Vite. UI actions call engine functions, which return the new state.
- **Persistence.** A versioned JSON save with migrations, stored in localStorage (Capacitor storage later). Saves can be exported and imported as text.
- **Tests.** Node's built-in test runner (`node --test`, which runs `.ts` files natively). This includes Monte Carlo balance tests.
- **Android.** Capacitor wraps the built web app. GitHub Actions builds the APK and publishes it to a GitHub Release, so it can be downloaded directly on the phone.
  - Signing uses **one fixed keystore**, stored in repo secrets. That way updates install over the old version and keep the save.
- **Firebase and Cloudflare** aren't needed for the first version. Cloud save backup is optional later.

## 14. Art

- **Style: "scavenger's field journal."** Ink linework, flat muted color and a watercolor-like wash, in a rust / teal / bone palette.
- **Portraits** are made of layered SVG parts (built with Fable 5.2 before Nov 16).
  - **Canvas:** `viewBox="0 0 256 256"`, framed as a bust.
  - **Colors:** skin, hair, cloth and accent are parameters (CSS variables).
  - **Layer order, back to front:**
    1. background
    2. back hair
    3. body / clothes (replaced by the armor layer)
    4. neck and head
    5. face shape
    6. scar overlays
    7. eyes
    8. brows
    9. nose
    10. mouth
    11. facial hair
    12. front hair
    13. headgear / mask
    14. condition overlays (bandages, stress shading)
  - **Gear and history show on the character:**
    - the armor type changes the body layer
    - a Hazmat suit adds a gas mask
    - Lost Eye adds an eyepatch
    - Wounded adds bandages
    - stress above 70 adds shading
  - **Variety target:** about 8 face shapes, 12 hair styles, 6 eyes, 6 mouths, 5 noses, 6 facial hair, 6 clothes, 4 armor, 4 headgear and 6 scar or condition overlays.
- **Image generation** (after Nov 16) covers location cards, event vignettes, item icons and buildings. Use one locked style prompt and a reference image.
- **Placeholder** until the art exists: initials in a stamped circle, plus icons from game-icons.net (CC BY 3.0, credited).

## 15. Roadmap

| # | PR | Model |
|---|---|---|
| 1 | Engine core: setup, RNG, types, stats, trait and gear data, character generator, relationship basics, Chronicle, tests, CI | Opus · **done** |
| 2 | Expedition simulation: beats, checks, combat, downed/injury/death, loot, stress, practice growth, trait evolution, relationship events, Monte Carlo balance tests | **Fable** · **done** |
| 3 | Portrait system: layered SVG parts and the composer | **Fable** (before Nov 16) |
| 4 | Event content pack: 40+ events with flavor text | **Fable** |
| 5 | UI shell: React/Vite, roster, survivor sheet, save/load | Opus |
| 6 | Reach map, run planner, run report, notifications | Opus |
| 7 | Depot: buildings, workers, resources, recruits, Depot events, time catch-up | Opus |
| 8 | Android APK: Capacitor, Actions and a GitHub Release | Opus |

**First playable = PRs 1–8.**

### Phase 2 ideas

- **Nemeses:** an enemy that downs a survivor and gets away becomes a named, recurring foe.
- **Nicknames** earned by feats.
- **Outposts** on fully explored locations, extending the guild's reach (the Civ-style expansion).
- **Named gear** with a kill history.
- **Pets:** strays that follow an Animal Lover home.
- **The Vultures:** a rival guild competing for locations.
- **Weather and seasons.**
- **Planned Depot defense** during raids.

## 16. Open questions

- Should romance (*Partners*) be part of the relationship system?
- Is 1 game day = 1 real hour the right pace?
- Should the player name the guild?
- Is 4 the right maximum crew size?
