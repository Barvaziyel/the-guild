import type { NeedKind, Resources, StatId } from '../types.ts';
import type { CrewLines } from './flavor.ts';

/**
 * What a place's best part needs (§7.16, 3.13.0), and how it reads when someone covers it, when
 * nobody does, and when someone has a go anyway.
 *
 * In the lines, {a} is whoever does it ({b} the other of two who do it together), {it} the thing in
 * the way ("the signal box"; always one thing, so "it" can follow), {tool} what helped ("the
 * lockpicks") and {ride} the vehicle that took a load. A part can have two needs: each line has to read
 * right after the other need's lines, and before the part's find.
 */
export interface NeedDef {
  id: NeedKind;
  /** The tag's word: "Locked". */
  name: string;
  /** Who it takes, for the tag read out in full: "someone who can open a lock". */
  takes: string;
  stat: StatId;
  /** Two who are each nearly good enough cover it between them: a heavy door, a load. */
  together?: true;
  /** A running vehicle with room for it covers it: a load. */
  vehicle?: true;
  /** Check contexts for a go at it, so the gear and traits that help with such things help. */
  contexts: readonly string[];
  /** Done by someone good enough (stat), holding something that helps (tool), with a trait for it, wearing gear for it, two at once, or by vehicle. */
  covered: {
    stat: readonly string[];
    tool?: readonly string[];
    trait?: readonly string[];
    gear?: readonly string[];
    together?: readonly string[];
    vehicle?: CrewLines;
  };
  /** Nobody covers it, and they don't try. */
  skip: CrewLines;
  /** Someone has a go anyway; then whether it worked. */
  tries: readonly string[];
  won: readonly string[];
  lost: readonly string[];
  fail: NeedFail;
}

/** What a go that didn't work costs whoever had it. */
export interface NeedFail {
  /** HP lost, and the danger where they are on top when `danger` is set. */
  hurt?: readonly [number, number];
  danger?: true;
  cause?: string;
  stress?: number;
  rads?: readonly [number, number];
  /** Something comes: a fight, this often, with this kind of enemy if the place has any. */
  fight?: { chance: number; type?: string; line?: string };
  /** When a fight could have come and didn't. */
  quiet?: CrewLines;
}

