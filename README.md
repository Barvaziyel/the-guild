# The Guild

Run a scavenger guild out of a ruined rail depot, forty years after the Burn. Recruit drifters, gear them up, send crews into the Reach, and read what happened when they come back. Every survivor changes with what they live through: scars, traits, friendships, feuds, and occasionally a name on the Memorial Wall.

- Design: [`docs/DESIGN.md`](docs/DESIGN.md)
- Status: engine core, expedition simulation, portraits, 54 scripted events and the UI shell (PRs 1–5 of the roadmap). The app shows the roster, survivor sheets and the Memorial Wall, and saves on the device. Sending crews out from the app comes next (PR 6).

![The roster, a survivor sheet and a Chronicle](docs/img/ui-shell.png)

![Twenty-four randomly generated survivors](docs/img/portraits-random.png)

One survivor through everything that can happen to them:

![One survivor: wounded, scarred, sick, stressed, older, and on the Memorial Wall](docs/img/portraits-one-life.png)

## Development

Requires Node 22.18 or later.

```bash
npm install
npm run dev      # play in a browser; open the Network URL on a phone to try it there
npm run check    # typecheck + tests + build
npm run sample   # print a randomly generated guild
npm run career   # play a guild through 40 runs and watch its people change
npm run portraits # write a gallery of survivor portraits to out/portraits.html
```

Until the run planner arrives, **Settings → Developer → Play ten runs** moves a guild forward a month so there is history to look at.

Fonts: [Big Shoulders Stencil](https://fonts.google.com/specimen/Big+Shoulders+Stencil) and [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next), both under the SIL Open Font License, bundled through Fontsource.
