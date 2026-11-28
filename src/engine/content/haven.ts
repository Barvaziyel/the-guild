/**
 * Haven (§9.11): the long goal, from the broadcast that ends the first week.
 * Aviel, 2026-11-16: the guild finds out about Haven bit by bit, through runs
 * to different places (and a couple of buildings), with hints heard by chance
 * often enough to keep it interesting, all kept in a Haven tab. At the end the
 * guild learns what Haven is (Aviel, 2026-11-16): a cult that grew up after the
 * bombs around a doctor from St. Jude's, who means to make the next kind of
 * human and cuts up whoever comes to try, with the Glow's radiation. The
 * Hollows out of the Glow are their failures. The clues mostly sound good and
 * grow darker; the hints go the same way. Nothing says it outright: the guild
 * hears the truth at the gate, from one of its own who went (HAVEN_DREAMER).
 */
import type { BuildingId, HavenHintSource } from '../types.ts';

/** The broadcast, as the guild first hears it (the first week's last step quotes it too). */
export const HAVEN_BROADCAST = 'This is Haven. We have power, clean water, and room for you. All survivors welcome.';

/** Where a clue is: found on a run to a place (at a level of it), or worked out once a building is up. */
export type HavenClueWhere =
  /** A run to the place, at this level or deeper (1 the outskirts, 2 deeper in, 3 the heart of it). */
  | { kind: 'run'; locationId: string; depth: 1 | 2 | 3 }
  /** A building at this level; then the player works it out from the Haven tab. */
  | { kind: 'build'; building: BuildingId; level: number; action: string };

export interface HavenClue {
  id: string;
  /** What it is, as the file lists it: "The engineer's logbook". */
  title: string;
  /** The lead, before it's found: where it should be, and why anyone thinks so. */
  lead: string;
  where: HavenClueWhere;
  /** Found only once all of these are. Empty: a lead from the broadcast on. */
  after: readonly string[];
  /** A run's line when the crew finds it; {a.*} is whoever finds it. Build clues have none. */
  find?: string;
  /** What it says or shows, kept in the file. */
  text: string;
  /** What the guild knows from it, in one line, for the top of the file. */
  learned: string;
}