export const NEEDS: Record<NeedKind, NeedDef> = {
  locked: {
    id: 'locked',
    name: 'Locked',
    takes: 'someone who can open a lock',
    stat: 'wits',
    contexts: ['lock'],
    covered: {
      stat: ['{a.first} works at the lock on {it} until it gives.', '{a.first} studies the lock on {it} for a while, then has it open with a bent nail.'],
      tool: ['{a.first} goes at the lock on {it} with {tool}, and it clicks open.', '{a.first} gets out {tool}. A minute later, {it} is open.'],
    },
    skip: { crew: ['Nobody here can open {it}, so it stays shut.'], solo: ["{a.first} can't get {it} open, so it stays shut."] },
    tries: ['{a.first} sets about forcing {it}.', '{a.first} goes at {it} with whatever is to hand.'],
    won: ['It gives at last, bent but open.', 'Something snaps, and {it} swings open.'],
    lost: ['The lock holds, and the racket carries.', "It won't give, and the noise of trying carries a long way."],
    fail: {
      fight: { chance: 0.4, line: 'Something heard it.' },
      quiet: { crew: ['Nothing comes. They leave {it} shut and move on.'], solo: ['Nothing comes. {a.first} leaves {it} shut and moves on.'] },
    },
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    takes: 'someone strong enough to shift it',
    stat: 'brawn',
    together: true,
    contexts: ['lift'],
    covered: {
      stat: ['{a.first} puts {a.their} back into it, and {it} gives.', '{a.first} gets a shoulder to {it} and heaves until it gives.'],
      tool: ['{a.first} goes at {it} with {tool} until it gives.', '{a.first} takes {tool} to {it}, and a few minutes later it gives.'],
      together: ['{a.first} and {b.first} get their shoulders to {it} and heave as one, and it gives.', 'It takes {a.first} and {b.first} both, but {it} gives.'],
    },
    skip: { crew: ["{It} won't budge for anyone here, so they leave it."], solo: ["{It} won't budge for {a.first}, so {a.they} leaves it."] },
    tries: ['{a.first} throws {a.their} whole weight at {it}.'],
    won: ['Something gives at last, and {it} is open.'],
    lost: ["{It} doesn't move. Something in {a.first}'s back does."],
    fail: { hurt: [2, 3], cause: 'a wrenched back', stress: 5 },
  },
  radiation: {
    id: 'radiation',
    name: 'Radiation',
    takes: 'someone who can stand the radiation',
    stat: 'grit',
    contexts: ['radiation'],
    covered: {
      stat: ["{a.first} can stand it for a while. {a.They} goes in, quick and steady, and doesn't linger."],
      tool: ['{a.first} goes in behind the clicks of {tool}, never long in one spot.'],
      trait: ['{a.first} goes in as if it were nothing. It stopped getting to {a.them} long ago.'],
      gear: ['{a.first} seals up {tool} and goes in.'],
    },
    skip: { crew: ['Nobody here will go near {it}: the air there tastes of metal.'], solo: ["{a.first} won't go near {it}: the air there tastes of metal."] },
    tries: ['{a.first} holds {a.their} breath and goes in anyway.'],
    won: ['{a.first} is out again before the sickness can take hold.'],
    lost: ['{a.first} stays in too long, and comes out grey.'],
    fail: { rads: [15, 25], stress: 5 },
  },
  machines: {
    id: 'machines',
    name: 'Machines',
    takes: 'someone who can get a machine running',
    stat: 'wits',
    contexts: ['tech'],
    covered: {
      stat: ["{a.first} gets the panel off {it}, finds what's wrong, and has it running."],
      tool: ['{a.first} goes into {it} with {tool} and coaxes it back to life.'],
      trait: ['{a.first} listens to {it} for a while, then knows exactly what it wants. It runs.'],
    },
    skip: { crew: ['Nobody here can get {it} running, so they leave it.'], solo: ["{a.first} can't get {it} running, and leaves it."] },
    tries: ['{a.first} starts pulling wires in {it}, hoping.'],
    won: ['It coughs, catches, and runs.'],
    lost: ['Sparks. {a.first} jumps back with a burnt hand.'],
    fail: { hurt: [1, 3], cause: 'a shock', fight: { chance: 0.3, line: 'Somewhere close, an alarm starts up.' } },
  },
  flooded: {
    id: 'flooded',
    name: 'Flooded',
    takes: 'someone who can swim it',
    stat: 'brawn',
    contexts: ['swim'],
    covered: {
      stat: ['{a.first} swims down into {it}, comes up for air, and goes down again, as many times as it takes.'],
    },
    skip: { crew: ['The water over {it} is too deep for anyone here.'], solo: ['The water over {it} is too deep for {a.first}.'] },
    tries: ['{a.first} takes a deep breath and goes under.'],
    won: ['{a.first} comes up gasping, but {a.they} made it.'],
    lost: ['{a.first} comes up too late, choking on black water.'],
    fail: { hurt: [1, 2], cause: 'nearly drowning', stress: 10 },
  },
  carry: {
    id: 'carry',
    name: 'Heavy load',
    takes: 'someone who can carry it out',
    stat: 'brawn',
    together: true,
    vehicle: true,
    contexts: ['lift'],
    covered: {
      stat: ['{a.first} shoulders {it} and walks out under the weight.'],
      together: ['{a.first} and {b.first} carry {it} out between them.'],
      vehicle: { crew: ['They get {it} onto {ride} and lash it down.'], solo: ['{a.first} gets {it} onto {ride} and lashes it down.'] },
    },
    skip: { crew: ['{It} is more than anyone here can carry out.'], solo: ['{It} is more than {a.first} can carry out.'] },
    tries: ['{a.first} gets {it} up alone, somehow, and starts out.'],
    won: ["It's slow going, but {a.they} makes it."],
    lost: ['Halfway out, {it} slips and comes down on {a.first}.'],
    fail: { hurt: [2, 4], cause: 'a load that fell' },
  },
  traps: {
    id: 'traps',
    name: 'Rigged',
    takes: "someone who can see what's rigged",
    stat: 'wits',
    contexts: ['spot'],
    covered: {
      stat: ["{a.first} spots what's rigged, one thing after another, and clears a way to {it}."],
      trait: ['{a.first} checks every step to {it} twice, and finds what was rigged.'],
    },
    skip: { crew: ["It's rigged, and nobody here can see how. They stay clear of {it}."], solo: ["It's rigged, and {a.first} can't see how. {a.They} stays clear of {it}."] },
    tries: ['{a.first} picks a way to {it} and hopes.'],
    won: ['Nothing goes off.'],
    lost: ['Something goes off.'],
    fail: { hurt: [2, 4], danger: true, cause: 'a trap', stress: 8 },
  },
  animals: {
    id: 'animals',
    name: 'Animals',
    takes: 'someone the animals will let by',
    stat: 'nerve',
    contexts: ['animals'],
    covered: {
      stat: ['{a.first} stares them down until they give ground.'],
      trait: ['{a.first} goes in slow, talking low, and they let {a.them} by.'],
    },
    skip: { crew: ['Nobody here wants to walk past those animals, so {it} stays theirs.'], solo: ["{a.first} doesn't want to walk past those animals, so {it} stays theirs."] },
    tries: ['{a.first} walks in as if {a.they} owned the place.'],
    won: ['They back off.'],
    lost: ["They don't back off."],
    fail: {
      fight: { chance: 0.6, type: 'feral' },
      quiet: { crew: ['{a.first} backs away slowly, and they let {a.them} go. The others follow, just as slowly.'], solo: ['{a.first} backs away slowly, and they let {a.them} go.'] },
    },
  },
};

