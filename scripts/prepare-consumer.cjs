const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

function parseArgs(args) {
  if (args.length === 0) return {};
  assert(
    args.length === 2 &&
      args[0] === '--output' &&
      args[1].trim() &&
      !args[1].startsWith('--'),
    '用法：node scripts/prepare-consumer.cjs [--output 全新目录]',
  );
  return { output: args[1] };
}

function readPackResult(json, packageName) {
  const packed = Object.values(JSON.parse(json));
  assert.equal(packed.length, 1, 'npm pack 必须生成且只生成本库 tarball');
  assert.equal(packed[0].name, packageName, 'npm pack 返回了其他包');
  return packed[0];
}

function installedVersion(fromDirectory, name) {
  const requireFrom = createRequire(path.join(fromDirectory, 'package.json'));
  const manifest = requireFrom.resolve
    .paths(name)
    .map((directory) => path.join(directory, name, 'package.json'))
    .find((filename) => fs.existsSync(filename));
  assert(manifest, `${name}: 未安装，不能确定干净消费者使用的精确版本`);
  return JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
}

function createOutput(output, libraryRoot) {
  const root = fs.realpathSync(libraryRoot);
  if (!output)
    return fs.mkdtempSync(
      path.join(
        fs.realpathSync(os.tmpdir()),
        'unif-react-native-files-consumer-',
      ),
    );
  const requested = path.resolve(output);
  const target = path.join(
    fs.realpathSync(path.dirname(requested)),
    path.basename(requested),
  );
  const relative = path.relative(root, target);
  assert(
    relative &&
      (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)),
    '消费者输出目录必须位于库目录之外',
  );
  // Exclusive creation preserves any existing directory, including failed runs.
  fs.mkdirSync(target);
  return fs.realpathSync(target);
}

function copyExample(exampleRoot, output) {
  const excluded = new Set([
    'build',
    'Pods',
    'vendor',
    'node_modules',
    'local.properties',
    '.xcode.env.local',
    '.gradle',
    '.cxx',
    '.kotlin',
    '.git',
    '.DS_Store',
  ]);
  for (const name of [
    'src',
    'index.js',
    'app.json',
    'android',
    'ios',
    'Gemfile',
    '.bundle',
  ]) {
    fs.cpSync(path.join(exampleRoot, name), path.join(output, name), {
      recursive: true,
      filter(source) {
        if (excluded.has(path.basename(source))) return false;
        assert(
          !fs.lstatSync(source).isSymbolicLink(),
          `示例不能包含链接：${path.relative(exampleRoot, source)}`,
        );
        return true;
      },
    });
  }
}

function run(command, args, cwd, capture = false) {
  const env = { ...process.env };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture)
      process.stderr.write(`${result.stdout || ''}${result.stderr || ''}`);
    throw new Error(
      `${command} ${args.join(' ')} 失败（${result.status ?? result.signal}）`,
    );
  }
  return result.stdout;
}

const browserCheck = `
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as files from '@unif/react-native-files';
const entry = fileURLToPath(import.meta.resolve('@unif/react-native-files'));
assert(entry.endsWith('/lib/module/index.web.js'), entry);
assert.deepEqual(Object.keys(files).sort(), [
  'clearLocalDirectory', 'copyLocalFile', 'createLocalFileLifetime',
  'createLocalResourceAccess', 'deleteLocalFile', 'downloadLocalFile',
  'getLocalDirectorySize', 'getLocalFileSize', 'getNativeTemporaryRoot',
  'readLocalFile', 'writeLocalFile',
]);
for (const value of Object.values(files)) assert.equal(typeof value, 'function');
const uri = 'file:///fixture/file';
assert.equal(files.getNativeTemporaryRoot(), undefined);
for (const pending of [
  files.copyLocalFile({ sourceUri: uri, targetUri: uri + '-copy' }),
  files.deleteLocalFile(uri), files.getLocalDirectorySize('file:///fixture'),
  files.getLocalFileSize(uri), files.readLocalFile({ uri, encoding: 'utf8' }),
  files.writeLocalFile({ uri, content: '' }), files.clearLocalDirectory('file:///fixture'),
  files.downloadLocalFile({ sourceUrl: 'https://example.invalid/file', targetUri: uri }),
]) {
  const result = await pending;
  assert.equal(result.status, 'failed');
  assert.equal(result.error.reason, 'unsupported');
}
const controller = new AbortController();
controller.abort();
assert.deepEqual(await files.downloadLocalFile({ sourceUrl: 'https://example.invalid/file', targetUri: uri }, { signal: controller.signal }), { status: 'cancelled' });
const access = files.createLocalResourceAccess({ rootUri: 'file:///fixture' });
assert.equal((await access.getUrl(uri)).error.reason, 'unsupported');
assert.equal((await access.getUrl('file:///outside/file')).error.reason, 'outside_root');
assert.equal((await access.close()).error.reason, 'unsupported');
let cleaned = 0;
const lifetime = files.createLocalFileLifetime(() => { cleaned += 1; });
const release = lifetime.retain();
assert.equal(typeof release, 'function');
lifetime.retire();
assert.equal(cleaned, 0);
release(); release(); lifetime.retire();
assert.equal(cleaned, 1);
assert.equal(lifetime.retain(), undefined);
console.log(JSON.stringify({ browserEntry: entry, functions: 11, status: 'passed' }));
`;