export const HAVEN_CLUES: readonly HavenClue[] = [
  {
    id: 'logbook',
    title: 'The engineer’s logbook',
    lead: 'Whoever kept Hilltop Radio Station running would have heard the broadcast first, and logged it.',
    where: { kind: 'run', locationId: 'radio_station', depth: 1 },
    after: [],
    find: 'In the booth under the mast, {a.first} finds the engineer’s logbook, still on the desk.',
    text: 'The last entries are in a careful hand. “New carrier on 147.3, very strong. Bearing east-north-east. Somebody out there has real power.” A week later: “Same message every hour. Thinking of going.” Then nothing.',
    learned: 'The broadcast comes from the east, past the edge of the Reach.',
  },
  {
    id: 'flyer',
    title: 'A flyer in the tunnels',
    lead: 'People shelter in the Old Metro on their way through. Anyone passing word along would leave it there.',
    where: { kind: 'run', locationId: 'old_metro', depth: 1 },
    after: [],
    find: 'Pasted to a pillar on the platform, {a.first} finds a printed flyer, hardly faded.',
    text: 'HAVEN. POWER. CLEAN WATER. ROOM FOR YOU. Under it, smaller: “Wait by the highway with a fire lit after dark. We will come for you.” Printed, on good paper. Nobody has printed anything in years.',
    learned: 'Haven sends for people who answer: they wait by the highway with a fire lit.',
  },
  {
    id: 'kessler_note',
    title: 'A note on the Kesslers’ door',
    lead: 'The Kesslers had the farm before it went quiet. Nobody knows where they went.',
    where: { kind: 'run', locationId: 'kessler_farm', depth: 1 },
    after: [],
    find: 'Nailed to the farmhouse door, behind a loose board, {a.first} finds a note in pencil.',
    text: '“Gone to Haven. The white trucks came for us like they said. Take what you need, we won’t want it. Ruth Kessler and the boys.”',
    learned: 'Whole families have gone. White trucks come for them.',
  },
  {
    id: 'letters',
    title: 'Letters nobody collected',
    lead: 'Somebody on Maple Street kept the post going for a while. If anyone wrote to Haven, the letters went through there.',
    where: { kind: 'run', locationId: 'maple_street', depth: 1 },
    after: ['kessler_note'],
    find: 'In a postbox on the corner, {a.first} finds a bundle of letters tied with string.',
    text: 'All addressed to people who went to Haven, from people who stayed. “Did you get there? Is it like they say?” “Write back, Jo, even one line.” “Mum’s worse. Can they send for her too?” None was ever collected.',
    learned: 'Nobody who went to Haven has ever written back.',
  },
  {
    id: 'dropped_radio',
    title: 'A convoy’s dropped radio',
    lead: 'The logbook gives a bearing east, and the trucks would need water on the way. The Water Plant is on that line.',
    where: { kind: 'run', locationId: 'water_plant', depth: 1 },
    after: ['logbook'],
    find: 'By the intake, among fresh tyre tracks, {a.first} picks a handheld radio out of the mud.',
    text: 'A good radio, newer than anything at the Depot, with a white H painted on the back. It’s set to a band next to the broadcast. The tracks around it are from big trucks, a lot of them, all going east.',
    learned: 'Haven’s trucks stop at the Water Plant, and their drivers talk on a band of their own.',
  },
  {
    id: 'convoy_band',
    title: 'The convoy band',
    lead: 'The dropped radio is too weak to hear much. Wired into a bigger receiver, it might pick up the drivers.',
    where: { kind: 'build', building: 'radio_tower', level: 2, action: 'Listen in' },
    after: ['dropped_radio'],
    text: 'With the dropped radio wired into the new receiver, the drivers come in, faint. “Convoy two, eleven head from the coast road, coming in by the north gate.” “Copy, two. How many fit?” Then a laugh, and static.',
    learned: 'Haven’s convoys bring people in by a north gate, and count them in heads.',
  },
  {
    id: 'intake_list',
    title: 'The intake list',
    lead: 'The tracks at the Water Plant run on toward Checkpoint Bravo, where the highway leaves the Reach.',
    where: { kind: 'run', locationId: 'checkpoint_bravo', depth: 1 },
    after: ['dropped_radio'],
    find: 'In the guard booth at the barrier, {a.first} finds a clipboard someone left behind.',
    text: 'HAVEN INTAKE, printed at the top. Names, ages, blood types, and a tick or a cross by each. Most have ticks. Three names near the bottom have a feather drawn beside them: Vultures.',
    learned: 'Haven keeps a list of everyone it takes in. Three of the names are Vultures.',
  },
  {
    id: 'intake_forms',
    title: 'Forms from St. Jude’s',
    lead: 'The flyer’s paper is hospital stock. Someone from Haven has been through St. Jude’s for supplies.',
    where: { kind: 'run', locationId: 'st_judes', depth: 1 },
    after: ['flyer'],
    find: 'On a ward where the dust has been disturbed, {a.first} finds a stack of forms on a trolley.',
    text: 'Medical forms, half filled in, on the same paper as the flyer. Height, weight, blood type, and an outline of a body with every old break and scar marked on it. At the bottom of each, one word circled: CANDIDATE, or DONOR. Every one is signed in the same neat hand: Dr. M. Marr.',
    learned: 'Haven looks people over when they arrive. Their doctor worked at St. Jude’s.',
  },
  {
    id: 'ledger',
    title: 'Red Hand’s ledger',
    lead: 'Red Hand Camp trades with anyone who pays. If Haven’s trucks pass that way, Red Hand will have dealt with them.',
    where: { kind: 'run', locationId: 'red_hand_camp', depth: 1 },
    after: ['intake_list'],
    find: 'In the raiders’ strongbox, under the ammo, {a.first} finds a ledger.',
    text: 'Red Hand’s accounts, in a clumsy hand. Most lines are ammo and fuel. Some say only “Haven”, a date, and a number: “Haven, 4.” “Haven, 6.” They were paid well every time: food, medicine, guns. The ledger never says for what.',
    learned: 'Red Hand sells something to Haven, and Haven pays well.',
  },
  {
    id: 'truck_map',
    title: 'The driver’s map',
    lead: 'One of the white trucks went off the road into Blackwater. Whatever the driver carried is still in the cab, deeper in.',
    where: { kind: 'run', locationId: 'blackwater', depth: 2 },
    after: ['intake_list'],
    find: 'Half sunk in the swamp lies a white truck with bars on the back windows. In the cab, {a.first} finds the driver’s map.',
    text: 'A road map with the route drawn in grease pencil: out of the Reach past Checkpoint Bravo, east along the old highway for two days. Fuel stops marked. The end of the line is off the edge of the map, with a circle and an H.',
    learned: 'Haven’s trucks take the old highway east, two days out of the Reach.',
  },
  {
    id: 'notebook',
    title: 'The runaway’s notebook',
    lead: 'One name on Haven’s list is crossed out, with a note in pencil: “ran, Glow road”. The trucks don’t follow anyone into the Glow. Go well armed, and take Medkits.',
    where: { kind: 'run', locationId: 'the_glow', depth: 1 },
    after: ['intake_list'],
    find: 'Near the crater rim, under a slab of fused glass, {a.first} finds what’s left of someone, and a notebook sealed in a plastic bag.',
    text: 'Most of the pages are burned through. One isn’t: a careful drawing of the dam from the inside, with the north gate, the turbine hall, a long building marked WARDS, a room with a row of tables in it, and a way out along the spillway marked with a cross. Under it, pressed hard into the paper: “Not the north gate. Never the north gate.”',
    learned: 'Someone got out of Haven along the spillway and ran through the Glow. They drew the inside of the dam.',
  },
  {
    id: 'bearing',
    title: 'A bearing on Haven',
    lead: 'The map ends at the edge of the paper. A big enough antenna, turned along the highway, could find where the signal is strongest.',
    where: { kind: 'build', building: 'radio_tower', level: 3, action: 'Take a bearing' },
    after: ['truck_map'],
    text: 'With the big antenna turned along the highway, the signal peaks at one place: Corwin Dam, two days east. The dam ran a power station once. They really do have power.',
    learned: 'Haven is at Corwin Dam, two days east along the old highway.',
  },
  {
    id: 'gate_code',
    title: 'The gate code',
    lead: 'The drivers on the convoy band talk about a hut at the Water Plant where they sleep on the way. It’s deeper in, past the filter beds.',
    where: { kind: 'run', locationId: 'water_plant', depth: 2 },
    after: ['convoy_band', 'intake_list'],
    find: 'In the drivers’ hut past the filter beds, chalked on a board by their radio, {a.first} finds a list of call signs and a code.',
    text: 'Call signs for the convoys, and under them: “North gate: say SHEPHERD, flash twice.” Below that, in another hand: “Don’t forget the count.”',
    learned: 'A truck that says “Shepherd” and flashes twice gets in at the north gate.',
  },
];