/** One of a part's needs; `it` is what's in the way, when it isn't the part itself. */
export interface PartNeed {
  kind: NeedKind;
  it?: string;
}

/**
 * The best part of one level of a place (§7.16): something worth having, behind what it takes to get
 * at it. It's a kind of thing found there ("a signal box"), so a run there may come across it again.
 */
export interface PartDef {
  /** The beat's title. */
  title: string;
  /** What's in the way, as the lines name it: "the signal box". */
  it: string;
  /** One or two, in the order they're met. */
  needs: readonly PartNeed[];
  /** What they see when they come to it. */
  sight: readonly string[];
  /** What's there once they're in, before the haul. */
  inside: readonly string[];
  /** What it holds, by weight: half the haul, the other half whatever the place gives up anyway. */
  loot: Partial<Resources>;
  /** How much it holds against the usual for where it is (1 if missing): a signal box holds less than a gun safe. */
  size?: number;
  /** Chance of a piece of gear too, and of which kinds (all gear if missing). */
  gear: number;
  gearFrom?: readonly string[];
}

/** The haul from a part: {loot} is what it gave up. */
export const PART_HAUL: CrewLines = {
  crew: ['They come away with {loot}.', 'They take {loot}.'],
  solo: ['{a.first} comes away with {loot}.', '{a.first} takes {loot}.'],
};

/** Kinds of gear a part may hold. */
export const WEAPONS = ['pipe_pistol', 'hunting_rifle', 'crossbow', 'scattergun'] as const;
export const ARMOR = ['leather_jacket', 'scrap_vest', 'riot_gear'] as const;
export const TOOLS = ['crowbar', 'geiger_counter', 'binoculars', 'lockpicks', 'multitool'] as const;