function prepareConsumer(args) {
  const root = path.resolve(__dirname, '..');
  const output = createOutput(parseArgs(args).output, root);
  console.log(`消费者目录：${output}`);
  const exampleRoot = path.join(root, 'example');
  const library = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  const example = JSON.parse(
    fs.readFileSync(path.join(exampleRoot, 'package.json'), 'utf8'),
  );
  for (const file of [
    library.main,
    library.types,
    library.exports['.'].browser,
  ]) {
    assert(
      fs.statSync(path.join(root, file)).isFile(),
      `缺少构建产物：${file}，请先运行构建`,
    );
  }
  copyExample(exampleRoot, output);
  const artifacts = path.join(output, 'artifacts');
  fs.mkdirSync(artifacts);
  const packed = readPackResult(
    run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', artifacts],
      root,
      true,
    ),
    library.name,
  );
  assert(
    !packed.files.some((file) => file.path.endsWith('.patch')),
    'npm tarball 不应分发应用维护的补丁',
  );
  const tarball = path.join(artifacts, path.basename(packed.filename));
  const bytes = fs.readFileSync(tarball);
  const integrity = `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
  assert.equal(integrity, packed.integrity, 'tarball 完整性不匹配');

  const exactVersion = (name) => installedVersion(exampleRoot, name);
  const dependencies = {};
  for (const [name, version] of Object.entries(example.dependencies)) {
    if (name === library.name) continue;
    assert(
      !version.startsWith('workspace:'),
      `无法为额外 workspace 依赖 ${name} 生成干净消费者`,
    );
    dependencies[name] = exactVersion(name);
    if (/^\d+\.\d+\.\d+$/.test(version))
      assert.equal(
        dependencies[name],
        version,
        `${name}: 已安装版本偏离示例固定版本`,
      );
  }
  dependencies[library.name] = `file:./artifacts/${path.basename(tarball)}`;
  const devDependencies = Object.fromEntries(
    [
      '@babel/core',
      '@babel/runtime',
      '@react-native-community/cli',
      '@react-native-community/cli-platform-android',
      '@react-native-community/cli-platform-ios',
      '@react-native/babel-preset',
      '@react-native/metro-config',
      '@react-native/typescript-config',
      '@types/react',
      'typescript',
      'patch-package',
    ].map((name) => [name, exactVersion(name)]),
  );
  const manifest = {
    name: 'unif-react-native-files-consumer',
    version: '0.0.0',
    private: true,
    scripts: example.scripts,
    dependencies,
    devDependencies,
  };
  fs.writeFileSync(
    path.join(output, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(output, 'metro.config.js'),
    "const { getDefaultConfig } = require('@react-native/metro-config');\nmodule.exports = getDefaultConfig(__dirname);\n",
  );
  fs.writeFileSync(
    path.join(output, 'babel.config.js'),
    "module.exports = { presets: ['module:@react-native/babel-preset'] };\n",
  );
  fs.writeFileSync(
    path.join(output, 'tsconfig.json'),
    `${JSON.stringify(
      {
        extends: '@react-native/typescript-config',
        compilerOptions: { strict: true, noEmit: true, types: ['react'] },
        include: ['src/**/*.ts', 'src/**/*.tsx', 'consumer.ts'],
        exclude: ['node_modules'],
      },
      null,
      2,
    )}\n`,
  );
  fs.copyFileSync(
    path.join(__dirname, 'fixtures/consumer.ts'),
    path.join(output, 'consumer.ts'),
  );
  fs.writeFileSync(path.join(output, 'verify-browser.mjs'), browserCheck);

  run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
    output,
  );
  const requireFromConsumer = createRequire(path.join(output, 'package.json'));
  const installedRoot = fs.realpathSync(
    path.dirname(requireFromConsumer.resolve(`${library.name}/package.json`)),
  );
  assert(
    installedRoot.startsWith(
      `${fs.realpathSync(path.join(output, 'node_modules'))}${path.sep}`,
    ),
    '消费者必须解析安装的 tarball，不能使用源码链接',
  );
  const typeOutput = run(
    process.execPath,
    [
      requireFromConsumer.resolve('typescript/bin/tsc'),
      '--noEmit',
      '--listFiles',
    ],
    output,
    true,
  );
  const typeEntry = path.join(installedRoot, library.types);
  assert(
    typeOutput.split(/\r?\n/).includes(typeEntry),
    `类型检查没有消费包内公开声明：${typeEntry}`,
  );
  assert(
    !typeOutput
      .split(/\r?\n/)
      .some((file) => file.startsWith(`${installedRoot}/src/`)),
    '类型检查意外解析了未打包源码入口',
  );
  run(process.execPath, ['--conditions=browser', 'verify-browser.mjs'], output);
  const summary = {
    consumer: output,
    package: `${library.name}@${library.version}`,
    tarball,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    integrity,
    typeEntry,
    checks: {
      types: 'passed',
      browser: 'passed',
      nativePatchContents: 'not_checked',
    },
  };
  fs.writeFileSync(
    path.join(output, 'consumer-verification.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    '原生补丁未应用；由宿主显式准备后，运行 check-native-patches.cjs --patch-dir <补丁目录> --consumer <消费者目录> 只读核对。',
  );
  return summary;
}

if (require.main === module) {
  try {
    prepareConsumer(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  readPackResult,
  installedVersion,
  createOutput,
  copyExample,
  prepareConsumer,
};
