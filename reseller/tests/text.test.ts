import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeXml, fitLines, measureText, trimToLength, wrapText } from '../src/core/text.js';

describe('wrapText', () => {
  it('keeps every line within the requested width', () => {
    const text = 'Vintage Nike Air Max 90 Infrared Running Shoes Excellent Condition';
    const lines = wrapText(text, 900, 66, true);
    for (const line of lines) {
      assert.ok(
        measureText(line, 66, true) <= 900,
        `line overflowed: "${line}" = ${measureText(line, 66, true)}px`,
      );
    }
  });

  it('loses no words', () => {
    const text = 'Levi 501 straight leg dark wash denim jeans W32 L34';
    assert.equal(wrapText(text, 500, 40).join(' '), text);
  });

  it('hard-splits a token longer than the line', () => {
    const lines = wrapText('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 100, 40, true);
    assert.ok(lines.length > 1);
    assert.equal(lines.join(''), 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('returns nothing for empty input', () => {
    assert.deepEqual(wrapText('   ', 500, 40), []);
  });
});

describe('fitLines', () => {
  it('shrinks the font rather than exceeding the line budget', () => {
    const long =
      'Supreme Box Logo Hooded Sweatshirt FW17 Heather Grey Large Pre-Owned Very Good Condition';
    const fitted = fitLines(long, 940, 3, 66, 42, true);
    assert.ok(fitted.lines.length <= 3, `got ${fitted.lines.length} lines`);
    assert.ok(fitted.fontSize <= 66 && fitted.fontSize >= 42);
  });

  it('ellipsises when even the smallest size will not fit', () => {
    const absurd = 'word '.repeat(200);
    const fitted = fitLines(absurd, 300, 2, 40, 38, true);
    assert.equal(fitted.lines.length, 2);
    assert.ok(fitted.lines[1]?.endsWith('…'));
  });

  it('leaves a short title at full size on one line', () => {
    const fitted = fitLines('Nike Dunk Low', 940, 3, 66, 42, true);
    assert.equal(fitted.fontSize, 66);
    assert.deepEqual(fitted.lines, ['Nike Dunk Low']);
  });
});

describe('trimToLength', () => {
  it('breaks on a word boundary', () => {
    assert.equal(trimToLength('Vintage Nike Air Max Running Shoes', 20), 'Vintage Nike Air Max');
  });

  it('collapses whitespace', () => {
    assert.equal(trimToLength('  Nike   Air \n Max  ', 100), 'Nike Air Max');
  });

  it('never exceeds the limit', () => {
    const out = trimToLength('Supercalifragilisticexpialidocious', 10);
    assert.ok(out.length <= 10, out);
  });
});

describe('escapeXml', () => {
  it('escapes characters that would break an SVG text node', () => {
    assert.equal(
      escapeXml(`Tom & Jerry's <b>"tee"</b>`),
      'Tom &amp; Jerry&apos;s &lt;b&gt;&quot;tee&quot;&lt;/b&gt;',
    );
  });
});
