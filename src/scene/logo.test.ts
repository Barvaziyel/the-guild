import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CHAPTER, GAME_NAME, chapterLine, logoMarkSvg } from './logo.ts';

describe('the mark (3.15.1)', () => {
  test('the game is The Depot, and its first chapter is Haven', () => {
    assert.equal(GAME_NAME, 'The Depot');
    assert.equal(CHAPTER.name, 'Haven');
    assert.equal(chapterLine(), 'Chapter one: Haven');
  });

  test('a ring, a roof run out to it, and the D, named for screen readers', () => {
    const svg = logoMarkSvg();
    assert.match(svg, /^<svg[^>]*viewBox="0 0 1024 1024"/);
    assert.match(svg, /aria-label="The Depot"/);
    assert.match(svg, /class="logo-ring"/);
    assert.match(svg, /class="logo-roof" clip-path="url\(#logo-in\)"/);
    assert.match(svg, />D<\/text>/);
    assert.doesNotMatch(svg, /<rect/);
    assert.match(logoMarkSvg({ background: true, size: 64 }), /width="64" height="64"[^>]*><rect/);
  });
});
