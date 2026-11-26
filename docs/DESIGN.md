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
| Name | Generated; player can rename. The backstory follows the new name; old log lines keep the name used at the time |
| Sex | Male or female, half each (he or she in text). First names come from a list for men, one for women, and one for either |
| Orientation | Straight, gay or bi (§5.1). Not shown on the sheet |
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

- **At the cap** (1.6.2), a new earned or personality trait pushes out the oldest of the visible earned and personality traits, never Veteran or Survivor. The Chronicle says so: *Became Hardened: seen too much, and left being Optimist behind.*
- If there's nothing it can push out, the new trait isn't gained.
- Scars and stress traits always fit.
- Before 1.6.2 new traits were simply refused at the cap, so the longest-lived people stopped changing.

Some trait behaviors:

- **Brave**: never flees and draws enemy attention. **Cowardly**: may flee when hurt or when an ally goes down.
- **Loyal**: tries to save downed allies, with a big bonus for Bonded friends.
- **Greedy**: finds more loot and may pocket some of it. Getting caught hurts relationships.
- **Hothead**: +1 to melee, starts arguments, and clashes with other Hotheads.
- **Lucky**: rerolls one failed check per run. **Unlucky**, usually hidden, rerolls one *success* per run.
- **Animal Lover**: Ferals sometimes back off, and a stray may follow them home (animals, §9.7).

### 4.5 Traits that evolve (the "change over time" engine)

Each survivor keeps **life counters**: runs, runs at danger 2 or more (*hard runs*, counting the level gone to), combats survived, kills by enemy type, times downed, near deaths, radiation absorbed, allies lost, allies saved, successful scavenges, ranged and melee kills, and days at the Depot.

Evolution rules are data, checked after every run and every Depot day:

| Rule | Trigger |
|---|---|
| Cowardly → **Steady** | 5 or more combats survived, then a 25% chance after each further combat |
| Gain **Veteran** | 40 hard runs (danger 2 or more) survived, guaranteed. 25 runs of any kind in 1.6.2 and 10 before; either way nearly everyone was a Veteran within a real month, many from the Rail Yard. Saves from before 1.7.1 count all past runs as hard |
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
  - *Partners*: romance, uncommon (§5.1)

**What changes a relationship:**

| Event | Change |
|---|---|
| Run together | 2 × trait affinity (so −4 to +4). Loner halves gains |
| Survive a combat together | +2 (once per run), only for a pair whose affinity isn't negative |
| Argue over the shares (Greedy 25%, Hothead 15% after a run that found something) | −10 |
| Blamed for a death (below) | −20 |
| Quiet talk on the road | +5 |
| Saved by them | +30, plus the *Owes a Life* flag |
| Argument (Hothead, rival events) | −10 |
| Caught stealing | −25 |
| Shared rations, covered for them | +8 / +10 |
| Fled while they were downed | −40 (−5 with everyone else in the crew) |
| Same Depot job | Drift of +1 per day × affinity |

**Everyday life stops at Friends or Rivals** (1.7.1). Working side by side, the Bar, a party and life at an outpost move a pair no further than the top of Friends (59) or the bottom of Rivals (−59). Bonded and feuds take something that happened: a run or fight together, a rescue, an argument over shares, blame for a death, a decision. Before, life at the Depot made most pairs Bonded within a month (39 of 66 pairs in a guild of 12), so Bonded meant little.

**What relationships change:**

- **Bonded in the same crew:** +1 to all checks, 20% less stress, and +5 to each other's wound rolls.
- **Rival in the crew:** +2 stress per beat and a chance of argument events.
- **Feud:** the run planner shows a warning, and the pair may refuse to go together. At the Depot they may fight, causing a Wounded condition. Rarely, one of them **leaves the guild**; Loners, Greedy survivors and Hotheads are more likely to go.
- **Crew cohesion** is the average pair score in a crew. It adds −2 to +2 to every crew check.
- **When a friend dies:** their friends become Grieving. A Bonded friend either becomes Haunted (50%) or Vengeful against the killer's type (50%).
  - **Blame** (1.6.2): the one closest to the dead (their partner, or else the best friend) blames someone who came back from that run 50% of the time, the one they like least. −20, and a line in both Chronicles: *Blames Dex Arlo for Mara Vance's death.*
- **Why runs changed in 1.6.2:** every run used to add +1 to every pair, and every fight +3. After two real weeks a guild of about 10 had 6.5 Bonded pairs and half a feud, so the drama rarely fired. Now running together brings together the people who get along, and pushes apart the ones who grate on each other.

### 5.1 Partners

Romance is uncommon, and a step beyond Bonded.

- **Orientation.** Everyone has one: 85% straight, 6% gay, 9% bi, worked out from their appearance seed. It isn't shown on its own; it shows in who they end up with. Measured on guilds of 4 and 8 over two to four months, **about 96% of couples are a man and a woman**.
- **Falling for each other.** Each Depot day, two Bonded adults at home together, drawn to each other and not Grieving, become partners with a 1.5% chance. A Bonded pair gets together after about two months at home on average; in 60-run test careers it came to about one couple per guild.
  - Someone who already has a partner is ×0.01 as likely to find another: **about 99% have one partner**.
  - Every couple already in the guild makes the next one ×0.4 as likely (1.6.2). Without it, 7 of 12 people had a partner after a real month.
  - It's in both Chronicles ("Became partners with Wren Gale.") and the news ("Dex and Wren are together now.").
- **Together.** Partners are Bonded, so they get everything Bonded friends do, plus:
  - At the Depot, each sheds **2 more stress a day** with the other home.
  - On a run, seeing their partner go down costs **+10 stress**, and a partner standing adds **+5** to their wound roll.
  - Three run events need partners: one takes the other's watch, they argue about who stays back (a Nerve check), and a ring found in the rubble.
- **Splitting up.** Partners whose score falls below Friend (+20) split up, with a line in both Chronicles and the news.
- **Losing a partner** hits harder than losing a friend: Grieving lasts **7 days longer**, **+25 stress**, and the Chronicle says "Lost Dex Arlo, her partner." A widowed survivor can find someone new once the grief has passed.
- **On screen:** the sheet says "Together with Wren Gale." under the name, and the partner comes first in Bonds, marked *Partners*.

### 5.2 Ageing (1.10.0)

Everyone gets a year older every 365 game days, about 45 real days. Asked for 2026-11-11; Aviel chose a slow decline and a rare peaceful death (2026-11-12).

- **Birthdays.** Each survivor's falls on a day of the year from their appearance seed (no dice spent). It goes in the Chronicle: "Turned 31." Away on a run, it waits until they're home.
- **The years tell, from 60.** Each birthday from 60 has a half chance of taking a point off Grit, Brawn or Aim, never below 2: "Turned 62, and the years are starting to tell: Brawn down to 5."
- **Dying of old age, from 65.** Only at home, a chance each day of 0.0000076 × (age − 64)², which is about 10% a year at 70 and about 30% at 75. They go to the Memorial Wall ("Died peacefully at the Depot, at 72"), their gear goes to the stash, and friends grieve as for any death.
- **Portraits** already grey with age and gain lines at 50, so faces age on their own.
- **Measured** (the simulated player, 30 guilds over 10 real weeks): one guild in ten or so has someone over 60 by the end, and nobody died of old age. It's a long-game thing.
- *Before 1.10.0, ages were fixed. Old saves get a birthday for everyone (save version 17).*

### 5.3 Families (1.10.0)

Partners at the Depot sometimes have a baby, who grows up there and joins the guild at 16. Asked for 2026-11-11; Aviel chose babies that are rare and come with a pregnancy (2026-11-12).

- **A baby on the way.** Each day, a woman of 18 to 42 and her partner (a man), both at the Depot, find out a baby is on the way with a 1% chance. No free bed is needed: a baby sleeps in its parents' bed. In the Chronicle of both and the news ("Mara and Tom are expecting a baby."). A mother waits about two years (730 days) after one baby before the next.
  - **The pregnancy** lasts 270 game days (about 5 real weeks). The mother has *Expecting*; for the last 80 days (10 real days) she's *Nearly due*, and stays home. The baby comes on the day she's home and due.
  - **The birth.** In both Chronicles ("Had a daughter, Nico.", "Became a father: a son, Kai.") and the news; each parent sheds 15 stress.