/**
 * The Vultures' word (§9.11): once the guild has the intake list and the
 * Vultures are in the Reach, one of theirs comes to the fence about the three
 * names. It's what brings them along at the end (Aviel: they think Haven is
 * vile too). It comes to the Depot on a Depot day, not from a run.
 */
export const HAVEN_VULTURES = {
  id: 'vultures_word',
  title: 'The Vultures’ word',
  after: ['intake_list'] as readonly string[],
  text: 'One of the Vultures came to the fence alone, hands empty. Word had got round that the guild found a list with three of theirs on it. They went east last winter to answer the broadcast, and nobody heard from them again. “When you go,” she said, “send for us. We’re going too.”',
  learned: 'The Vultures lost three people to Haven. When the guild goes, they want to come.',
};

/**
 * The one who goes (§9.11). Aviel, 2026-11-16: "One of our own gets influenced
 * by the news of haven and runs away to join them alone on some run one time.
 * This is the one who escapes and is shot when you approach." Once the guild
 * has found a few clues, one of its people (grown, known a while, with no
 * partner or child to keep them) starts listening. Three lines about them are
 * heard at the fire as it gets hold of them; then, on the way home from a run
 * with someone else along, they walk off east. Kept away from runs, they go at
 * night. Their goodbye is filed with what the guild has found.
 */