/** Each place's best part, on each level: the outskirts, deeper in, the heart of it. */
export const PARTS: Record<string, readonly [PartDef, PartDef, PartDef]> = {
  rail_yard: [
    {
      title: 'The signal box',
      it: 'the signal box',
      needs: [{ kind: 'locked' }],
      sight: ['A signal box stands apart from the freight cars, its door chained and padlocked. Someone wanted it kept.'],
      inside: ["Inside, the railmen's tools still hang in a neat row, and there's a tin box under the floorboards."],
      loot: { scrap: 5, tech: 2, ammo: 1 },
      size: 0.75,
      gear: 0.25,
      gearFrom: TOOLS,
    },
    {
      title: 'The sealed boxcar',
      it: 'the boxcar',
      needs: [{ kind: 'heavy' }],
      sight: ['On the far siding, one boxcar still has its seals on. Its door has rusted into the track.'],
      inside: ['Crates, stencilled and never opened, packed to the roof.'],
      loot: { rations: 3, scrap: 4, meds: 1, gas: 1 },
      gear: 0.2,
    },
    {
      title: 'The roundhouse',
      it: 'the roundhouse',
      needs: [
        { kind: 'machines', it: 'the turntable' },
        { kind: 'carry', it: 'the battery bank' },
      ],
      sight: ['In the roundhouse, an engine sits on the turntable, facing the wall. Its battery bank is on the far side, out of reach, until the turntable turns.'],
      inside: ["The batteries alone are worth the trip, and the engine's lockers hold the rest."],
      loot: { tech: 4, scrap: 5, gas: 1 },
      gear: 0.15,
    },
  ],
  maple_street: [
    {
      title: 'The end house',
      it: 'the end house',
      needs: [{ kind: 'animals' }],
      sight: ['A pack of rad hounds lies around the yard of the end house, a dozen at least, all of them watching.'],
      inside: ['The pantry in the end house is untouched. The hounds kept every other scavenger away.'],
      loot: { rations: 4, meds: 1, scrap: 3 },
      gear: 0.1,
    },
    {
      title: 'The gun safe',
      it: 'the gun safe',
      needs: [{ kind: 'locked' }],
      sight: ['In a basement under the cul-de-sac, a gun safe is bolted to the floor. Nobody has managed it yet: the scratches around the lock say they tried.'],
      inside: ['Rifles wrapped in oilcloth, and boxes of shells.'],
      loot: { ammo: 4, scrap: 3 },
      gear: 0.5,
      gearFrom: WEAPONS,
    },
    {
      title: "The prepper's house",
      it: "the prepper's house",
      needs: [{ kind: 'traps' }, { kind: 'heavy', it: 'the bunker hatch' }],
      sight: ['The house at the end of the street has boarded windows, bright new wire and a hand-painted sign: KEEP OUT. I MEAN IT. In the garage floor, a bunker hatch.'],
      inside: ['Under the garage, the bunker: shelves of tins, drums of water, a medicine cabinet. Its owner never made it down.'],
      loot: { scrap: 2, rations: 4, meds: 3, ammo: 1 },
      gear: 0.3,
    },
  ],
  kessler_farm: [
    {
      title: 'The orchard',
      it: 'the orchard',
      needs: [{ kind: 'animals' }],
      sight: ['The orchard is thick with fruit, and with hounds. They lie between the trees, fat and watchful.'],
      inside: ['Windfalls by the sackful, and the good fruit from the high branches.'],
      loot: { scrap: 2, rations: 5, meds: 1 },
      gear: 0.05,
    },
    {
      title: 'The root cellar',
      it: 'the cellar door',
      needs: [{ kind: 'heavy' }],
      sight: ["The farmhouse burned, but its root cellar didn't. The cellar door lies under a fallen beam."],
      inside: ['Jars in rows, and seed sacks as dry as the day they were filled.'],
      loot: { rations: 5, meds: 1, scrap: 3 },
      gear: 0.1,
    },
    {
      title: 'The grain silo',
      it: 'the silo',
      needs: [
        { kind: 'heavy', it: "the silo's hatch" },
        { kind: 'carry', it: 'the grain' },
      ],
      sight: ['The grain silo still stands, its hatch rusted shut. Something in there smells like bread.'],
      inside: ['Grain. More than the Depot has seen in years.'],
      loot: { scrap: 2, rations: 8, gas: 1 },
      gear: 0.05,
    },
  ],
  old_metro: [
    {
      title: 'The ticket hall',
      it: 'the maintenance locker',
      needs: [{ kind: 'traps' }],
      sight: ['Someone strung the ticket hall with tripwires and hung cans on them, then left. Behind the wire, the maintenance locker.'],
      inside: ["Whoever strung the wire kept a store in the locker, beside the line's own tools."],
      loot: { scrap: 5, tech: 2, ammo: 1 },
      gear: 0.25,
      gearFrom: TOOLS,
    },
    {
      title: 'The lower platform',
      it: 'the lower platform',
      needs: [{ kind: 'flooded' }],
      sight: ['Stairs lead down into black water. A train waits at the lower platform, its doors open under the surface.'],
      inside: ['It was an evacuation train. People packed what mattered.'],
      loot: { meds: 2, ammo: 2, tech: 1, scrap: 3 },
      gear: 0.3,
    },
    {
      title: 'The control room',
      it: 'the control room',
      needs: [
        { kind: 'locked', it: 'the control room' },
        { kind: 'machines', it: 'the backup generator' },
      ],
      sight: ["Deep under the junction, the line's control room is locked up tight, and everything in it runs off a backup generator that went quiet long ago."],
      inside: ['With the lights on, the control room gives up its stores.'],
      loot: { tech: 4, ammo: 2, scrap: 4 },
      gear: 0.3,
    },
  ],
  drowned_mall: [
    {
      title: 'The pharmacy',
      it: 'the pharmacy',
      needs: [{ kind: 'flooded' }],
      sight: ["The pharmacy is on the lower floor, under a lake of green water. Its sign is just visible below the surface."],
      inside: ['The sealed bottles on the back shelves are still good.'],
      loot: { scrap: 2, meds: 4, rations: 1 },
      gear: 0.1,
    },
    {
      title: 'The security office',
      it: 'the security office',
      needs: [{ kind: 'locked' }],
      sight: ["The mall's security office has a steel door, and it's locked. Guards keep things."],
      inside: ['A gun locker, a first aid station, and the radio the guards never got to use.'],
      loot: { scrap: 2, ammo: 3, meds: 2, tech: 1 },
      gear: 0.35,
      gearFrom: [...WEAPONS, ...ARMOR],
    },
    {
      title: 'The cold store',
      it: 'the cold store',
      needs: [
        { kind: 'flooded', it: 'the loading bay' },
        { kind: 'heavy', it: 'the cold store door' },
      ],
      sight: ['Under the food court, the loading bay is flooded to the ceiling. Beyond it, the cold store was sealed when the power went.'],
      inside: ['Dry, dark and full: everything the food court never sold.'],
      loot: { scrap: 2, rations: 5, meds: 2, gas: 1 },
      gear: 0.15,
    },
  ],
  radio_station: [
    {
      title: 'The record room',
      it: 'the record room',
      needs: [{ kind: 'locked' }],
      sight: ['The record room is locked, and somebody has written MINE on the door in marker.'],
      inside: ["Behind the records, someone's stash: batteries, a box of shells, a few tins."],
      loot: { scrap: 2, tech: 2, ammo: 2, rations: 1 },
      gear: 0.2,
    },
    {
      title: 'The service lift',
      it: 'the service lift',
      needs: [{ kind: 'machines' }],
      sight: ['The transmitter hall is at the top of the tower, and the stairs to it are gone. Only the service lift goes up.'],
      inside: ['At the top, the transmitter hall, untouched: racks of parts nobody could reach.'],
      loot: { tech: 5, scrap: 4 },
      gear: 0.2,
    },
    {
      title: 'The lookout post',
      it: 'the lookout post',
      needs: [
        { kind: 'traps', it: 'the lookout post' },
        { kind: 'locked', it: "the raiders' strongbox" },
      ],
      sight: ['The raiders who use the mast keep a post at its foot, rigged against visitors. Their strongbox is inside.'],
      inside: ["The strongbox holds the raiders' pay, and their spare rounds."],
      loot: { ammo: 4, scrap: 4, gas: 2 },
      gear: 0.3,
    },
  ],
  st_judes: [
    {
      title: 'The pharmacy cage',
      it: 'the pharmacy cage',
      needs: [{ kind: 'locked' }],
      sight: ['The hospital pharmacy is a cage of steel mesh, and the cage is still locked.'],
      inside: ["Most of the shelves were emptied in a hurry. The locked drawers weren't."],
      loot: { scrap: 2, meds: 5, tech: 1 },
      gear: 0.15,
      gearFrom: ['medkit'],
    },
    {
      title: 'Radiology',
      it: 'the radiology wing',
      needs: [{ kind: 'radiation' }],
      sight: ['The radiology wing is behind old warning signs. Even from the corridor, the air there has a taste.'],
      inside: ['Nobody else has dared. Its supply rooms are full.'],
      loot: { scrap: 2, meds: 5, tech: 2 },
      gear: 0.25,
    },
    {
      title: 'The surgery floor',
      it: 'the surgery floor',
      needs: [
        { kind: 'radiation', it: 'the surgery floor' },
        { kind: 'locked', it: 'the drug safe' },
      ],
      sight: ['The seventh floor is surgery. The air up there is heavy with it, and the drug safe is behind the last door.'],
      inside: ['The drug safe holds what a hospital keeps for its worst days.'],
      loot: { scrap: 2, meds: 8, tech: 1 },
      gear: 0.3,
    },
  ],
  water_plant: [
    {
      title: 'The sluices',
      it: 'the sluice motor',
      needs: [{ kind: 'machines' }],
      sight: ['The intake sluices are shut, and the motor that works them is dead. Open them, and the lower galleries drain.'],
      inside: ['The water goes down, and the lower galleries come out from under it, strewn with everything the flood carried in.'],
      loot: { scrap: 5, tech: 3, gas: 1 },
      gear: 0.15,
    },
    {
      title: 'The filter beds',
      it: 'the filter beds',
      needs: [{ kind: 'flooded' }],
      sight: ['The old filter beds are deep tanks of murky water. Tools glint on the bottom.'],
      inside: ['Tools dropped by the last shift, and a crate of filters still in their wrapping.'],
      loot: { tech: 3, scrap: 4, meds: 1 },
      gear: 0.25,
      gearFrom: TOOLS,
    },
    {
      title: 'The pump room',
      it: 'the pump room',
      needs: [
        { kind: 'heavy', it: 'the pump room door' },
        { kind: 'carry', it: "the master pump's motor" },
      ],
      sight: ["At the heart of the plant, the pump room is sealed. The plant's machines never let anyone near it."],
      inside: ['The motor alone is the finest machine-work in the Reach, and the room around it is full of spares.'],
      loot: { tech: 6, scrap: 4 },
      gear: 0.25,
    },
  ],
  blackwater: [
    {
      title: 'The hunting hut',
      it: 'the hunting hut',
      needs: [{ kind: 'animals' }],
      sight: ['Something has made a den of the old hunting hut: there are eyes in the reeds all around it.'],
      inside: ['Smoked meat still hangs in the rafters, and the traps on the wall still work.'],
      loot: { scrap: 2, rations: 5, ammo: 1 },
      gear: 0.15,
    },
    {
      title: 'The drowned church',
      it: 'the church',
      needs: [{ kind: 'flooded' }],
      sight: ['A church stands in the swamp, the water up to its windows. People sheltered there once, and stored what they had in the crypt.'],
      inside: ["The crypt's shelves are still full."],
      loot: { rations: 3, meds: 3, scrap: 3 },
      gear: 0.2,
    },
    {
      title: 'The glowing pool',
      it: 'the glowing pool',
      needs: [
        { kind: 'radiation', it: 'the glowing pool' },
        { kind: 'animals', it: 'the island' },
      ],
      sight: ['In the heart of the swamp lies a pool that glows at night, with an island in the middle. Whatever hunts the swamp nests there, and they are watching.'],
      inside: ['In the mud of the island lies everything the swamp ever swallowed.'],
      loot: { scrap: 2, meds: 4, rations: 2, tech: 2 },
      gear: 0.35,
    },
  ],
  checkpoint_bravo: [
    {
      title: 'The arms container',
      it: 'the container',
      needs: [{ kind: 'locked' }],
      sight: ['Behind the barrier sits a shipping container stencilled ARMS, with an army padlock on it.'],
      inside: ['Rifles in racks, and ammunition in green tins.'],
      loot: { ammo: 5, scrap: 3 },
      gear: 0.4,
      gearFrom: WEAPONS,
    },
    {
      title: 'The minefield',
      it: 'the command post',
      needs: [{ kind: 'traps' }],
      sight: ['The way to the command post runs through a field marked with little red flags. Most of the flags have blown away.'],
      inside: ["The command post: maps, a radio, and the officers' supplies."],
      loot: { scrap: 2, ammo: 3, meds: 2, tech: 2 },
      gear: 0.3,
    },
    {
      title: 'The motor pool',
      it: 'the motor pool',
      needs: [
        { kind: 'heavy', it: 'the bay door' },
        { kind: 'machines', it: 'the armoured truck' },
      ],
      sight: ["The motor pool's bay door is shut on an armoured truck. It needs power to open its own lockers."],
      inside: ["The truck's lockers swing open, and its tank is still half full."],
      loot: { scrap: 2, gas: 5, ammo: 3, tech: 2 },
      gear: 0.35,
      gearFrom: ARMOR,
    },
  ],
  red_hand_camp: [
    {
      title: 'The gate dogs',
      it: 'the gate',
      needs: [{ kind: 'animals' }],
      sight: ['The Red Hand keep hounds at the stadium gate, chained in a long row. The chains are long.'],
      inside: ["Past the gate, the raiders' outer stores, where nobody thought to post a guard."],
      loot: { rations: 3, ammo: 2, scrap: 4 },
      gear: 0.2,
    },
    {
      title: 'The tunnel',
      it: 'the supply room',
      needs: [{ kind: 'traps' }],
      sight: ["The tunnel under the stands is how the Red Hand come and go, and they've rigged it against anyone else. At its end, their supply room."],
      inside: ['The supply room is stacked to the ceiling.'],
      loot: { scrap: 2, ammo: 3, rations: 3, meds: 2, gas: 1 },
      gear: 0.3,
    },
    {
      title: "The boss's lockup",
      it: 'the lockup',
      needs: [
        { kind: 'locked', it: 'the lockup' },
        { kind: 'heavy', it: 'the floor safe' },
      ],
      sight: ["The Red Hand's boss keeps a lockup under the stadium boxes, with a floor safe inside it."],
      inside: ['The Red Hand\'s takings: the best of everything they ever stole.'],
      loot: { scrap: 2, ammo: 4, meds: 3, gas: 2, tech: 2 },
      gear: 0.4,
    },
  ],
  the_glow: [
    {
      title: 'The glass flats',
      it: 'the glass flats',
      needs: [{ kind: 'radiation' }],
      sight: ['Past the crater\'s lip the ground is glass, and the hot spots shimmer. A wrecked convoy sits in the middle of it.'],
      inside: ['Nobody has dared the convoy. Its trucks are full.'],
      loot: { tech: 4, scrap: 4, meds: 1 },
      gear: 0.3,
    },
    {
      title: 'The research station',
      it: 'the research station',
      needs: [
        { kind: 'radiation', it: 'the crater floor' },
        { kind: 'machines', it: "the station's generator" },
      ],
      sight: ["Down on the crater floor, a research station is dug into the glass, dark. Its doors won't open without power."],
      inside: ['Inside the station are the instruments they brought to measure the end of the world.'],
      loot: { scrap: 2, tech: 6, meds: 1 },
      gear: 0.35,
    },
    {
      title: 'Ground zero',
      it: 'the vault',
      needs: [
        { kind: 'radiation', it: "the crater's heart" },
        { kind: 'heavy', it: 'the vault door' },
      ],
      sight: ['At the very centre, where the bomb fell, a government vault stands half sunk in the glass.'],
      inside: ['Whatever they meant to save is still in there.'],
      loot: { scrap: 2, tech: 6, meds: 2, ammo: 2 },
      gear: 0.5,
    },
  ],
};

/** A place's best part on a level, if it has one (a market has none). */
export function partAt(locationId: string, level: number): PartDef | undefined {
  return PARTS[locationId]?.[level - 1];
}
