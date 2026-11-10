/**
 * Write a gallery of portraits to out/portraits.html (open it in a browser).
 *   npm run portraits              # random survivors
 *   npm run portraits -- <seed>
 * Sections: random survivors, every hair style, every outfit and armor,
 * and one survivor through everything that can happen to them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { GEAR, Rng, generateSurvivor, getOrigin, getTrait, newGame, type Survivor } from '../src/engine/index.ts';
import { CLOTHES, HAIR_STYLES, portraitLook, portraitSvg } from '../src/portrait/index.ts';

const seed = process.env.GALLERY_SEED ?? process.argv[2] ?? `gallery-${Date.now()}`;
const state = newGame({ seed, now: 0 });
const rng = new Rng(seed);
const fresh = (): Survivor => generateSurvivor(state, rng, { day: 1 });
const clone = (s: Survivor, change: (c: Survivor) => void): Survivor => {
  const c = structuredClone(s);
  change(c);
  return c;
};
const item = (defId: string) => ({ uid: `g-${defId}`, defId, quality: 'common' as const });
const trait = (id: string) => ({ id, gainedDay: 1 });

export interface Card {
  s: Survivor;
  label: string;
  memorial?: boolean;
}

export function sections(): { title: string; cards: Card[] }[] {
  const random: Card[] = Array.from({ length: 24 }, () => {
    const s = fresh();
    return { s, label: `${s.firstName} ${s.lastName}, ${s.age} - ${getOrigin(s.origin).name}` };
  });

  const model = fresh();
  model.equipment = {};
  model.traits = [];
  model.age = 30;
  const hairCards: Card[] = HAIR_STYLES.map((name, i) => ({
    s: clone(model, (c) => {
      c.appearance.hairStyle = i;
      c.appearance.hairColor = i;
      c.appearance.skinTone = i;
      c.appearance.faceShape = i;
      c.appearance.seed = model.appearance.seed + i * 7919;
    }),
    label: `hair: ${name}`,
  }));

  const outfitCards: Card[] = [];
  CLOTHES.forEach((name, i) => {
    // Search for a seed that gives this outfit with no hat, so each one is shown plainly.
    for (let k = 0; k < 500; k++) {
      const c = clone(model, (x) => {
        x.appearance.seed = 1000 + i * 500 + k;
      });
      const look = portraitLook(c);
      if (look.clothesIndex === i && look.accessory === 'none') {
        outfitCards.push({ s: c, label: `clothes: ${name}` });
        break;
      }
    }
  });
  for (const g of GEAR) {
    outfitCards.push({ s: clone(model, (c) => void (c.equipment[g.slot] = item(g.id))), label: `${g.slot}: ${g.name}` });
  }
  for (const acc of ['goggles', 'bandana', 'beanie']) {
    for (let k = 0; k < 500; k++) {
      const c = clone(model, (x) => {
        x.appearance.seed = 5000 + k;
        x.appearance.hairStyle = 5;
      });
      if (portraitLook(c).accessory === acc) {
        outfitCards.push({ s: c, label: `accessory: ${acc}` });
        break;
      }
    }
  }

  const hero = fresh();
  hero.equipment = { weapon: item('hunting_rifle') };
  hero.traits = [];
  hero.stress = 10;
  const life: Card[] = [
    { s: hero, label: 'day 1' },
    { s: clone(hero, (c) => void (c.equipment.armor = item('leather_jacket'))), label: 'finds a jacket' },
    { s: clone(hero, (c) => void c.traits.push(trait('wounded'))), label: 'Wounded' },
    { s: clone(hero, (c) => void c.traits.push(trait('badly_wounded'))), label: 'Badly Wounded' },
    { s: clone(hero, (c) => void c.traits.push(trait('scarred_face'))), label: 'Scarred Face' },
    { s: clone(hero, (c) => void c.traits.push(trait('lost_eye'))), label: 'Lost Eye' },
    { s: clone(hero, (c) => void c.traits.push(trait('burn_scars'))), label: 'Burn Scars' },
    { s: clone(hero, (c) => void c.traits.push(trait('rad_sickness'))), label: 'Rad Sickness' },
    { s: clone(hero, (c) => void (c.stress = 85)), label: 'stress 85' },
    { s: clone(hero, (c) => void c.traits.push(trait('haunted'), trait('grieving'))), label: 'Haunted, Grieving' },
    {
      s: clone(hero, (c) => {
        c.age += 25;
        c.equipment = { weapon: item('crossbow'), armor: item('scrap_vest'), tool: item('binoculars'), trinket: item('dog_tags') };
        c.traits.push(trait('lost_eye'), trait('scarred_face'), trait('burn_scars'));
        c.stress = 80;
      }),
      label: '25 years on',
    },
    { s: hero, label: 'on the Memorial Wall', memorial: true },
  ];
  void getTrait;
  return [
    { title: 'Random survivors', cards: random },
    { title: 'Hair styles', cards: hairCards },
    { title: 'Clothes, gear and accessories', cards: outfitCards },
    { title: `One life: ${hero.firstName} ${hero.lastName}`, cards: life },
  ];
}

if (import.meta.main) {
  let html = `<!doctype html><meta charset="utf-8"><title>The Guild - portraits</title><style>
body{font-family:Georgia,serif;background:#d9ccb0;color:#2b2420;margin:16px}
h2{margin:28px 0 10px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
figure{margin:0;background:#eadfc8;border:2px solid #2b2420;border-radius:6px;overflow:hidden}
figure svg{display:block;width:100%;height:auto}figcaption{font-size:12px;padding:5px 6px;border-top:2px solid #2b2420}
</style><h1>The Guild: portraits</h1><p>Seed: ${seed}</p>`;
  for (const section of sections()) {
    html += `<h2>${section.title}</h2><div class="grid">`;
    for (const card of section.cards) {
      html += `<figure>${portraitSvg(card.s, card.memorial ? { memorial: true } : {})}<figcaption>${card.label}</figcaption></figure>`;
    }
    html += '</div>';
  }
  mkdirSync('out', { recursive: true });
  writeFileSync('out/portraits.html', html);
  console.log('Wrote out/portraits.html');
}