export const HAVEN_DREAMER = {
  id: 'dreamer_goodbye',
  /** Heard at the fire, {a} the one, each once the guild has found as many clues as its tier. */
  lines: [
    { id: 'dreamer_radio', tier: 3, text: 'Most nights now {a.first} sits up by the radio, listening to the broadcast with the sound turned low.' },
    { id: 'dreamer_talk', tier: 5, text: 'At the fire, {a.first} talks about Haven for a long time: hot water, real beds, a doctor who stayed. When somebody laughs, {a.they} doesn’t laugh with them.' },
    { id: 'dreamer_pack', tier: 7, text: '{a.first} has been putting food aside, a little each day, and {a.their} pack sits ready by the door. “Just in case,” {a.they} says, and won’t look at anyone.' },
  ],
  /** The run's last beat, on the way home. */
  run: 'Where the old highway turns east, {a.first} stops and won’t go any further. “I’m going to Haven. Don’t come after me. When I’m settled I’ll send for all of you, I promise.” Nobody can talk {a.them} out of it. The last anyone sees of {a.them} is {a.their} back, walking east.',
  /** Kept home: the news, the morning after. */
  night: 'In the night, {a.first} slipped away with {a.their} pack. On {a.their} bunk, a note: “Gone to Haven. Don’t come after me. When I’m settled I’ll send for all of you, I promise.”',
  title: '{a.first}’s goodbye',
  /** The scrap, after the road home or the night. */
  said: '“I’m going to Haven. Don’t come after me. When I’m settled I’ll send for all of you, I promise.” Then {a.first} walked east along the old highway, and didn’t look back.',
  note: 'Left on {a.their} bunk: “Gone to Haven. Don’t come after me. When I’m settled I’ll send for all of you, I promise.”',
  learned: '{a.first} went east to answer the broadcast, alone.',
  /** Their last line in the guild's Chronicle. */
  reason: 'Went east alone, to Haven.',
  /** For the ones who watched them go. */
  saw: 'Watched {a.first} walk east to Haven, and couldn’t stop {a.them}.',
};

/** Clues that, found, open the road (the journey itself is the next roadmap step). */
export const HAVEN_ROAD: readonly string[] = ['bearing', 'gate_code', 'notebook'];

export interface HavenHint {
  id: string;
  from: HavenHintSource;
  /** Clues found before it can be heard: the hints darken as the guild learns more. */
  tier: number;
  /** A clue that must be found first. */
  needs?: string;
  /**
   * What was seen or heard, as the file keeps it. {a.*} is the person it came
   * through: on a run, one of the crew; at the gate, the newcomer; at the fire,
   * someone at home; a captive. Traders, the radio and the Vultures have nobody.
   */
  text: string;
}

