/**
 * Elites (§7.15, 3.12.0): one of a kind at each place where there's fighting.
 * Each has something it does that no other enemy does, and a prize: a Relic
 * with a name of its own. The guild hears of one before it meets it (`signs`),
 * can go after it (`lair`), and once it's dead it stays dead.
 *
 * The lines are story: each has to make sense on its own, and every one that
 * can follow another has to follow from it.
 */
import type { EnemyDef } from './enemies.ts';

export const ELITES: readonly EnemyDef[] = [
  // ------------------------------------------------------------ the Rail Yard
  {
    id: 'the_switchman',
    type: 'scrapbot',
    name: 'The Switchman',
    plural: 'Switchmen',
    description: 'A rail maintenance robot still walking the yard, still throwing switches for trains that stopped coming years ago. Bolted plates over everything that matters.',
    hp: 26,
    attack: 5,
    damage: 4,
    defense: 9,
    armor: 1,
    stealth: 12,
    threat: 5,
    morale: 'fearless',
    plates: 4,
    heavy: 0.3,
    hitVerb: 'hit by',
    loot: { scrap: [4, 8], tech: [1, 2] },
    elite: {
      place: 'rail_yard',
      signs: {
        title: 'Something on the tracks',
        lines: {
          crew: [
            'At the far end of the yard a switch lever throws itself with a clang. Then the next one down the line. Then the next.',
            'Something tall is walking the tracks with a lamp, stopping at every switch, checking it, moving on. Plates of steel bolted over its chest. It turns its lamp their way and holds it there a long moment.',
            'It doesn’t come any closer. Not this time. They don’t go any closer either.',
          ],
          solo: [
            'At the far end of the yard a switch lever throws itself with a clang. Then the next one down the line. Then the next.',
            'Something tall is walking the tracks with a lamp, stopping at every switch, checking it, moving on. Plates of steel bolted over its chest. It turns its lamp {a.first}’s way and holds it there a long moment.',
            'It doesn’t come any closer. Not this time. {a.first} doesn’t go any closer either.',
          ],
        },
      },
      met: 'A lamp comes swinging down the line, and behind it, the Switchman, plates rattling, a track bar in its hand.',
      lair: {
        title: 'The Switchman’s line',
        lines: {
          crew: ['They follow the clang of the switches to the far end of the yard, where every lever has been oiled and every rail swept. The lamp is already coming.'],
          solo: ['{a.first} follows the clang of the switches to the far end of the yard, where every lever has been oiled and every rail swept. The lamp is already coming.'],
        },
      },
      killed: 'The Switchman stops in the middle of a step. The lamp flickers, and goes out, and somewhere down the yard a lever falls back with a clang.',
      prize: { item: 'crowbar', name: 'The Switch Bar', story: 'The Switchman’s track bar, taken at the Rail Yard. It has thrown a thousand switches.' },
    },
  },
  // ------------------------------------------------------------ Maple Street
  {
    id: 'old_mother',
    type: 'feral',
    name: 'Old Mother',
    plural: 'Old Mothers',
    description: 'A rad-hound twice the size of the rest, grey at the muzzle, with a litter somewhere under the porches. When she howls, the street answers.',
    hp: 24,
    attack: 5,
    damage: 5,
    defense: 10,
    armor: 0,
    stealth: 11,
    threat: 5,
    morale: 'fearless',
    pack: true,
    leader: true,
    calls: { id: 'rad_hound', chance: 0.55, max: 3, how: 'throws back her head and howls', comes: 'comes running out from under a porch' },
    hitVerb: 'mauled by',
    loot: {},
    elite: {
      place: 'maple_street',
      signs: {
        title: 'A howl on Maple Street',
        lines: {
          crew: [
            'A howl goes up somewhere down the street, long and low, and every hound on Maple Street answers it.',
            'At the end of the block she stands on a porch roof and watches them: a rad-hound twice the size of the rest, grey round the muzzle. Pups tumble about under the steps below her.',
            'She doesn’t chase them off. She doesn’t have to. They take the long way round.',
          ],
          solo: [
            'A howl goes up somewhere down the street, long and low, and every hound on Maple Street answers it.',
            'At the end of the block she stands on a porch roof and watches {a.first}: a rad-hound twice the size of the rest, grey round the muzzle. Pups tumble about under the steps below her.',
            'She doesn’t chase {a.them} off. She doesn’t have to. {a.first} takes the long way round.',
          ],
        },
      },
      met: 'The other hounds go quiet and part. Old Mother comes up through them, head low, and something jingles at her throat.',
      lair: {
        title: 'Old Mother’s porch',
        lines: {
          crew: ['They find the house with the gnawed bones in the yard and the pups under the steps. She is already on the porch, waiting for them.'],
          solo: ['{a.first} finds the house with the gnawed bones in the yard and the pups under the steps. She is already on the porch, waiting.'],
        },
      },
      killed: 'Old Mother lies down slowly, the way an old dog does at the end of a long day. Under the porch, the pups have gone quiet.',
      prize: { item: 'dog_tags', name: 'Old Mother’s Tags', story: 'On a chain round Old Mother’s neck, at Maple Street. Somebody’s dog, once. The name on them is worn off.' },
    },
  },
  // ------------------------------------------------------------ Kessler Farm
  {
    id: 'the_butcher',
    type: 'raider',
    name: 'The Butcher',
    plural: 'Butchers',
    description: 'Keeps the farm’s smokehouse going day and night. Nobody asks what with. Swings a cleaver with a hook on the back of it, and gets worse when he bleeds.',
    hp: 26,
    attack: 4,
    damage: 5,
    defense: 9,
    armor: 1,
    stealth: 9,
    threat: 6,
    morale: 'fearless',
    heavy: 0.2,
    grabs: 0.3,
    enrages: true,
    hitVerb: 'hacked by',
    loot: { rations: [3, 6], ammo: [1, 3] },
    elite: {
      place: 'kessler_farm',
      signs: {
        title: 'The smokehouse',
        lines: {
          crew: [
            'Smoke is coming out of the old smokehouse behind the barn, and it smells like supper. Nobody on the crew feels hungry.',
            'A big man in a leather apron comes out to the woodpile, whistling, a cleaver hooked on his belt. He splits a log with one swing, and looks up at the orchard as if he knew exactly where they were lying.',
            'He smiles, and goes back in. They don’t wait for him to come out again.',
          ],
          solo: [
            'Smoke is coming out of the old smokehouse behind the barn, and it smells like supper. {a.first} doesn’t feel hungry.',
            'A big man in a leather apron comes out to the woodpile, whistling, a cleaver hooked on his belt. He splits a log with one swing, and looks up at the orchard as if he knew exactly where {a.first} was lying.',
            'He smiles, and goes back in. {a.first} doesn’t wait for him to come out again.',
          ],
        },
      },
      met: 'Somebody is whistling. The Butcher steps out from behind the barn, wiping his cleaver on his apron, and the whistling doesn’t stop.',
      lair: {
        title: 'The smokehouse',
        lines: {
          crew: ['They go round the back of the barn to the smokehouse, where the smoke never stops. The door opens before they reach it.'],
          solo: ['{a.first} goes round the back of the barn to the smokehouse, where the smoke never stops. The door opens before {a.they} reaches it.'],
        },
      },
      killed: 'The Butcher goes down on his knees in the mud, still holding the cleaver, and the whistling stops at last.',
      prize: { item: 'machete', name: 'The Butcher’s Cleaver', story: 'Taken from the Butcher at Kessler Farm, hook and all. It was sharpened every day.' },
    },
  },
  // ------------------------------------------------------------ the Old Metro
  {
    id: 'the_conductor',
    type: 'hollow',
    name: 'The Conductor',
    plural: 'Conductors',
    description: 'A hollow still in a transit uniform, cap and all, with a brass bell on his belt. When it rings, the others come out of the tunnels.',
    hp: 28,
    attack: 4,
    damage: 5,
    defense: 9,
    armor: 0,
    stealth: 9,
    threat: 5,
    morale: 'fearless',
    rads: 1,
    rises: true,
    calls: { id: 'hollow', chance: 0.6, max: 3, how: 'rings the bell on his belt', comes: 'shuffles out of the dark to answer it' },
    hitVerb: 'clawed by',
    loot: { tech: [1, 2], scrap: [2, 4] },
    elite: {
      place: 'old_metro',
      signs: {
        title: 'A bell in the tunnels',
        lines: {
          crew: [
            'Down the tunnel, a bell rings: two short, one long, like a train about to leave.',
            'A figure in a transit uniform walks the platform with a lantern, cap straight, checking faces. Hollows shuffle out of the dark and stand in a line behind him, as if they had tickets.',
            'He rings the bell again, and they all turn and walk into the tunnel. The crew waits a long time before anyone moves.',
          ],
          solo: [
            'Down the tunnel, a bell rings: two short, one long, like a train about to leave.',
            'A figure in a transit uniform walks the platform with a lantern, cap straight, checking faces. Hollows shuffle out of the dark and stand in a line behind him, as if they had tickets.',
            'He rings the bell again, and they all turn and walk into the tunnel. {a.first} waits a long time before moving.',
          ],
        },
      },
      met: 'A bell rings in the dark: two short, one long. The Conductor steps onto the platform, cap straight, and holds out his hand as if for a ticket.',
      lair: {
        title: 'The last platform',
        lines: {
          crew: ['They go down past the last working light to the platform where the bell rings. The Conductor is waiting there with his lantern, as he always is.'],
          solo: ['{a.first} goes down past the last working light to the platform where the bell rings. The Conductor is waiting there with his lantern, as he always is.'],
        },
      },
      killed: 'The Conductor folds onto the platform. His cap rolls to the edge and drops onto the tracks, and the bell on his belt rings once more, by itself.',
      prize: { item: 'lucky_coin', name: 'The Conductor’s Token', story: 'A brass subway token from the Conductor’s pocket, in the Old Metro. Good for one ride, any line.' },
    },
  },
  // ------------------------------------------------------------ the Drowned Mall
  {
    id: 'the_snapper',
    type: 'feral',
    name: 'The Snapper',
    plural: 'Snappers',
    description: 'Something old lives in the lake where the food court was: a snapping turtle as big as a car, its shell grown over with weed. It goes under, and comes up somewhere else.',
    hp: 24,
    attack: 5,
    damage: 5,
    defense: 8,
    armor: 1,
    stealth: 12,
    threat: 6,
    morale: 'fearless',
    plates: 3,
    dives: 0.35,
    grabs: 0.2,
    hitVerb: 'bitten by',
    loot: { rations: [2, 4] },
    elite: {
      place: 'drowned_mall',
      signs: {
        title: 'The food court lake',
        lines: {
          crew: [
            'Out on the lake where the food court used to be, a table that’s floating there sinks, all at once, without a sound.',
            'A moment later a head the size of a barrel comes up by the escalator, old and beaked and green with weed, and looks at them. Then it slides back under, and the ripples go a long way.',
            'Nobody wants to cross the water after that.',
          ],
          solo: [
            'Out on the lake where the food court used to be, a table that’s floating there sinks, all at once, without a sound.',
            'A moment later a head the size of a barrel comes up by the escalator, old and beaked and green with weed, and looks at {a.first}. Then it slides back under, and the ripples go a long way.',
            '{a.first} doesn’t want to cross the water after that.',
          ],
        },
      },
      met: 'The water by the escalator bulges, and the Snapper heaves itself out onto the tiles, weed streaming off its shell.',
      lair: {
        title: 'The food court lake',
        lines: {
          crew: ['They wade out along the drowned food court, waist deep, past the sunken tables. The water goes still. Then something under it moves.'],
          solo: ['{a.first} wades out along the drowned food court, waist deep, past the sunken tables. The water goes still. Then something under it moves.'],
        },
      },
      killed: 'The Snapper sags onto the tiles and its head sinks slowly into the water. For a long time nothing in the lake moves at all.',
      prize: { item: 'scrap_vest', name: 'The Snapper’s Shell', story: 'Plates cut from the Snapper’s shell at the Drowned Mall and laced into a vest. Older than the mall, probably.' },
    },
  },
  // ------------------------------------------------------------ Hilltop Radio Station
  {
    id: 'the_lookout',
    type: 'raider',
    name: 'The Lookout',
    plural: 'Lookouts',
    description: 'Lives at the top of the mast with a scoped rifle, a lot of patience and a lot of bullets. Only a shot can reach her up there.',
    hp: 14,
    attack: 7,
    damage: 5,
    defense: 10,
    armor: 1,
    stealth: 8,
    threat: 5,
    morale: 'fearless',
    ranged: true,
    flies: true,
    aims: 0.6,
    hitVerb: 'shot by',
    loot: { ammo: [4, 8] },
    elite: {
      place: 'radio_station',
      signs: {
        title: 'A glint on the mast',
        lines: {
          crew: [
            'Halfway up the ridge, a glint at the very top of the radio mast. Then a shot cracks into the rock a hand’s width from someone’s boot.',
            'A voice drifts down on the wind, a woman’s, quite cheerful: “That was the warning one.”',
            'They go back down the ridge the way they came, keeping low.',
          ],
          solo: [
            'Halfway up the ridge, a glint at the very top of the radio mast. Then a shot cracks into the rock a hand’s width from {a.first}’s boot.',
            'A voice drifts down on the wind, a woman’s, quite cheerful: “That was the warning one.”',
            '{a.first} goes back down the ridge the way {a.they} came, keeping low.',
          ],
        },
      },
      met: 'A glint at the top of the mast, and a cheerful voice on the wind: “I see you.” The Lookout is up there with her rifle.',
      lair: {
        title: 'Under the mast',
        lines: {
          crew: ['They come up the ridge in the long grass, as quietly as they can, to the foot of the mast. From somewhere far above comes a cheerful whistle.'],
          solo: ['{a.first} comes up the ridge in the long grass, as quietly as {a.they} can, to the foot of the mast. From somewhere far above comes a cheerful whistle.'],
        },
      },
      killed: 'The Lookout’s rifle clatters down the mast, a long way, ahead of her.',
      prize: { item: 'hunting_rifle', name: 'The Lookout’s Rifle', story: 'Fell from the top of the mast at Hilltop Radio Station, scope and all. There are a lot of notches on the stock.' },
    },
  },
  // ------------------------------------------------------------ St. Jude's
  {
    id: 'the_matron',
    type: 'hollow',
    name: 'The Matron',
    plural: 'Matrons',
    description: 'The head nurse still does her rounds, glowing faintly in her starched cap. She patches up her patients, and she calls them out of their beds.',
    hp: 36,
    attack: 4,
    damage: 6,
    defense: 9,
    armor: 0,
    stealth: 9,
    threat: 7,
    morale: 'fearless',
    rads: 2,
    rises: true,
    mends: 5,
    calls: { id: 'hollow', chance: 0.4, max: 2, how: 'claps her hands twice, sharply', comes: 'climbs out of a bed to answer her' },
    hitVerb: 'clawed by',
    loot: { meds: [3, 6] },
    elite: {
      place: 'st_judes',
      signs: {
        title: 'The night rounds',
        lines: {
          crew: [
            'On the fourth floor a trolley squeaks down the dark ward, slow and steady, stopping at every bed.',
            'The one pushing it glows a little in the dark, a starched cap still pinned to what hair she has left. At each bed she straightens the sheet and pats the hand of whatever is lying in it. Some of them move.',
            'She looks up at the door, where they are standing, and puts one finger to her lips.',
          ],
          solo: [
            'On the fourth floor a trolley squeaks down the dark ward, slow and steady, stopping at every bed.',
            'The one pushing it glows a little in the dark, a starched cap still pinned to what hair she has left. At each bed she straightens the sheet and pats the hand of whatever is lying in it. Some of them move.',
            'She looks up at the door, where {a.first} is standing, and puts one finger to her lips.',
          ],
        },
      },
      met: 'A trolley squeaks round the corner, and the Matron with it, glowing faintly, cap pinned straight. She looks at them the way a nurse looks at visitors after hours.',
      lair: {
        title: 'The fourth floor',
        lines: {
          crew: ['They go up to the fourth floor, where the trolley squeaks all night. Every bed on the ward is made, and every one of them has someone in it.'],
          solo: ['{a.first} goes up to the fourth floor, where the trolley squeaks all night. Every bed on the ward is made, and every one of them has someone in it.'],
        },
      },
      killed: 'The Matron sits down on the edge of an empty bed, very upright, and stops. The trolley rolls on a little way without her.',
      prize: { item: 'medkit', name: 'The Matron’s Bag', story: 'The Matron’s own bag from St. Jude’s, packed exactly the way the hospital taught her.' },
    },
  },
  // ------------------------------------------------------------ the Water Plant
  {
    id: 'the_warden',
    type: 'scrapbot',
    name: 'The Warden',
    plural: 'Wardens',
    description: 'The plant’s head of security: bigger than the sentries, armored like a vault, with a bay of drones on its back that it lets out one at a time.',
    hp: 24,
    attack: 5,
    damage: 5,
    defense: 10,
    armor: 2,
    stealth: 8,
    threat: 8,
    morale: 'fearless',
    ranged: true,
    plates: 3,
    calls: { id: 'scrap_drone', chance: 0.4, max: 2, how: 'opens a hatch on its back', comes: 'lifts out of it, buzzing' },
    hitVerb: 'shot by',
    loot: { tech: [3, 6], scrap: [4, 8] },
    elite: {
      place: 'water_plant',
      signs: {
        title: 'Inspection',
        lines: {
          crew: [
            'A siren whoops once, somewhere inside the plant. Every sentry in sight stops where it is.',
            'Something big rolls along the catwalk above the settling tanks: a security unit twice the size of the sentries, armored like a safe, drones clinging to its back like ticks. It stops by each sentry, and each one salutes.',
            '“Unauthorized personnel,” it says, to nobody in particular. They leave before it says it to them.',
          ],
          solo: [
            'A siren whoops once, somewhere inside the plant. Every sentry in sight stops where it is.',
            'Something big rolls along the catwalk above the settling tanks: a security unit twice the size of the sentries, armored like a safe, drones clinging to its back like ticks. It stops by each sentry, and each one salutes.',
            '“Unauthorized personnel,” it says, to nobody in particular. {a.first} leaves before it says it to {a.them}.',
          ],
        },
      },
      met: 'A siren whoops once. The Warden rolls into the open, drones stirring on its back: “Unauthorized personnel. Remain where you are.”',
      lair: {
        title: 'The control room',
        lines: {
          crew: ['They go in past the settling tanks to the control room, where every screen still glows. The Warden is parked in front of them, and it turns.'],
          solo: ['{a.first} goes in past the settling tanks to the control room, where every screen still glows. The Warden is parked in front of them, and it turns.'],
        },
      },
      killed: 'The Warden’s lights go out one by one. “Shift ends,” it says, and doesn’t say anything else.',
      prize: { item: 'riot_gear', name: 'The Warden’s Plate', story: 'Cut from the Warden’s own armor at the Water Plant, and fitted to a person. Still stamped “Authorized”.' },
    },
  },
  // ------------------------------------------------------------ Blackwater
  {
    id: 'the_bog_king',
    type: 'feral',
    name: 'The Bog King',
    plural: 'Bog Kings',
    description: 'The biggest mire stalker anyone has seen, older than the swamp. It waits under the water for days at a time, and comes up where you aren’t looking.',
    hp: 34,
    attack: 5,
    damage: 7,
    defense: 9,
    armor: 0,
    stealth: 13,
    threat: 9,
    morale: 'fearless',
    heavy: 0.25,
    dives: 0.4,
    grabs: 0.2,
    hitVerb: 'mauled by',
    loot: { rations: [3, 6] },
    elite: {
      place: 'blackwater',
      signs: {
        title: 'Something in the water',
        lines: {
          crew: [
            'A deer is drinking at the edge of the black water. Then there is no deer, only rings spreading out across the pool.',
            'Something long moves under the surface, as long as a boat, past where they are crouching, and the water glows faintly where it goes. It takes a long time to go by.',
            'Nobody says anything until they are well clear of the water.',
          ],
          solo: [
            'A deer is drinking at the edge of the black water. Then there is no deer, only rings spreading out across the pool.',
            'Something long moves under the surface, as long as a boat, past where {a.first} is crouching, and the water glows faintly where it goes. It takes a long time to go by.',
            '{a.first} doesn’t breathe properly until {a.they} is well clear of the water.',
          ],
        },
      },
      met: 'The black water heaves, and the Bog King comes up out of it, jaws first, weed and old bones hanging off its back.',
      lair: {
        title: 'The deep pool',
        lines: {
          crew: ['They push out through the reeds to the deep pool in the middle of the swamp, where the water glows and the bones on the bank are big ones. The water goes very still.'],
          solo: ['{a.first} pushes out through the reeds to the deep pool in the middle of the swamp, where the water glows and the bones on the bank are big ones. The water goes very still.'],
        },
      },
      killed: 'The Bog King rolls over in the shallows, pale belly up, and the swamp is quiet in a way it hasn’t been for years.',
      prize: { item: 'leather_jacket', name: 'The Bog King’s Hide', story: 'Cut and cured from the Bog King’s hide, at Blackwater. It still smells of the swamp in the rain.' },
    },
  },
  // ------------------------------------------------------------ Checkpoint Bravo
  {
    id: 'bravo_six',
    type: 'scrapbot',
    name: 'Bravo Six',
    plural: 'Bravo Sixes',
    description: 'An army walker still holding the checkpoint it was told to hold. Plated all over, with a gun that sweeps a whole line of people at once.',
    hp: 30,
    attack: 6,
    damage: 5,
    defense: 10,
    armor: 3,
    stealth: 7,
    threat: 10,
    morale: 'fearless',
    ranged: true,
    plates: 4,
    sweeps: 0.35,
    hitVerb: 'shot by',
    loot: { ammo: [6, 12], tech: [2, 4] },
    elite: {
      place: 'checkpoint_bravo',
      signs: {
        title: 'The checkpoint',
        lines: {
          crew: [
            'A loudspeaker crackles on the checkpoint’s tower: “Halt. Present papers. This is your only warning.”',
            'Behind the barrier something stands up that they’d taken for a burnt-out truck: a walker on four legs, plated all over, a long gun turning to follow them. “BRAVO SIX” is painted on its side, under a lot of scratches.',
            'They don’t have papers. They back off slowly, and it lets them.',
          ],
          solo: [
            'A loudspeaker crackles on the checkpoint’s tower: “Halt. Present papers. This is your only warning.”',
            'Behind the barrier something stands up that {a.first} had taken for a burnt-out truck: a walker on four legs, plated all over, a long gun turning to follow {a.them}. “BRAVO SIX” is painted on its side, under a lot of scratches.',
            '{a.first} doesn’t have papers. {a.They} backs off slowly, and it lets {a.them}.',
          ],
        },
      },
      met: 'A loudspeaker crackles: “Halt. Present papers.” Bravo Six stands up behind the barrier, and its gun swings round.',
      lair: {
        title: 'The barrier',
        lines: {
          crew: ['They walk up the road to the barrier, in the open, because there is no other way to get there. “Halt,” says the loudspeaker. “Present papers.”'],
          solo: ['{a.first} walks up the road to the barrier, in the open, because there is no other way to get there. “Halt,” says the loudspeaker. “Present papers.”'],
        },
      },
      killed: 'Bravo Six sinks down on its legs. “Checkpoint... relieved,” says the loudspeaker, and then only static.',
      prize: { item: 'scattergun', name: 'Bravo Six’s Sweeper', story: 'Unbolted from Bravo Six at the checkpoint and cut down to carry. Army issue, and it still kicks like one.' },
    },
  },
  // ------------------------------------------------------------ Red Hand Camp
  {
    id: 'the_red_hand',
    type: 'raider',
    name: 'The Red Hand',
    plural: 'Red Hands',
    description: 'The gang’s boss, who painted his hand red the first time and never stopped. Calls his people with a whistle, and fights harder the more he bleeds.',
    hp: 32,
    attack: 6,
    damage: 7,
    defense: 10,
    armor: 2,
    stealth: 8,
    threat: 10,
    morale: 'fearless',
    leader: true,
    heavy: 0.3,
    enrages: true,
    calls: { id: 'raider_scav', chance: 0.35, max: 2, how: 'puts two fingers in his mouth and whistles', comes: 'comes running from the stands' },
    hitVerb: 'hit by',
    loot: { ammo: [5, 10], scrap: [5, 10] },
    elite: {
      place: 'red_hand_camp',
      signs: {
        title: 'The stadium',
        lines: {
          crew: [
            'From the hill above the stadium they can see the whole camp, and the whole camp is cheering.',
            'In the middle of the field a man with one red hand is beating someone half to death in front of the whole camp. When he’s done he holds the red hand up, and the stands roar his name.',
            'Nobody on the crew says it. Everybody thinks it: sooner or later, someone has to.',
          ],
          solo: [
            'From the hill above the stadium {a.first} can see the whole camp, and the whole camp is cheering.',
            'In the middle of the field a man with one red hand is beating someone half to death in front of the whole camp. When he’s done he holds the red hand up, and the stands roar his name.',
            '{a.first} thinks it, lying there in the grass: sooner or later, someone has to.',
          ],
        },
      },
      met: 'A whistle, and the shouting stops. The Red Hand walks out in front of his people, red hand up, smiling.',
      lair: {
        title: 'The field',
        lines: {
          crew: ['They go over the stakes at night and down onto the field. The floodlights come on all at once, and the Red Hand is standing in the middle of them, waiting.'],
          solo: ['{a.first} goes over the stakes at night and down onto the field. The floodlights come on all at once, and the Red Hand is standing in the middle of them, waiting.'],
        },
      },
      killed: 'The Red Hand goes down in the middle of the field, and the stands go quiet, and stay quiet.',
      prize: { item: 'sledge', name: 'The Red Hand’s Maul', story: 'The Red Hand’s own sledge, taken on the field at Red Hand Camp. The handle is red where he held it.' },
    },
  },
  // ------------------------------------------------------------ the Glow
  {
    id: 'the_glass_man',
    type: 'hollow',
    name: 'The Glass Man',
    plural: 'Glass Men',
    description: 'A hulk grown through with glass from the ground where the bomb fell, so bright it’s hard to look at. Its arms sweep the ground in front of it, and everything near it gets sick.',
    hp: 38,
    attack: 5,
    damage: 7,
    defense: 8,
    armor: 1,
    stealth: 6,
    threat: 12,
    morale: 'fearless',
    rads: 3,
    rises: true,
    sweeps: 0.35,
    hitVerb: 'struck by',
    loot: { tech: [4, 8] },
    elite: {
      place: 'the_glow',
      signs: {
        title: 'A light in the Glow',
        lines: {
          crew: [
            'Out on the glass plain, something is brighter than the ground. It’s walking.',
            'It is shaped like a man, a very big one, but glass has grown up through it like ice through a cracked pipe, and it shines green from the inside. Where it steps, the ground chimes. The Geiger counters go mad at a hundred yards.',
            'They lie flat behind a slab of fused concrete until it has gone, and for a long while after.',
          ],
          solo: [
            'Out on the glass plain, something is brighter than the ground. It’s walking.',
            'It is shaped like a man, a very big one, but glass has grown up through it like ice through a cracked pipe, and it shines green from the inside. Where it steps, the ground chimes. Even at a hundred yards {a.first} can feel it on {a.their} skin.',
            '{a.first} lies flat behind a slab of fused concrete until it has gone, and for a long while after.',
          ],
        },
      },
      met: 'The light gets brighter, and the ground starts to chime. The Glass Man comes walking out of the glare.',
      lair: {
        title: 'Where the bomb fell',
        lines: {
          crew: ['They walk out across the glass toward the middle of the Glow, where the ground is brightest, wrapped up against it as well as they can be. Something there is brighter still.'],
          solo: ['{a.first} walks out across the glass toward the middle of the Glow, where the ground is brightest, wrapped up against it as well as {a.they} can be. Something there is brighter still.'],
        },
      },
      killed: 'The Glass Man cracks from top to bottom with a sound like a bell, and falls in pieces, and the pieces go dark one by one.',
      prize: { item: 'hazmat_suit', name: 'The Glass Man’s Suit', story: 'Found sealed in its case where the Glass Man slept, in the middle of the Glow. Whoever brought it never got to put it on.' },
    },
  },
];
