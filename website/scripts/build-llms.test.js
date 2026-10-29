'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { buildBundle } = require('./llms/bundle');

const site = path.join(__dirname, '..');

test('Files 网站和 LLM 资料使用同一文档源', () => {
  assert.equal(
    fs.realpathSync(path.join(site, 'docs')),
    path.resolve(site, '../docs'),
  );
});

test('生成文档覆盖根入口的全部函数和公开类型', () => {
  const bundle = buildBundle({ root: site });
  const overview = bundle['md/api/overview.md'].toString('utf8');
  const types = bundle['md/api/types.md'].toString('utf8');
  const source = fs.readFileSync(path.join(site, '../src/index.ts'), 'utf8');
  const functions = [...source.matchAll(/export \{ (\w+) \} from /g)];
  const typeBlock = source.match(/export type \{([^}]+)\}/s);
  assert(functions.length > 0);
  assert(typeBlock);
  for (const [, name] of functions) {
    assert(overview.includes('`' + name + '`'), name);
  }
  for (const name of typeBlock[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    assert(new RegExp(`\\b(?:interface|type) ${name}\\b`).test(types), name);
  }
});
