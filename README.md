# The Guild

Run a scavenger guild out of a ruined rail depot, forty years after the Burn. Recruit drifters, gear them up, send crews into the Reach, and read what happened when they come back. Every survivor changes with what they live through: scars, traits, friendships, feuds, and occasionally a name on the Memorial Wall.

- Design: [`docs/DESIGN.md`](docs/DESIGN.md)
- Status: engine core and expedition simulation (PRs 1–2 of the roadmap). No UI yet.

## Development

Requires Node 22.18 or later.

```bash
npm install
npm run check    # typecheck + tests
npm run sample   # print a randomly generated guild
npm run career   # play a guild through 40 runs and watch its people change
```
