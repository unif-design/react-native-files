const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  createOutput,
  copyExample,
  parseArgs,
  readPackResult,
  installedVersion,
} = require('./prepare-consumer.cjs');
const {
  readPatches,
  parsePatchArgs,
  checkInstalledPatches,
} = require('./check-native-patches.cjs');

function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'files-script-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, filename, content = 'fixture') {
  const target = path.join(root, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

test('打包结果接受 npm 的数组与包名对象格式，拒绝其他包和多个包', () => {
  const packed = { name: '@unif/react-native-files', filename: 'files.tgz' };
  for (const result of [[packed], { '@unif/react-native-files': packed }]) {
    assert.deepEqual(
      readPackResult(JSON.stringify(result), packed.name),
      packed,
    );
  }
  assert.throws(() =>
    readPackResult(JSON.stringify([packed, packed]), packed.name),
  );
  assert.throws(() =>
    readPackResult(JSON.stringify([{ name: 'other' }]), packed.name),
  );
});

test('精确版本读取支持不公开 package.json 的已安装包，且不执行包入口', (t) => {
  const root = temporary(t);
  write(root, 'package.json', '{}');
  write(
    root,
    'node_modules/fixture-sdk/package.json',
    JSON.stringify({
      name: 'fixture-sdk',
      version: '1.2.3',
      exports: './index.js',
    }),
  );
  write(
    root,
    'node_modules/fixture-sdk/index.js',
    'throw new Error("must not execute")',
  );
  assert.equal(installedVersion(root, 'fixture-sdk'), '1.2.3');
  assert.throws(() => installedVersion(root, 'missing-sdk'), /未安装/);
});

test('输出参数拒绝未知、重复、缺失和空路径', () => {
  assert.deepEqual(parseArgs([]), {});
  assert.deepEqual(parseArgs(['--output', '/tmp/consumer with spaces']), {
    output: '/tmp/consumer with spaces',
  });
  for (const args of [
    ['--unknown'],
    ['--output'],
    ['--output', ''],
    ['--output', '--unknown'],
    ['--output', '/tmp/a', '--output', '/tmp/b'],
  ]) {
    assert.throws(() => parseArgs(args));
  }
});

test('只创建库外全新目录，不覆盖已有文件或经父目录链接落入库中', (t) => {
  const root = temporary(t);
  const library = path.join(root, 'library');
  fs.mkdirSync(library);
  write(library, 'keep.txt', 'keep');
  assert.throws(() => createOutput(library, library));
  assert.throws(() => createOutput(path.join(library, 'consumer'), library));
  fs.symlinkSync(library, path.join(root, 'alias'), 'dir');
  assert.throws(() =>
    createOutput(path.join(root, 'alias', 'consumer'), library),
  );
  assert.equal(fs.readFileSync(path.join(library, 'keep.txt'), 'utf8'), 'keep');
  const destination = path.join(root, 'consumer with spaces');
  assert.equal(
    createOutput(destination, library),
    fs.realpathSync(destination),
  );
  assert.throws(() => createOutput(destination, library));
});

test('复制原生示例保留源文件并排除依赖、构建和本机配置', (t) => {
  const root = temporary(t);
  const example = path.join(root, 'example');
  const output = path.join(root, 'consumer');
  const included = [
    'src/App.tsx',
    'index.js',
    'app.json',
    'Gemfile',
    '.bundle/config',
    'android/gradlew',
    'android/app/src/main/AndroidManifest.xml',
    'ios/Podfile',
  ];
  const excluded = [
    'android/build/result',
    'android/app/build/result',
    'ios/Pods/pod',
    'ios/build/result',
    'vendor/bundle/gem',
    'node_modules/package/index.js',
    'android/local.properties',
    'ios/.xcode.env.local',
    'android/.gradle/cache',
    'android/app/.cxx/Debug/CMakeCache.txt',
    'android/.kotlin/sessions/state',
  ];
  for (const name of [...included, ...excluded]) write(example, name);
  fs.mkdirSync(output);
  copyExample(example, output);
  for (const name of included)
    assert.equal(fs.readFileSync(path.join(output, name), 'utf8'), 'fixture');
  for (const name of excluded) {
    assert.equal(fs.existsSync(path.join(output, name)), false, name);
    assert.equal(fs.existsSync(path.join(example, name)), true, name);
  }
});

test('复制不接受指向示例外部的链接', (t) => {
  const root = temporary(t);
  const example = path.join(root, 'example');
  write(root, 'outside.txt');
  fs.mkdirSync(path.join(example, 'src'), { recursive: true });
  fs.symlinkSync(
    path.join(root, 'outside.txt'),
    path.join(example, 'src', 'outside.ts'),
  );
  assert.throws(
    () => copyExample(example, path.join(root, 'consumer')),
    /链接/,
  );
});

function patchFixture(root) {
  for (const [name, version] of [
    ['@dr.pogodin/react-native-fs', '2.41.0'],
    ['@dr.pogodin/react-native-static-server', '0.28.1'],
  ]) {
    const filename = `${name.replace('/', '+')}+${version}.patch`;
    const prefix = `node_modules/${name}/`;
    const patch = `diff --git a/${prefix}native.txt b/${prefix}native.txt\nindex 7898192..e69de29 100644\n--- a/${prefix}native.txt\n+++ b/${prefix}native.txt\n@@ -1 +0,0 @@\n-a\n`;
    write(root, `patches/${filename}`, patch);
    write(root, `${prefix}package.json`, JSON.stringify({ name, version }));
    write(root, `${prefix}native.txt`, '');
  }
  write(root, 'package.json', '{}');
  write(
    root,
    'node_modules/@unif/react-native-files/package.json',
    JSON.stringify({ name: '@unif/react-native-files', version: '0.0.0' }),
  );
}

test('逐文件核对真实解析 SDK 的补丁后字节，原生内容改变必须失败', (t) => {
  const root = temporary(t);
  patchFixture(root);
  const patches = readPatches(path.join(root, 'patches'));
  const report = checkInstalledPatches(root, patches);
  assert.equal(report.length, 2);
  assert.equal(
    report[0].files[0].blobHash,
    'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
  );
  write(root, 'node_modules/@dr.pogodin/react-native-fs/native.txt', 'changed');
  assert.throws(() => checkInstalledPatches(root, patches), /补丁后内容/);
});

test('消费者顶层已补丁但 Files 实际使用未补丁嵌套副本时必须失败', (t) => {
  const root = temporary(t);
  patchFixture(root);
  const nested =
    'node_modules/@unif/react-native-files/node_modules/@dr.pogodin/react-native-fs';
  write(
    root,
    `${nested}/package.json`,
    JSON.stringify({ name: '@dr.pogodin/react-native-fs', version: '2.41.0' }),
  );
  write(root, `${nested}/native.txt`, 'unpatched');
  const patches = readPatches(path.join(root, 'patches'));
  assert.throws(() => checkInstalledPatches(root, patches), /补丁后内容/);
  write(root, `${nested}/native.txt`, '');
  const report = checkInstalledPatches(root, patches);
  assert.equal(
    report.filter((item) => item.name === '@dr.pogodin/react-native-fs').length,
    2,
  );
  assert.equal(
    report.filter(
      (item) => item.name === '@dr.pogodin/react-native-static-server',
    ).length,
    1,
  );
});

test('检查补丁必须显式指定目录，拒绝缺失、重复和未知参数', () => {
  assert.deepEqual(
    parsePatchArgs([
      '--patch-dir',
      '/tmp/patches',
      '--consumer',
      '/tmp/consumer',
    ]),
    { patchDir: '/tmp/patches', consumer: '/tmp/consumer' },
  );
  for (const args of [
    [],
    ['--patch-dir'],
    ['--patch-dir', ''],
    ['--consumer', '/tmp/consumer'],
    ['--patch-dir', '/tmp/a', '--patch-dir', '/tmp/b'],
    ['--patch-dir', '/tmp/a', '--unknown', '/tmp/b'],
  ]) {
    assert.throws(() => parsePatchArgs(args));
  }
});

test('补丁不能把验证目标指到 SDK 目录外', (t) => {
  const root = temporary(t);
  patchFixture(root);
  const filename = path.join(
    root,
    'patches/@dr.pogodin+react-native-fs+2.41.0.patch',
  );
  fs.writeFileSync(
    filename,
    fs
      .readFileSync(filename, 'utf8')
      .replaceAll('native.txt', '../outside.txt'),
  );
  assert.throws(() => readPatches(path.join(root, 'patches')), /路径/);
});