export const HAVEN_HINTS: readonly HavenHint[] = [
  // On a run: seen or heard on the way.
  { id: 'chalk', from: 'run', tier: 0, text: 'On a bridge pier, {a.first} finds an arrow in fresh chalk pointing east, and one word: HAVEN.' },
  { id: 'family', from: 'run', tier: 0, text: 'A family passes on the road with everything they own on a cart, going to Haven. They wave, and the youngest is singing.' },
  { id: 'water_tower', from: 'run', tier: 0, text: 'Painted on a water tower in letters a yard high: HAVEN · POWER · WATER · EAST.' },
  { id: 'fire_ring', from: 'run', tier: 1, text: 'By the highway, {a.first} finds a big fire burned out in a ring of stones, and a lot of footprints around it. Then tyre tracks, and no more footprints.' },
  { id: 'bus', from: 'run', tier: 2, text: 'A school bus by the road has HAVEN painted down its side. The seats have been taken out.' },
  { id: 'trucks', from: 'run', tier: 2, text: 'Far off, a line of white trucks goes east along the highway with their lights on in daylight. Nobody has seen a working truck that new in years.' },
  { id: 'shoes', from: 'run', tier: 3, text: '{a.first} picks up a child’s shoe at the side of the highway. Further on, the other one.' },
  { id: 'scrubbed', from: 'run', tier: 4, text: 'Scratched into a wall at a crossroads: DON’T ANSWER IT. Someone has tried to scrub it off.' },
  { id: 'graves', from: 'run', tier: 5, text: 'A row of graves by the highway, each with a strip of white cloth tied to the marker. No names. Too many for a family.' },
  { id: 'bracelet', from: 'run', tier: 6, text: 'In the weeds by the highway, {a.first} finds a plastic hospital bracelet, cut off. There’s no name on it, only a number.' },
  { id: 'seam', from: 'run', tier: 6, text: '{a.first} gets a close look at a dead Hollow. Across its chest runs a row of old stitches, neat as a seam.' },
  { id: 'runner', from: 'run', tier: 7, text: 'Someone runs past going west, barefoot, and won’t stop or say a word. When {a.first} calls after them they run faster.' },
  { id: 'convoy_stops', from: 'run', tier: 4, text: 'From a rooftop, {a.first} watches a white truck stop on the highway. Men get out and look around for a long time, then drive on without anyone.' },
  { id: 'cage_truck', from: 'run', tier: 7, text: 'A white truck lies burned out on the hard shoulder. The back of it is a cage, and the door locks from the outside.' },
  { id: 'tally', from: 'run', tier: 8, text: 'On a road sign someone has scratched a tally, dozens of strokes in fives, and under it: HAVEN TOOK.' },
  { id: 'tag_2041', from: 'run', tier: 9, text: 'In the ashes of an old campfire, {a.first} finds another hospital bracelet. Number 2041.' },
  { id: 'unloading', from: 'run', tier: 8, text: '{a.first} meets a scavenger who swears she saw a white truck at the edge of the Glow, unloading. “Whatever got out walked straight in,” she says. “Didn’t even look back.”' },
  // A newcomer, when they join.
  { id: 'cousin', from: 'gate', tier: 0, text: '{a.first}’s cousin answered the broadcast in the spring. {a.They} {a.is} sure he’s warm and fed by now.' },
  { id: 'coast', from: 'gate', tier: 0, text: '{a.first} says everyone on the coast has heard the broadcast. Half of them have gone.' },
  { id: 'waited', from: 'gate', tier: 1, text: '{a.first} once waited three nights by the highway with a fire lit. Nobody came, so {a.they} came here instead.' },
  { id: 'lights', from: 'gate', tier: 2, text: '{a.first} saw Haven’s lights once from a hill, far off in the east. Electric light, a whole row of it, all night.' },
  { id: 'brother', from: 'gate', tier: 4, text: '{a.first}’s brother went to Haven and said he’d send for {a.them}. That was two years ago.' },
  { id: 'doctor', from: 'gate', tier: 4, needs: 'intake_forms', text: '{a.first} knows the name Marr. A doctor at St. Jude’s before the bombs, who stayed when everyone else ran. “Saved my mother’s life,” {a.they} says. “If Marr runs Haven, it’s in good hands.”' },
  { id: 'old_left', from: 'gate', tier: 5, text: '{a.first} says Haven doesn’t take everyone. Old people and the sick get left at the fire.' },
  { id: 'counted', from: 'gate', tier: 7, text: '{a.first} won’t talk about the east. {a.They} only asked, twice, whether the guild counts its people.' },
  { id: 'sister_letter', from: 'gate', tier: 3, text: '{a.first} carries a letter from {a.their} sister in Haven, all about the hot water and the gardens. It isn’t in her handwriting.' },
  { id: 'scarred', from: 'gate', tier: 9, text: '{a.first} has a long scar from {a.their} collarbone down, far too neat for a field doctor, and won’t say where it came from.' },
  // A trader at the gate.
  { id: 'buys', from: 'trader', tier: 0, text: 'A trader says Haven’s convoys buy anything, and pay in tools that work.' },
  { id: 'highway', from: 'trader', tier: 1, text: 'A trader won’t take the highway east any more. Too many trucks, she says, and they don’t stop for anyone.' },
  { id: 'thread', from: 'trader', tier: 2, text: 'A trader sold Haven’s people every needle and reel of thread she had, the good surgical kind. “Somebody out there does a lot of sewing.”' },
  { id: 'red_hand_paid', from: 'trader', tier: 4, text: 'A trader says Red Hand have been rich since they started dealing with Haven. He wouldn’t say in what.' },
  { id: 'twenty_years', from: 'trader', tier: 6, text: 'A trader has been on the roads twenty years. She’s never met anyone who came back from Haven.' },
  { id: 'stopped_selling', from: 'trader', tier: 5, text: 'A trader has stopped selling to Haven’s convoys. She won’t say why, only that she has children.' },
  { id: 'unfinished', from: 'trader', tier: 6, text: 'A trader says Haven’s drivers talk like preachers. They kept calling her “unfinished”, and she didn’t like how they looked at her.' },
  { id: 'boots', from: 'trader', tier: 8, text: 'A trader says Haven paid her once in boots: good boots, all different sizes, some still laced.' },
  // The radio at night (with a Radio Tower).
  { id: 'children', from: 'radio', tier: 0, text: 'Late at night, between broadcasts, the Haven band plays a song: children singing, a little out of tune.' },
  { id: 'cut_off', from: 'radio', tier: 1, text: 'One night the broadcast stops halfway through a word. An hour later it starts again from the top, as if nothing happened.' },
  { id: 'new_line', from: 'radio', tier: 3, text: 'The broadcast has a new line, in the same calm voice: “If you can’t make the road, wait by your fire. We will find you.”' },
  { id: 'not_fit', from: 'radio', tier: 4, needs: 'dropped_radio', text: 'On the convoy band, faint: “Nine head off the coast road. Two not fit.” A pause. “Leave those.”' },
  { id: 'full', from: 'radio', tier: 7, needs: 'convoy_band', text: 'On the convoy band: “North gate, open up. We’re full, and they’re loud tonight.”' },
  { id: 'roll_call', from: 'radio', tier: 6, needs: 'convoy_band', text: 'On the convoy band, late at night, a voice reads numbers, slowly, for a long time. Every so often another voice says “present.”' },
  { id: 'be_more', from: 'radio', tier: 5, text: 'The broadcast has another new line, in the same calm voice: “At Haven, you can be more than you are.”' },
  { id: 'for_the_glass', from: 'radio', tier: 8, needs: 'convoy_band', text: 'On the convoy band: “Two more for the glass tonight. Neither one took.”' },
  { id: 'same_breath', from: 'radio', tier: 8, text: 'Someone at the Depot is sure now that the broadcast is a recording: the same little breath before “clean water”, every hour, for months.' },
  // Talk at the fire.
  { id: 'shower', from: 'fire', tier: 0, text: 'At the fire, {a.first} says {a.they}’d give anything for a hot shower before {a.they} dies. Haven has hot water, surely.' },
  { id: 'why_go', from: 'fire', tier: 2, text: 'At the fire, someone asks why anyone would leave: the Garden’s coming on and the roof holds. Nobody has an answer.' },
  { id: 'send_back', from: 'fire', tier: 3, text: 'At the fire, {a.first} says what everyone’s been thinking: a place that good would have room to send someone back.' },
  { id: 'home', from: 'fire', tier: 5, text: 'Somebody painted HAVEN over the Depot’s gate in the night. By morning somebody else had crossed it out and written HOME.' },
  { id: 'staying', from: 'fire', tier: 7, text: 'At the fire, {a.first} says that even if Haven is all it says, {a.they}’d rather stay here.' },
  { id: 'bad_joke', from: 'fire', tier: 4, text: 'Nobody wants to talk about Haven at the fire tonight. {a.first} tells a long, bad joke instead, and everyone laughs too hard.' },
  { id: 'what_we_have', from: 'fire', tier: 8, text: 'At the fire, {a.first} counts what the Depot has now: water, walls, a garden, each other. Then {a.they} asks, quietly, what Haven has that’s worth the trip.' },
  // A captive, questioned or just talking.
  { id: 'bars', from: 'captive', tier: 1, text: '{a.first}, held at the Depot, saw Haven’s trucks once: armour plate, and bars on the back windows. “To keep raiders out,” {a.they} says, not sounding sure.' },
  { id: 'list', from: 'captive', tier: 5, text: '{a.first}, held at the Depot, spits when Haven comes up. “You want to end up on a list?”' },
  { id: 'red_hand_truck', from: 'captive', tier: 7, text: '{a.first}, held at the Depot, drove a truck to Haven for Red Hand once. {a.They} didn’t like the sound from the back.' },
  { id: 'strong_ones', from: 'captive', tier: 8, text: '{a.first}, held at the Depot, says Red Hand only ever sold Haven the strong ones. “They said they were building something.”' },
  // The Vultures, once they're in the Reach.
  { id: 'gone', from: 'vultures', tier: 2, text: 'A Vulture on the road says they’ve lost people to Haven. Not dead, she says. Gone.' },
  { id: 'the_best', from: 'vultures', tier: 6, text: 'A Vulture says the three they lost to Haven were the strongest they had. “Haven only takes the best,” she says. “So why does nobody ever come back?”' },
  { id: 'waiting', from: 'vultures', tier: 9, text: 'A Vulture on the road asks whether it’s true the guild knows the way now. She looks like she’s been waiting a long time to ask.' },
];

