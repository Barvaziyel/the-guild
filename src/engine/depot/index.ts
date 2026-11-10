export {
  assignPost,
  atDepot,
  build,
  buildProblem,
  buildingDef,
  buildingLevel,
  buildingName,
  bunksCap,
  canAfford,
  canWork,
  costText,
  defaultPosts,
  hasFreeBunk,
  initialBuildings,
  nextLevel,
  postProblem,
  postStat,
  postText,
  postedTo,
  weakestStat,
  workerSlots,
  workingAt,
} from './buildings.ts';
export { dailyUpkeep, emptySummary, firepitRelief, frontier, gardenYield, healRate, playDepotDay, type DepotSummary } from './day.ts';
export { acceptOffer, declineOffer, offerProblem, offerText, rollDepotEvents } from './events.ts';
export { boardSize, recruitProblem, refreshRecruits, takeIn } from './recruits.ts';
export { craft, craftProblem, craftQuality, findRecipe, upgradeFor, upgradeItem, upgradeProblem, workshopItems } from './workshop.ts';
export { advanceTime, dayStart, nextDayAt, type AdvanceResult } from './time.ts';