- **Beds** (Aviel, 2026-11-13; §9.1): partners share a bed, and a child sleeps in a parent's bed until 6, then needs one of their own ("Turned 6, and moved to a bed of her own."). With more people than beds, someone sleeps on the floor each night, and nobody new can be taken in. *A first version needed an empty bed for a baby, and a switch on the Bunks to keep one free; rescues and finds fill every bed since 1.9.0, so without the switch babies almost never came.*
- **Measured** (30 guilds over 10 real weeks, a person-like simulated player): 0.7 to 1 pregnancies a guild and about 0.5 babies born. A busy guild has a couple home together on about one day in eight, which is why it's rarer than the 1% suggests. Guilds hold 13 to 15 people (12 before), because couples free up beds. Nobody slept on the floor yet: a baby born in that time turns 6 about nine real months later.
- **The child.** Born *Depot-Born*, with the father's surname, and:
  - a face that mixes theirs: the skin tone between the two, each other feature from one or the other;
  - stats that lean toward theirs (a point up where their average is 6 or more, down where it's 3 or less);
  - a half chance of one of a parent's ways (a visible personality trait), and their own hidden ones.
- **Growing up in real time.** 16 game years, about two real years. Children live at the Depot and never go out, take posts, or turn up in events.
  - They eat half a ration a day, and need a bed of their own from 6.
  - Everyone at home sheds 1 more stress a day for each child (2 at most).
  - From 12 they help in the Garden: half a ration a day each.
  - At 16 they join the guild with a rusty pipe, on Friend terms with their parents ("Turned 16 and joined the guild.").
- **Losing a parent** goes in the child's Chronicle: "Lost her mother, Mara Kell, at 6." or "Watched his father, Tom Voss, walk out of the Depot, at 9."
- **Only a woman and a man** have babies. Taking in an orphan (a child to rescue, for couples without children) is a later idea.
- **On screen:** a Children panel at the bottom of the Roster, each child with a sheet (stats and Chronicle; they can be renamed); family lines on the parents' sheets ("Expecting a baby, due in about 5 real weeks.", "Mother of Nico."); children smaller in the portrait and playing in front of the fire in the yard; beds counted with them; a notice on the due day and the day a child joins. The tour's bonds step mentions babies.

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
  - **the road** (1.7.1): +5 for every run, and +1 for every 15 minutes away (about 6 to the Rail Yard, 8 to the Water Plant, 15 to the Glow), on top of what happens on the way
  - a starving Depot: +4 per day, and hunger alone never pushes anyone past 70 (+10 with no limit before 1.7.1, which broke people when the Depot's relief dropped in 1.6.2)
- **Relief:**
  - Depot rest: −2 per day (−5 before 1.6.2)
  - Firepit or Bar: −3 more per day at level 1, −4 at 2, −5 at 3 (−3/−5/−8 in 1.6.2, −5/−8/−12 before), and each keeper 0.5 + Nerve × 0.1 more (1 + Nerve × 0.25 before 1.7.1)
  - **Why slower:** 8 Depot days pass in a real day, so with the old numbers stress was back near zero by every check-in, and the Firepit, the Bar and calming trinkets barely mattered. Now a hard run takes a few game days to shake off.
  - a Bonded friend at the Depot
  - trinkets such as an Old Photo
- **Stress is people's time** (1.7.1, `claude/economy-design.md` in the project). The road's cost means every run uses up some of a person, and the Depot's relief decides how much they can do: about 50 a real day with a level 1 Firepit, 65 with the Bar, 80 with the Bar and Stage. A run costs about 8 at danger 1, 15 at danger 2, 27 at danger 3 and 35–55 at danger 4–5, so a person manages two or three real runs a real day past the easy places. Pushing them harder is allowed and has a cost, so the size of the guild matters more than how often the app is opened, and the Rail Yard grind stops paying (6.7 loot for 8 stress, against 27 for 27 at the Water Plant).
  - Measured with the simulated player over two real weeks, against 1.7.0: breaking points per guild fell from 2.2 to 0.4 for a careful player, 8.4 to 0.8 for a casual one and 21.5 to 2.0 for one who takes recruits the Garden can't feed. Average stress sits around 20 instead of under 10. Deaths didn't rise.
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
- **Explored, 0–100%.** Each finished run explores more of the location: Scout 10–15%, Scavenge 4–6%, Hunt 2–4% (half if the crew turns back). Fully exploring the outskirts opens the way **deeper in** (§7.10) and lets the guild set up an **outpost** there (§7.9).
- **Discovered or hidden.** Each location lists the places it leads to. Discovery beats reveal them, and Scout runs find them three times as often. The Radio Tower and events can reveal them too.

The guild starts with 3 known locations (The Rail Yard, Maple Street, Kessler Farm). There are 12 in all, from danger 1 up to The Glow at danger 5.

### 7.2 Planning a run

1. **Location**, and **how far in** once a deeper level is open (§7.10)
2. **Vehicles**, if the guild has any (§7.8), and a **crew**: 1–4 ready survivors on foot, or as many as the vehicles seat
3. **Job:**
   - Scavenge: loot
   - Scout: explore the location and discover new ones
   - Hunt: fight, get rations from Ferals, clear threats
   - Rescue: only while someone is calling for help from that place (§10.1, 1.9.0)
4. **Supplies:** meds and ammo. Rations are packed automatically: one per crew member per game day away. **A crew can always leave:** if the Depot is short, rations go to the crew in order, and whoever gets none goes out hungry (+10 stress, shown in the planner and the log). That way an empty larder never traps the guild; a hunt or a scavenging run is always possible (1.1.2).
5. **Standing orders:**
   - **Approach:**
     - Sneaky: +2 to spotting enemies, and the crew tries to slip past them (except when hunting). Runs take 15% longer.
     - Balanced: no modifiers.
     - Aggressive: +1 to attacks, −2 to spotting enemies.
   - **Retreat:** when anyone is below half HP (Wounded), when anyone is Downed, or never. Whatever the order, the crew heads home after a fight in which someone went down.
   - **Loot priority:** the resource to keep when there's more than the crew can carry.

**One run a game day** (1.10.1, Aviel). Back on the game day they set out, everyone is **Exhausted** and can't go out again until the next game day starts (at most 3 real hours). The planner says when: "Vic has been out today, and can go again at 18:00." A run that crosses into the next day leaves them free on return. **Exhausted only limits runs** (2.0.0, Aviel): they work their post, staff an outpost and hold the gate in a raid as usual (`onlyRuns` on the trait; `laidUp` is what keeps people in bed). *From 1.6.1 Exhausted was only −1 Grit and Brawn until the next day, which didn't stop anyone: a player who checked in every hour sent people out several times a game day and hauled about twice as much (measured: 522 runs and 4,860 scrap in 35 real days, against 314 and 2,570 at six check-ins). Now hourly play gets 324 runs, about the same as six check-ins.* Every run also costs stress for the road itself (§6, 1.7.1).

**Two steps (2.2.0, Aviel: "crew step then settings step, which should be compact").** The planner first asks who goes (and in what), then the orders: how far in, the job, approach, when to pull out, meds and ammo, *Lead the fights*, and what to keep, all on one screen with *Send them* right under them. Each choice is a row of buttons with a line under it about the one picked. *Lead the fights* is there from the start and on by default (§7.13).

The planner shows the duration, warnings (rivals or feuds in the crew, injuries, high stress, guns without ammo, tired from the last run) and a **simulated risk**. To get it, the engine quietly runs the same run with 50 different seeds and counts how often someone goes down or dies. The player sees only the word: Low, Moderate, High or Deadly risk. Until 2.8.2 it also said "In 50 tries, someone went down 9 times. Nobody died."; Aviel: don't explain background calculations like that to the player.

### 7.3 Resolution

- When the crew **departs**, the engine picks a seed and simulates the entire run immediately into a list of **beats** with timestamps spread across the duration.
- The beats are revealed in the run log as time passes. You can peek mid-run.
- When the crew **returns**, the effects apply all at once on the report screen, and a local notification fires.
  - The game brings a crew home the moment they're due, or as soon as it's opened after that. The report waits, marked new, until the player opens it. A banner says who is back, and the Runs tab shows a count of new reports.
  - Notices never give away what happened: "Mara and Dex are due back", not "Dex died".
  - In a browser, notices only fire while the game is open, even in the background. The Android app schedules them with the system, so they fire with the game closed.
  - **On time, and right when late** (3.7.4). A tester left the game for more than a day, then got the notices for his last runs all at once, a day late: a fight, something to decide (he hadn't answered it). Nothing fired twice (a simulated phone, opening the game at random over weeks, found every notice fired when the game wanted it): Android had held them back. Until then they were inexact alarms, since Android 14 won't let an app set exact ones without a permission it isn't given, and it holds an app that hasn't been opened in a while back further, letting a pile go when it's opened. Now:
    - Exact alarms (3.9.1): the app asks for none on install. 3.7.4 used `USE_EXACT_ALARM`, granted on install, but Google Play only allows it in alarm clock and calendar apps, and the game is built as if for the store (§15). Now it's `SCHEDULE_EXACT_ALARM` (Android's *Alarms & reminders*), which the player grants: Settings shows *On time* with an *Allow* button under the notices switch while it's missing. Without it a notice is scheduled inexact and may come late, which the points below make harmless. Asking for an exact one without it would open the settings page on every sync, so each notice says which it wants; when that changes (the player allowed it, or took it back) every held notice is scheduled again.
    - A notice about a wait says until when, not for how long ("choose by 09:13", "until 14:35"), so a late one is still right.
    - Each notice knows when it stops being true (`until`: the end of a wait, the decision settled; otherwise an hour after its time). One that comes after that is taken down as it comes, if the game is running (`staleNotice`); the plugin keeps the event until the game listens, so ones let go as it starts are caught too.
    - Opening the game, or coming back to it, clears its notices from the shade.
    - Each notice carries its own time, since the date the system hands back (`Wed Nov 25 09:13:00 IST 2026`) can't always be read, and a notice that moved then stayed at its old time (`notice-sync.ts`).
    - A decision's notice waits for a day someone is home (§9.5).
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
2. **Rounds** (up to 6). Every combatant attacks: d10 + attack stat + weapon bonus vs. the target's defense.
   - **Their moves first** (2.3.0; Aviel: fights had no real strategy, "strike strike strike"). At the start of each round, before the crew acts, each enemy picks what it will do: a hit at someone it can reach; a **big hit** for those that wind one up (twice the damage, 2 harder to land: Raider Brute 35% of rounds, Hollow Hulk 35%, Raider Enforcer 30%, Vulture Lieutenant 25%, Mire Stalker 20%); or, badly hurt (half its HP or less) with its side's nerve under 40, a **run for it** half the time, gone at the end of the round unless stopped. A commander sees all of it (§7.13). It does what it said, unless its target is out of reach by then (it turns to someone it can reach), someone draws fire, or someone guards that person. A stunned one loses its turn. On their own, someone a big hit coming at them would put down takes cover; the rest go for something in reach, the hurt first and the one winding up a big hit next.
   - **Ranks** (2.3.0). Each side has a front and a back. Blows reach only the other side's front rank while anyone stands in it; shots reach anyone. The enemies that shoot (Raider Gunner, Vulture Shot, Scrapbot Sentry) stand at the back. The crew starts all in front, so blows spread as before; a commander can send someone back (out of reach of blows while anyone is in front, but a blade can't reach anything from there). A lookout on the Watchtower counts as the back.
   - **Flyers** (2.3.0; Aviel: a drone nobody can hit is a problem, so they're fragile, and a crew that can't reach them runs and loses something). The Scrap Drone flies: only shots reach it, and it's fragile (3 HP, no armor). A crew on a run left facing only flyers with nobody who can shoot takes one more round and pulls out, dropping a third of what it found. At the gate they keep at it till the rounds run out.
   - **Enemies that need different answers** (2.4.0, every fight):
     - **The Raider Brute is armored**: armor 3 (was 1) and 12 HP (was 14), so a blade (3 damage) does 1 a hit. *Smash* goes through armor, a called shot doubles before armor comes off, big guns hit hardest; or break the others and it runs with them. A shield by its name on the stage.
     - **Hollows get back up** (the Hollow and the Glowing Hollow, not the Hulk or a nemesis): the first time one drops it lies on the ground, and at the end of the next round it gets up with half its HP, once. **Finish it**, a move anyone in reach has, can't miss and keeps it down (a shot costs a round of ammo). A fight is over when nothing is standing; whatever is still on the ground then counts as killed by whoever dropped it.
     - **Rad-hounds hunt as a pack**: the pack goes for one of the crew together, and each hound gets +1 to hit for each other hound on that person (up to +2). Their bite is 2 (was 3), so a pack costs about what it did; it just lands on one person. The answers: send that person back, guard them, take cover, or spray the pack.
     - **On their own**, a crew finishes anything on the ground first, takes cover when the blows coming at someone would put them down (a big hit, or two or more), and goes for what it can hurt (a blade looks past a brute).
     - Measured (2,000 runs a place): within noise of §7.5 everywhere; the Glow kills a little more often (13.2 per 100 runs vs 11.8: its hollows get up). My first try had packs going for the most hurt person at +2 with their old bite: hurt runs at the danger-1 places went from 1% to 5%. Raids (600 a band, fresh / with a lookout): raiders 49 / 63, ferals 56 / 74, hollows 50 / 64, scrapbots 72 / 84. Leading (1,880 runs, a test commander that also finishes what's down): won 56% vs 51% alone, deaths 26 vs 36 per 1,000.
   - **Jobs besides fighting** (2.5.0; Aviel: "there should be goals sometimes other than fighting… someone do x for 3 turns… instead of 'shoot', 'hold the door'"). A quarter of fights on runs (never at the gate) come with a job that fits who they're up against. Whoever works it spends their turn on it instead of attacking: a turn of work a round, two for someone strong or sharp enough or carrying the right tool. **One person a round** (3.0.1; Aviel found two on it counting twice, which let a crew of three finish any job in a round): once someone has worked it, it isn't anyone else's move that round, and a second ordered onto it fights as they would on their own. The jobs are data (`content/goals.ts`):

     | Job (move) | Comes with | Work | By the end of round | Twice as fast | Done | Not done |
     |---|---|---|---|---|---|---|
     | Hold the door | raiders, hollows, ferals | 3 | – | Brawn 7+ | It's shut. | Each round nobody holds it, one more of the plainest of them comes through, two at most. |
     | Grab their stash (*Haul the crate*) | raiders | 2 | 3 | Brawn 8+ | Two finds of what the place has. | They get it away. |
     | Get them out (*Carry them out*) | ferals, hollows | 2 | 4 | Brawn 8+ | Half the time the stranger comes home to join (or waits at the gate for a bed); the rest give 1 or 2 meds and go their own way. | They don't make it. |
     | Open the cage (*Work the lock*) | scrapbots, raiders | 3 | 4 | Wits 8+, Lockpicks or a Multitool | A piece of gear and some scrap. | It locks down for good. |

     A fight won before a job is done gets it done anyway, however far along it was: nobody is in the way now (Aviel, 2026-11-18: "You should still win the goal"). The crate, the stranger and the cage pay as if the work were finished; a door needs nothing more once they're beaten, and shows as done ("Whoever was behind the door thinks better of it.") rather than half-held. **On their own**, a crew of two or more puts one on the job each round: whoever it costs the fight least (the turns they'd need times what they'd hit for), never someone the blows coming at them would put down, and only while the job can still be done in time. A crew of one never does; a commander can. Under command (§7.13) the job is a move for everyone, named for it, and has its own panel; nobody else takes it on their own once the player has put someone on it.
     - Measured (3,000 runs a place, crew of 3, default orders): within noise of §7.5 everywhere. Hunting at the danger 2 and 3 places, crews left alone win 4% fewer fights and go down 4% more often, and bring home 8% more and half again as many strangers (9.5 per 100 runs, from 6.1). Crews left alone get the door shut 81% of the time, the stash 97%, the stranger out 90%, the cage open 80%. With a job in every fight that fits, the door alone costs a sixth more downs; my first try put the best at it on the door, usually the crew's best blade, and cost a third more. Leading (978 runs each way, a commander who puts the one with the most HP on the job): won 48% vs 44% alone, deaths 33 vs 46 per 1,000 runs, loot 7.3 vs 6.7.
   - **What they do needs an answer** (3.8.0; Aviel, 2026-11-25: "The fights are still boring… I just attack the same thing every time… I never use called shots or whatever… There's no thought to it." He weighed a mini-game, or a fuller system like Final Fantasy's, and picked fights as small puzzles, in the way of Into the Breach: problems that attacking the nearest one doesn't solve, shown with what they would cost). Measured before: a stand-in player who piles everyone onto one enemy did nearly as well as one who read their moves (won 33.7% of fights vs 34.5%).
     - **Shove** (a blow) or **Pin down** (a shot, a round of ammo): everyone has it, at anything in reach, 2 easier to land than an attack, and it does no harm. It breaks what the enemy was winding up (a big hit, a lined-up shot, a mend, a firebomb, a grab) or gets someone out of its grip, and the enemy is **off balance**: everyone else is 2 more likely to hit it this round. Shoves go first in a round, so the others get the good of them. A firebug shoved or pinned down drops its firebomb at its own feet. A plain hit just comes off balance.
     - **Lined-up shots**: a Raider Gunner (30% of rounds), a Vulture Shot (30%) or a Haven Marksman (35%) may line up a shot instead of firing: nothing this round, and next round a shot at the same one for twice the damage. A stun spoils it too. My first try gave it +2 to hit and three times the damage, and Sentry Bots did it too: raids by raiders were held 63% of the time instead of 82%, by scrapbots 36% instead of 91%.
     - **The Raider Patcher** (new; threat 3, 7 HP, at the back with a pistol): each round it patches up the worst hurt of its own (down to 3/4 or less) for 6, instead of shooting. Kill it first, or pin it down.
     - **The Raider Firebug** (new; threat 4, 7 HP, at the back): 40% of rounds it throws a firebomb at the rank its mark stands in: 3 on everyone there (more in dangerous places, as every hit), half in cover. Send people back, take cover, or pin it down. My first try burned for 4: deaths at the Radio Station doubled.
     - **Hollows grab**: a Hollow (30% of rounds) or a Glowing Hollow (25%) may go for a grip on someone in front nobody holds: a hit that also holds on. Held, they can only **Break free** (Brawn against 8 + danger) and can't move, and it bites them every round, with no roll, until it's shoved, stunned or put down. A plain hit doesn't make it let go: in my first try it did, and piling on freed people anyway.
     - **Who comes:** with raiders, a patcher or a firebug is bought first now and then (`EncounterDef.support`): Maple Street half the time (patchers only), the Drive-In 30% (patchers), Kessler Farm, the Drowned Mall, the Radio Station and St. Jude's 60%, Checkpoint Bravo and Red Hand Camp 70%. Raids and the Vultures' groups are as they were.
     - **Caught off guard**, they show no moves in the first round: they do nothing in it anyway (before, the moves they wouldn't make showed).
     - **On their own**, someone held tries to break free; the rest go for whatever holds a friend (4 times as likely) and anything winding something up (twice); someone a firebomb or a lined-up shot would put down takes cover. They never shove: that's the commander's.
     - Measured (stand-ins for the player over 4,000 led runs at ten places, danger 1 to 4; `SimLead.commander`, a hook for tests and measuring only): on their own, 29.6% of fights won, 1.29 of the crew down at a fight's end, 67 deaths per 1,000 runs; piling onto one, 33.0%, 1.04, 56; the 2.4.0 reader, 34.8%, 0.82, 47; one who also answers the new moves, 35.4%, 0.73, 42, with 11% more brought home than piling on and 5% more runs finished. Before, piling on was 33.7%, 1.06, 48 and the reader 34.5%, 0.85, 45: the gap between them grew from a fifth fewer down to nearly a third. `thought.test.ts` keeps it: a reader has at least a tenth fewer down than piling on. The balance table (§7.5) is within noise of before. Raids (600 a band, a guild of 4): raiders held 81.8% (81.8% before), ferals 36.7% (36.8%), hollows 63.7% (63.8%), scrapbots 90.8% (91.0%).
     - **On screen** (§7.13): over each of the crew, what's coming at them this round as a number ("−7"), red when it could put them down, with a flame when a firebomb is in it and a crosshair when a shot is being lined up at them for next round (before: a notch for each blow). Badges over the enemies: a crosshair (lining up; red, taking the shot), a green cross (patching up), a flame (a firebomb), a claw (a grab; red, a grip held). A claw by the bar of someone held, who has no rank to pick; "+6" over one of theirs about to be patched up. *Them* says what each means to do and what it would cost, and what they are with the answer to each.
   - Measured (2,000 runs a place, crew of 3, default orders): within noise of the table in §7.5 everywhere; Rail Yard runs finished drop from 99% to 98% (drones). Raids (600 a band, a fresh guild of 4 / with a lookout): raiders 47% / 63% (were 47 / 69: melee defenders can't reach the gunners until the front falls), ferals 48 / 69 (56 / 77), hollows 53 / 71 (57 / 72), scrapbots 68 / 84 (60 / 71); all bands together 51% (52%).
   - Ranged attacks use Aim and spend ammo. Melee attacks use Brawn.
   - **Survivors hit enemies** against the enemy's defense, for weapon damage minus the enemy's armor, at least 1.
   - **Enemies hit survivors** against 7 + armor. Armor counts once (1.6.1): it makes hits rarer, and only heavy armor (3 or more) also takes 1 off each hit. Before 1.6.1 it also came off every hit in full, and a crew in Solid Scrap Vests was nearly untouchable even in the Glow.
   - Enemies pick targets at random among those they can reach, weighted toward Brave survivors. Survivors prefer enemies that are already hurt.
3. **Trait hooks.** Cowardly survivors may flee. Hotheads charge in. Loyal survivors cover downed Bonded friends. Lucky survivors reroll.
4. **Enemy morale.** Raiders and Ferals have **nerve** (2.3.0; before, they ran once more than half the group was dead). It starts at 100; each death takes 100 ÷ (half the group, rounded down, + 1), so with nothing else they still break once more than half are dead. Their **leader** falling (Raider Enforcer, Vulture Lieutenant) takes 30 more, a hit of 6 or more takes 8, one stared down takes 20, one running takes half a death; each of the crew going down gives them 15 back. At 0 those that can run do. Hollows, Scrapbots and nemeses never break.
5. **Retreat orders.** When the crew's standing order triggers, they attempt to withdraw with a group check. Failing gives the enemy one more round. A Vengeful survivor facing their sworn enemy blocks the retreat.
   - Enemy group size comes from a threat budget: (5 + 1.5 × danger) × a crew-size factor (0.6 / 0.85 / 1.1 / 1.35 for 1–4), up to 6 enemies.
   - **Enemies are worse in dangerous places** (1.6.1). Deeper levels count with their extra danger.
     - +1 attack and +1 damage at danger 3, +2 at 5, +3 at 7 (the heart of the Glow).
     - From danger 4, +1 defense and +20% HP for each point (danger 4: +1, 5: +2, 7: +4).
     - Two heavy kinds: the **Raider Enforcer** (Checkpoint Bravo, Red Hand Camp) and the **Hollow Hulk** (the Glow), each threat 8 and hitting for 7–8.
     - Nemeses are scaled the same way before their own bonuses.
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
| 45 or more | **Wounded**: temporary, heals in 4–8 days (2–5 before 1.6.2) |
| 20–44 | **Serious**: Badly Wounded for 8–14 days (4–8 before 1.6.2), plus a 50% chance of a permanent **scar** |
| Under 20 | **Mortal** → death save |

The wounded can't be sent on runs until they heal. If an ally's help lifted the result into a better row, that ally is credited with the **rescue**: +30 relationship, an *Owes a Life* flag, and an entry in both Chronicles.

**Death save.** If a standing ally can reach a Medkit (theirs or the casualty's), it is used up and the survivor lives. A Medkit gives no bonus to the wound roll itself: it is one guaranteed life. Otherwise the survivor makes a Grit check against DC 12. If they fail, **they die**. Anyone who survives a mortal wound gains the **Survivor** trait.

- **Target:** about 1 death per 30–50 runs at moderate danger with sensible orders. Reckless play at Deadly danger is much worse. Monte Carlo balance tests (`balance.test.ts`) simulate thousands of runs and check these rates stay in range.
- **Measured in 1.6.1** (fresh crew of 3 with no gear, scavenging, Balanced, retreat when Downed, no Medkit; `npm run balance`):

  | Danger | Someone goes down | Deaths | Runs finished |
  |---|---|---|---|
  | 1 | 0–1% of runs | almost never | 99–100% |
  | 2 | 6–16% | 1 per 80–400 runs | 84–95% |
  | 3 | 41–49% | 1 per 22–44 runs | 51–59% |
  | 4 | 59–79% | 1 per 10–17 runs | 21–41% |
  | 5 | 87% | 1 per 9 runs | 14% |

  - A Medkit in the crew cuts deaths by 60–90% at danger 3 and 35–65% at danger 4–5.
  - Never retreating and attacking aggressively at danger 4–5 costs a life every 6–8 runs.
- **Rechecked in 2.9.0** (1,500 runs each, crews of 3 scavenging, Balanced, pulling out when someone is down): hollows that get up (2.4.0) made the Glow deadlier for a crew without Medkits.

  | Crew in the Glow | Runs finished | Someone goes down | Deaths |
  |---|---|---|---|
  | Seasoned (below), no Medkit | 42% | 58% | 1 per 37 runs |
  | Seasoned, a Medkit each | 42% | 58% | 1 per 250 |
  | A month in: +2 to every stat, a Prime Hunting Rifle, Solid Riot Gear and a Medkit each | 74% | 26% | 1 per 1,500 |

  So once a crew is geared up the Glow is dangerous, not impossible, and Medkits make most of the difference. That's the crew the story's clue in the Glow (§9.11) is meant for; it takes them two to four runs.
- **Gear matters, but danger 4–5 stay dangerous** (1.6.1). A *seasoned* crew has +1 to every stat (about two real weeks of growth), a Solid Hunting Rifle and a Solid Scrap Vest each, ammo and a Medkit. Over 300 runs each:

  | Danger | Runs finished | Deaths |
  |---|---|---|
  | 1–2 | 100% | none |
  | 3 | 99–100% | none |
  | 4 | 75–83% | 1 per 300 runs or fewer |
  | 5 | 42% | 1 per 100 runs |

  Before 1.6.1 the same crew finished every run at every place, the Glow included, with no deaths. `balance.test.ts` checks that a seasoned crew is safe at danger 3 but finishes under 65% of runs in the Glow, with deaths.
- **Whole crew downed (a rout):** with nobody standing, nobody can help. Wound rolls get no ally bonuses and Medkits can't be used. The crew loses all loot and everyone gains +30 stress. In a crew of two or more, at least one member always survives to drag the others home, so there are no total wipes. A survivor who goes out **alone** has no such guarantee.
- **Death:** the survivor goes to the Memorial Wall with their portrait, name, days survived, cause of death and Chronicle. Their gear comes home with the survivors.
- **Mercy mode:** an optional setting where survivors are never killed and mortal wounds become scars instead. It's off by default.

### 7.6 Loot

- Loot comes as resource units and gear drops.
- The crew can carry the sum of everyone's Carry. Anything beyond that is left behind.
- Gear quality, from worst to best: **Rusty (−1) · Common · Solid (+1) · Prime (+2) · Relic (+2 and a unique perk)**.
- **Danger pays** (1.6.1): every find is 25% bigger for each point of danger above 1, so the Glow gives double; a level down counts as a point more (§7.10). Since 1.10.1 it's in each find ("Rosa turns up 5 scrap."), rounded to whole supplies with the odds kept, and a load in the packs holds as much more, so the carry limit counts the same loads. *Until 1.10.1 it was added to the haul at the end ("25% on top"), which Aviel found read like a bonus rather than what's there.* Loot per run with a fresh crew is about 5 at danger 1, 9–13 at danger 2, 13 at danger 3. For a seasoned crew (§7.5) it's 6–7 at danger 1, 12–17 at danger 2, 23–27 at danger 3, 26–28 at danger 4 and 19 at danger 5, where they turn back more often.
- **More scrap everywhere** (3.4.0, Aviel: "raise the percentage of scrap found compared to other things on all runs"). Every place's scrap weight is 3 more than it was, so every place finds more scrap and a little less of everything else; the total found doesn't change. Scrap a run (fresh crew of 3, `npm run balance`, 400 runs a place), before → after: the Rail Yard 3.3 → 3.6, Maple Street 1.7 → 2.3, Kessler Farm 1.4 → 2.7, the Old Metro 4.8 → 5.6, the Drowned Mall 3.1 → 4.3, Hilltop 3.2 → 4.6, St. Jude's 1.6 → 3.1, the Water Plant 4.6 → 5.6, Blackwater 1.0 → 2.9, Checkpoint Bravo 2.0 → 3.1, Red Hand Camp 1.6 → 2.1, the Glow 0.9 → 1.6: about 40% more over all, most at the places that had least. Deaths, downs and loot are unchanged (the same dice pick what a find is). Outposts send home the same mix.
- **Relics** (1.6.1) turn up in two ways, and can't be made:
  - at **the heart of a place** (§7.10), as a rare quality among found gear (weight 6, against about 100 for the others);
  - from a **nemesis** killed for good, which always leaves one: a weapon or armor it hoarded.
- A Relic's perk is +1 to one stat, fixed for each Relic and shown with its stats.

### 7.7 Stories: nemeses, nicknames, named weapons (1.2.0)

Names the guild gives out. The names and the nickname rules are data in `content/stories.ts`; the numbers are in `constants.ts`.

**Nemeses.** An enemy that puts someone down and is still alive when the fight ends (it fled, or the crew pulled out) becomes a nemesis half the time, if the guild has fewer than 3 at large. It gets a name by kind (*Old Notch*, a Rad-hound; *Mother Ash*, a raider; *the Janitor*, a Sentry Bot), and haunts the place it was met.

- **Coming back.** In each fight at its place there is a 35% chance it leads the enemies, at most once a run. It has 1.5× its kind's HP plus 3, +1 attack, +1 defense, and +1 attack for each person it has killed (up to +2). It doesn't run with the pack; once it's below a third of its HP it tries once a fight to get away (50%).
- **Grudges.** Anyone it has put down before gets +1 to hit it, and the log says they have not forgotten.
- **Its record.** Who it put down and killed, how often it got away, and a short story ("Day 4: Put Mara Vance down at Maple Street, and got away."). A death it caused is put down to it by name: *Killed by Old Notch at Kessler Farm*.
- **Killing it.** It is gone for good. The killer's Chronicle says so, everyone it ever put down sheds 10 stress (those at home hear the news), and a named weapon that did it remembers.
- **Measured** (3,000 runs a place, fresh crew of 3, retreat when downed): a nemesis turns up in 7–16% of runs at its place and barely moves the death rate. A feral or Hollow nemesis dies in about a third of the fights it's in; a raider nemesis with its crew rarely does unless the guild stops retreating. New ones are born in about 1 run in 9 at danger 3, 1 in 40 at danger 2, and almost never at danger 1.
- Runs overlap, so a run's result carries *news* about each nemesis it met (born, put someone down, killed someone, got away, died), merged into the nemesis as it stands when the crew is back. A nemesis that died meanwhile stays dead.

**Nicknames.** After each run, someone without a nickname is checked against the rules in order; the first that fits and rolls its chance gives a name from its list, never one already in use. Since 1.6.2 a rule about a count or a trait fits only on the run that reaches it, so it's one roll, not one roll on every run after. Before, nearly everyone had a name within a real month. The rules: killing a nemesis (*Bane*), a dozen ranged or melee kills (*Two-Shot*, *Knuckles*), surviving a mortal wound (*Lazarus*), going down four times (*Bounce*), saving two lives (*Doc*), losing an eye (*Patch*), 200 radiation (*Sparky*), 25 scavenges (*Magpie*), 40 runs (*Old Hand*), or running from a fight (*Rabbit*). A nickname sticks. The Chronicle says why: *Earned a name: "Two-Shot", for a dozen kills at range.*

**Named weapons.** A weapon's kills are counted. At 25 (10 before 1.6.2) it earns a name that reads well after "the" (*Widowmaker*, *Bonebreaker*), and its story starts: *Named after its 25th kill, in Mara Vance's hands at Maple Street.* The story adds kills 50, 100 and 200, a nemesis it killed, and an owner who died carrying it (*Came home from the Glow without Dex Arlo.*). It keeps its name through upgrades and new owners.

### 7.8 Vehicles and gas (1.4.0)

This is how crews grow past four, and how the guild moves faster and hauls more. Vehicles are rare, and each is a thing to look after.

| Vehicle | Seats | Carries | Time vs walking | Gas a leg | Noise | Built in the Workshop | Trader's price |
|---|---|---|---|---|---|---|---|
| Motorcycle | 2 | +4 | 45% | 1 | +25% | Level 2: 50 scrap, 8 tech | 45 scrap, 6 tech |
| Hatchback | 5 | +10 | 55% | 2 | +30% | Level 3: 90 scrap, 15 tech | 70 scrap, 10 tech |
| Pickup Truck | 5 | +20 | 60% | 3 | +35% | — | 90 scrap, 12 tech |
| Cargo Van | 8 | +24 | 65% | 4 | +45% | — | 110 scrap, 15 tech |

- **Gas** is the sixth resource. Scavenging turns it up where cars and generators were (Checkpoint Bravo and Red Hand Camp most), traders swap it for scrap or ammo, and raiders take it. A new guild has none.
- **Taking vehicles.** A run can take several. With vehicles, the crew is as big as the seats (one driver per vehicle, the rest fill seats in order); on foot it stays 1–4. A vehicle that is out or broken down can't go.
  - **Gas** is paid when the crew leaves: each vehicle burns its rate for every leg, one leg per 30 minutes of walking (Maple Street 1, the Drowned Mall 2, Red Hand Camp 4, the Glow 5).
  - **Faster:** the run takes the slowest vehicle's share of the walking time. The number of beats still comes from the distance, so a vehicle meets as much on the way, just sooner.
  - **Carries more:** each vehicle's cargo adds to what the crew can bring home.
  - **Noisy:** fights come up more often (the combat weight × 1 + the vehicles' noise, at most +60%), the crew is −2 to spotting enemies first, and **nobody sneaks in a vehicle** (the planner switches a Sneaky approach to Balanced).
- **Wear.** Every run takes 3–9 condition, by type, for a place an hour's walk away or more, and less for a nearer one, down to 30% of it (at least 1): about 1–3 to the Rail Yard. Every fight or hazard knocks off 1–3 more. (3.7.2; Aviel: one 5-minute run took his motorcycle from 60% to 49%. It was 3–9 for any run and 2–6 a knock.) At 0 it breaks down and stays home until repaired. Repairs happen in the Workshop (level 1 or better), back to full: 3 scrap for every 10 points and 1 tech for every 25 (24 scrap, 3 tech from 20%).
- **Wrecks.** At every fight or hazard, a vehicle is wrecked with a chance of 0.4% × danger + 8% × (1 − condition/100)². Measured over a run at Checkpoint Bravo: about 2% in good condition, 4% at 60%, 7% at 25%; at Red Hand Camp up to 11% when worn. A wreck hurts its riders (1–4 each) and is left behind. If what still runs can't seat everyone, the crew **turns for home on foot**: the walk takes 60% of the round trip on foot, and everyone gains +8 stress. A lost run loses its vehicles too.
- **Found on runs.** Places with wrecks (Maple Street, the Rail Yard, Kessler Farm, the Drowned Mall, St. Jude's, the Water Plant, Checkpoint Bravo, Red Hand Camp) can turn one up on a discovery beat. The crew gets it running and drives it home at 10–35% condition, and its cargo helps carry the loot. About 3% of scouting runs at those places find one, and well under 1% of other runs.
- **Sold by traders.** About one caravan in ten brings a vehicle instead of the usual offer, at 45–80% condition, for its price ±15%.
- **Stolen in raids.** A broken raid drives off a vehicle parked at home 40% of the time (half with a Watchtower, half again more with nobody home).
- **Leaving people home** (§9.3): the planner warns when fewer than three would be left to hold the fence. A thin fence is easier to break, an empty Depot draws raiders, and raiders who get in take more.

### 7.9 Outposts (1.6.0)

Expansion: camps out in the Reach that extend what the guild can reach and bring home.

- **Setting one up.** A place's outskirts must be fully explored. The **Radio Tower** keeps outposts in contact, one per level (so up to three), and an outpost costs 40 scrap and 6 tech. It's set up at once, from the place's *Outpost* tab on the Reach.
- **Who lives there.** Up to 3 people. Moving out takes away their Depot post; they can come home any time, from the outpost or their sheet, and the Chronicle notes both. Moving people out is also a way to separate two who are fighting at the Depot.
- **A hard posting** (Aviel, 2026-11-12: it shouldn't feel like a vacation). Out there people:
  - **eat from the Depot's rations**, carried out to them, and go hungry with the Depot;
  - don't work a post, go on runs, change gear, or hold the Depot's fence;
  - each send home 2–3 supplies a day at danger 1, 3–4 at danger 2–3, 4–5 at danger 4–5, drawn from the place's loot table, and practice Wits doing it (after their ration: 1.5, 2.5 and 3.5 a day). Someone resting until healed sends nothing;
  - **heal 3% of their health a day**, about a third of the Depot's base, with no Infirmary;
  - **rest little:** −1 stress a day (the Depot gives −2 plus its Firepit), more beside a Bonded friend or their partner;
  - **keep watch:** +1 stress a day for every point of danger above 1. Measured over 60 days with one person and no friend there, starting at stress 20: the Rail Yard and Maple Street 0, the Drowned Mall 1, St. Jude's 30, Checkpoint Bravo 47, the Glow 60 (about 0.8 breaking points each; 0.3 at Checkpoint Bravo). People at dangerous outposts need swapping out;
  - get to know each other and can fall for each other, like coworkers.
- **Trouble.** Each day an outpost with someone in it has a 4% + 2% × danger chance of trouble (6% at danger 1, 14% at danger 5):
  - **Prowlers** from the place's enemy table come at the fence: d10 + the best Aim + 1 for each other fit person, against 8 + danger. Held: Aim practice, +3 stress. Not held: one person takes 1–2 + danger damage and everyone +6 stress.
  - **A long night:** +6 stress each, or +2 on a Nerve check.
  - **An accident:** someone fails a Wits check and falls through a rotten floor, for 1–4 damage.
  - **Radiation**, where the place has it: someone fails a Grit check (DC 7 + 2 × radiation) and gets Rad Sickness.
  - Nobody dies of it: health never drops below 1, and anyone left under a third of their health is Wounded. Hurts and sickness go in the news and the Chronicle. Measured: 2–6 such lines per 60 days, from Maple Street to the Glow.
- **Shorter runs.** A run to the place, or to any place next to it on the roads, sets out from the outpost and takes half the time (and half the gas).
- **A rest stop.** A crew heading home from a run there or next door stops at the outpost: +2 HP and −8 stress each (not a crew walking home from a wreck, or a lost run).
- **Raids.** Each day an outpost is raided with a chance of 0.5% + 0.5% × danger. Since 2.1.0 (Aviel: "like the gate") it's a raid like the Depot's (§9.8): a notice when they arrive (an outpost has no Watchtower to see them coming), a 3-hour wait, then take command or let them fight; whoever lives there and isn't laid up defends. One raid at a time anywhere: an outpost raid on a day one is already on passes by.
  - The fight: raiders bought for the defenders there (at least one), ×0.75, at a gentler danger than the place's own (1, 2, 2, 2, 3 for danger 1–5: raiders who come for a camp aren't the worst the place has). No meds; the Depot's ammo. Nobody dies, as at the gate.
  - **Held:** Aim practice and a Chronicle line; the spoils go home (§9.8).
  - **Broken:** +10 stress each. The outpost is **damaged** and sends home half until it's mended (15 scrap). Broken again while damaged, it **burns**: it's gone, and its people come home.
  - An empty outpost can't be held, so it's damaged by the first raid and burns at the second.
  - Measured (250 raids each, fresh people, no orders): Maple Street with one, two or three people held 80%, 82%, 94% (the old roll: 68%, 89%, 97%); Kessler Farm 75%, 73%, 82% (62%, 78%, 91%); St. Jude's 76%, 71%, 85% (48%, 67%, 82%); Checkpoint Bravo 79%, 76%, 82% (39%, 59%, 73%); the Glow 8%, 22%, 48% (29%, 45%, 64%). Gear counts now, which the roll ignored.
  - *Before 2.1.0:* d10 + the best Aim there + 1 for each other fit person, against 7 + danger; broken, one was Wounded. Over 120 days with no mending, three people at Maple Street lost it 0% of the time; three at Checkpoint Bravo 22%.
- **Where they show:** the Outpost tab says what life is like there with the place's numbers; a flag on the map (torn while damaged), a tag in the list of places, the Depot's *Out in the Reach* panel, the header count ("2 at the outpost"), the yard's list of who's away, the roster and sheet ("At the outpost at Maple Street"), and the sheet's post picker, which lists the outposts.

### 7.10 Deeper in (1.6.0)

Each place has three levels: **the outskirts**, **deeper in** and **the heart of it**. A level opens when the one before it is fully explored, and runs explore the level they went to.

| Level | Danger | Takes | Loot | Chance of gear |
|---|---|---|---|---|
| The outskirts | as listed | as listed | by danger | ×1 |
| Deeper in | +1 | +25% | by danger | ×1.5 |
| The heart of it | +2 | +50% | by danger | ×2 |

- Danger past 5 is possible deep in the worst places.
- Since 1.6.1 the extra danger also makes the enemies there hit harder (§7.4), and Relics turn up only at the heart.
- **Loot follows the danger** (1.10.1, Aviel): a level's finds grow with its danger like any place's (§7.6), so deeper in the Rail Yard (danger 2) finds as much as Kessler Farm (danger 2). *From 1.6.1 to 1.10.0 each level down also multiplied loot by 1.5, on top of the place's own danger, so the deeper Rail Yard paid +50% and Kessler Farm +25%.* What a level still has over a place of the same danger: more gear, and Relics at the heart. A simulated player who goes deep brings home about 20% less scrap than before (2,050 against 2,570 in 35 real days); +35% a point of danger would put it back.
- Measured in 1.6.1 with fresh crews of 4 (no gear) at the Drowned Mall: deaths 1 in 200 runs at the outskirts, 1 in 32 deeper in, 1 in 12 at the heart. Loot per run 14.8, 20.9 and 20.6 (crews turn back more at the heart); gear 0.27, 0.33, 0.30 a run. At Maple Street: deaths 1 in 600, 300 and 67, loot 7.1, 15.7 and 23.5. Deeper is for strong, well-equipped crews.
- The news says when each level is fully explored, and the place's *About* tab lists the levels with their danger and progress. The planner offers only open levels.

### 7.11 The Vultures (1.11.0)

Another scavenger guild that works the Reach. Asked for in the first design (phase 2); Aviel's answers (2026-11-13): rivals you can deal with, named people, and they compete for places, people, outposts and traders. Meetings on runs became radio calls in 1.12.0 (§7.12).

**Arrival.** On game day 40 (about five real days in; an older save gets them a real day after updating) word comes that a crew calling themselves the Vultures has set up at a danger-3 or 4 place, which goes on the map. Their **boss** and **three lieutenants** are people, made like survivors: portraits, names, traits. A lieutenant comes to the gate the next day (§9.5).

**Standing**, from −100 to 100, starts at −10:

| Standing | From | What it means |
|---|---|---|
| At war | −40 and below | They attack crews they meet, raid the Depot and outposts, and send threats. |
| Wary | −39 | Meetings are standoffs. Raids now and then. |
| Truce | 10 | Meetings are a nod, sometimes news. No raids. |
| Trading partners | 40 | Friendly meetings, their own traders at the gate. |

It moves with what the guild does: fights (−5, −20 for hitting a camp), killing their people (−10), paying tribute (+10), trades (+3), letting prisoners go (+10), and the answers given to their envoys.

**Strength**, from 0 to 100, starts at 40. It grows by about 0.8 a real day (0.1 a game day), and with each person they take in (+2). It drops with each of theirs killed (−2), each lieutenant lost (−5), and each camp lost (−15). It sets how many camps they hold (1 + one per 35), the size of their crews, and how much they hurt the trade.

**Camps.** The first is their home, where the boss is. They set up another every 24 game days or so while their strength allows, next to one they hold, never where the guild has an outpost, each with a lieutenant. **Their turf** is their camps' places and the places of danger 2 or more next to those (the safe places near the Depot are never theirs). Strength 25 or less loses a camp.

**What they compete for:**

- **Places.** At a place in their turf, finds are 20% thinner, and a crew may meet them (one meeting a run at most, likelier at a camp).
- **People.** A call for help left unanswered goes to the Vultures half the time. Someone at the gate who's left waiting until they go goes to them half the time. Each makes them +2 stronger.
- **Outposts.** At war, a guild outpost in their turf is raided by them 1% a day (0.3% wary), fought like the gate (§9.8, since 2.1.0; before, as hard as raiders plus a fifth of their strength). The guild can take theirs: a new job, **Hit their camp**, at a place with one.
- **Traders.** Until they're trading partners, caravan swaps are smaller by a quarter of their strength in percent (a tenth at 40). As trading partners, their own traders come with better swaps (×1.25), and each trade is +3 standing.

**Meetings on runs** (with a Radio Tower they're radio calls, §7.12; unanswered, or without one, the crew's orders decide):

- **Truce or trading partners:** a nod in passing, +1 standing (+2 as partners). One time in five they share news of a place.
- **Wary:** a standoff. Sneaky crews try to slip past (a Wits check). Otherwise the best talker faces them down (Nerve against 9 + strength/25): they back off, or demand a toll of a quarter of what the crew carries. An aggressive crew refuses the toll and fights, and so does any crew that fails to slip past.
- **At war:** they attack, unless a sneaky crew slips past.
- **A fight** is with two to four Vultures, more with their strength, and a lieutenant 40% of the time near their camps. A downed lieutenant is captured half the time when the crew holds the field, and killed otherwise.

**Hit their camp** (a job at a place with a camp): the crew goes straight for the camp, a fight half again as big as usual, with the camp's lieutenant (the boss at their home). If they win:
- the camp is gone and its stores come home (20–40 supplies and maybe a piece of gear);
- strength −15, standing −20 (straight to war from anything above it);
- the planner warns what it will do to the standing.

Taking their home camp puts the boss down, captured or killed. They fall back to another camp under a new boss; with no other camp they're gone for 20–30 game days, then come back with a new boss at strength 25. **The Vultures never go for good.**

**Prisoners.** A captured lieutenant or boss is held at the Depot and eats a ration a day. Each game day there's a 2% chance they slip out. On the Vultures screen:
- **let them go:** +10 standing;
- **trade them back:** +15 standing, plus 20 scrap and 10 tech;
- **ask them to join:** 25%, better with someone close at home; they join if there's a bed, and it's −10 standing either way;
- or keep them.

A lieutenant lost (killed, captured, joined) is replaced 15–25 game days later.

**Raids on the Depot.** At war, Vulture raids come as often as raider raids, led by a lieutenant, 2 harder to hold off. Wary, a quarter as often.

**Envoys** are decisions (§9.5) that come up every 12–20 game days once the Vultures are here, cast with a lieutenant as the envoy ({v.first}):
- first contact;
- tribute (wary or war, strength 40+);
- a trade (truce or better);
- a truce offer (at war);
- a defector at the gate;
- a prisoner exchange (while the guild holds one).

Their effects move standing and strength, swap supplies, take the envoy prisoner, or take in a defector.

**Balance** (the simulated player, 24 guilds over 35 real days): by then they hold two or three camps at strength 80–90 and have taken about 7 people. A player who checks in often ends where 1.10.1 did (22.3 building levels against 22.5); a casual one who never deals with them is about 1.4 levels behind (19.4 against 20.8), with a tenth less scrap and tech. Deaths and hunger are unchanged.

**On screen:** a Vultures screen (`#/vultures`) with their standing and what it means, their strength, their people with portraits and where they are, their camps, the guild's prisoners and their history. The Reach shows their camps on the map and tags their turf in the list; a place's panel says what they do there. The planner warns and offers *Hit their camp*. The Depot's header shows the standing once they've come. Tour step: *The Vultures*.

### 7.12 Radio calls (1.12.0)

Step 18b, from the ideas in `claude/interactive-ideas.md` (Aviel, 2026-11-13: "Yes, radio calls"). Runs can get repetitive; this gives the player a say partway through one without breaking "runs are decided at departure" (§7.3).

**Forks.** Now and then a run comes to a fork: a choice the crew has to make, at most one a run. Forks are data (`content/forks.ts`), like events: each has who's there, what they find, what they say on the radio, two to four orders, and what each order leads to (checks, effects, extra time). A travel, hazard or discovery beat becomes a fork 20% of the time when one fits (about one scavenging run in seven, one scouting run in four); meeting the Vultures when they're wary or at war is always a fork (§7.11).

**The call.** Whoever found it calls home (crews carry a radio; until 2.8.2 this took a Radio Tower):
- a notice on the phone, and a card on the run, on the Depot's Today tab and on the Runs tab;
- the card shows what they found, what they say, and the orders;
- they **wait on the radio for 30 real minutes**. Answered, they go on at once. Unanswered, the one on the radio decides by the crew's orders and their own traits (a Hothead goes through the raiders, a Cautious one leaves the door shut), and the run is 30 minutes longer for the wait.

Until 2.8.2 a crew without a Radio Tower decided on the spot, the same way, and lost no time. Aviel (2026-11-15): forks shouldn't need the tower, as fights don't since 2.2.0; the tour read as if the two contradicted each other, and the run log already had a crew "get on the radio" at a fight with no tower. The tower is still what brings calls for help, more people answering, outposts, and calling a crew home when raiders are seen.

**How it's decided at departure.** The run is played once with nobody answering, then once for each order. The dice are seeded, so every replay is the same up to the fork. All of them are stored; the answer picks which future happens, and the rest of the run moves to start from the moment of the answer. Once the call is settled the other branches are dropped.

**The forks** (1.12.0):

| Fork | Where | Orders | Unasked |
|---|---|---|---|
| A sealed door | buildings, danger 2+ | Open it (45 min, a hard Wits check: supplies, maybe gear) · Leave it | Tinkerer, Curious, Greedy or an aggressive crew open it |
| Raiders on the road | raider places, danger 2+ | Go around (30 min, Grit) · Go through them (a fight, the crew strikes first) · Sneak past (hard Wits: their ammo, or a fight caught out) | Hothead or aggressive: through; sneaky: sneak; else around |
| Someone on the road | danger 1–3 | Bring them along (3 in 5 join the guild; otherwise they slip off with some meds) · Send them on | Generous: bring them |
| A hot roof | places with radiation | Go up (Grit: supplies, and rads) · Leave it | Greedy or aggressive: up |
| A storm | anywhere | Shelter (40 min, eases stress) · Push on (Grit, or hurt and strained) | Cautious or Cowardly: shelter |
| The Vultures, wary | their turf | Slip past (Wits, or a fight) · Talk them down (Nerve, or the toll) · Pay the toll · Fight | Sneaky: slip; aggressive: fight; else talk |
| The Vultures, at war | their turf | Slip past (Wits, or caught out) · Hit them first · Turn for home | Sneaky: slip; aggressive or never pulling out: hit them; else home |

**Balance** (the simulated player, 36 guilds over 35 real days, never answering, so the worst case): runs come to a fork about one time in six. Ignored calls and the slower orders cost runs, 2% for a player who checks in often and 8% for a casual one, and 7–14% of the scrap found; tech, building levels, deaths and hunger are unchanged. The slow orders were shortened for this (shelter 60 → 40 minutes, going around 40 → 30, the door 50 → 45), and only a Cautious or Cowardly crew shelters from a storm unasked.

### 7.13 Taking command of a fight (1.13.0 on runs; 2.0.0 with raids)

From the plan (§15), Aviel's answers 2026-11-13: fights on runs (Hit their camp included) and raids on the Depot can be commanded; on a run you choose it in the planner, and at a fight the crew waits up to 30 minutes with a notice on the phone, then fights alone; each person gets their own move each round, and what they can do depends on who they are, what they carry and their traits; commanding does **a little better** than leaving them to it. Runs come first (1.13.0); raids follow, and the game is 2.0.0 when both are done.

**Leading a run.** The planner has *Lead the fights*. Since 2.2.0 any crew can be led and it's on by default (Aviel: "I don't like that I have to click lead fights every run", and it shouldn't wait for a Radio Tower: that "takes away a big feature of the game for no reason from beginning players"); before, it needed a Radio Tower. Until 2.5.0 a crew without one set out to be led but didn't stop at its fights. Every fight on that run stops and calls home:
- a notice on the phone, and a card on the Depot and on the run: who they're up against;
- *Take command* opens the fight; *Let them fight* sends them in on their own at once;
- unanswered, they wait 30 minutes and then fight on their own, as on any run;
- once you're in command, the fight has to be over by those 30 minutes; rounds you haven't given by then they fight on their own.
The rest of the run goes on from the moment the fight ends, so a quick commander gets them home sooner.

**Why it takes longer** (2.7.1). The planner says what slows a crew on foot under the time: "Slower on foot: Briar sets the pace (Cautious)." Only the slowest is named, since only the slowest counts, and a slowing trait that's still hidden isn't: "someone in the crew is slower than they let on." Aviel saw the Rail Yard take 11 minutes, not 10, with nothing saying why.

**When they're due back** (2.5.1). The run itself keeps the half hour for every fight (nobody may answer), but the time the game tells you counts a fight still ahead as answered at once: a 10-minute Rail Yard run read 40 minutes, which looked wrong and gave away that a fight was coming (Aviel). Once the crew stops at a fight, its wait counts ("if nobody answers sooner"). The same goes for a radio call still ahead (§7.12).

**How it stays decided.** A led run keeps a copy of what it set out with (the crew, and what the run reads of the guild). Each round you give is stored; the run is played again from that copy with your orders, up to the next round that needs you. Every replay is the same up to there because the dice are seeded. A fight you don't command plays exactly as before: the automatic fight is unchanged.

**A round.** Each person standing picks a move, and where they stand (2.3.0: in front or at the back, §7.4); anyone you don't give one to fights as they would on their own. Before the orders, the screen shows **their moves** (§7.4): a badge over each enemy (a hit, a big hit, running), marks over each of the crew for the blows coming at them (a bigger red one for a big hit), and a list ("Raider Brute: winding up a big hit at Silas (up to 10)."). Their **nerve** is a bar in the stage's corner, with a line saying what wears it down. Under the list, **What they are** (2.4.0) gives a line for each kind of enemy in the fight that needs a particular answer: armored, gets back up, hunts as a pack, flies, shoots from the back, winds up big hits, leads them. A hollow on the ground shows a badge for getting back up, and *Finish it* is offered first. **A job** (2.5.0, §7.4): when the fight came with one, its move ("Hold the door", "Haul the crate") is there for everyone, after the attack, but for one of them a round: once it's picked for someone, it's greyed out for the rest with who is on it (3.0.1), and it has a panel under the last round: what it is, a bar of the work done, how many rounds are left or how many are still behind the door, and who is on it this round. The stage shows it in the top-left corner, a pip for each turn of work, filling as the round plays; one through the door walks on when it comes. The call before taking command says the fight has a job. Moving someone to the back shows at once who can still reach them. Measured (1,880 led runs, a test commander that ducks a big hit that would drop someone, hits the one winding up, and patches the downed): won 62% vs 57% left alone, deaths 27 vs 38 per 1,000 runs, a seventh more loot. Sending shooters to the back is no free win: the front then takes every blow (downs 70 vs 57 per 100 fights). **A target that's gone** (2.2.0, Aviel asked what happens): if the enemy picked falls or runs before their turn, they turn to the nearest one still standing with the same move, and the log says so ("Tobias's target is gone. He turns to Raider Scav 2."). Before, the order was dropped and they fought on their own. Then the enemies act, then morale and the 6-round limit, as in §7.4. *Pull out* is an order for the whole crew: the withdrawal check of §7.4.

**Moves.** Everyone can:
- **attack** an enemy you pick: *Shoot* (a gun with ammo, or the crossbow), *Strike* (a melee weapon or an empty gun), or *Punch*;
- **take cover**: no attack, and enemies are 3 less likely to hit them this round;
- **patch up** someone (with a med from the pack): the Wits check of the meds between beats; someone down gets back up with half of that, and the roll for their wound gets +5;
- **aim** (with a gun or the crossbow): no shot this round, and the next one is +3 to hit and +1 damage;
- **shove** (a blow) or **pin down** (a shot), 3.8.0: no harm, +2 to hit; it breaks what the enemy was winding up or gets someone out of its grip, and the others are +2 to hit it this round (§7.4). Shoves go first in a round;
- **break free**, the one move left to someone in a hollow's grip (3.8.0): Brawn against 8 + danger.

Gear and traits add moves (a `moves` hook on traits and gear):

| Move | From | What it does |
|---|---|---|
| Called shot | Hunting Rifle, Crossbow; Dead-Eye with any gun | −3 to hit, double damage |
| Spray | Scattergun | two enemies at once, −2 to hit each, 2 ammo |
| Smash | Sledge | −2 to hit, +2 damage, through any armor |
| Stun | Shock Baton | a hit costs the enemy its next attack |
| Charge | Hothead | +2 to hit and damage; enemies are 2 more likely to hit them this round |
| Draw fire | Brave | the enemies go for them this round; 2 harder to hit |
| Guard | Loyal, Riot Gear | attacks on the ally you pick go to them instead this round |
| Spot | Binoculars | no attack; everyone else is +2 to hit the enemy you pick this round |
| Intimidate | Burn Scars, Scarred Face | vs raiders and Vultures: Nerve against 10 + danger, and one of them (never a leader or a nemesis) breaks and runs |
| Soothe | Animal Lover, Beast-Friend | vs a feral: Nerve against 9 + danger, and it slinks off |
| Short out | Tinkerer, Multitool | vs a scrapbot: Wits against 9 + danger, and it shuts down |

**Balance** (1,938 led runs at danger 2–4, each played twice from the same dice: every fight left to the crew, and every fight given to a simple commander who focuses the weakest enemy, patches up whoever is down, takes cover when badly hurt and uses intimidate, soothe and short out where they can): commanded fights are won 56% of the time against 49%, fewer people die (28 against 39 in 1,000 runs; deaths are rare, so this swings from one batch of runs to the next, and over 6,000 runs it was 30 against 38), and a run brings home a fifth more, mostly from the fights it wins. As many people go down either way. The +5 to the wound roll is what decides the deaths: with +10 they halved, with nothing they barely moved. Fights nobody commands play exactly as before (the same runs give the same logs, line for line).

**The battle stage (1.14.0).** Aviel asked for it after seeing the first fight screen ("like in an RPG game", 2026-11-13), and picked a side view. The fight is drawn as one scene. The crew stands on the left, in their portrait colors with the armor and weapon they carry, facing the enemies on the right, over a backdrop of the place: each of the 12 places has its own. Every enemy has a drawing: raiders by role (the scav's mask, the gunner's goggles and rifle, the brute's spiked bat, the enforcer's road-sign plates), Vultures in black with a crest of black feathers fanned up from the head (the lieutenant's tipped in bone), a pale ruff around the neck and a band of red paint across the eyes (Aviel, 2026-11-18: "maybe add feathers to their head?"; their portraits on the Vultures screen wear the same over their faces), hounds and the mire stalker, hollows stooped (the glowing one lit green, the hulk huge), the hovering drone and the tracked sentry. Up to three a side stand in one rank; more stand in two, smaller as they crowd. Over each head is an HP bar; the name is under the feet in front and over the bar behind. Since 2.2.0 the bar carries its numbers ("4/8", or just "4" where that wouldn't fit), for the enemies too (Aviel: "I can't see how much HP enemies have"), and they change as a round plays. A Vulture has a feather by its name, a nemesis a red mark and its name in red. Stunned enemies show stars, an aimed shot shows a crosshair, and the fallen lie where they fell.
- **Giving orders.** The person whose orders are open has a ring at their feet. Whatever they can go after has a dashed ring, and the target picked has a solid ring and a marker. A tap on an enemy sends their attack (or the targeted move picked) at it. A tap on one of the crew picks them for a move that helps (patch up, guard), or else opens their orders. The line under the moves says what a tap does now. The move chips and target chips below still work the same.
- **Playing a round.** After *Give the orders* the screen scrolls back up to the stage (2.2.0: before, the orders left you at the bottom, under the fight), and the round plays on the stage one act at a time, about 0.7 seconds each. A melee attacker lunges, a shooter fires with a flash and a tracer, and the target shakes on a hit or sidesteps a miss. Damage pops up over the target (red on the crew, yellow on enemies), and the bars drop as it lands. A patch-up glows green, and people who break and run slide off the stage. The *Last round* lines come in step with it. A tap, or *Skip*, jumps to the end. With reduced motion there's no playback.
- **One screen** (2.6.0; Aviel: "It's clunky now having to scroll up and down and things opening and closing", like the planner before it was put on one page). The fight under command fits a phone screen, top to bottom:
  - a line with the round, the time left, and the meds and ammo to hand;
  - the stage (the job and their nerve in its top corners, *Round 2 / Skip* at its top while a round plays, so nothing below moves);
  - the last two lines of what happened (in round 1, a job the fight came with leads), with *Log*, the whole fight so far, and *Them*: the job, their moves and nerve, and what they are, each in a sheet that slides up;
  - the crew in a row, each with their orders in two lines ("Shoot Glowing Hollow 1", "On their own", "Shoot: who?"), or how they are (Down);
  - the open person's place (in front, at the back) and their moves, three across, with *On their own*. A move that needs a target stays lit among the moves, says what it does at once, and its targets come in under the moves ("At whom?"), so another move can be tapped instead (3.7.1; Aviel: picking *Called shot* asked "who?" before he could see what it meant, and there was no going back but by picking a target); tapping one on the stage does the same. Picked in full, the next person without orders opens by itself;
  - a line under the moves: what the move does, whom to tap, where they stand once moved, or that nothing is in reach;
  - *Pull out*, *Let them finish* and *Give the orders*, which stay at the bottom of the screen.
  At 390 by 844 it fits whole; someone with more than eight moves, or a phone with tall bars, scrolls a little, and the buttons stay in reach. The raid at the gate uses the same screen.
- **Before and after.** The card when a crew stops at a fight shows the stage with who they're up against, before anyone takes command (`fightPreview`, which changes nothing). When the fight ends, its last round plays out on the end screen, with how it went: won, got away, both sides pulled back, or beaten (`lastFought`).
- **How it knows.** A commanded fight notes each act as it happens (who, at whom, hit, miss or kill, how much, a shot or a blow), alongside the log lines, and the fight view carries them. Nothing rolls differently for it: fights nobody commands come out the same, line for line.

### 7.14 The market at the Drive-In (3.4.0)

Aviel, 2026-11-23, and a friend playing too: rations are a passive income used only for upkeep, so they pile up; scrap only comes from runs and pays for everything, so there's never enough. His idea: "some kind of merchant that you can go to and exchange rations for scraps, or scraps for gas… maybe the price goes up as you exchange more." (Spoiling, §9.1, caps the pile but wastes it; caravans buy spare rations at 0.5 scrap, but an offer for rations came about once a real week.)

- **A place, not a building.** *The Drive-In*, a swap meet under an old drive-in screen, danger 1, 30 minutes on foot, known from the start (older saves have it too), straight down the road from the Depot on the map. `LocationDef.market`: only the **Trade** job goes there, and Trade goes nowhere else. Nothing to explore (Trade explores 0), so no levels and no outpost; no calls for help come from it; its panel on the Reach has no Outpost tab, and shows the prices today instead of what it mostly finds.
- **A trade run** takes goods and brings back something else: any supply for any other. The goods leave the stores when the crew sets out.
  - The planner's orders show *Buy* (each supply, with its price today), how many, one at a time (holding a button keeps counting), and *Pay with* (each supply, with how many the Depot can spare: what's stored, less what the run takes anyway, like rations for the road).
  - The price follows: what goes and what comes back, as pictures, and "7 scrap cost 23 rations at today's prices".
  - The price is the fewest goods that buy that many, so it rounds up, never down (`priceOf`). The trader hands over exactly that many (`TradeOrder.want`), even when the goods were worth a little more; a good haggler still gets a little on top.
  - At most, what the goods the crew can carry would buy.
  - (3.7.2; Aviel: "it's annoying that everything jumps by seemingly random numbers when trading. I should be able to buy an exact amount of x and tell me the price in y. It should round up, don't make it easier on me." Before, you picked how much to take, in fives, and saw roughly what it fetched.)
- **Packs full of goods:** a trade crew carries three times its usual load (`TRADE_LOAD`), vehicles' cargo included. A crew of three on foot carries about 50–70. What's bought is what they keep first if anything has to be left behind.
- **On the road** the run is an ordinary one at danger 1 (raider scavs mostly: they want the packs), with the market halfway (a `trade` beat, its stamp a pair of scales). A crew that turns back before it gets there brings the goods home; a routed crew loses them, as it loses anything it carries; one routed on the way back loses what it bought.
- **Haggling:** at the market the crew's best Nerve rolls against 10: 15% more on a success, 25% if it beats it by 5.
- **Prices.** Each supply has a worth in scrap (scrap 1, rations 0.45, ammo 0.5, gas 1.2, meds 1.5, tech 3). The market pays 85% of what something's worth and asks 115%. So at the start 3 rations fetch a scrap and a scrap buys 1.6 rations; a scrap buys about half a can of gas; tech sells for about 2.2 scrap and costs about 4.1.
- **The more of one thing, the worse the price** (his rule). Every unit sold raises that supply's glut by its worth over 100, every unit bought lowers it, and its price goes with e to the minus glut. Scrap, which everyone there deals in, moves a third as fast (over 300), so paying for gas in scrap doesn't sink it. Selling 60 rations at once fetches about 17 scrap (3.5 each), 120 about 29, 200 about 41. Buying makes that supply more expensive the same way, whatever the guild pays with. A glut eases back 10% every game day, so about half of it is gone in a real day.
- **Priced at departure** (runs are decided at departure, §7.3): the price when they leave is stored with the plan (`TradeOrder.quote`), so every replay of the run agrees, and the market moves then, so a second crew sent at the same time doesn't get the same deal.
- **The panel** shows the prices as a table in scrap, for ten of each, at today's price: *Sell 10 for* and *Buy 10 for* (at the start: rations 3 and 6, meds 11 and 20, ammo 4 and 7, tech 22 and 41, gas 9 and 16), with "Cheap lately" or "Pricey lately" under a supply once the guild has moved it. A big load fetches less than ten times that; the planner says what the whole load fetches. (The first version wrote each price as a sentence, "Rations: 3 fetch a scrap, and a scrap buys 1.6.", and said "dear" for expensive; Aviel: a table would be clearer, and nobody says "dear".) The planner's *For* choices say the same in a line: "10 rations sell for 3 scrap here, and cost 6." 
- **Tour:** a step on the Reach, *The market*, after *Why go out*; *Getting more* mentions the Scrapyard and the market.
- **Later:** in multiplayer (§15), the market's prices could be shared by every guild on the server.

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
- **Named gear** (§7.7). A weapon with 25 kills earns a name and a history.

## 9. The Depot

**Resources:** Scrap · Rations · Meds · Ammo · Tech · Gas (gas runs vehicles, §7.8)

The Depot plays one **Depot day** for every game day that passes (§11). Each day, for everyone at home (not out on a run):

1. Conditions that have run their course wear off.
2. **Food.** The Garden grows rations, and everyone eats 1 (Gluttons and Drinkers 2). If there isn't enough, they eat what there is and go hungry: +4 stress each instead of any rest, never past 70 on hunger alone, and they heal at half the rate (+10 stress with no limit before 1.7.1). Nobody starves to death. The log notes when the food runs out and when it's back.
   - **Rations spoil (2.2.0; Aviel: anything stored past 10 days has a 50% chance of spoiling).** The larder keeps its rations in batches by the day they came in, and eats the oldest first. Once a batch is more than 10 days old, half of what's left of it goes off each day (an odd one out is a coin toss, on dice of its own so nothing else rolls differently). So a hoard melts away, and a steady Garden or a fresh hunt is what keeps the guild fed. Rations taken out for runs, trades and the rest come off the oldest too. The Garden's status says how many are past 10 days, or will be by tomorrow, and "Since you last looked" says how many went off. Saves from before start with everything stored as of the day they're loaded. *Measured over 35 days (24 guilds a bot): a careful player ends with about 370 rations instead of 2,300, and goes hungry no more often; the scrap it used to get selling its hoard is smaller.*
   - **Warnings (1.1.2).** When the Garden grows less than the whole guild eats (counting those out on runs), the Depot shows how long the stores last, from 10 days out, or that they're gone, with what to do about it. The gate notes when another person would eat more than the Garden can spare.
3. **Work.** People at their posts work and get +1 practice a day in the building's stat (a project's crew works its stage instead, §9.6). Serious wounds (anything that blocks runs) keep people in bed: they keep their post but don't work, and can't take a new one until healed.
4. **Care.** Everyone heals 8% of max HP a day, +8% per Infirmary level, and +2% per point of Wits among the Infirmary's medics (15% and +10% before 1.6.2). A staffed Infirmary also closes wounds sooner, and treats rad sickness and fever with meds, one patient per medic a day. The Clinic (§9.6) doubles the healing, and wounds close in half the time.
5. **Rest.** Everyone sheds 2 stress a day, plus the Firepit's share, plus 2 with a Bonded friend at home, plus 1 with the Memorial Garden (§9.6) (§6: together, about 50 a real day at level 1 and 80 with the Bar and Stage). Optimists and Drinkers shed half as much again.
6. **People.** Co-workers drift toward or away from each other by their trait affinity (a 50% chance each day). A Bar warms everyone a little. Neither goes past Friends or Rivals (§5).
7. **Evolution.** Days at the Depot count toward evolution rules, such as Haunted → Hardened with a Bonded friend home.
8. Something may happen (§9.3), and a new set of recruits answers the radio (§10).

**Balance.** Monte Carlo tests (`depot/depot.test.ts`) check that a new guild left at home for 60 days never goes hungry and stays calm, and that a full Bunks of 8 is fed by a level 2 Garden with three gardeners.

### 9.1 Buildings

| Building | At the start | Level 1 | Level 2 | Level 3 | Workers use |
|---|---|---|---|---|---|
| Bunks | Level 1 | 4 beds | 8 beds (30 scrap) | 12 beds (110 scrap, 12 tech, 120 rations, 20 meds) | — |
| Garden | Level 1 | Grows rations | ×2 (25 scrap) | ×3 (100 scrap, 12 tech, 10 gas, 10 meds, 40 rations) | Wits |
| Scrapyard (3.4.0) | — | Strips scrap, two hands (20 scrap) | ×2, three hands (55 scrap, 8 tech, 15 gas) | ×3 (140 scrap, 18 tech, 30 gas, 80 rations) | Brawn |
| Firepit → Bar | Level 1 | −3 stress a day | Bar: −4, people warm to each other (45 scrap, 6 tech, 70 rations) | Bar and Stage: −5, warm faster (140 scrap, 16 tech, 120 rations, 15 meds) | Nerve |
| Infirmary | — | 25 scrap, 2 meds | 80 scrap, 10 tech, 30 meds | 200 scrap, 28 tech, 80 meds, 40 rations | Wits |
| Workshop | — | Basic gear, ammo (30 scrap) | Guns, armor, instruments, Prime upgrades (75 scrap, 14 tech, 15 gas, 20 rations) | Makes Solid gear (190 scrap, 42 tech, 30 gas, 10 meds, 30 rations) | Wits |
| Radio Tower | — | more answer the radio, stats known, calls for help, one outpost (30 scrap, 5 tech) | more, and better recruits, two outposts (80 scrap, 20 tech, 15 gas, 20 rations) | the most, the best, three outposts (200 scrap, 45 tech, 30 gas, 10 meds, 30 rations) | Wits |
| Watchtower | — | Raid defense, halves losses (25 scrap) | Stronger (60 scrap, 10 tech, 40 ammo, 20 rations) | Strongest (160 scrap, 26 tech, 90 ammo, 10 gas, 10 meds, 30 rations) | Aim |
| Training Yard | — | 2 practice a day (20 scrap) | 3 (50 scrap, 8 tech, 50 rations, 5 meds) | 4 (130 scrap, 22 tech, 100 rations, 20 meds) | Any stat |

**Beds** (1.10.0, Aviel). Everyone needs a bed, but partners share one, and children sleep in a parent's bed until 6 (§5.3). People out on runs or living at an outpost keep theirs. With more people than beds (a couple splits up, a child turns 6 in a full house), nobody new can be taken in, and each Depot day that many people at home sleep on the floor, picked at random: no rest that night, and +3 stress instead (never past 70). The news says when it starts ("There are more people than beds…") and when it ends ("Everyone has a bed again."), the Depot header says how many beds are needed, and the summary counts the nights.

**Costs across supplies** (1.6.2). Before, every building cost scrap and a little tech, and rations, meds, tech, ammo and gas piled up with nothing to spend them on. All the levels together cost 975 scrap, 149 tech, 105 rations, 35 meds and 45 ammo in 1.6.2. The Garden never costs rations, so a guild that has run out of food can still build the thing that grows it.

**A five-week Depot** (1.7.1, Aviel's choice). Income grows about 18× in a guild's first real month (21 supplies on day 1, about 390 a day by week four, measured), so with flat prices everything was built by about real day 18 and there was nothing left to buy. Now the first levels stay cheap (Bunks 2 takes no rations and Infirmary 1 takes 2 meds, so neither traps a new guild), the other level 2s cost about twice as much and the level 3s three times. All the levels together: 2,295 scrap, 388 tech, 250 rations, 82 meds and 120 ammo. Projects (big multi-stage works, §9.6) come after that, since 1.8.0.

**Scrap no more than about half** (3.9.0; Aviel: "I'm always chasing scraps, while I have pretty much enough of everything else. 180 scraps to get more than 8 people is so much scrap"). Scrap was about 40% of what runs bring home but three quarters of what buildings cost, so it gated nearly every upgrade while rations, meds, tech and gas piled up. Now each upgrade past the cheap first ones is at most a little over half scrap, by what the market says each supply is worth (§7.14), and the rest is what fits the building: rations for the Bunks, the Bar and the Training Yard, meds for the Infirmary, ammo for the Watchtower, gas and tech for the Scrapyard's torch, the Workshop and the Radio Tower. All the levels together: 2,020 scrap, 302 tech, 770 rations, 212 meds, 155 gas and 130 ammo (worth about 8% less than before). No upgrade takes more than 120 rations, since rations spoil after 10 days. Level 1s and Bunks 2 are as they were. An upgrade that takes rations can't be paid if it would leave less than 4 days of food (`BUILD_KEEPS_FOOD_DAYS`): "That would leave too little to eat." Projects (§9.6) still cost mostly scrap: they're what a full Scrapyard feeds late on. `depot.test.ts` checks the share.

Measured with a person-like player (six check-ins a real day, builds the cheapest thing it can, two on the Garden and two on the Scrapyard once it has the people, everyone else out in crews of three; 16 guilds, five real weeks). Before, the next upgrade waited on scrap at 86–98% of check-ins in every week, and by day 35 the guild held 81 scrap but 215 rations, 130 meds, 84 tech and 123 gas. Now scrap is what it waits on in the first week (the level 1s are all scrap), and after that the wait moves around: tech about half the time, rations about a third, meds and scrap about a quarter, gas less, none of them always. By day 35 the guild holds 286 scrap, 213 rations, 49 meds, 48 tech and 47 gas. A little quicker overall: 23 levels by day 35 instead of 19, Bunks 3 in 11 of 16 guilds (median real day 26) instead of 7 (day 32). Scrap builds up again from week four, for the projects; tech is the dear one now, and the market turns spare scrap into it.

**Checked to the end of the content** (1.7.2, `claude/balance-5-weeks.md` in the project). A simulated player that plays like a person (kits out its runners, goes where what it needs is, goes deeper, drives, sets up outposts, takes useful trades) played 24 guilds for five real weeks at each of three paces. Level 1s come in the first real week (Garden 2 by day 4), level 2s in weeks 2–3, level 3s in weeks 3–5, and the Depot is finished around real day 31; a casual player (four check-ins a day) is about 15% behind. Two early changes came out of it: a new guild starts with 50 scrap instead of 20, and Infirmary 1 no longer takes tech, which the danger-1 places barely have (it came around real day 11; now day one).

**Upkeep** (1.6.2). The upper levels of some buildings use something up each Depot day. A fraction is the chance of one more.

| Building | Uses | Level 2 | Level 3 |
|---|---|---|---|
| Firepit (Bar) | rations | 1 a day | 2 a day |
| Infirmary | meds | 0.25 a day | 0.5 a day |
| Workshop | tech | 0.25 a day | 0.5 a day |
| Radio Tower | tech | 0.25 a day | 0.5 a day |
| Watchtower | ammo | 0.5 a day | 1 a day |

- It's paid after the guild eats.
- A building whose upkeep can't be paid **works one level lower that day**. It keeps its level and comes back once the stores do.
- The building's screen says what it uses and when it ran short.
- The Depot's "since you last looked" note says what the upkeep used and which buildings ran short.

Building is instant. Numbers live in `constants.ts`, and the building text in `content/buildings.ts`; a test checks that they agree.

- **Garden:** rations per day = level × (2 + for each gardener, 0.5 + Wits × 0.25). Two gardeners with Wits 4 at level 1 grow 5, enough for a guild of 4 at home.
- **Scrapyard** (3.4.0; Aviel and a friend playing too: "there's always not enough scrap and always too much rations"): scrap per day = level × (for each worker, 0.5 + Brawn × 0.1), twice as much since 3.9.0 (it was 0.25 + Brawn × 0.05), so it's a steady source the way the Garden is for rations. Nothing without hands, unlike the Garden. Two with Brawn 4 at level 1 strip about 14 scrap a real day; three with Brawn 5 at level 3, about 72. The point is a choice for people at home once the guild is fed: until 3.4.0 the only post that made anything without a run was the Garden. In the yard it's the sidings between the Bunks and the Garden: a heap, the shell of an old car being cut up, bins; bottles for a cutting torch at level 2, a winch on an A-frame and a cart at level 3. Its workers hammer. The cots by the Bunks (for the hurt, with no Infirmary) moved up under the rails to make room.
- **Firepit:** each keeper adds 0.5 + Nerve × 0.1 to the relief (1 + Nerve × 0.25 before 1.7.1). A Bar gives each pair at home a 25% chance a day to warm by 1 (50% at level 3).
- **Workshop:** each worker turns 1 scrap into 1 + Wits × 0.25 ammo a day, until the Depot holds 60 ammo.
- **Radio Tower:** a 3% chance per level each day, +0.5% per point of the operators' Wits, of hearing about an undiscovered place one road beyond a known one.
- **Watchtower:** sees raiders coming (§9.8): 50/70/90% by level, +10% per lookout, 45/75/120 minutes ahead; seen coming, the defenders strike first. Lookouts with a gun shoot from up top, out of reach, +1 to hit per level. Halves what a broken raid takes. (A raid a decision brings, §9.5, still uses the old roll: +2 per level, +1 per lookout.)

### 9.2 Posts

- Each building with work takes 2 workers at level 1 and 3 at levels 2–3. Posts are given from the building's screen or from a survivor's sheet. A survivor out on a run keeps their post and picks it up when back.
  - Posts belong to the Depot: changing or removing the post of someone who is out sticks when they come back (1.2.1). Before that, a returning crew brought back the posts they left with, which could put three people in a two-person Garden; loading an older save takes the extras off, those out on runs first, with a note in the news.
- **Training Yard** workers each pick a stat (the weakest by default) and get 2/3/4 practice in it a day, instead of the usual +1.
- **A new game** posts the two founders with the best Wits to the Garden and the one with the best Nerve to the Firepit, so the guild feeds itself from the start.

### 9.3 Depot events

At most one event a day (a 20% chance), weighted:

| Event | What happens |
|---|---|
| A wanderer | Someone turns up at the gate and waits there 3 days (§10). Half as likely as the other events since 1.9.0 (weight 1.5 against 2–3), since most new people now come from the Reach. |
| A trader caravan | Its card (3.4.0, Aviel: "it should be clearer what you're giving and what you're getting") has two boxes, *You give* (each thing, with how much the guild has) and *You get* (with a piece of gear's icon and stats, or a vehicle's seats, load and shape), and for a plain swap what the Drive-In would give for the same (§7.14). Offers a swap of supplies (gas among them; 8–20 of what the guild gives, or up to an eighth of a big stockpile, at most 200, since 1.7.2, so a guild rich in scrap and short of tech can turn one into the other), or a Solid or Prime piece of gear for scrap (and tech for guns), or now and then a vehicle (§7.8). Since 1.6.2, half the time it offers to **buy** what the guild has spare for scrap. Rations bring 0.5 scrap each, meds 1.2, tech 2, gas 1 and ammo 0.4. Spare means beyond 25, or beyond ten days of eating for rations, and the caravan takes 20–40% of it. Stays 2 days. |
| A raid | Since 2.0.0 a fight at the gate (§9.8). Before: d10 + the best Aim at home + 2 per Watchtower level + 1 per lookout (+4 with the Wall, §9.6), −2 for each hand short of three at home, vs 12. Held: the defenders get Aim practice and a little stress. Broken: raiders take 25% of the scrap, rations, ammo and gas (half that with a Watchtower, a quarter more with one person home and half more with nobody), never more than 30 of each plus a fifth of whatever is stored beyond 100 (1.6.2; before, 30 at most, which meant nothing against stockpiles in the hundreds), may drive off a parked vehicle (§7.8), one defender is Wounded, and everyone gains +10 stress. Raids come twice as often when no more than one person is home. |
| A celebration | Costs a ration per two people. Everyone at home sheds 15 stress, and every pair warms by 3. Only when food is plentiful. |
| A fever | Someone at home becomes Feverish (−1 Grit, −1 Wits, 2–4 days) unless the Infirmary treats it. |
| A stray | An animal of a kind the guild doesn't keep waits at the gate for 3 days, to be kept or sent off (§9.7). Someone with a way with animals feeds it and sheds 10 stress. With one of each kind, a stray dog just moves on. |

**Feuds at home:** each feuding pair at the Depot has a 20% chance a day to come to blows. The loser (on a Brawn roll) is Wounded, both gain stress, and the feud deepens. Nobody dies at the Depot. A feud can end with someone walking out (*Them or me*, §9.5, 1.9.0).

### 9.4 Workshop

- **Make:** everything but trinkets. Basic weapons, armor and tools need level 1; guns other than the Pipe Pistol and Crossbow, Riot Gear, the Hazmat Suit, Binoculars, the Multitool and the Geiger Counter need level 2. Recipes are in `content/workshop.ts`. A Medkit costs 4 scrap and 3 meds.
- **Vehicles** (§7.8): repairs back to full condition at any level; a Motorcycle at level 2 and a Hatchback at level 3. Trucks and vans can't be built.
- **Improve:** weapons and armor only, since quality doesn't change anything else. Rusty → Common: 4 scrap. Common → Solid: 10 scrap, 2 tech. Solid → Prime: 20 scrap, 6 tech, and a level 2 Workshop. Relics can't be made. The Workshop can improve what's in the stash and what anyone at home is carrying.
- **Take apart** (salvage, 1.8.0, Aviel's idea). A guild four weeks in carried 34–66 pieces nobody used (measured). Now any piece in the stash can be taken apart at a Workshop of any level, for a share of what its recipe costs: a quarter for Rusty, 0.4 for Common, 0.6 for Solid, 0.8 for Prime (at least 1 scrap; guns give tech too, rounded down). Trinkets, which have no recipe, give 2 scrap.
  - **Not taken apart:** relics ("worth more whole"), named weapons, Medkits, and a trinket someone cherishes while they're alive.
  - **Spare gear:** the Gear screen gathers Rusty and Common weapons and armor into one panel, with what they'd come to and *Take them all apart*. Each piece's *Give* list also has *Take apart* with its value.
  - It's a small income (about 220 scrap and 15 tech over ten real weeks, measured), not a way to get rich: the point is a tidy stash.

### 9.5 Decisions at the Depot (1.7.0)

Now and then something comes up that the player has to decide (Aviel's idea, 2026-11-12). The decisions are data in `content/dilemmas.ts`, and `dilemmas.ts` plays them.

- **How often:** one at a time. The next comes 5–11 game days after the last is settled (about once a real day). The first comes on day 4 of a new guild.
- **What they're about:** twelve to start with. Each is built around real people at the Depot:
  - two fighting over a good coat;
  - missing rations and a suspect;
  - a stranger at the gate;
  - a light on the hill someone wants to go and see;
  - bad blood at dinner (needs a rival or feud);
  - grief at the fire (someone Grieving);
  - a Greedy survivor's stash under the floorboards;
  - a woman with a sick child (needs 3 meds);
  - whose kill was it;
  - an old map (needs a place left to find);
  - a couple who want a party;
  - someone asleep on watch;
  - *Them or me* (1.9.0): one of a feuding pair has packed a bag. Asking either to go sends them; talking it through or a week apart can keep both (a Nerve check, or luck). Left alone, one of them leaves, with a week of rations or after one last fight.

  New ones come up first.
- **Four answers.** What follows isn't on the button: each answer has outcomes tried in order. Whether one happens depends on the people involved: a stat check (a Wits check to spot what's really going on, Brawn in a fight), a trait (a Greedy suspect really did it), whether the two get along, or luck. The last outcome always fits.
- **Effects:** stress, the pair's relationship, how everyone else feels about someone, supplies gained or lost, a hurt (never fatal), a trait or condition, practice, a stranger joining (if there's a bed), word of a new place, someone new at the gate, someone leaving the guild.
- **Unanswered:** after 8 game days (about a real day), the people involved settle it themselves, with outcomes of their own that are usually worse. If someone it's about dies or leaves first, it's dropped.
- **Leaving the guild** (`leaving.ts`, 1.9.0). Whoever walks out takes what they carry and is gone for good. Their last Chronicle line says why; they're kept in `state.departed`, and the Memorial Wall lists them under *Gone their own way*, with their sheet still readable. A partner left behind is upset (+15 stress) and it's over between them. Their animals go to whoever was closest to them.
- **What's written:** the news gets a line with the title and what happened. Those involved get a subject-less Chronicle line: *Argued with Wren over a good coat.*
- **On screen:**
  - The Depot's Today tab opens with the card: who it's about (their faces), what's going on, the four answers, and when it has to be decided by. After answering, the card says what happened until dismissed, with a line of what came into the stores or went out ("Ammo +6.", 2.5.1; Aviel asked "What shells?" when a story mentioned shells it hadn't explained).
  - The Depot tab shows a mark while one waits.
  - With notices on, a notice comes when the next one is due, and a reminder two hours before one is settled without the player, saying by when (3.7.4). Tapping either opens the Depot.
  - A decision is about people at the Depot, so on a day with everyone out it waits for the next. Until 3.7.4 the notice didn't: it came, and the game had nothing to decide, which read like a notice for the last one. Now it's for the first day that begins with someone home (crews back by then count), and for an envoy's day if that's sooner.
- `dilemmas.test.ts` checks every decision's references and placeholders, and that each can come up and every outcome of every answer (and of leaving it) can happen.

### 9.6 Projects (1.8.0)

Big works that change the Depot for good, like Civ's wonders: the long goal once the buildings are done (Aviel's choice, from `claude/economy-design.md`). The projects are data in `content/projects.ts`; `projects.ts` plays them.

| Project | Needs | Each stage costs | Crew works with | What it does when finished |
|---|---|---|---|---|
| The Line: track and a handcar | Workshop 2 | 700 scrap, 100 tech, 50 rations | Brawn | Runs to Hilltop, Checkpoint Bravo, Blackwater, Red Hand Camp and the Glow take half the time |
| The Wall | Watchtower 3 | 650 scrap, 130 ammo, 40 rations | Brawn | +4 to holding off raids |
| The Clinic | Infirmary 3 | 270 scrap, 200 meds, 65 tech, 30 rations | Wits | Everyone at the Depot heals twice as fast, and wounds close in half the time |
| The Relay | Radio Tower 3 | 330 scrap, 90 tech, 60 gas, 20 rations | Wits | Two more outposts, and word of every place not yet found |
| The Memorial Garden | Someone has died | 170 scrap, 50 rations | Nerve | Everyone at the Depot sheds 1 more stress a day; grief passes in half the time |

- **Three stages each.** The player pays for a stage, then a crew works it off: each crew member at the Depot and fit adds 1 + their work stat × 0.25 a day. A big stage takes 150 work (about 20 game days, or 2.5 real days, for three people with the stat at 6); the Memorial Garden's take 60.
- **One stage at a time,** across all projects. When one stage is done, the next has to be paid for. So there is one crew: starting another project brings along whoever was on a paused one.
- **The crew** is a post (three people at most). They leave their old post, practice the project's stat as they work, and eat a ration more each while a stage is under way. Out on a run or in bed, they don't work.
- **Each stage** writes a line in the news ("The rails are mended as far as the river."). The last frees the crew and writes a line in each one's Chronicle ("Helped rebuild the Line.").
- **The Line** halves the time to its stops; where an outpost already shortens a run, the bigger cut counts, not both.
- **Seen in the yard:** the Line's track along the bottom with a handcar, the Wall replacing the chain-link stage by stage, the Relay's mast and dish on the station roof, an awning and a flag over the Clinic's cots, and the Memorial Garden's plot with its tree and stone.

**Balance** (measured with the person-like player for ten real weeks, 16 guilds at each pace):

| | No projects | Engaged | Casual (4 check-ins a day) | Bold |
|---|---|---|---|---|
| Stages done by day 70 (of 15) | — | 11 (8–13) | 8 (2–12) | 10 (4–15) |
| Projects finished | — | 3.2 | 2.4 | 3.3 |
| Scrap left at day 70 | 11,770 | 2,410 | 1,510 | 2,870 |
| Stash | 195 | 76 | 51 | 77 |
| Hungry days | 5.2 | 5.2 | 3.6 | 1.5 |

- Projects start around real day 35, once the buildings are done, and run past real day 70: about five more weeks of goals.
- What holds a guild back is people's time (three of about twelve on the crew) and, for some guilds, tech or meds, not scrap. A guild short of tech has a reason to go to the Glow or trade for it.
- The Relay took 130 tech a stage at first; with gas piling up (1,200 at day 70 with nothing to spend it on), its generator takes 60 gas and the tech came down to 90.
- Deaths, stress and food are unchanged.

### 9.7 Animals (1.9.0)

Several kinds, each with its own effect (Aviel's choice). The guild keeps at most one of each; they're data in `content/animals.ts`, and `animals.ts` plays them.

| Animal | What it does |
|---|---|
| Dog | +2 to holding off raids |
| Cat | Each day, whoever at the Depot is most on edge sheds 3 more stress |
| Goat | Milk: a ration a day, counted with what the Garden grows |
| Crow | Brings home shiny things: 15% a day for 1–3 scrap, 1% a day for a trinket |

- **Keepers.** Each animal has a keeper, who sheds 1 more stress a day at home with it. The keeper can be changed. When a keeper dies or leaves, the animal goes to whoever was closest to them.
- **Not on an empty stomach.** On a hungry day nobody rests, so the keepers and the cat give no relief either.
- **Arriving.**
  - **At the gate:** a stray of a kind the guild doesn't keep turns up (the Depot's stray event) and waits 3 days to be kept or sent off.
  - **Following a crew home:** some events on runs bring one, kept by whoever won it over. That's the stray dog (60%, when an Animal Lover wins it over), a goat on the road, a cat in the ruins, and a crow with a key.
- **They cost nothing:** they live on scraps. The cost is the choice of who looks after them.
- **The dog stays home.** Taking it on runs could come later.
- **On screen:**
  - strays at the gate on the Today tab, with *Keep it* and *Send it off*;
  - the Animals panel under the yard drawing, with each animal's keeper picker;
  - a line on the keeper's sheet;
  - in the yard: the dog at its keeper's side (or waiting by the gate while they're away), the cat asleep on the Bunks, the goat grazing by the Garden, the crow on a fence post.
- **Measured** with the person-like player: a guild that keeps every stray has all four by week 5.

### 9.8 Raids at the gate (2.0.0)

Aviel's answers, 2026-11-13: raiders come; with a Watchtower a roll may see them coming, with a notice and time to prepare (keep people home); otherwise they're at the gate with a notice, and when he opens the game he deals with it, picking the fight with whoever is at the Depot. They wait **a few hours**, then fight alone. **Only those at the Depot when the raiders arrived can defend** (his correction: otherwise waiting for a crew to come back would be a trick). This finishes taking command of a fight (§7.13): the game is 2.0.0.

- **When they come.** The Depot day that rolls a raid (§9.3) sets a time for it to arrive, 50–160 minutes into the day. One raid at a time.
- **Seen coming.** With a Watchtower, a chance it's seen on the road: 50/70/90% by level, +10% per lookout posted, at most 95%. Seen, it's spotted 45/75/120 minutes before it arrives (never before the day began), with a notice and a card on the Depot: when they'll be at the gate, who's home, and which crews will be back in time. The defenders are ready and strike first (the raiders don't attack in the first round).
- **At the gate.** On arrival, who is home and fit is fixed: those who can defend. Tired from a run is fit (Exhausted only limits runs); laid up isn't. A crew that gets back later holds back until it's over, and nobody sets out while the raiders are there. They wait **3 hours** for the player (`RAID_WAIT`), with a notice and a card: *Take command* or *Let them fight*. After 3 hours, they fight it out on their own. With nobody home, they walk in.
- **The fight.** Played like a fight on a run (§7.3), at the Depot (danger 2), on the battle stage with the Depot's own backdrop. Raiders: scavs, gunners and brutes, bought like a fight at danger 2 ×1.05, for a fence of at least three (fewer at home doesn't mean fewer raiders). The Vultures (at war, or now and then wary, §7.11) come with one of their named people at their head, stronger as they grow. The defenders use the Depot's ammo and meds, and what they use comes out of the stores. On their own they fight until someone goes down, then pull back inside. Under command it's replayed from a copy of the defenders taken when the fight began, round by round, like a led run's fight; their gear can't change until it's over.
- **What helps.** Lookouts with a gun go up the Watchtower and shoot from there, out of reach (+1 to hit per level); with nobody left at the gate, the tower can't hold it alone. The Wall (§9.6): raiders need 3 more to hit the defenders. The dog (§9.7) bites alongside them (to hit +3, 2–3 damage), and nobody can hurt it.
- **After.** Nobody dies at the gate: the Infirmary is right there (mercy, +10 to wound rolls). Won, or a standoff: held; the defenders practise Aim (+2) and it goes in their Chronicle. Pulled back or all down: broken, as before (§9.3): a share of the scrap, rations, ammo and gas, maybe a parked vehicle, +10 stress for everyone home. The Chronicle and the news say who held the gate, and whether you led it.
- **Getting ready** (his picks, 2026-11-13, in 2.0.0). Seen on the road, the raid screen lists who's home, every crew out (back in time or not), and what can be done before they arrive:
  - *Call a crew home.* With a Radio Tower (and a Watchtower to see them coming), a run keeps a copy of what it set out with (`Run.home`; a led run has its own) and can be played again with the crew turning back at that moment (`recallAt`): the same run up to then, then "Word over the radio: raiders on the way to the Depot", and home in half again the time they'd been out (as any run cut short). The screen says when they'd be back and whether that's in time. Not while they're on the radio or in a fight under command; a call or a fight still ahead never happens. Runs set out before the Radio Tower can't be called.
  - *Shore up the fence.* 20 scrap: raiders need 2 more to hit the defenders (on top of the Wall).
  - *Hide some stores.* A break-in finds only half the stores, and the defenders reach only half the meds and ammo.
  - Both need someone home to do them.
- **Talking first** (at the gate, before any fighting; one try):
  - *Pay them off.* They want 60% of what they'd carry off breaking in, and at least 3 scrap and 3 rations for each of them. Nobody hurt. The Vultures take it as a toll (+3 standing, +2 strength).
  - *Stare them down.* The best Nerve at the gate (intimidate counts) against 13, 15 for the Vultures: d10 + bonus, so about 30% for a new guild. If it works they go, and it goes in the talker's Chronicle; if not, they strike first (the defenders can't act in the first round) and there's no more talking.
- **Who holds the gate.** By default everyone who can; the player can keep people back.
- **Two bands.** A quarter of raids (own dice) come in two bands; the second is 60% the size of the first and never has a leader. The Watchtower sees both; at the gate the card says a second band waits on the road. If the gate holds against the first, the second comes on: anyone down or badly hurt gets patched up with a med while there are any (they get back up as in a fight, §7.13). Under command the round that beat the first band plays out on the stage first (2.8.7), then the player picks who meets the second (those kept back are fresh) and commands that fight too or lets them fight; left alone, everyone still up meets it. Held means holding against both.
- **Measured** (600 raids each, a new guild of 4, everything left to the defenders): held 48% (the old roll: 46%), two-band raids 34%; about 0.6 people hurt a raid. With a Watchtower and a lookout with a rifle 70% (old 75%); Watchtower 2 and a lookout 81% (old 92%); the Wall and a dog 85% (old 98%). Shored up: a new guild 67%, Watchtower and lookout 85%, the Wall and a dog 95%, and fewer hurt. Hidden stores: a little worse (half the ammo and meds), 45% for a new guild. Staring down works about 31% of the time for a new guild.
- **Raids that differ** (Aviel's picks, 2026-11-14, in 2.1.0). Besides raiders and the Vultures, the Reach's other bands come for the Depot once the guild knows a place they come from (from the places' encounters). Weights: raiders 6, feral packs 2, hollows 1.5, scrapbots 1.5, on the raid's own dice. Each band (`content/raids.ts`):
  - *Raiders and the Vultures* talk, take stores and maybe a vehicle (as above).
  - *A feral pack* (rad-hounds, mire stalkers): can't be paid or stared down; inside they take only rations, half again raiders' share. Bought ×1.12.
  - *Hollows* (hollows, glowing hollows): can't be talked to; the Watchtower sees them half as often (they come in the dark); inside they take nothing and hurt two of those home. Bought ×1.15.
  - *Scrapbots* (drones, sentries): can't be talked to; inside they take scrap and tech (half again raiders' share of tech); the Workshop's people know where to hit them, +1 to hit for each Workshop level. Bought as raiders.
  - Measured (400 raids each, a new guild of 4, no orders): raiders 46% held, ferals 56%, hollows 54%, scrapbots 66% (the Workshop helps); with a Watchtower and a lookout 70/80/74/73%; the Wall and a dog 87/89/94/93%. All bands together, a new guild holds 52% (the old roll: 46%).
- **What they want** (2.1.0). Raiders and the Vultures at the Depot come for something in particular 40% of the time, picked from what applies (on their own dice): a parked **vehicle** (weight 1), **one of theirs back**, a captive or a Vulture lieutenant the guild holds (2), **a score to settle** with whoever has killed the most raiders, at least 5 (1), or **a kind of store**, rations, meds or ammo, 30% of it and at least 15, 4 or 10 (1). The Watchtower and the gate say so.
  - Paying them off gives them what they came for instead of a toll: the vehicle, the prisoner, the store. A score can't be paid ("They won't take anything for Gray"); staring them down still can work.
  - In the fight, raiders with a score go for that person four times as often.
  - Broken in, they take it: the vehicle for sure, the prisoner freed, twice the share of the store, or the person beaten (Wounded).
  - Gone when they came (the vehicle out on a run, the prisoner gone, the person out), they take what they can.
- **Spoils** (2.1.0). A held raid leaves what the beaten carried (each enemy's drops, as on runs, when the fight is won), and each raider or Vulture killed leaves a weapon or armor 35% of the time (rusty a third of the time; `RAID_SPOILS`). The end screen and the news list it.
- **Captives** (2.1.0). After a won fight against raiders or the Vultures, one is left behind alive 30% of the time, held at the Depot (`state.captives`, the Roster's *Captives* panel). They eat a ration every other day and slip out 2% of days. **Question** them once: the best Nerve at the Depot (intimidate counts) against 12, and they tell of a cache (8–16 scrap, 4–10 rations, 3–8 ammo). **Ask them to join**: 25%, needs a bed; a no is final. **Let them go**: the Vultures warm to it (+5). Their own may come back for them (*one of theirs back*).
- **Not picked:** a trail back to their camp.

### 9.9 The Depot's corners (2.7.0)

Aviel's new game had nothing to do but send a run and wait out the one-run-a-game-day rule (§15). Of the ideas for the first hours he picked this one, and a first-week story (§9.10). The old depot itself has corners nobody has been through, and someone at home can search them. The corners are data in `content/corners.ts`; `corners.ts` plays them.

- **The corners:**

  | Corner | Minutes | Helps | Opens | Found (passing the check / not) |
  |---|---|---|---|---|
  | The ticket office | 5 | Wits | – | a route map with a place marked, and the keys / the keys |
  | The signal box | 10 | Wits | – | 5 tech from an old field radio (what Radio Tower 1 needs) / 5 scrap, 2 tech |
  | The water tower | 10 | Grit | – | a new place on the map and 6 ammo / the place, and a fall (3 HP) |
  | The locked freight car | 15 | Brawn | – | a dog, kept by whoever found it, and 4 scrap / the dog, sore arms (+3 stress) |
  | The coal bunker | 15 | Brawn | – | 10 ammo, 4 scrap / 4 ammo, 4 scrap, +3 stress |
  | The stationmaster's house | 15 | Nerve | – | a stranger living there joins (or waits at the gate for a bed) / a pack: 2 meds, 4 rations |
  | The cellar | 15 | Nerve | the ticket office's keys | 10 rations, 3 meds / 5 rations, 1 med, bitten (2 HP, +6 stress) |
  | The engine shed | 20 | Wits | the signal box | a Multitool and 8 scrap / 12 scrap |

  The check is d10 + the stat against 8 to 10. A dog moves on if the guild already has one.
- **Searching:** one search at a time, by anyone at home who can work. Someone back from a run who's tired from it can go (§7.2). While searching they can't set out on a run or move to an outpost. The search ends when its time is up, through `advanceTime` like a crew coming home. Whoever searched gets a Chronicle line ("Searched the signal box at the Depot.") and the news gets the story. If they're gone before it ends, the corner waits for someone else.
- **On screen:** under the yard on the Depot's Yard tab. It shows how many have been searched, the search under way, and the corners still to search: each with its time and the stat that helps, or why it's shut. Tapping one opens a sheet with what it is and who could go, the best at it first. When a search ends, a card says what turned up, with a line for the stores ("Ammo +6.") and any gear, until *Done*. There's a notice when it ends (tapping it opens the Yard; in 2.7.0 it opened "Run not found", 2.7.1), and a red dot on the Yard tab (a line in the bell before 3.5.0). Once every corner is searched, the panel goes.
- Old saves get the corners too, none searched (save 24).
- Tour: a step, *The Depot's corners*, after *The yard*. Shown again from Settings, it says how many are left, or that they've all been searched and the list is gone (2.8.3).

### 9.10 The first week (2.8.0)

The other half of Aviel's pick for the first hours (§9.9): a short chain of things to do, one at a time, each with a reward. Together they take a new guild through its first places, buildings and fights to a motorcycle, and end with the first word of Haven, the game's long goal (§15). The steps are data in `content/story.ts`; `story.ts` checks them and pays out.

| Step | Goal | Reward |
|---|---|---|
| Kit them out | Hand out the gear in the stash: nothing left that would fill an empty slot on anyone | 6 ammo |
| Get the Garden going | Garden level 2 | 8 rations |
| A first run | A crew home from a run, anywhere | 5 scrap |
| The old depot | Three corners of the Depot searched (§9.9) | 2 meds |
| Smoke over Maple Street | A crew home from Maple Street | Whoever lit the fire, at the gate wanting to join |
| The farm | A crew home from Kessler Farm | 10 rations, 4 tech (parts from the well pump) |
| Wheels | The Workshop | A Motorcycle at 60% (it was under a tarp in the engine shed) and 8 gas |
| Get on the air | The Radio Tower | 10 scrap, and the Haven broadcast |

- **One step at a time.** Each goal is read from the game as it is. Runs count from when the step began (a run before it doesn't count). When the goal is met, the reward waits to be collected. Collecting writes the step's ending in the news, then the next step begins.
- **The end:** the first night on the air, a recorded voice: *"This is Haven. We have power, clean water, and room for you. All survivors welcome."* It plays on the hour, every hour, the same words. Nobody has heard of Haven or knows where it is. From there, Haven (§9.11): the card says the Haven tab now keeps what the guild finds out, and opens it.
- **On screen:** a note pinned above the yard on the Depot's Yard tab, so a new player sees it on opening (paper, the one thing on the Depot that is). It waits until the tour is over or skipped, and so does its dot (its line in the bell before 3.5.0): in 2.8.0 a new guild opened on the note with the tour's card over it, two paper cards at once (Aviel, 2.8.1): where it is in the chain ("Getting started · 3 of 8"; it said "The first week · 3 of 8" before 3.7.3), the setup, the goal with a count where there is one ("1 of 3"), a button to where it's done with the reward beside it (the Gear screen, the building, the planner for the place, the Reach, or down to the corners). Once the goal is met, *Collect*, and a red dot on the Yard tab. After collecting, the note shows how it went and what came in until *Next*.
- **Not a week by the calendar** (3.7.3): a guild can take two weeks or more over it, and Aviel finished on day 14 to "The first week is behind them." What the player sees doesn't count days: the note says *Getting started*, its last card *Settled in*, the news "The guild has found its feet.", and the tour "once the guild has found its feet". In this document it's still the first week.
- **The motorcycle** is a real jump: otherwise it takes Workshop 2 and 50 scrap, 8 tech, a trader, or luck on a run. That's the point: something big at the end.
- **How long it takes** (a bot that follows the note, 40 guilds each; it sends anyone free to the Rail Yard and searches corners with whoever's home):

  | Check-ins | Week done (median) | Game day |
  |---|---|---|
  | Every 30 min | 5 real hours (5–10) | 2 |
  | Every hour | 9 real hours (8–11) | 4 |
  | Every 3 hours, 8:00 to 23:00 | 30 real hours (30–36); 1 in 40 not yet at 48 | 11 |

  The Radio Tower's tech is the slowest part: the farm's 4 and the signal box's 5 cover it. Nobody went hungry; 1–3 deaths in 40 guilds over two days, as without the week.
- **Old saves:** a guild no older than 14 game days gets the week from its first step, counting runs from when it came in (save 25). An older guild doesn't.
- Tour: the last step, *That's the tour*, says that when it closes, a note above the yard says what to do first. (2.8.0 had a step pointing at the note; with the note hidden during the tour, 2.8.1 dropped it.)

### 9.11 Haven (2.9.0)

The long goal (§15), from the broadcast that ends the first week. Aviel, 2026-11-16, after reaching the broadcast within a day: it has to be clear that the story is now about finding out about Haven and getting there, with hints throughout and the goal made plain. The pieces are his:
- **Clues are found on runs** to different places, not like the first week's tasks; a couple are buildings too ("you can also have build goals").
- **A tab of its own**, there once the broadcast is heard, holds everything known.
- **Hints by chance in different situations**, "common enough that it makes you interested in finding out more".
- **It takes about five weeks** to the last trip, ending around when the Depot is finished.
- **The truth** (Aviel, 2026-11-16, replacing slavers: "It's better than slavers"): Haven began after the bombs, a cult around a doctor from St. Jude's Hospital (Dr. M. Marr in the clues) who believes in making the next kind of human. Whoever answers the broadcast is taken in, cut up and experimented on, with the Glow's radiation, to raise them to something higher. Haven didn't cause the Burn (Aviel, correcting the first telling: "they didn't cause the bombs to drop"), but the Hollows that come out of the Glow are its failures, left there by the white trucks. The broadcast is bait, and the "intake" sorts candidates from donors. The clues and hints start out sounding wonderful and darken as the guild learns more (hospital bracelets, surgical thread, stitches on a dead Hollow, "two more for the glass"); nothing says it outright before the end.
- **One of the guild goes** (Aviel: "One of our own gets influenced by the news of haven and runs away to join them alone on some run one time. This is the one who escapes and is shot when you approach"). See *The one who goes* below.
- **The Vultures join the guild at the end:** rivals or not, they think Haven is vile too. They lost three of their own to Haven, and once the guild finds the list with their names, one of theirs comes to the fence: "When you go, send for us."
- **The end** (the next step, not this one): everyone fit sets out and fights on the way under command. **The truth comes at the gate**: just as they arrive, the one who went gets out, runs to them shouting what Haven really is, and is shot by a sniper in front of them (they go from the departed to the Memorial Wall). Then a big fight beside the Vultures, against a giant stitched together from many people (four arms, three legs, two heads). Then an ending scene, a Chronicle line for everyone who went, home with whoever they freed, and the game goes on. The guild is glad of the haven it built.

**Clues.** Thirteen, in `content/haven.ts`, each with a lead (where it should be, and why anyone thinks so), what it says, and a line for *What we know*. Each opens when the clues it follows on from are found, so there are usually two or three leads open at once. Eleven are found on runs to a place, at a level of it (§7.10); two are worked out from the Haven tab once a building is up. One the road needs is in the Glow (Aviel: "There should be a clue you need that can only be got by going in the danger 5 location"): a geared crew comes back from there most of the time, so it's dangerous, not impossible (§7.5).

| Clue | Where | After | What it tells them |
|---|---|---|---|
| The engineer's logbook | Hilltop Radio Station (danger 2) | the broadcast | The signal comes from the east, past the edge of the Reach |
| A flyer in the tunnels | The Old Metro (2) | the broadcast | Wait by the highway with a fire lit, and Haven comes for you |
| A note on the Kesslers' door | Kessler Farm (2) | the broadcast | Whole families have gone; white trucks come for them |
| Letters nobody collected | Maple Street (1) | the Kesslers' note | Nobody who went has ever written back |
| A convoy's dropped radio | The Water Plant (3) | the logbook | The trucks stop there; the drivers have a band of their own |
| The convoy band | Radio Tower level 2: *Listen in* | the radio | They bring people in by a north gate, counted in heads |
| The intake list | Checkpoint Bravo (4) | the radio | A list of everyone taken in; three of the names are Vultures |
| Forms from St. Jude's | St. Jude's Hospital (3) | the flyer | Haven looks people over when they arrive: every break and scar, and CANDIDATE or DONOR. Signed by Dr. M. Marr, who worked at St. Jude's |
| Red Hand's ledger | Red Hand Camp (4) | the list | Red Hand sells Haven something, and is paid well |
| The driver's map | Blackwater Swamp, deeper in (4) | the list | The trucks take the old highway east, two days out |
| The runaway's notebook | The Glow (5) | the list (a name crossed out: "ran, Glow road") | Someone got out along the spillway and drew the inside of the dam (wards, a room of tables): "Not the north gate. Never the north gate." |
| A bearing on Haven | Radio Tower level 3: *Take a bearing* | the map | Haven is at Corwin Dam |
| The gate code | The Water Plant, deeper in (4) | the convoy band and the list | "Shepherd", and two flashes, at the north gate |

- **Only at places the guild knows** (2.9.1, Aviel: "If I haven't found that location yet, I shouldn't even know about it"). A lead at a place nobody has found isn't shown anywhere, not even by name; the Leads page only says there may be more out past the places the guild knows, and that scouting turns up new ones. The first leads at unknown places (the radio station, the metro) show up when scouting finds the place, and the report says "There's a lead for Haven there". **A find puts where it points on the map:** when a clue opens a lead at a place nobody has found, that place is discovered ("The engineer's logbook points the way to the Water Plant. It's on the map now."), so from the first finds on, the chain never needs scouting.
- **Finding one.** A crew that makes it there and back (a run that turns back early doesn't count) looks for it: 40% on the first try, 25% more for each crew that came back without it, 15% more when scouting. Whoever's sharpest (Wits) finds it. The run's log has the find, what it says, and where it points on to ("It points on to the Water Plant."); the report shows it whole (2.9.1, Aviel: "it should be very clear... what the clue says... where was found and then... what's the next clue that it leads to"). The rolls have their own dice, so a run comes out the same as it would without Haven but for what it turned up. The Vultures' word comes to the Depot on a Depot day (30% a day) once the list is found and they're in the Reach.
- **The road** is open once they have the bearing, the gate code and the runaway's notebook: *They know where Haven is, and how to get in.*

**The one who goes.** Once the guild has found 3 clues and has at least 5 people, one of them starts listening: someone at the Depot, in the guild a real day or more, with no partner or child to keep them (picked on Haven's own dice). Three lines about them are heard at the fire, as hints, each once the guild has found as many clues as its tier (3, 5, 7), 35% a Depot day when one is due and they're home: up late by the radio; talking about hot water and "a doctor who stayed"; a pack by the door, "just in case". After the third (or once the road is open) they're ready. The next run they're on with someone else along, they walk off where the old highway turns east, on the way home: a beat of its own (*The highway east*), "Rook went east to Haven, alone." in the report, and *Watched Rook walk east to Haven* in the Chronicle of whoever saw it. They're still counted with the crew for the rest of the run, so nothing else in it changes. Kept off runs a real day after they're ready, they slip away at night and leave a note. Either way they leave the guild with what they carry, like walking out (§9.5), the Memorial Wall's *Gone their own way* says "Went east alone, to Haven.", and their goodbye is filed in the Haven tab with what was found ("Rook's goodbye"), with a line in *What we know*. If they die before it comes to it, it may get hold of someone else. A guild that never reaches 5 people loses nobody this way; part 2 needs a stand-in for the gate then (one of the Vultures' three).

**Hints.** Fifty-eight, in `content/haven.ts` (and the three about the one who goes), from seven places: on a run (a line in the report), from someone new when they're taken in, a trader at the gate, the radio at night (with a Radio Tower), talk at the fire, a captive, and the Vultures once they're in the Reach. Each is heard once. A hint can be heard only once the guild has found as many clues as its tier, so they darken in order (the earliest tier available comes first); a few need a particular clue (the convoy band's talk needs the dropped radio). At most one every 3 game days; when that allows, a run brings one 20% of the time, a newcomer or a trader 60%, and a Depot day 12% (from the radio, the fire, a captive or the Vultures, whichever has one to tell). Hints the player didn't see come up go in the news.

**On screen.**
- **The Haven tab** in the tab bar (six tabs then, a little smaller), with a count of what's new, or *!* when a building clue is ready. It's the guild's notebook on Haven (Aviel: more organized, since it gets long, and "make it look like handwriting... something cool"): paper on the steel, notes in a pen hand (Caveat, bundled like the other fonts), buttons and small print in the usual face.
  - **The road** at the top: a hand-drawn map from the Depot to "Haven?" ("Corwin Dam" once the bearing is taken), a stop a clue. It's inked as far as the clues found, with a rust ring for each open lead and pencil dots for what's still unknown, and a key and "5 of 13 found." under it ("The road is open." at the end). Then the broadcast, quietly.
  - **Leads:** *What we know* on a ruled page (a line a clue), then each lead on an index card taped to the page: where (the place and level, or the building), which find pointed here in red pencil ("From the engineer's logbook."; none for the first leads), why, and a button: *Plan a run there*; *See the place* when the level isn't open, *See the Buildings*, or *Listen in* / *Take a bearing* when the building is up (first in the list, and a dot on the Haven tab). After a failed try: "One crew looked and came back without it. Scouting looks harder."
  - **Found:** the clues as scraps of paper, two to a row, newest first, with who found them, where and when (or "At the fence", "Worked out at the Depot"); new ones are circled in red pencil. Tap one to read it whole on a sheet: who found it and where, what it says, *What it tells us*, and *Where it points*: each clue it leads to, marked like the road, with how it stands ("The Water Plant: a lead now.", "Found.", or "Once the intake list is found too."). Working out a building's clue opens that sheet at once.
  - **Heard:** the hints on a ruled page, newest first, with where each came from; the newest six show and the rest fold under *Older*.
  - Tabs show how many each part holds, with a dot when something's new.
- A place with a lead is tagged *Lead for Haven* on the Reach, and its panel says what's there (tap for the Haven tab). The planner says so too: "A lead for Haven here: the engineer's logbook. If the crew gets there, they'll look for it." A report with a find shows it whole, the same note as the Found sheet, with *Open Haven*; otherwise "no sign of it this time."
- The first week's last card says the new Haven tab keeps what the guild finds out, and its button is *Open Haven*.
- Tour: a step *Haven* at the end of *Later on*: before the broadcast, that the long goal comes over the radio and gets a tab; after, what the tab holds.
- **Old saves:** a guild past its first week has heard it (save 26). A guild older than the first week (§9.10) hears it on the first Depot day it has a Radio Tower.

**How long it takes** (a bot that plays like a person and sends one crew a check-in after a lead it could manage; 12 guilds each, real days, median):

| | Engaged (six check-ins) | Casual (four) |
|---|---|---|
| First four clues | 2–4 | 3–9 |
| The dropped radio, the forms | 10–11 | 12 |
| The list, the ledger, the Vultures' word | 18 | 20–22 |
| The runaway's notebook (the Glow, once a crew is at ease at danger 4) | 19 (12 of 12) | 24 (11 of 12) |
| The convoy band (Radio Tower 2) | 23 (10 of 12 by day 35) | 30 (9 of 12) |
| The driver's map, the gate code | 26–27 (9–10 of 12) | 31 (1–3 of 12) |
| The bearing (Radio Tower 3): the road open | 33 (5 of 12 by day 35) | later |
| Hints heard by day 7, 14, 21, 28, 35 | 8, 18, 27, 34, 39 | 8, 17, 25, 31, 36 |

Radio Tower 3 is one of the last buildings, so the road opens about when the Depot is done, as Aviel asked. Deaths and hunger are as without Haven, the trips into the Glow included.

### 9.12 Haven, part 2: the road east (3.0.0)

Aviel, 2026-11-17: about **2 hours** on the road; **everyone goes, even the injured, and the children too** ("wtf u leave children behind"), and everyone has to fit in vehicles, or the guild **buys places in a caravan** before it sets out; **one shot**: lose, and Haven goes on, the guild goes home hurt and keeps rebuilding, "it is what it is"; finishing it is **3.0.0**.

**Setting out.** Once the road is open (§9.11), *The road east* is pinned over the notebook at the top of the Haven tab, under the radio line, edged in rust: the one thing on the tab to act on. The find that opens the road marks the tab new as any find does. The card says who rides and what carries them, sells the caravan places, lists what's worth knowing (few meds, guns with no ammo, who's hurt, who comes in from an outpost) and what stops them now, gives **the Vultures' word**, from whoever of theirs is coming, by how things stand with them (Aviel, 2026-11-18: "The Vultures should say something depending on your relationship with them before the haven run"; trading: "About time... Leave some of them for us."; truce: "We said we'd come, and we will. Don't make us sorry."; wary: "We don't like you much. We like Haven a lot less."; war: "Our word was about Haven, not about you... After that, things go back to how they were."), or says nobody is coming when they're about but never gave their word, and asks once more before they go ("there's no turning back").
- **Who:** everyone in the guild, wherever they are: hurt, tired or at an outpost (they come in first). Children ride along and stay with the vehicles.
- **What stops it:** a crew still out, raiders seen or at the gate, or someone searching a corner. The card says which.
- **Seats:** every vehicle that runs, one driver each, has to seat everyone, children included. Short, and the guild can **buy places in a trader's caravan**: 20 scrap and 2 tech a seat, bought before setting out and kept until it does (people who join later need more).
- **What they take:** every med and round of ammo in the Depot, a ration each, and gas for the vehicles as for any run to a place two hours out.
- **While they're away:** the Depot is empty, and its header says so. No runs (everyone is out), no raids (none are scheduled while the guild is on the road, so an empty Depot is no warning), and nothing is worked. The yard has nobody in it, the Roster says the children are on the road with the guild, and the card on the Haven tab points at the run.

**The road.** One run (job `haven`, to Corwin Dam, a place off the map), played from a script instead of the usual random beats, with every fight under command as on any run (§7.13). Minutes from setting out, before any waiting for orders:
1. 10: *The old highway*. The whole guild together on the road east.
2. 30: *Red Hand's toll*. Raiders across the highway. A fight.
3. 50: *A white truck*. One of Haven's comes the other way and slows. The driver smiles and waves them on: "Nearly there. They'll be so glad to see you." No fight: the guild doesn't know yet.
4. 65: *The Glow road*. Hollows out of the Glow, more than anyone has seen, and some with stitches. A fight.
5. 95: *Corwin Dam*. The dam, the garden on the spillway, washing on a line: just as the broadcast said.
6. 105: *The north gate*. The truth, then the last fight.
7. 155: *Home*.

**The fights wait for the player, as long as it takes** (Aviel, 2026-11-18: "The last fights should wait for the player and never play on their own"). There's no half hour: a fight nobody has answered is never fought on its own, and one under command never finishes itself when time runs out. The guild stays stopped on the road, the run doesn't come home, and the run screen says they wait for your word instead of a time; the fight card and its notice say the same. *Let them fight* and *Let them finish* are still there, as the player's own choice. A wait pushes everything after it back. At each fight the six in best shape fight (the most HP, then the best fighters); the rest stay with the vehicles and the children. A road fight that goes badly ends with the team pulling back to the vehicles, and the guild drives on: those knocked down come round on the drive, and whoever has the best Wits patches up whoever needs it while the meds last. Deaths in road fights are as on any run, but nobody stays behind to fall: measured on 24 bot guilds, none died on the road.

Each fight has its own name on the fight card and screen and its own backdrop: *Red Hand's toll* (cars across the highway, a shot-up road sign, burning tires), *the Glow road* (the highway cracked through glowing pools, a pylon down, a burned-out bus) and *Haven's north gate* (the dam's wall with HAVEN painted over the open gate, washing and a garden on top, a white truck parked by it).

**The north gate.** Before the last fight, what happens at the gate **plays out on the stage** (Aviel, 2026-11-18), a still at a time with the log's line under it, before the player can take command: the guild in front of the shut gate; a small door in the wall banging open and the runner coming out in a hospital gown; running at them, shouting; the shot, a flash on the wall and its line down to her; her lying in the road; the Vultures pulling up behind the guild; then the gate open, Haven's own out, and the fight's own stage. A tap goes to the next still, *Skip* ends it, and *Watch the gate again* plays it once more. What the shot does to people's nerve stays in the log.

A door bangs open in the wall and **the one who went east** (§9.11) runs out in a hospital gown, stitches across their scalp, shouting the truth: Haven cuts people up, down in the turbine hall, to make something out of them. A shot from the wall, and they fall in the road, short of the guild. They go from *Gone their own way* to the Memorial Wall ("Shot at Haven's gate, running to the guild."), and their friends grieve. A guild that never lost anyone east sees a woman in a hospital gown instead. Then **the Vultures** pull up behind them, as promised once the guild had their word (§9.11): their boss and a lieutenant, if they're free, fight beside the guild's six, and can be given orders like anyone. On the stage they're drawn as Vultures, with the feather by their names. Then the gate opens: **Haven's orderlies** (bone saws, fearless), a **marksman** on the wall (out of reach of anyone without a gun), and **the Shepherd**: a giant sewn together out of many people, four arms, two heads, three legs. The Shepherd strikes twice a round, at two people when it can: its line under *Them* says both ("winding up a big hit at Mara, and a second blow at Kai"), and both show as marks over their heads. The last fight runs up to 10 rounds, and **nobody dies in it**: whoever goes down is dragged back to the trucks. The guild wins only if it brings the Shepherd and the rest down; anything else is a loss.

**The end.** An ending scene in the run's log and report, and kept on the Haven tab for good (`state.haven.end`).
- **Won:** the wards are full of people strapped to beds, waiting their turn. Those who can walk come home: they fill the Depot's free beds, and **whoever doesn't fit goes with the Vultures**, who have room at their camps (Aviel asked: "what if you don't have room in the depot for everyone?"). Haven's stores come home in the haul (meds, tech, scrap). Nobody finds Dr. Marr: an open window over the spillway, and a coat on the rocks below. The Vultures are glad of the guild (+30 standing). Everyone who went: "Went to Haven, and saw it end."
- **Lost:** the first line says how (beaten down, pulled out, or still fighting when nobody can lift an arm); the Vultures drag the guild back to the trucks; behind them the broadcast starts up again, calm as ever. Everyone comes home hurt (whoever was downed is wounded as usual). Haven goes on, and the guild keeps building the haven it has. The Vultures fought beside them anyway (+10). Everyone who went: "Went to Haven, and came home beaten."
- Either way the game goes on. The report is headed *Haven is finished* or *Haven goes on*, says who was shot at the gate, how many were freed and where they went, and its button opens the Haven tab instead of planning another run. The Haven tab keeps the ending in the card's place; won, the radio line goes quiet ("On the radio, where Haven used to be: nothing.").

**Balance.** The Shepherd: 64 HP before Haven's danger (90 at the gate), armor 2, attack 5, damage 6, heavy blows, two strikes a round. The toll is a danger-4 band of six raiders, the Glow a danger-5 band of six hollows with a hulk, the gate the Shepherd, two orderlies and a marksman at danger 5. Measured on 24 of the bot's guilds saved at day 35 of a 5-week game (a script outside the repo; 12 trips each, every fight left to the guild): the engaged bot's guilds win at the gate 77% of the time, the casual one's 45% (a guild of 9 with little ammo never does); nobody dies on the road; the Vultures come 92–100% of the time; six fight at the gate, beside the Vultures. Not yet measured with the fights under command.

## 10. Recruitment

- **Where new people come from** (Aviel, 2026-11-12: fewer turning up at random, more from rescues and events). Most come from out in the Reach.
  - **Rescues** (§10.1): calls for help over the radio.
  - **People found on runs:** four events bring someone home with the crew.
    - *A Shopping Cart*: someone on the road, at danger 3 or below. A Nerve check.
    - *The Holdout*: someone barricaded in a building. A Wits check; a failure means a warning shot.
    - *The Cage*: a raiders' prisoner, at danger 2 or above. A Wits check; a failure starts a fight.
    - *Hands Up*: a Red Hand deserter. A Wits check; a failure is an ambush.

    About 7% of runs at danger 1–3 bring someone home this way (2% at the Rail Yard, up to 10% at the Radio Station). Whoever is found joins if a bed is free, or waits at the gate 6 days. They join on good terms with whoever found them (+15) and write *Came home from Maple Street with Dex Holt and stayed.*
  - **The radio:** now and then someone answers it: 3% a day without a Radio Tower, then 5%, 7% and 9% by its level (one every 1½–4 real days). They wait at the gate 4 days, with a line in the news. Before 1.9.0, 2 + the tower's level answered every day and waited one day.
  - **Wanderers** (§9.3) turn up on their own and wait 3 days.
  - **Measured** with the person-like player over 5 weeks: of the people in a guild at day 35 who weren't founders, about 5 came from rescues and finds and about 3 from the radio and wanderers. Guilds fill their beds as fast as before, because beds are the limit.
- **Candidate info.** Each candidate shows their origin, age, backstory, visible traits, and a hint when they have a hidden one. Without a Radio Tower, their stats show as rough ranges (one either side). A Radio Tower at level 2 or 3 brings recruits with 1 or 2 extra stat points, still no higher than 7.
- **Taking someone in** is free but needs a free bed in the Bunks (§9.1). They join with relationships to everyone and a first Chronicle entry.
- **Rescue jobs** (§10.1) bring in people who owe their rescuer a life.
- **New game.** The guild starts with 4 generated survivors, 3 known locations, level 1 Bunks, Garden and Firepit, and 50 scrap, 24 rations, 3 meds and 15 ammo (20 scrap before 1.7.2). With 4 beds, the first recruit needs better Bunks.

### 10.1 Calls for help (1.9.0)

With a Radio Tower, now and then someone calls for help from a known place; `rescue.ts` plays the calls, and `expedition/rescue.ts` the run.

- **How often:** one call at a time. The first comes 3 days after the Radio Tower can hear it. After that, the next comes 5–10 game days after one is settled (10–20 before Aviel asked for more people from rescues), which is about one a real day.
- **How long:** a call lasts 6 game days (about three quarters of a real day). Unanswered, the voice goes quiet, with a line in the news.
- **Who's calling:** a recruit with 2 more stat points, in one of four kinds of trouble:
  - **trapped** under a fallen wall: a crew Brawn check. Failing by a little still gets them out, but the lifter is hurt; failing by more loses them.
  - **hurt and bleeding:** a Wits (medicine) check. On a failure, meds brought along save them 60% of the time.
  - **cornered** with something prowling: a fight. Winning saves them, but 8% + 4% per danger of the time one of the enemies got to them first. Pulling back or a rout leaves them behind.
  - **lost** and out of water: a crew Wits (scouting) check. If it fails, the search goes on (+4 stress each) for a second try.

  Each check is against 11 + the place's danger.
- **The run:** the Rescue job, in the outskirts only, and one crew at a time. The rescue beat comes once, early-to-middle of the run, in place of the job's usual beat. Brought out alive, the person shows the crew their stash (6–12 of a supply, plus the danger), and travels home with the crew. A rout on the way home loses them.
- **Measured** (crew of 3 with Leather Jackets and Machetes, 300 runs each): saved about 70–85% of the time at danger 1–2 and 55–75% at danger 3. At danger 4 that crew mostly turns back before finding them.
- **Coming home:**
  - **Joining:** the person joins if a bed is free. Their first Chronicle line is *Brought out of The Rail Yard alive by Dex Holt.* They start at +30 with their rescuer and owe them a life (the *Owes a Life* flag); the rescuer writes *Brought Echo Arden out of The Rail Yard alive.*
  - **No bed free:** they wait at the gate for 6 days and join the same way when taken in.
  - **Lost or never found:** a line in the news, and one in each crew member's Chronicle.
- **On screen:**
  - **Today tab:** a card with the person's face, their trouble, when the call goes quiet, and *Plan a rescue* (or *Follow the run* once a crew is out).
  - **Reach:** the place is tagged *Calling for help*, and its panel says so.
  - **Planner:** it offers Rescue first there and starts with it.
  - **Report:** it says how it went, with a link to the person.
  - **Notices:** with notices on, one when a call comes in, and a reminder two hours before it goes quiet.
- **Measured** with the person-like player, who answers every call at a place it can manage: about 19 rescue runs per guild in 5 weeks. Building pace, food, deaths and stress are unchanged. Most of the people saved after week 3 wait at the gate, because the beds are full by then.

## 11. Time model

- The game runs on real time and keeps going while the app is closed.
- **1 game day = 3 real hours** (`DAY_MS`), so about 8 Depot days pass in a real day. For testing, Settings → Developer → *Developer shortcuts* adds a button to a crew's run that skips ahead to their return (the whole timeline moves, as if the time had passed).
  - Until save version 6 a day was 1 real hour. Loading an older save moves its start back so the guild stays on the same day.
  - Everything counted in days follows the day: healing and conditions, Depot work and food, how long visitors stay. A wound that keeps someone home 4–8 days is 12–24 real hours (since 1.6.2; 2–5 days before).
- Runs take real time, not game days: 10 minutes for the nearest locations and up to 2.5 hours for far ones. So almost every run is within one day, and packs one ration per person.
- **Catch-up** (`advanceTime`). When the app opens, and at each new day while it's open, the days that passed are played in order. Crews due back before a day begins come home first, then the Depot has its day. At most **7 days** (21 real hours) are played at once; older missed days are skipped, so a long absence never spirals out of control. The Depot screen sums up what the days brought ("Since you last looked").

## 12. Screens

1. **Depot (home):** resource bar, buildings and their workers, active runs (countdown plus the latest beat), event inbox. *Built (PR 7):*
   - The first tab and the screen the game opens on. It grew long, so since 1.3.1 it has tabs of its own. Since 2.2.0 they are Yard, Today, Buildings, Projects and News, and **the Yard is the default** (Aviel), with "Since you last looked" above the drawing (the days that passed, what the Garden grew and the guild ate, rations that went off, ammo made, health healed, and the news) until *Got it*. A notice about a decision, a call for help or the family opens Today.
     - **Today:** a decision waiting, when there is one (§9.5; the Depot tab carries a mark meanwhile), a call for help (§10.1), a food warning, a trader's offers (Trade, Send them on), crews out, who is at the gate (and any stray, with *Keep it* and *Send it off*, §9.7), the gear and the vehicles. (The three latest news lines went in 2.2.0: the News tab is next to it.)
     - **Buildings:** each building with its live numbers and workers, then those still to build. Coming back from a building returns here.
     - **Projects** (1.8.0, §9.6): an intro, then each project as a card: what it is and does, a progress bar marked in stages, what the next stage costs with *Start*, or what it needs first, the crew (with *Take off* and *Add to the crew*), and how long the stage has left at this pace. Under way first, finished last. The Today tab says how the stage under way is coming along.
     - **News:** the Depot news, up to 60 lines.
   - **A building's screen:** what it does now, the next level and its cost, and its workers (post someone, take them off; Training Yard workers pick a stat). The Workshop adds Make and Improve.
   - **At the gate:** the recruit board (§10).
   - Survivor sheets have a post picker; since 1.8.0 it lists the projects under way too.
2. **Roster:** survivor cards showing portrait, name, status, HP and stress bars, and top traits. *Built (PR 5).*
3. **Survivor sheet:** portrait wearing their gear, stats with practice bars, traits (tap for an explanation and how it was gained), relationships, gear slots and Chronicle. Three tabs: *Stats and gear*, *Bonds*, *Chronicle*. If a survivor has a hidden trait, the sheet says something about them hasn't shown yet, without naming it. *Built (PR 5).* Since 2.8.4 an *i* beside *Stats* opens a sheet with what each stat is for and how it grows, in plain words (a playtester asked for it). Since 1.2.0: the nickname between first and last name (also on the roster and the Memorial Wall), named weapons with what they are, their kills and their story, and *Scores to settle* on the Bonds tab (nemeses that put them down).
4. **Reach map:** locations with explored %, danger and radiation, and since 1.10.1 what each mostly finds (everything at least half as common as its most common supply: "Mostly rations and scrap"), in the list and the place's facts. Tap a location for details and to plan a run. *Built (PR 6):* (since 1.2.0, a place names the nemesis that haunts it, a *Known by name* list under the places gives every nemesis's record and story, and the planner warns when a nemesis haunts the place and who has a score to settle)
   - The map is a page of the journal: ink roads on paper, markers numbered and colored by danger, a ring that fills as a place is explored, and a badge where a crew is out.
   - A question mark sits at the end of each road to somewhere not yet found. Tapping it says where to scout.
   - Below the map: the picked place's details, and a list of every known place.
   - Since 1.6.0 the picked place has two tabs: **About** (its facts, the levels once deeper in is open, and *Plan a run*) and **Outpost** (what an outpost does and what stands in the way, or who lives there, *Bring home*, *Send someone to live here*, what it sends home, and *Mend*). The map flags outposts, and the list of places tags them and shows the deepest level's progress.
   - Map positions live in the UI (`src/ui/reach-map.ts`), not in the location data. A test checks that every location has a spot.
5. **Run planner** (§7.2). *Built (PR 6):* crew (with why anyone can't go), how far in (1.6.0, once a deeper level is open), job, meds and ammo, approach, when to pull out, and what to keep first. Below that: time away and when they're back, problems that stop the run, warnings, and the simulated risk, worked out once the plan stops changing. A bar at the bottom keeps the risk and the *Send the crew* button in reach.
6. **Runs:** crews out now (last thing heard, progress, back in how long) and the last 20 reports, new ones marked. *Built (PR 6).* Since 2.2.0 the six newest and any unread show, and the rest wait behind *Show N older reports*.
   - **A crew that is out:** a countdown, and the log so far, revealed beat by beat as time passes.
   - **Run report:** what came home, deaths, places found, the beat-by-beat log with the dice under each line, then what changed for each person. For example: *"Mara gained Rad-Hardened"*, *"Dex & Ava are now Friends"*, and the loot. It opens in place of the countdown when the crew gets back.
7. **Memorial Wall:** faded portraits with the day and cause of death; tap one for their sheet and Chronicle. Opened from the bottom of the roster. *Built (PR 5).* Since 1.9.0, *Gone their own way* below lists those who walked out (§9.5), and their sheets say when and why.
8. **Settings:** mercy mode, notices when crews come back (and when something needs deciding, since 1.7.0), portrait wobble, the tour, export and import save, load the backup copy, start a new guild, developer shortcuts and fast-forward (§11, §13). *Built (PR 5, 6, 10).*
9. **The tour** (PR 10). A new guild starts with it, and Settings can show it again. A card pinned above the tab bar walks through 33 short steps in 7 parts: the Depot (the yard, its corners, the red dots, notices, days passing), supplies and food, your people (with gear and new people), runs (with leading the fights), building, raids and decisions, and later on (the radio, vehicles, further out, projects, the Vultures, Haven). In 2.8.2 Aviel found steps out of date or in odd places (the corners under people; the radio step read as if fights still needed the tower), so each was checked against the game and the parts reordered: what's on the Depot first, and what a new guild won't meet for a while last. Each step opens its screen and outlines what it's talking about, with live numbers where they help (what the Garden grows, what the first buildings cost). *Next*, *Skip this part* and *Skip tour* are always there. Opening the game mid-tour (from a notice, say) stays where it opened; the next step moves on from there.
10. **Gear** (1.1.1). The stash by slot (weapons, armor, tools, trinkets), each piece with a *Give* button that lists everyone: those at the Depot can take it, those out on a run can't yet. Since 1.8.0, a *Spare gear* panel above it takes the Rusty and Common weapons and armor apart at once, and each *Give* list ends with *Take apart* and what it gives (§9.4). Below, what each person carries; tap someone for their sheet. Opened from the Depot's Gear panel, from the stash line on a survivor's sheet, and from a run report that found gear.
11. **Vehicles** (1.4.0). Each vehicle with what it does, a condition bar, where it is, and *Repair* with its cost; below, what the Workshop can build. Opened from the Depot's Vehicles panel (which says what the guild has, or how to get one), the Workshop and a report that found one. The planner lists the vehicles above the crew, with seats, condition, and the gas the trip needs; the crew limit follows the seats. Reports say what became of each vehicle taken. The resource bar shows gas, in two rows of three on a phone.
12. **The yard** (1.5.0). A tab on the Depot screen (since 2.2.0 the first, and the one it opens on) with the Depot drawn as it is right now, in the portraits' style.
    - **What's in it:** the station house, the water tower and the signal gantry behind; the rails with a freight car per Bunks level; the Workshop, Infirmary, Garden, Firepit and Training Yard, each drawn by level (an empty lot with pegs and string before it's built); the Radio Tower's mast and the Watchtower's platform when built; vehicles at home parked in the yard (a broken one on bricks); the fence and the gate; recruits queuing outside; a trader's cart while a caravan is in; projects as they're built (§9.6), each tappable to open the Projects tab; the guild's animals (§9.7), with an Animals panel under the drawing.
    - **People** are small figures in their portrait colors (skin, hair, clothes, armor, hat, a bandage when wounded): workers at their posts (with a hoe in the Garden, on the platform at the Watchtower), the wounded on cots by the Infirmary (or by the Bunks without one), everyone else on the logs around the fire and then about the yard, partners side by side. Those out on a run aren't there; a panel below says where they are and when they're back.
    - **Time of day** follows the phone's clock: dawn, day, dusk and night, with lit windows, the fire's glow, the string lights and the radio light after dark. The fire flickers, smoke drifts and people shift a little; nothing moves with *reduce motion* on.
    - **Taps:** tapping someone or something picks it (it's drawn again on top, glowing) and the line under the drawing says who or what it is, with a button to open their sheet, the building, the recruits, the vehicles, or the trader's offer.
    - Code: `src/scene/` draws it (plain TypeScript, no dependencies, like `src/portrait/`); `src/ui/yard-view.ts` works out who is where.

**Navigation.** Tabs along the bottom: Depot, Roster, Reach, Runs, Settings, and Haven before Settings once the broadcast is heard (§9.11).

**The day up top.** The day number sits at the top of every screen, by the Settings cog (the bell's place until 3.5.0). Aviel asked for a way to see there when the next day starts (2.8.8); of three mockups he picked a dial: a ring beside the day fills as the day goes, and under the day is the countdown, "Next in 2 h 13 min" (the first try, a line squeezed under the number, was "ugly and cramped"). A screen reader hears the clock time instead: "Day 22 starts at 1:35 PM". The tour's *Days pass* step outlines it.

**Red dots, no bell (3.5.0).** The bell (2.2.0, Aviel: "a notifications bell up top that keeps track of what he needs to address") listed what needed the player in four groups. A player said he felt he was missing something without knowing what: where to look, what he'd read and what was new, and he suggested red dots instead. Aviel picked: red dots, no bell (`attention-view.ts`).
- **A red dot** sits on whatever is new or waiting, on the tab bar, the tabs inside a screen and the row itself, so the dots lead the way down:
  - *Depot:* Yard (a first-week step done, its reward waiting, not while the tour is on; a corner searched), Today (a decision, people or strays at the gate, a trader, a call for help nobody has gone to, food short or gone, nobody home to hold the gate), News (news since it was last opened).
  - *Roster:* each person with new Chronicle lines (the Chronicle tab has the dot), or close to breaking (80 stress), or going without a weapon or armor while the stash has one (Stats and gear).
  - *Gear:* someone going without a weapon or armor the stash could give them, or gear new to the stash (each new piece keeps its dot while the tab is open). A piece taken off someone isn't new (3.7.5; Aviel: handing out a new piece put the old one in the stash with a dot): what everyone has on counts as seen, and so does gear moved by hand on a person's sheet.
  - *Reach:* a place not opened yet (on the list and the map), a call for help, an outpost that needs mending.
  - *Runs:* a report not read (on the report too), a crew on the radio or at a fight.
  - *Haven:* something new, or something to work out.
- **What's been seen** is kept on the phone, against this guild (`Prefs.seen`). The first time, everything there is counts as seen, so an older guild doesn't light up all over. Opening the News tab, a person's Chronicle, a place, or the Gear tab is seeing what's there.
- **The News dot** (3.7.1; Aviel: it "keeps having a red dot for seemingly no reason") follows the newest line the News tab shows (`Seen.newsKey`, `latestNews`). It used to count the log: a crew coming home added a run line, which the News tab leaves to the Runs tab, and lit it with nothing new to read; and once the log was full (it keeps 300 lines) new lines didn't light it.
- **Tap a picture to see what it means** (3.7.1; Aviel: "Symbols are not clear, like what does the dice symbol mean?"). Every picture with a number or a word has a dotted line under its word, and a tap shows its words in a bubble over it for a few seconds (`components/TagTips.tsx`, `tipPlacement`). A picture in a row or a button doesn't also pick the row. The dice say *rolls* or *together* beside them. The tour's supplies step says so.
- **What can't wait** is a strip under the header on every screen (but the one it opens): a fight or a raid waiting for orders, a crew on the radio.
- The bell's place in the header is a cog for Settings, which left the tab bar; **Gear** took its place as a tab, with Vehicles under it.
- **Gear on every card** (the same player didn't notice his people had nothing on): the Roster, the planner's crew list and the Gear tab show each person's four slots as small pictures, an empty slot dashed, an empty weapon or armor slot red when the stash has one.
- The "crew is back" toast steps aside by itself after a few seconds; the report's dot stays.

**Less text, more pictures (3.6.0).** The same player sent "the top 4 without considering relationships", couldn't tell what relationships did, or what set aggressive apart from balanced; Aviel asked what vehicles are good for, "all this with less text", and then: "I would like to even remove helper text that already exists and replace it with some visual explanation", "everywhere". So a screen shows what something does as small line pictures with a number or a word each (`glyphs.ts`, `components/Glyph.tsx`: a glyph and a tag, green when it's good for the guild, red when it isn't; each is read out in full to a screen reader), with the game's own numbers, and the help paragraphs are gone.
- **Supplies** have a picture each, in its own color: the header shows six pictures and numbers in one row (the names are only read out), and every cost, haul and trade uses the same pictures. A cost marks in red what the guild is short of, so "Needs 30 scrap, 4 tech." is no longer said in words; only other problems are ("Needs a level 3 Workshop.").
- **The planner.** Under each order, what the one picked does: *Sneaky* eye +2, slips past, clock +15%; *Balanced* even; *Aggressive* swords +1, eye −2. The jobs (most loot and a little mapping; mapping and new places ×3; more fights, rations and practice; trade ×3 loads; hit their camp: a hard fight, their stores, war). When to pull out (hurt: safest, less loot; down: the middle; never: the most loot, risky). The lead switch is a clock and how long they wait. Before they go: the clock, back at, and the rations, marked when short.
- **Who goes with whom.** In the crew picker each person shows how they get on with those already picked, skipping the neutral: two hearts bonded, a heart friends, a ring partners, a bolt rivals, a flag a feud, with the name. Under the crew, how well they get on: the bonus or penalty on the rolls they make together (dice ±N, §5), two hearts if there's a bonded pair, stress if there are rivals.
- **What a tie does.** On the Bonds tab each tie has its picture, its bar and what it does: bonded dice +1 (every roll on a run together), stress −20% on a run, a shield +5 (wounds less likely to be serious), home −2 stress a day, grief if one is lost; partners more at home and on wounds, and stress if the other goes down; friends lift the crew's rolls and grieve; rivals and feuds drag the rolls down and cost 2 stress a stretch, rivals quarrel, a feud comes to blows at home. A key under the list says what each picture stands for.
- **Vehicles**: seats, how much faster (−55%), how much more they carry (+4), gas a leg, and the noise (+25% fights), on the Vehicles screen, the Workshop's list and the planner's picker with the condition. Taking one shows seats and the gas there and back against what's at the Depot.
- **The Depot**: the note for the days you were away is a picture for each supply, what came in and what went ("rations +20 −12"), and health; only going hungry, rations going off, buildings running short and nights on the floor are said. Building cards show what each does now (beds 3/8, rations +6.5 −4 a day, scrap, stress, healing, ammo) and its upkeep, empty posts as dashed squares, an unbuilt one its cost. Projects: Pay › Crew › Days · +1 ration each, instead of a paragraph.
- **The Reach**: each place lists the pictures of what it mostly gives up; a place shows its visits and the roads nobody has followed; an outpost is seats, what it sends home a day, a ration a day each, runs nearby −50%, healing a third as fast, the watch's stress, raids.
- **The report** shows the haul as pictures, and the gear by its picture and name.
- **Cut**: the help on the Memorial, the Vultures (what they are, what moves them, how to hit a camp), the yard ("tap anyone"), the animals, the children, captives, the corners after the first, spare gear (now *N pieces → scrap*), an empty stash, the market's long note and its price key, the nemeses' explanation, the outpost's paragraphs, the Workshop's notes, Settings. The tour is shorter and says where the pictures are.

**Staying put (2.2.0).** Aviel: things jumped when he switched tabs, and an answered decision "disappeared" so he had to scroll up. Switching tabs within a screen (the Depot's, a place's, a sheet's) or picking a place on the map keeps the scroll where it was, and a tab's panel is at least a screen tall so a short tab doesn't pull the page; a card that shrinks once answered (a decision) is brought back into view; a raid that moves on to its next part starts at the top. The Depot's header says where things stand with the Vultures in one line ("The Vultures: wary"), and the whole summary stays on their screen and the Reach. Survivors who are out show where they are and when they're back, on the roster and on their sheet.

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
- **Persistence.** A versioned JSON save with migrations, stored in localStorage after every change.
  - **In the app, also in a file** (3.9.1, `save-disk.ts`). The WebView's storage belongs to the WebView and its web address and can be lost on its own, so each save also goes to a file in the app's own data (`the-guild/save.json`), 1.5 s later or when the game goes to the background. Every save is counted, the count kept in the file and beside the save in storage; on opening, whichever is further along wins, so storage that lost its save, can't read it or stopped taking writes is put back from the file before the game loads.
  - **A copy a real day**, the day's first save, in `the-guild/copies/`; the last 3 are kept. Settings → Save → *Copies on this phone* loads one like an import (the current save becomes the backup copy).
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
  - **Tools and trinkets** all have a look since 1.9.0:
    - Lockpicks: a leather roll at the hip with the picks showing;
    - Multitool: a red handle on a chest strap;
    - Old Photo: taped to the chest;
    - Music Box: a little wooden box on the cord, with its crank.

    Bad Leg and Missing Fingers are out of frame.
  - A hand-drawn wobble is applied with an SVG filter. It can be turned off (`wobble: false`) if long lists of portraits scroll slowly on the phone.
  - `npm run portraits` writes a gallery to `out/portraits.html`.
- **Everything else is drawn in code too** (3.3.0, §14.3), in the same ink: the planned image-generator art for places, events, items and buildings was not needed.

### 14.1 Sound (3.1.0)

Aviel, 2026-11-23: "make the game a bit more interesting… assets and movement… music, sound effects". He picked all of it: sound effects, fight sounds with a buzz, the yard's ambience, and music, which I make ("make it good enough"); movement (3.2.0) and art (3.3.0) follow.

- **Everything is made offline** in `tools/audio/` (Python) and shipped in `public/audio/` as Ogg Opus, about 6 MB in all. Nothing is downloaded while playing.
- **Music**, composed in code and played on the FluidR3 GM instruments (Frank Wen, CC BY 3.0, credited in Settings → About and the README). Five loops of about a minute and a half, each folded so it loops without a gap:
  - *The Depot* by day (6–18 h on the phone's clock): fingerpicked steel guitar, cello, a distant harmonica, D minor.
  - *Night* (from dusk, 18 h, to 5 h): slower nylon guitar, a warm pad, a low cello line.
  - *Fights and raids*: the fight screen, and the raid screen while a raid is on: a string and bass ostinato, horns, E minor, and the first edition's drums (Aviel, after four other tries: "The original first edition had drums that to me sounded good if only they were louder and reverberating"). Then (16:26, on that version: "there are two kinds of drums now, the constant low one and the once in a while high one. The low one we can get rid of, and the high one we can make hit a bit harder"): the taiko groove is gone; the tom fill every fourth bar and the timpani stay, the toms played harder and soft-clipped so they land harder. Their level (16:34: "too loud, make them a bit closer to the strings and all the rest"): through a phone a fill peaks about 9 dB over the music around it, as in the version he liked. After the timpani roll into the last part (16:43: "instead of one single one, I suggest adding from that point a single beat every other beat"), the low tom that ends the roll keeps beating on one and three to the end of the loop, a little under the fills. The drums are in a hall of their own (3.2 s). **Levels are judged through a simulated phone speaker** (a high-pass at 300 Hz): a phone plays nothing much under 300 Hz, where almost all of a taiko is, so the drums' lows are 12 dB down (inaudible on a phone, and room for the rest).
  - *The road east*: the Haven tab, and every screen while the guild is on the road east. Hopeful (Aviel, 2026-11-23: "as you hear out on the road to a beautiful safe Haven! Only later you find out that they are bad"): fingerpicked guitar and a warm pad set out, a horn sings a lullaby-like tune, strings and a fiddle lift it, a music box plays it softly at the end. C major.
  - *The truth*: the Haven tab once the road east is over, won or lost: the same tune as a slightly out-of-tune music box lullaby in C minor, over a drone, a heartbeat in the middle.
  - A change of music fades across in about 2.5 seconds, and a piece picks up where it was left.
- **The yard** under the music: wind always, the fire (nearer on the Yard tab), birds by day, crickets at night. Synthesized loops, mixed by the hour. Silent in fights; only wind while the Depot stands empty on the road east.
- **Sounds**, synthesized (with a few instrument notes for the musical ones), all in one sprite file:
  - the game changing: a crew setting out (the gate and steps, or an engine), a crew home (a guitar chord), someone new, a building or project stage going up, something made at the Workshop, a trade, a corner searched, a first-week step collected, a find for Haven (the music box), a decision to make, a death (a low cello and a bell). At most two at once, the more important first.
  - something starting to need the player while they look: a crew on the radio or at a fight (static and a beep), raiders seen and again at the gate (an alarm bell).
  - fights, act by act as the stage plays: each gun by its kind (pipe pistol, rifle, scattergun, crossbow; drones and sentries a zap of a laser), each blow by the weapon (a pipe or sledge thuds, a machete cuts, the shock baton crackles, bare hands punch), hounds snarl and bite, hollows groan, scrapbots whirr, misses ricochet, the fallen fall, patching up, taking cover, running, a door, a job being worked; the guild on the left, the enemy on the right. A won fight ends on horns, a rout on low cello. The shot at Haven's gate is heard.
  - **No two the same** (3.4.1; a player fought eight hollows and they all groaned the same, one after another): hollows, hounds and scrapbots each have three voices, and each enemy in a fight gets one of them at a pitch of its own (0.88–1.12), so no two of the first eight sound alike; its swings and its fall take the same pitch. Someone of the guild being hurt is one of three sounds, by who it is. On top of that every sound plays a little different each time (±5% pitch, ±12% loudness).
  - a quiet click on every button, a page turning on the tab bar, a soft sweep when a sheet opens.
- **A short buzz of the phone** in fights: light when one of the guild takes a big hit (4 or more), heavy when they go down (the Haptics plugin; the vibrate API in a browser).
- **Settings → Sound**: sound on or off, Music, Sounds and The yard sliders, and *Buzz in fights*. These belong to the phone, not the save (`prefs.ts`). Nothing plays until the first touch (phones require it), nor while the game is in the background.
- Code: `sound-view.ts` decides what plays (tested), `audio.ts` plays it with Web Audio, `use-sound.ts` keeps it in step with the game, `sounds.ts` is written by `tools/audio/build.py`.

### 14.2 Movement (3.2.0)

Aviel, 2026-11-23, all four of the movement options. Everything moves with CSS (keyframes made in code where they depend on the game), and nothing moves with the phone's *reduce motion* setting on.

- **The yard comes alive** (`src/scene/life.ts`):
  - People at a post work at it: the gardeners chop with their hoes, the Workshop's hammer, the fire's keepers poke it, the Training Yard spars, the medics bend to their work, the lookout turns to watch the other way. A project's crew hammers.
  - About two in five of those by the fire or at a post on the ground step away now and then: they get up, walk along the open ground in front of their row of buildings, stand a while and walk back. **Walking like people** (3.4.1; a player said the walking looked weird): straight there, slanting across the ground, rather than up or down to the lane first, side-on, which looked like sliding; easing off and slowing to a stop rather than one speed from first step to last; steps as fast as the pace (a stride about 8 units, quicker for a run), each person in their own step rather than everyone in time; the body rising a little with each step. Children run about more often, babies stay put. Nobody on a cot, up a tower or at the gate. Timed by the phone's clock, so the yard drawn again a moment later carries on where it was.
  - **Crews through the gate**: a crew that set out or came home in the last three minutes is seen doing it when the yard is first looked at: on foot they gather by the gate, go out through it and along the road (or come along the road, in through the gate, and back to where they belong); with vehicles, the vehicles drive out, or drive in and park, and the crew rides. The gate swings open while they pass.
  - A trader's cart that turns up while the yard is open rolls in along the road; someone new at the gate walks up to it.
  - The clouds drift, birds cross by day, a star falls now and then at night, and a tumbleweed rolls along the road.
- **Crews on the map**: a crew out walks (or drives) along the roads it knows from the Depot to its place, the shortest way, and back again: the first and last 30% of a run on the road, the rest at the place (where the place's badge counts them). Tap one to open its run. The tour's Reach step mentions it.
- **Livelier fights**: everyone standing breathes; a hit sends specks of blood (sparks off a machine), a shot that misses kicks up dirt, a gun leaves a puff of smoke, someone put down falls rather than appearing on the ground, and a heavy blow (6 or more) or someone going down shakes the stage.
- **Snappier screens**: a new screen fades up into place (another tab of the same screen doesn't), cards fade in as they appear, buttons press in, the toast springs up, badges pop; a supply that changes counts to its new amount and flashes green or red, with the change (“+12”) floating up beside it.

### 14.3 Pictures (3.3.0)

Aviel, 2026-11-23, all four of the art options, in the ink style of the yard and portraits (`src/scene/icons.ts`, `src/scene/pictures.ts`, shown by `components/Art.tsx`):

- **An icon for every piece of gear**: a small drawing on a paper tile; a rusty one is speckled with rust, solid, prime and relic carry one, two and three stars, and a relic has a gold edge; an empty slot is a dashed outline. On the Gear screen, a survivor's gear and the stash picker, the Workshop's *Make* and *Improve*, and a trader's gear. **A new piece of gear needs a drawing in `icons.ts`** (`pictures.test.ts` fails otherwise).
- **Each place's picture**: its battle backdrop (§7.13) cropped to a banner across the horizon, at the top of the Reach's place panel, the planner's crew step (the orders step stays on one screen), and a run, out or back.
- **Small pictures in the log**: a round stamp in red ink beside every moment of a run: setting out (the gate), the road (footprints), scavenging (a crate pried open), a hazard (the warning sign), a fight (crossed blades), the crew among themselves (a fire), a find (a spyglass), a rescue (two hands), the Vultures (a feather), home (the Depot's roof).
- **Buildings up close**: a building's screen opens with its drawing from the yard at its level (the empty lot before it's built), with sky and ground around it, the Firepit with its fire and smoke moving. Always a landscape (1.9 to 2.8 wide to 1 high).

### 14.4 Coming home, and what happened while you were away (3.7.0)

Aviel, 2026-11-23 and 24: tweening in all five places, things that happened while the game was closed played the first time they're seen, and coming home from a run "satisfying, and clearly showing what was brought back including what they took with them (ammo etc)". As before, nothing moves with *reduce motion* on.

- **Coming home** (`homecoming-view.ts`, `components/Homecoming.tsx`). A report opens on three rows:
  - *Took*: the meds and ammo packed, the rations and gas, and any goods for the market. A report keeps the rations and gas as `RunReport.packed` (save version 28); older reports show what they can.
  - *Used*: what of that didn't come back, struck through.
  - *Back*: what they found or traded for, and the meds and ammo they didn't use, then each piece of gear by its picture.

  The first time a report is opened, the rows come in one after another and each thing back pops up in turn. Then it flies home: supplies into the Depot's tab and gear into the Gear tab, each of which bumps as it lands. The "crew is back" toast doesn't sit over the report it points to. (3.7.2: it first flew into a strip of all six of the Depot's stores under the rows, which counted up. Aviel found that line confusing, so it's gone.)
- **Fights**: a bar drains. What was just lost stays as a pale chunk for a moment and shrinks away; a heal grows in. A frame knows the health before its act (`StageEffect.was`).
- **The map, since the last look** (`mapNews`, `seeMap`; `Seen.mapped`). The Reach remembers the places it drew and how explored they were:
  - A place new to the map draws its road in from where it was found, then pops up at its end; the roads on from it fade in.
  - A ring explored further since fills up from where it was.
- **The yard, since the last look** (`newlyBuilt`, `seeBuilt`; `Seen.built`): a building put up or improved rises from its footing with a little bounce, and dust puffs out along the ground (`goingUp`), once.
- **The header, since the last look** (`storesNews`, `seeStores`; `Seen.stores`): opening the game, each supply counts from what it was when last seen to what's there now, with the change floating up.
- **Bars and dots**: meters and bond bars fill up from empty as they come on screen and slide when they change; a red dot springs in.
- **Walking, side-on** (Aviel: "walking is still weird looking"). Someone walking is drawn from the side, as they move:
  - Both legs come from one hip, the far one darker, swinging against each other.
  - The near arm swings against the near leg, and the far arm moves behind the body.
  - The body is narrower, and the head is in profile with one eye looking where they go.

  Before, a front-facing body crossed its legs like scissors and flapped both arms.
- **Packs on the road**: a crew walking out or in through the gate carries a pack. It's small for a run under 45 minutes and big, with a bedroll, for a longer one, and it bulges on the way home (`YardTrip.pack`, `BIG_PACK_MS`).
- **Riding** (3.7.2; Aviel: a pair on the motorcycle "just sped out without the characters"):
  - A crew that drives rides in its vehicles, filling each one's seats in turn (`YardTrip.vehicle.riders`). Coming home, only those back at the Depot ride.
  - On a motorcycle the driver sits leaning into the bars and the passenger holds on behind (`rider`).
  - In anything else, each rider is a head and shoulders in a window, under faint glass (`inWindow`). A pickup's bed carries two more.
  - On the Reach, a crew that took only motorcycles shows on one (`CrewMarker.ride`). The map's little car now faces the way it drives; it drove backwards.
- **The ride's time**: once a vehicle is picked, the planner's header says how long the ride takes ("about 5 min by motorcycle", `tripLine`) instead of the place's walk. Aviel saw "4.5 minutes" for the Rail Yard after the header had said "about 10 min on foot".
- Marks from before 3.7.0 have no record of the map, the yard or the stores, so nothing moves the first time.

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
| 12 | Partners: romance (§5.1) | **done** (1.3.0) |
| 13 | Vehicles and gas (§7.8) | **done** (1.4.0) |
| 14 | The yard: a drawing of the Depot with everyone in it (§12) | **done** (1.5.0) |
| 15 | Expansion: outposts and deeper areas (§7.9, §7.10) | **done** (1.6.0) |
| — | Balance: combat and loot (1.6.1), economy and pace (1.6.2), from the review in `claude/balance-review.md` | **done** |
| 16 | Decisions at the Depot (§9.5), asked for 2026-11-12 | **done** (1.7.0) |
| — | Balance C: people's time and a five-week Depot (§6, §9.1), from the economy design in `claude/economy-design.md` | **done** (1.7.1) |
| — | Balance D: checked to the end of the content with a person-like simulated player; a faster first week, bigger trades (§9.1) | **done** (1.7.2) |
| — | Projects and salvage (§9.6, §9.4), the long goal after the Depot | **done** (1.8.0) |
| 17 | What's missing, in two parts (Aviel, 2026-11-12): **rescue jobs, feuds that make someone quit, animals and the last gear drawings** (§10.1, §9.5, §9.7) | **done** (1.9.0) |
| 17b | **Ageing and babies** (§5.2, §5.3) | **done** (1.10.0) |
| — | Beds (partners share, children with their parents until 6), one run a game day, loot by danger inside each find (§5.3, §7.2, §7.6) | **done** (1.10.1) |
| 18 | The Vultures, a rival guild (§7.11), asked for in the first design; Aviel's answers 2026-11-13 | **done** (1.11.0) |
| 18b | Radio calls (§7.12): a run stops at a fork (a Vulture meeting, or one of five scripted forks) and calls home; the player answers or the crew settles it by its orders | **done** (1.12.0) |

### Picked next (Aviel, 2026-11-13)

From the ideas in `claude/interactive-ideas.md`, and Aviel's own additions. The order isn't set yet.

| Idea | What Aviel said | Status |
|---|---|---|
| Take command of a fight: turn-based fights, at least as an option (his ask from 2026-11-12) | Yes. **The game is 2.0.0 when this is done.** Picked first (§7.13) | **done**: runs 1.13.0; the battle stage 1.14.0; raids at the gate, getting ready, talking first and two bands 2.0.0; raids that differ, what they want, spoils and captives, outposts like the gate 2.1.0 (§9.8) |
| Haggle with traders | Yes | in part (3.4.0): at the market the crew's best talker haggles on their own (§7.14); caravans at the gate still don't |
| Names: things get their names from the guild's people, not from the player, once they've spent enough time with them | Yes, named by the people | planned |
| What people want: now and then someone asks for something, and doing it (or not) matters | Maybe | to decide |
| Long expeditions beyond the Reach | Possible | to decide |
| Prisoners | Fine as built in the Vultures (§7.11) | **done** (1.11.0) |
| Rations spoil after some time (Balance C had left spoilage out) | His addition, 2026-11-13; with it, his fixes of 2026-11-14: the bell, the planner in two steps, leading fights by default, the Yard first, enemy health, nothing jumping (§9, §7.2, §7.13, §12) | **done** (2.2.0) |
| Strategy in fights, 1: their moves shown before the orders, front and back ranks, drones only shots can reach (fragile; a crew that can't shoot pulls out and drops things), their nerve and leaders (§7.4, §7.13) | Aviel, 2026-11-14: fights were "strike strike strike". He picked all five ideas; every fight, crews left alone too. A second, smaller weapon was offered and dropped | **done** (2.3.0) |
| Strategy in fights, 2: enemies that need different answers (armored brutes, hollows that get back up unless finished, hound packs) | Aviel, 2026-11-14 | **done** (2.4.0) |
| Strategy in fights, 3: goals besides fighting, where someone spends rounds on a job instead of fighting: hold the door, grab and go, get someone out, fix or open something | Aviel, 2026-11-14 | **done** (2.5.0) |
| Strategy in fights, 4: fights as small puzzles (§7.4): shove or pin down, lined-up shots, patchers, firebugs, hollows that grab, and what's coming at each of the crew as a number | Aviel, 2026-11-25: "still boring… no thought to it"; he picked puzzles over a mini-game or a Final Fantasy-style system | **done** (3.8.0). Next, if he wants: combos made plain, fewer and better fights (only the ones worth leading stop for orders) |
| Scrap at most about half of an upgrade, and a Scrapyard twice as strong (§9.1) | Aviel, 2026-11-26: "always chasing scraps… 180 scraps to get more than 8 ppl is so much"; he picked spreading the costs and doubling the Scrapyard | **done** (3.9.0) |
| An energy plant: solar while the sun is up, gas at night or in winter, powering some things | His idea, 2026-11-13: "Need to think" | to think about |
| A view of each outpost, like the yard: the place drawn with its outpost and the people who live there | His addition, 2026-11-14 | planned |
| More to do at the start, to hook a new player. His new game (2026-11-14): equip the starting gear, upgrade the Garden, send a 10-minute run, then wait about 2.5 hours before that crew can go out again (one run a game day, §7.2). Ideas offered: fresh legs for the first runs, the Depot's own corners, things coming to you early, a first-week story, scouting trips | His addition, 2026-11-14: "Not sure how to do that though"; at 23:34 he picked the Depot's corners and a first-week story | **done**: the corners (2.7.0, §9.9), the first week (2.8.0, §9.10) |
| **Haven**, the long goal for the whole game. The first week ends with its broadcast: a place with power, clean water and room for survivors, somewhere past the Reach. Finding where it is and getting there is the goal. **The twist:** by the time the guild reaches it, they've built a haven of their own at the Depot, and Haven turns out to be a trap, or not what it said. The guild is glad of what it built | Aviel, 2026-11-15: "at the end there is a twist, you already built your own haven at that point, and you find out that that haven is really a trap or something, but you're happy with what you built" | |
| Haven, part 1: finding it. Clues found on runs to different places and two from buildings, hints by chance from all over, a Haven tab, about five weeks (§9.11) | Aviel, 2026-11-16: the story is now about finding out about Haven and getting there; clues from runs at different places (and build goals too), "all the information you have so far should live in a new tab", hints "common enough that it makes you interested". The truth (his, later the same day): a cult around a doctor from St. Jude's, started after the bombs, cuts people up to make the next kind of human, with the Glow's radiation; the Hollows are its failures. One of the guild goes east to join them. 2.9.1 (his playtest, 2026-11-17): a find shows what it says, where it was found and where it points; no lead at a place the guild hasn't found | **done** (2.9.0, 2.9.1) |
| Haven, part 2: the road east (§9.12, 3.0.0). Everyone sets out, children too; fights on the way under command; at the gate, the one of the guild who went east gets out, shouts the truth and is shot by a sniper; the Vultures join, since they think it's vile too; a big fight against a giant stitched from many people (four arms, three legs, two heads; it needs a drawing in `fighters.ts`); an ending scene, Chronicle lines, whoever they freed comes home; the game goes on | Aviel, 2026-11-16: "Haven is really a place where they believe in creating the next evolution of humans... The end fight you have to fight this giant Frankenstein... you only find out once you get there"; "One of our own... runs away to join them... This is the one who escapes and is shot when you approach" | done (2026-11-17) |
| Sound (§14.1, 3.1.0): music, the yard's ambience, sound effects, fight sounds and a buzz | Aviel, 2026-11-23: "make the game a bit more interesting… music, sound effects"; he picked all four, and that I make the music | **done** (3.1.0) |
| Movement (§14.2, 3.2.0): the yard comes alive (work at the posts, people stepping away and back, crews and vehicles through the gate, the trader's cart, the sky and the road), crews on the Reach map, livelier fights, snappier screens | Aviel, 2026-11-23, all four | **done** (3.2.0) |
| Art (§14.3, 3.3.0): an icon for every piece of gear, each place's picture, small pictures in run logs, each building up close on its screen | Aviel, 2026-11-23, all four, in the ink style of the yard and portraits | **done** (3.3.0) |
| Too many rations, never enough scrap (§7.14, §9.1, §7.6): the market at the Drive-In, the Scrapyard, more scrap in every place's finds | Aviel, 2026-11-23, after he and a friend both ran into it; he picked the market (his idea, with prices that rise as you trade) and the Scrapyard, and added more scrap on all runs. Proposal in `claude/rations-and-scrap.md` | **done** (3.4.0) |
| **Multiplayer**, the next big thing. A Cloudflare Worker (he has an account), some storage there, playing offline and online. Ideas he named: runs together with other guilds, raiding other people's depots. Open: how it fits the single-player story | Aviel, 2026-11-23: "I would want it to be the next big thing we do." First take in `claude/multiplayer.md`: async and offline-first, own story in a shared world, starting with cloud saves | to design |

Not picked: choosing the rooms before a scavenge, raids you see coming, feasts and gatherings, talking to people in the yard.

- **Tutorial.** Starts with a new guild, and can be replayed from Settings. It walks through the resources and how to get more of each, food and the Garden, why crews go out on runs, why to build, and taking in recruits. It's optional: the player can skip the whole thing, or skip ahead to the next part. Built as the tour (§12); later steps that add something to explain (gas, vehicles) add a step to it.
- **Stories.** An enemy that downs a survivor and gets away becomes a named, recurring foe (a nemesis). Survivors earn nicknames from feats. A weapon with 10 kills earns a name and a history. Built as §7.7.
- **Partners.** Uncommon, and a step beyond Bonded. About 96% of couples are a man and a woman, and 99% are monogamous. Losing a partner hits harder than losing a friend.
- **Vehicles and gas.** This is how crew size changes: on foot, a crew stays at 1–4.
  - Most vehicles seat 5. Motorcycles seat 1–2, and bigger vehicles more. No bicycles.
  - **Gas** is a new resource, and every run with a vehicle burns some.
  - Vehicles are **rare**: found on runs (a wreck to get running), sold by traders now and then, or built in the Workshop.
  - A vehicle makes runs **faster** and **carries more** loot. It's **noisy**: enemies spot it more easily, and a crew in one can't sneak past. It **wears down**, and the Workshop repairs it.
  - A run can take **several vehicles** and more people. A vehicle can be **lost**: wrecked on a run (its riders walk home, which takes longer) or stolen in a raid.
  - Big crews leave **fewer people at home**. Before 1.4.0 an empty Depot only lost a little more in a raid; now a thin fence is easier to break, draws raiders, loses more, and can lose a vehicle.
  - *Built in 1.4.0 as §7.8.*
- **The yard** (step 14, asked for 2026-11-11). A drawing of the Depot on a tab of its own: the buildings as they are, everyone at home where they are (at their posts, around the fire, resting on cots), recruits outside the gate, a trader's cart, the vehicles parked in the yard, and the light of the time of day. Tap anything to see what it is and open it. A view only: nothing in the game changes.
- **Expansion.** Outposts on fully explored places extend the guild's reach (the Civ-style expansion). Places get deeper, more dangerous areas with better loot. Decided 2026-11-12: outposts send supplies home every day, shorten runs nearby, are a rest stop on the way home, and can be raided; people live there and can be swapped out any time; deeper levels open by exploring; the Radio Tower's level sets how many outposts. *Built in 1.6.0 as §7.9 and §7.10.*
- **Decisions** (step 16, Aviel, 2026-11-12). Now and then something comes up that the player decides: two people fighting over something, a dilemma. Four answers, with costs and rewards that aren't obvious. If he doesn't answer within about a day, the people involved settle it themselves, usually not the best way. *Built in 1.7.0 as §9.5.*
- **The order from here** (Aviel, 2026-11-12): first, balance everything up to where the content runs out (1.7.2); then what was already planned (projects with salvage, which was Aviel's addition, in 1.8.0; then step 17 and step 18); then the next steps below.
- **Interactive combat** (Aviel, 2026-11-12): runs can get repetitive, so fights should be playable, turn-based RPG style, at least as an option. Since runs are decided at departure, this needs a way to stop a run at a fight and wait for the player. Picked 2026-11-13 (*Take command of a fight*, above); the game is 2.0.0 when it's done.
- **Weapon mods** (Aviel liked them, 2026-11-12): a scope, a suppressor, a bayonet, made from tech and spare gear.
- **Second and third depots** (Aviel, 2026-11-12): new regions beyond the Reach that can be settled for real, not just held as outposts.
- **The economy** (Aviel, 2026-11-12, after `claude/economy-design.md`): finishing the Depot should take about five real weeks; the road should cost stress so people's time is the limit (both in 1.7.1); **projects** (big multi-stage works, like Civ's wonders) are the long goal; later, **expanding to new places** beyond the Reach. What comes after Balance C is decided once it has been played. Other ideas on the table: long expeditions, improving outposts, contracts from other settlements, training courses that teach a trait, feasts on demand, weapon mods.
- **Ageing and babies** (part of step 17, asked for 2026-11-11). *Built in 1.10.0 as §5.2 and §5.3.* Decided while building it: birthdays go in the Chronicle; losing a parent goes in the child's; no tour step (the bonds step mentions babies); orphans for couples without children come later.
- **The Vultures.** A rival guild competing for places, people, outposts and traders, with named people and a standing that runs from war to trading partners. *Built in 1.11.0 as §7.11.* Radio calls (18b) come next, so their meetings on runs can be answered from home.

**Later ideas:** weather and seasons, planned Depot defense during raids. (Interactive combat is picked, above.) Runs are decided at departure, so a hands-on fight would fit where the player is there when it happens: a raid on the Depot, or a nemesis met again.

### Built as if for the store (Aviel, 2026-11-26)

From the design review of 3.8.0 (the project doc `claude/design-review-3.8.md`; the plan in `claude/plan-4.0.md`). Aviel: build the game **as if it's going on Google Play, but don't publish yet**; the goal would be at least to pay back the US$25 registration fee, and for fun. **Free, then a one-time $1 unlock** when Haven's broadcast arrives at the end of the first week; after it the Depot and runs keep going, and Haven and everything the story opens after the first week wait for the $1. **No multiplayer for now, just cloud saves.** He agreed to this order, and that **4.0.0 is store-ready**:

| # | Version | Step | Status |
|---|---|---|---|
| 1 | 3.9.1 | Store blockers: exact alarms the player allows (not `USE_EXACT_ALARM`, which Play keeps for clock and calendar apps); the save also in a file, with a copy a real day (§7.3, §13) | **this PR** |
| 2 | 3.10.0 | Fewer, bigger fights (a crew calls home for fights that matter, or that would go badly without the player), and one *press on or come home* call a run; the radio's crackle | planned |
| 3 | 3.11.0 | Places that need the right people: locked, heavy, radiation, machines, flooded, carrying out, traps, animals; crew perks from pairs and traits | planned |
| 4 | 3.12.0 | Systems unlocked through the story, the first session for a stranger (an opening scene, a short first run, the first led fight), the tour cut to the first day; sound in scenes, and the gate scene redone with it | planned |
| 5 | 3.13.0 | The broadcast as the hook: seeds from day one, the night of the broadcast as a scene, a name on the air (someone a guild member lost), the goal made plain, a pull to go ("until the first snow"), the unlock page in the journal's style; with its sound (radio static, the dial, the voice through crackle) | planned |
| 6 | 3.14.0 | The storyteller: one director paces trouble with warnings and quiet stretches; *Gentle / Standard / Hard* at a new game | planned |
| 7 | 3.15.0 | People who speak (short lines in the yard, reports, fights, the planner) and want things, with refusals | planned |
| 8 | 3.16.0 | Runs you watch: the report opens on a short reel | planned |
| 9 | 3.17.0 | What kind of guild you become: open or closed, merciful or hard | planned |
| 10 | 3.18.0 | A Reach that changes: seasons, things that show up and go away, threats that move | planned |
| 11 | **4.0.0** | Store-ready: the $1 unlock (Play Billing), cloud saves, the store page, phones | planned |
| 12 | 4.1.0+ | Chapters with a time skip: Chapter 2 and the second depot | planned |

- **Not picked:** laying out the Depot by hand; one market for all trading; one kind of prisoner; a real use for gas.
- **Sound in scenes** (Aviel, 2026-11-26: "the crackling static of the radio as well, and during other 'cutscenes'"): a radio kit (static, squelch, crackle, the dial's whistle, a voice's hum, a dropout) in step 2; beds and cues for each still of a scene from step 4; from then on, every new scene gets a sound pass.
- **Store rules** (Google's pages, 2026-11-26): a one-time US$25 fee with ID verification; new personal accounts run a closed test with 12 testers for 14 days in a row before going public; new apps target API 36 (the game does).

## 16. Decisions and open questions

Decided 2026-11-11:

- Romance: yes, uncommon (*Partners*, Phase 2).
- Pace: 1 game day = 3 real hours.
- Crew size: bigger crews come from vehicles, not a higher cap.
- The player doesn't name the guild.
- Survivors are male or female (until 1.2.2 some were *they*).
- People resting until healed can't take a new post.
- Survivors have an orientation (85% straight, 6% gay, 9% bi), so about 96% of couples are a man and a woman.
- Ageing and babies: yes. Everyone ages a year every 365 game days, and children grow up at that pace (about two real years to 16). They help a little at the Depot and inherit looks, a stat lean and maybe a trait. Built in 1.10.0 (§5.2, §5.3).

Decided 2026-11-13:

- Beds: partners share one, children share their parents' until 6; someone without a bed sleeps on the floor (stress), and nobody new comes in (1.10.1).
- One run a game day for each person; deeper levels find more inside each find, by danger only (1.10.1).
- The Vultures are rivals you can deal with, with named people, and they compete for places, people, outposts and traders; their meetings on runs become radio calls (1.11.0, then 18b).
- Picked from the interactive ideas: taking command of a fight (2.0.0 when done), haggling with traders, and names given by the guild's people rather than the player; maybe what people want; possibly long expeditions; prisoners stay as built. The order isn't set (§15).
- Rations should spoil after some time (planned). An energy plant that runs on solar by day and gas at night or in winter, and powers some things, is an idea Aviel is still thinking about; winter would need seasons, which are on the later list (§15).

Decided 2026-11-26:

- **Built as if for Google Play, not published yet;** free, then a one-time $1 unlock at Haven's broadcast; 4.0.0 is store-ready; no multiplayer for now, just cloud saves (§15, *Built as if for the store*).

No open questions right now.