/**
 * The road east (§9.12, 3.0.0): the words of the guild's last run, in order.
 * {a} is the one who went east (§9.11), {v} the Vultures' boss.
 */
export const HAVEN_JOURNEY = {
  depart: 'The whole guild goes out of the gate together, for once, and there is nobody left behind to close it.',
  /** What the Vultures send before the guild sets out, by how things stand with them (Aviel, 2026-11-18). */
  word: {
    trade: 'About time. We’ll be on the road right behind you, all the way to their door. Leave some of them for us.',
    truce: 'We said we’d come, and we will. Don’t make us sorry.',
    wary: 'We don’t like you much. We like Haven a lot less. We’ll be there.',
    war: 'Our word was about Haven, not about you. We’ll be at the gate. After that, things go back to how they were.',
  },
  /** The Vultures are around, but never gave their word (§9.11): nobody comes. */
  noWord: 'The Vultures never gave their word. Nobody is coming to help.',
  /** Where the road's fights are, for the fight card and screen (and each has a backdrop of its own). */
  sites: {
    haven_toll: 'Red Hand’s toll',
    haven_glow: 'the Glow road',
    haven_gate: 'Haven’s north gate',
  } as Record<string, string>,
  children: 'The children ride with the packs, wide awake.',
  highway: {
    title: 'The old highway',
    lines: ['The old highway runs east, straight and empty, past the last sign anyone in the guild has ever read.'],
  },
  toll: {
    title: 'Red Hand’s toll',
    intro: 'Cars dragged across the road, and Red Hand behind them with their guns up, wanting a toll. Nobody is in the mood to pay it.',
  },
  truck: {
    title: 'A white truck',
    lines: [
      'A white truck comes the other way and slows beside them. The driver leans out, smiling.',
      '“Nearly there,” he says. “They’ll be so glad to see you.”',
      'The back of the truck is shut. Something in it knocks, once.',
    ],
  },
  glow: {
    title: 'The Glow road',
    intro: 'Hollows come out of the Glow and onto the road, more of them than anyone has seen in one place. Some of them have stitches.',
  },
  dam: {
    title: 'Corwin Dam',
    lines: [
      'The dam fills the valley ahead, white and quiet. There is a garden on the spillway, washing on a line, smoke from a chimney.',
      'It is exactly the way the broadcast said. Someone has painted HAVEN over the north gate, in letters taller than a man.',
    ],
  },
  gate: {
    title: 'The north gate',
    /** The one who went east (§9.11). */
    dreamer: [
      'A door bangs open in the wall, and {a.first} comes running out barefoot, in a hospital gown, with a line of fresh stitches across {a.their} scalp.',
      '“It’s not a haven!” {a.they} screams. “They cut you open! Down in the turbine hall, they’re making something out of people. Everyone who came. Everyone! Run!”',
      'A single shot from the wall. {a.first} falls in the road, ten steps short of them, and doesn’t get up.',
    ],
    /** Nobody went east from this guild. */
    stranger: [
      'A door bangs open in the wall, and a woman comes running out barefoot, in a hospital gown, with a line of fresh stitches across her scalp.',
      '“It’s not a haven!” she screams. “They cut you open! Down in the turbine hall, they’re making something out of people. Everyone who came. Everyone! Run!”',
      'A single shot from the wall. She falls in the road, ten steps short of them, and doesn’t get up.',
    ],
    /** The Vultures pull up (Aviel, 2026-11-28: “we saw everything that happened, let's kill these bastards”). */
    vultures: 'Engines on the road behind them: the Vultures, as they promised. {v.first} jumps down from the first truck, looks at the body in the road, then up at the wall. “We saw everything,” {v.they} says, loud enough for the wall to hear. “Let’s kill these bastards.”',
    open: 'The north gate swings open. Orderlies in white come out with saws and hooks, a marksman settles on the wall above them, and behind them comes the Shepherd: a giant sewn together out of many people, four arms, two heads, three legs, and every face on it still looking around.',
  },
  won: {
    title: 'Haven',
    lines: [
      'The Shepherd comes down at last, all of it at once, and the ground shakes.',
      'Inside, the wards are full: people strapped to beds, waiting their turn. Some are past saving. Some can walk.',
      'Nobody finds Dr. Marr. There is an open window over the spillway, and a white coat on the rocks below.',
      'On the long drive home nobody says much. Then the Depot’s lights come up out of the dark: the haven they built themselves.',
    ],
    /** With the Vultures there. */
    vultures: 'The Vultures take the stores they want. The guild takes the people.',
  },
  lost: {
    title: 'Haven goes on',
    /** How the fight at the gate was lost: the first line. */
    first: {
      routed: 'The Shepherd doesn’t stop. One by one the guild goes down under it.',
      withdrew: 'They pull back from the gate, and the Shepherd lets them go. It doesn’t need to chase.',
      stalemate: 'It goes on until nobody can lift an arm, and the Shepherd is still standing.',
    } as Record<string, string>,
    lines: [
      'Behind them, from the wall, the broadcast starts up again, calm as ever: “This is Haven.”',
      'They drive home the long way, hurt and quiet. Haven goes on. It is what it is: the Depot is still there, and so are they, and they’ll keep building it.',
    ],
    vultures: 'The Vultures drag them back to the trucks.',
    alone: 'They drag each other back to the vehicles.',
  },
  home: { won: 'The guild comes home from Haven.', lost: 'The guild comes home from Haven, beaten.' },
  /** The Memorial Wall, for the one shot at the gate. */
  shot: 'Shot at Haven’s gate, running to the guild.',
  shotNews: '{a.first} was shot at Haven’s gate, running to warn the guild.',
  wentWon: 'Went to Haven, and saw it end.',
  wentLost: 'Went to Haven, and came home beaten.',
  saw: 'Saw {a.first} shot at Haven’s gate.',
  freed: 'Freed from Haven’s wards, and came home with the guild.',
  /** Who didn't fit at the Depot, and went with the Vultures (Aviel: "what if you don't have room in the depot for everyone?"). */
  withVultures: 'There wasn’t room at the Depot for everyone freed from Haven: {n} went with the Vultures.',
};
