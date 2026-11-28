/**
 * Draws the app icon and the splash screen into assets/ from the game's mark (src/scene/logo.ts), with the
 * stencil font from node_modules. Needs puppeteer and Chrome (a dev tool, like tools/audio).
 *
 *     node tools/brand/make.mjs
 *
 * Then generate Android's icons and splashes from assets/ (docs/ANDROID.md).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, LOGO_COLORS, logoMarkSvg } from '../../src/scene/logo.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const puppeteer = await import('puppeteer').catch(() => import('/opt/npm-tools/node_modules/puppeteer/lib/puppeteer/puppeteer.js'));
const font = readFileSync(join(root, 'node_modules/@fontsource-variable/big-shoulders-stencil/files/big-shoulders-stencil-latin-wght-normal.woff2')).toString('base64');
const face = `@font-face{font-family:Stencil;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}html,body{margin:0}`;
const mark = (o = {}) => logoMarkSvg({ font: 'Stencil', ...o });

const browser = await puppeteer.default.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
async function draw(path, size, body, clear = false) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<style>${face}</style>${body}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'assets', path), omitBackground: clear });
  console.log(path);
}
// The icon: the mark on steel, filling it; and for Android's adaptive icon, the mark alone in the middle half.
await draw('icon-only.png', 1024, mark({ background: true, size: 1024 }));
await draw('icon-foreground.png', 1024, `<div style="width:1024px;height:1024px;display:grid;place-items:center">${mark({ size: 512 })}</div>`, true);
// The splash: the mark and the name.
const splash = `<div style="width:2732px;height:2732px;background:${LOGO_COLORS.steel};display:grid;place-content:center;justify-items:center;gap:40px">${mark({ size: 640 })}<div style="font-family:Stencil;font-weight:800;font-size:210px;line-height:1;color:${LOGO_COLORS.bone}">${GAME_NAME}</div></div>`;
await draw('splash.png', 2732, splash);
await draw('splash-dark.png', 2732, splash);
await browser.close();
