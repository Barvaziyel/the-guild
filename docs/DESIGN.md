# The Guild — Game Design Document

> Version 1.0 · 2026-11-11 · Living document. Numbers are starting points for tuning, not promises.

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
| Name, pronouns | Generated; player can rename. The backstory follows the new name; old log lines keep the name used at the time |
| Nickname | Earned through feats (§7.7), e.g. *Dex "Two-Shot" Arlo* |
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
| **Condition** | Temporary | Wounded, Rad Sickness, Grieving, Exhausted, Feverish |

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
  - *Partners*: romance, uncommon (Phase 2, §15)

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
4. **Supplies:** meds and ammo. Rations are packed automatically: one per crew member per game day away. **A crew can always leave:** if the Depot is short, rations go to the crew in order, and whoever gets none goes out hungry (+10 stress, shown in the planner and the log). That way an empty larder never traps the guild; a hunt or a scavenging run is always possible (1.1.2).
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
  - The game brings a crew home the moment they're due, or as soon as it's opened after that. The report waits, marked new, until the player opens it. A banner says who is back, and the Runs tab shows a count of new reports.
  - Notices never give away what happened: "Mara and Dex are due back", not "Dex died".
  - In a browser, notices only fire while the game is open, even in the background. The Android app schedules them with the system, so they fire with the game closed. They are inexact (Android may hold one a few minutes to save battery), which is fine for a crew's return and needs no exact-alarm permission.
  - Tapping a notice opens that crew's run.
- The result is fixed at departure, so the game can't be save-scummed. The simulation only depends on the crew, gear and supplies at departure.

A run has **3–8 beats**, depending on distance. Each beat is a type, weighted by job and location:

- **Travel:** flavor text and minor hazards
- **Scavenge:** a Wits check, then loot rolls
- **Hazard:** radiation, collapses or storms, with Grit or Wits checks
- **Combat** (§7.4)
- **Social:** trait-driven crew interactions
- **Discovery:** a stash, a survivor to rescue, a new location or lore
- **Return trip:** always last. Fatigue sets in, and a badly hurt crew risks one more hazard

**Scripted events.** A travel, hazard, discovery or social beat can be a written event instead of a plain one (`content/events.ts`, 54 so far). Travel beats are events 75% of the time, discoveries and social beats 50%, hazards 40%, when one fits.

- **What makes an event fit:**
  - a crew member with a certain trait (a Curious survivor won't leave a welded door alone; a Paranoid one insists on the long way round)
  - a relationship (rivals on a crumbling ledge; Bonded friends keeping watch; an old hand teaching a newcomer)
  - a piece of gear (the Music Box, the Old Photo)
  - the place: every location has one or two of its own
- **What an event does:** most have a check with a good and a bad outcome. Outcomes can give loot or gear, hurt someone, add or relieve stress, change relationships, grant a trait (an Animal Lover who wins over a stray may become Beast-Friend), reveal a new location, start a fight, or write a line in a survivor's Chronicle.
- A hidden trait that drives an event is revealed by it.
- No event happens twice on one run, and events the guild has already seen come up less often.
- Adding an event is adding one entry to the list. Tests check that every event can happen and that both outcomes read cleanly.

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
7. **Nemeses** (§7.7) can lead a fight at their place.

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

### 7.7 Stories: nemeses, nicknames, named weapons (1.2.0)

Names the guild gives out. The names and the nickname rules are data in `content/stories.ts`; the numbers are in `constants.ts`.

**Nemeses.** An enemy that puts someone down and is still alive when the fight ends (it fled, or the crew pulled out) becomes a nemesis half the time, if the guild has fewer than 3 at large. It gets a name by kind (*Old Notch*, a Rad-hound; *Mother Ash*, a raider; *the Janitor*, a Sentry Bot), and haunts the place it was met.

- **Coming back.** In each fight at its place there is a 35% chance it leads the enemies, at most once a run. It has 1.5× its kind's HP plus 3, +1 attack, +1 defense, and +1 attack for each person it has killed (up to +2). It doesn't run with the pack; once it's below a third of its HP it tries once a fight to get away (50%).
- **Grudges.** Anyone it has put down before gets +1 to hit it, and the log says they have not forgotten.
- **Its record.** Who it put down and killed, how often it got away, and a short story ("Day 4: Put Mara Vance down at Maple Street, and got away."). A death it caused is put down to it by name: *Killed by Old Notch at Kessler Farm*.
- **Killing it.** It is gone for good. The killer's Chronicle says so, everyone it ever put down sheds 10 stress (those at home hear the news), and a named weapon that did it remembers.
- **Measured** (3,000 runs a place, fresh crew of 3, retreat when downed): a nemesis turns up in 7–16% of runs at its place and barely moves the death rate. A feral or Hollow nemesis dies in about a third of the fights it's in; a raider nemesis with its crew rarely does unless the guild stops retreating. New ones are born in about 1 run in 9 at danger 3, 1 in 40 at danger 2, and almost never at danger 1.
- Runs overlap, so a run's result carries *news* about each nemesis it met (born, put someone down, killed someone, got away, died), merged into the nemesis as it stands when the crew is back. A nemesis that died meanwhile stays dead.

**Nicknames.** After each run, someone without a nickname is checked against the rules in order; the first that fits and rolls its chance gives a name from its list, never one already in use: killing a nemesis (*Bane*), a dozen ranged or melee kills (*Two-Shot*, *Knuckles*), surviving a mortal wound (*Lazarus*), going down four times (*Bounce*), saving two lives (*Doc*), losing an eye (*Patch*), 200 radiation (*Sparky*), 25 scavenges (*Magpie*), 40 runs (*Old Hand*), or running from a fight (*Rabbit*). A nickname sticks. The Chronicle says why: *Earned a name: "Two-Shot", for a dozen kills at range.*

**Named weapons.** A weapon's kills are counted. At 10 it earns a name that reads well after "the" (*Widowmaker*, *Bonebreaker*), and its story starts: *Named after its tenth kill, in Mara Vance's hands at Maple Street.* The story adds kills 25, 50 and 100, a nemesis it killed, and an owner who died carrying it (*Came home from the Glow without Dex Arlo.*). It keeps its name through upgrades and new owners.

## 8. Gear

Every survivor has four slots: **Weapon · Armor · Tool · Trinket**

| Slot | Items (starting set) |
|---|---|
| Weapon, melee (Brawn) | Pipe (2 dmg), Machete (3), Sledge (5, −1 to hit), Shock Baton (3, +2 vs Scrapbots) |
| Weapon, ranged (Aim, uses ammo) | Pipe Pistol (3), Hunting Rifle (5), Crossbow (4, silent, no ammo), Scattergun (6, close range) |
| Armor | Leather Jacket (1), Scrap Vest (2), Riot Gear (3, −1 when sneaking), Hazmat Suit (1, −75% radiation) |
| Tool | Crowbar (+2 scavenging), Geiger Counter (avoid radiation hazards), Medkit (automatic death save, used up), Binoculars (+2 vs ambush and to scouting), Lockpicks (find more stashes), Multitool (+2 tech) |
| Trinket | Lucky Coin, Old Photo (−stress), Dog Tags (+1 Nerve), Music Box (−stress for the whole crew), Rabbit's Foot |

- **Gear only changes at the Depot.** A crew that is out was simulated with the gear it left with, and comes home with exactly that.
- **The stash.** Gear that crews find or the Workshop makes goes into the guild's stash. The Gear screen (§12) lists it by slot, hands a piece to anyone at the Depot (their old one goes back), and shows what everyone carries.
- **Cherished trinkets.** After 5 runs with the same trinket, it becomes *Cherished* and its effect doubles. Losing it gives +30 stress and a Chronicle entry.
- **Workshop.** Makes gear and improves weapons and armor using Scrap and Tech (§9.4).
- **Named gear** (§7.7). A weapon with 10 kills earns a name and a history.

## 9. The Depot

**Resources:** Scrap · Rations · Meds · Ammo · Tech

The Depot plays one **Depot day** for every game day that passes (§11). Each day, for everyone at home (not out on a run):

1. Conditions that have run their course wear off.
2. **Food.** The Garden grows rations, and everyone eats 1 (Gluttons and Drinkers 2). If there isn't enough, they eat what there is and go hungry: +10 stress each instead of any rest. Nobody starves to death. The log notes when the food runs out and when it's back.
   - **Warnings (1.1.2).** When the Garden grows less than the whole guild eats (counting those out on runs), the Depot shows how long the stores last, from 10 days out, or that they're gone, with what to do about it. The gate notes when another person would eat more than the Garden can spare.
3. **Work.** People at their posts work and get +1 practice a day in the building's stat. Serious wounds (anything that blocks runs) keep people in bed.
4. **Care.** Everyone heals 15% of max HP a day, +10% per Infirmary level, and +2% per point of Wits among the Infirmary's medics. A staffed Infirmary also closes wounds sooner, and treats rad sickness and fever with meds, one patient per medic a day.
5. **Rest.** Everyone sheds 5 stress a day, plus the Firepit's share, plus 2 with a Bonded friend at home. Optimists and Drinkers shed half as much again.
6. **People.** Co-workers drift toward or away from each other by their trait affinity (a 50% chance each day). A Bar warms everyone a little.
7. **Evolution.** Days at the Depot count toward evolution rules, such as Haunted → Hardened with a Bonded friend home.
8. Something may happen (§9.3), and a new set of recruits answers the radio (§10).

**Balance.** Monte Carlo tests (`depot/depot.test.ts`) check that a new guild left at home for 60 days never goes hungry and stays calm, and that a full Bunks of 8 is fed by a level 2 Garden with three gardeners.

### 9.1 Buildings

| Building | At the start | Level 1 | Level 2 | Level 3 | Workers use |
|---|---|---|---|---|---|
| Bunks | Level 1 | 4 beds | 8 beds (30 scrap) | 12 beds (60 scrap, 4 tech) | — |
| Garden | Level 1 | Grows rations | ×2 (25 scrap) | ×3 (50 scrap, 4 tech) | Wits |
| Firepit → Bar | Level 1 | −5 stress a day | Bar: −8, people warm to each other (30 scrap, 2 tech) | Bar and Stage: −12, warm faster (60 scrap, 6 tech) | Nerve |
| Infirmary | — | 25 scrap, 2 tech | 45 scrap, 5 tech | 70 scrap, 10 tech | Wits |
| Workshop | — | Basic gear, ammo (30 scrap) | Guns, armor, instruments, Prime upgrades (50 scrap, 5 tech) | Makes Solid gear (80 scrap, 12 tech) | Wits |
| Radio Tower | — | +1 recruit, stats known (30 scrap, 5 tech) | +2, better recruits (50, 10) | +3, the best (80, 15) | Wits |
| Watchtower | — | Raid defense, halves losses (25 scrap) | Stronger (45 scrap, 3 tech) | Strongest (70 scrap, 8 tech) | Aim |
| Training Yard | — | 2 practice a day (20 scrap) | 3 (40 scrap, 3 tech) | 4 (60 scrap, 8 tech) | Any stat |

Building is instant. Numbers live in `constants.ts`, and the building text in `content/buildings.ts`; a test checks that they agree.

- **Garden:** rations per day = level × (2 + for each gardener, 0.5 + Wits × 0.25). Two gardeners with Wits 4 at level 1 grow 5, enough for a guild of 4 at home.
- **Firepit:** each keeper adds 1 + Nerve × 0.25 to the relief. A Bar gives each pair at home a 25% chance a day to warm by 1 (50% at level 3).
- **Workshop:** each worker turns 1 scrap into 1 + Wits × 0.25 ammo a day, until the Depot holds 60 ammo.
- **Radio Tower:** a 3% chance per level each day, +0.5% per point of the operators' Wits, of hearing about an undiscovered place one road beyond a known one.
- **Watchtower:** +2 per level to holding off raids, and +1 per lookout.

### 9.2 Posts

- Each building with work takes 2 workers at level 1 and 3 at levels 2–3. Posts are given from the building's screen or from a survivor's sheet. A survivor out on a run keeps their post and picks it up when back.
  - Posts belong to the Depot: changing or removing the post of someone who is out sticks when they come back (1.2.1). Before that, a returning crew brought back the posts they left with, which could put three people in a two-person Garden; loading an older save takes the extras off, those out on runs first, with a note in the news.
- **Training Yard** workers each pick a stat (the weakest by default) and get 2/3/4 practice in it a day, instead of the usual +1.
- **A new game** posts the two founders with the best Wits to the Garden and the one with the best Nerve to the Firepit, so the guild feeds itself from the start.

### 9.3 Depot events

At most one event a day (a 20% chance), weighted:

| Event | What happens |
|---|---|
| A wanderer | Someone turns up at the gate and waits there 3 days (§10). |
| A trader caravan | Offers a swap of supplies, or a Solid or Prime piece of gear for scrap (and tech for guns). Stays 2 days. |
| A raid | d10 + the best Aim at home + 2 per Watchtower level + 1 per lookout vs 12. Held: the defenders get Aim practice and a little stress. Broken: raiders take 25% of the scrap, rations and ammo (half that with a Watchtower, never more than 30 of each), one defender is Wounded, and everyone gains +10 stress. |
| A celebration | Costs a ration per two people. Everyone at home sheds 15 stress, and every pair warms by 3. Only when food is plentiful. |
| A fever | Someone at home becomes Feverish (−1 Grit, −1 Wits, 2–4 days) unless the Infirmary treats it. |
| A stray dog | Someone with a way with animals feeds it and sheds 10 stress; otherwise it moves on. |

**Feuds at home:** each feuding pair at the Depot has a 20% chance a day to come to blows. The loser (on a Brawn roll) is Wounded, both gain stress, and the feud deepens. Nobody dies at the Depot. Leaving the guild over a feud is not built yet.

### 9.4 Workshop

- **Make:** everything but trinkets. Basic weapons, armor and tools need level 1; guns other than the Pipe Pistol and Crossbow, Riot Gear, the Hazmat Suit, Binoculars, the Multitool and the Geiger Counter need level 2. Recipes are in `content/workshop.ts`. A Medkit costs 4 scrap and 3 meds.
- **Improve:** weapons and armor only, since quality doesn't change anything else. Rusty → Common: 4 scrap. Common → Solid: 10 scrap, 2 tech. Solid → Prime: 20 scrap, 6 tech, and a level 2 Workshop. Relics can't be made. The Workshop can improve what's in the stash and what anyone at home is carrying.

## 10. Recruitment

- **Recruit board.** Each day, 2 + the Radio Tower's level answer the radio. They're there for that day only. Wanderers (§9.3) wait 3 days.
- **Candidate info.** Each candidate shows their origin, age, backstory, visible traits, and a hint when they have a hidden one. Without a Radio Tower, their stats show as rough ranges (one either side). A Radio Tower at level 2 or 3 brings recruits with 1 or 2 extra stat points, still no higher than 7.
- **Taking someone in** is free but needs a free bed in the Bunks. They join with relationships to everyone and a first Chronicle entry.
- **Rescue jobs** can bring in free recruits. They start with *Owes a Life* toward their rescuer (not built yet).
- **New game.** The guild starts with 4 generated survivors, 3 known locations, and level 1 Bunks, Garden and Firepit. With 4 beds, the first recruit needs better Bunks.

## 11. Time model

- The game runs on real time and keeps going while the app is closed.
- **1 game day = 3 real hours** (`DAY_MS`), so about 8 Depot days pass in a real day. For testing, Settings → Developer → *Developer shortcuts* adds a button to a crew's run that skips ahead to their return (the whole timeline moves, as if the time had passed).
  - Until save version 6 a day was 1 real hour. Loading an older save moves its start back so the guild stays on the same day.
  - Everything counted in days follows the day: healing and conditions, Depot work and food, how long visitors stay. A wound that keeps someone home 2–5 days is 6–15 real hours.
- Runs take real time, not game days: 10 minutes for the nearest locations and up to 2.5 hours for far ones. So almost every run is within one day, and packs one ration per person.
- **Catch-up** (`advanceTime`). When the app opens, and at each new day while it's open, the days that passed are played in order. Crews due back before a day begins come home first, then the Depot has its day. At most **7 days** (21 real hours) are played at once; older missed days are skipped, so a long absence never spirals out of control. The Depot screen sums up what the days brought ("Since you last looked").

## 12. Screens

1. **Depot (home):** resource bar, buildings and their workers, active runs (countdown plus the latest beat), event inbox. *Built (PR 7):*
   - The first tab and the screen the game opens on.
   - "Since you last looked": the days that passed, what the Garden grew and the guild ate, ammo made, health healed, and the news.
   - A trader's offers, with Trade and Send them on.
   - Crews out, each building with its live numbers and workers, who is at the gate, buildings still to build, and Depot news.
   - **A building's screen:** what it does now, the next level and its cost, and its workers (post someone, take them off; Training Yard workers pick a stat). The Workshop adds Make and Improve.
   - **At the gate:** the recruit board (§10).
   - Survivor sheets have a post picker.
2. **Roster:** survivor cards showing portrait, name, status, HP and stress bars, and top traits. *Built (PR 5).*
3. **Survivor sheet:** portrait wearing their gear, stats with practice bars, traits (tap for an explanation and how it was gained), relationships, gear slots and Chronicle. Three tabs: *Stats and gear*, *Bonds*, *Chronicle*. If a survivor has a hidden trait, the sheet says something about them hasn't shown yet, without naming it. *Built (PR 5).* Since 1.2.0: the nickname between first and last name (also on the roster and the Memorial Wall), named weapons with what they are, their kills and their story, and *Scores to settle* on the Bonds tab (nemeses that put them down).
4. **Reach map:** locations with explored %, danger and radiation. Tap a location for details and to plan a run. *Built (PR 6):* (since 1.2.0, a place names the nemesis that haunts it, a *Known by name* list under the places gives every nemesis's record and story, and the planner warns when a nemesis haunts the place and who has a score to settle)
   - The map is a page of the journal: ink roads on paper, markers numbered and colored by danger, a ring that fills as a place is explored, and a badge where a crew is out.
   - A question mark sits at the end of each road to somewhere not yet found. Tapping it says where to scout.
   - Below the map: the picked place's details, and a list of every known place.
   - Map positions live in the UI (`src/ui/reach-map.ts`), not in the location data. A test checks that every location has a spot.
5. **Run planner** (§7.2). *Built (PR 6):* crew (with why anyone can't go), job, meds and ammo, approach, when to pull out, and what to keep first. Below that: time away and when they're back, problems that stop the run, warnings, and the simulated risk, worked out once the plan stops changing. A bar at the bottom keeps the risk and the *Send the crew* button in reach.
6. **Runs:** crews out now (last thing heard, progress, back in how long) and the last 20 reports, new ones marked. *Built (PR 6).*
   - **A crew that is out:** a countdown, and the log so far, revealed beat by beat as time passes.
   - **Run report:** what came home, deaths, places found, the beat-by-beat log with the dice under each line, then what changed for each person. For example: *"Mara gained Rad-Hardened"*, *"Dex & Ava are now Friends"*, and the loot. It opens in place of the countdown when the crew gets back.
7. **Memorial Wall:** faded portraits with the day and cause of death; tap one for their sheet and Chronicle. Opened from the bottom of the roster. *Built (PR 5).*
8. **Settings:** mercy mode, notices when crews come back, portrait wobble, the tour, export and import save, load the backup copy, start a new guild, developer shortcuts and fast-forward (§11, §13). *Built (PR 5, 6, 10).*
9. **The tour** (PR 10). A new guild starts with it, and Settings can show it again. A card pinned above the tab bar walks through 21 short steps in 7 parts: supplies, food, your people, runs, building, recruits, and time. Each step opens its screen and outlines what it's talking about, with live numbers where they help (what the Garden grows, what the first buildings cost). *Next*, *Skip this part* and *Skip tour* are always there. Opening the game mid-tour (from a notice, say) stays where it opened; the next step moves on from there.
10. **Gear** (1.1.1). The stash by slot (weapons, armor, tools, trinkets), each piece with a *Give* button that lists everyone: those at the Depot can take it, those out on a run can't yet. Below, what each person carries; tap someone for their sheet. Opened from the Depot's Gear panel, from the stash line on a survivor's sheet, and from a run report that found gear.

**Navigation.** Tabs along the bottom: Depot, Roster, Reach, Runs, Settings. Survivors who are out show where they are and when they're back, on the roster and on their sheet.

**Look.** The app is a depot workbench: steel-green surfaces, bone text, rust for actions. Names and numbers are set in Big Shoulders Stencil, like lettering on a freight car; everything else is Atkinson Hyperlegible Next. Portraits sit on top like pinned prints, and the Chronicle is the one page of the field journal itself (paper and ink). Both fonts are bundled (SIL Open Font License), so the APK works offline.

## 13. Tech architecture

- **TypeScript everywhere.** Use only erasable syntax (no `enum` or `namespace`). Imports use `.ts` extensions.
- **`src/engine/`** is pure, deterministic and has **zero runtime dependencies**.
  - No DOM, `Date.now()` or `Math.random()`. Time and randomness are passed in.
  - A seeded RNG (sfc32) whose state lives in the save.
  - All content is typed data in `src/engine/content/`.
- **`src/ui/`** uses React and Vite.
  - One store (`store.ts`) holds the game. `store.update(fn)` runs engine functions on a copy of the state, saves it and re-renders; if `fn` throws, nothing changes.
  - Screens are addressed by the URL hash (`#/roster`, `#/s/<id>/bonds`), so the phone's back button works.
  - Logic that can be tested without a browser lives in plain `.ts` files (`store.ts`, `persist.ts`, `route.ts`, `view.ts`, `runs-view.ts`, `depot-view.ts`, `reach-map.ts`, `dev.ts`) with Node tests. Components are `.tsx`.
  - Time moves in one place: `App.tsx` calls the engine's `advanceTime` when the clock reaches a crew's return or a new Depot day, and on opening the game.
  - The engine is type-checked without DOM types (root `tsconfig.json`), the UI with them (`src/ui/tsconfig.json`).
- **Persistence.** A versioned JSON save with migrations, stored in localStorage (in the Android app too: the WebView keeps it with the app's data).
  - Saves can be exported (copy, or download in a browser and share in the app) and imported (paste or file). Text that isn't a save, or a damaged one, is rejected with a reason.
  - Importing or starting over keeps the replaced save as a **backup copy**, which Settings can load again.
  - If the save on the device can't be read, the game shows it for copying and overwrites nothing until the player starts a new guild.
- **Developer tools** (Settings → Developer):
  - *Fast-forward* plays ten runs with random crews at danger up to 3, with three real Depot days after each (rations are topped up so it never stalls), then slides the whole timeline back so the guild looks older and nothing is in the future.
  - *Developer shortcuts* add a button to a crew's run that skips ahead to their return, the same way: the timeline moves, and the crew comes home through the normal return.
- **Tests.** Node's built-in test runner (`node --test`, which runs `.ts` files natively). This includes Monte Carlo balance tests.
- **Android.** Capacitor 8 wraps the built web app (`capacitor.config.ts`, native project in `android/`, min Android 7, target Android 16). The APK is **built locally** with `npm run apk` (see `docs/ANDROID.md`), not in CI, and sideloaded over USB or by copying the file.
  - Plugins: App (back button, resume), Local Notifications (crew returns), Share and Filesystem (exporting the save as a file). `src/ui/native.ts` and `src/ui/files.ts` hold the app-only code; the browser version is unchanged.
  - Signing uses **one fixed keystore**, made once by `npm run keystore` and kept out of git (back it up). That way updates install over the old version and keep the save. Without it, release builds fall back to the debug key.
  - The version code is the build time in minutes, so every build installs over the last; the version name is `package.json`'s.
  - Edge-to-edge: the SystemBars plugin passes the system bar sizes to CSS as `--safe-area-inset-*`, which `styles.css` prefers over `env(safe-area-inset-*)`.
- **Firebase and Cloudflare** aren't needed for the first version. Cloud save backup is optional later.

## 14. Art

- **Style: "scavenger's field journal."** Ink linework, flat muted color and a watercolor-like wash, in a rust / teal / bone palette.
- **Portraits** are layered SVG parts composed in code (`src/portrait/`). `portraitSvg(survivor)` returns an SVG string, so it works in the app and in tests.
  - **Canvas:** `viewBox="0 0 256 256"`, framed as a bust. Readable down to about 64 px.
  - **The face never changes.** It comes from the survivor's `appearance` record. Gear, wounds and age are drawn on top.
  - **Layers, back to front:**
    1. background (paper and a watercolor wash)
    2. back hair
    3. behind (hoods, the weapon on the back)
    4. neck
    5. body (clothes, or armor in their place; slings, tools, trinkets)
    6. head and ears
    7. skin marks (burns, sickness, haunted eyes), clipped to the face
    8. features (eyes, brows, nose, facial hair, mouth)
    9. face marks (wrinkles, eye bags, scars, plasters)
    10. hair on top and in front
    11. headgear (helmet, hood and mask, goggles, bandana, beanie, head bandage, eyepatch)
    12. strain (sweat and a knotted brow)
  - **Parts:** 8 face shapes, 8 skin tones, 14 hair styles in 8 colors (greying with age), 6 eyes, 6 brows, 5 noses, 6 mouths, 6 kinds of facial hair, 7 outfits, 3 accessories.
  - **Gear and history show on the character:**
    - armor replaces the clothes: Leather Jacket, Scrap Vest, Riot Gear (with helmet), Hazmat Suit (with hood and gas mask)
    - the weapon is carried on the back, with a sling or holster
    - Medkit, Binoculars, Geiger Counter and Crowbar are visible; so are Dog Tags, the Lucky Coin and the Rabbit's Foot
    - Lost Eye adds an eyepatch, Scarred Face a stitched scar, Burn Scars a burn
    - Wounded adds plasters, Badly Wounded a bandaged head
    - Rad Sickness, Haunted, Grieving and Exhausted show on the face
    - stress of 70 or more adds sweat and a knotted brow
    - the Memorial Wall shows the portrait faded
    - hidden traits never show
  - **Not drawn yet:** Lockpicks, Multitool, Old Photo and Music Box have no look. Bad Leg and Missing Fingers are out of frame.
  - A hand-drawn wobble is applied with an SVG filter. It can be turned off (`wobble: false`) if long lists of portraits scroll slowly on the phone.
  - `npm run portraits` writes a gallery to `out/portraits.html`.
- **Image generation** (after Nov 16) covers location cards, event vignettes, item icons and buildings. Use one locked style prompt and a reference image.
- **Placeholder** until the art exists: initials in a stamped circle, plus icons from game-icons.net (CC BY 3.0, credited).

## 15. Roadmap

| # | PR | Model |
|---|---|---|
| 1 | Engine core: setup, RNG, types, stats, trait and gear data, character generator, relationship basics, Chronicle, tests, CI | Opus · **done** |
| 2 | Expedition simulation: beats, checks, combat, downed/injury/death, loot, stress, practice growth, trait evolution, relationship events, Monte Carlo balance tests | **Fable** · **done** |
| 3 | Portrait system: layered SVG parts and the composer | **Fable** · **done** |
| 4 | Event content pack: 40+ events with flavor text | **Fable** · **done** (54 events) |
| 5 | UI shell: React/Vite, roster, survivor sheet, save/load | Opus · **done** |
| 6 | Reach map, run planner, run report, notifications | Opus · **done** |
| 7 | Depot: buildings, workers, resources, recruits, Depot events, time catch-up | Opus · **done** |
| 8 | Android APK: Capacitor, built locally (`npm run apk`), system notices | Opus · **done** |

**First playable = PRs 1–8.**

### Phase 2

Planned 2026-11-11, in this order, all on Opus:

| # | PR | Status |
|---|---|---|
| 9 | Slower pace: a game day lasts 3 real hours (§11) | **done** |
| 10 | Tutorial for a new guild (the tour, §12) | **done** |
| 11 | Stories: nemeses, nicknames, named gear (§7.7) | **done** (1.2.0) |
| 12 | Partners: romance | |
| 13 | Vehicles and gas | |
| 14 | Expansion: outposts and deeper areas | |
| 15 | What's missing: rescue jobs, feuds that make someone quit, pets, the last gear drawings | |
| 16 | The Vultures, a rival guild | |

- **Tutorial.** Starts with a new guild, and can be replayed from Settings. It walks through the resources and how to get more of each, food and the Garden, why crews go out on runs, why to build, and taking in recruits. It's optional: the player can skip the whole thing, or skip ahead to the next part. Built as the tour (§12); later steps that add something to explain (gas, vehicles) add a step to it.
- **Stories.** An enemy that downs a survivor and gets away becomes a named, recurring foe (a nemesis). Survivors earn nicknames from feats. A weapon with 10 kills earns a name and a history. Built as §7.7.
- **Partners.** Uncommon, and a step beyond Bonded. About 96% of couples are a man and a woman, and 99% are monogamous. Losing a partner hits harder than losing a friend.
- **Vehicles and gas.** This is how crew size changes: on foot, a crew stays at 1–4.
  - Most vehicles seat 5. Motorcycles seat 1–2, and bigger vehicles more. No bicycles.
  - **Gas** is a new resource, and every run with a vehicle burns some.
  - Vehicles are **rare**: found on runs (a wreck to get running), sold by traders now and then, or built in the Workshop.
  - A vehicle makes runs **faster** and **carries more** loot. It's **noisy**: enemies spot it more easily, and a crew in one can't sneak past. It **wears down**, and the Workshop repairs it.
  - A run can take **several vehicles** and more people. A vehicle can be **lost**: wrecked on a run (its riders walk home, which takes longer) or stolen in a raid.
  - Big crews leave **fewer people at home**. Today an empty Depot only loses a little more in a raid, and the Garden still grows its base. This step makes a thin Depot clearly riskier, so a big convoy has a cost at home.
- **Expansion.** Outposts on fully explored places extend the guild's reach (the Civ-style expansion). Places get deeper, more dangerous areas with better loot.
- **The Vultures.** A rival guild competing for places. They raid, trade, and turn up on runs.

**Later ideas:** weather and seasons, planned Depot defense during raids.

## 16. Decisions and open questions

Decided 2026-11-11:

- Romance: yes, uncommon (*Partners*, Phase 2).
- Pace: 1 game day = 3 real hours.
- Crew size: bigger crews come from vehicles, not a higher cap.
- The player doesn't name the guild.

No open questions right now.
