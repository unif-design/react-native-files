const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const SDK_PATCHES = [
  ['@dr.pogodin/react-native-fs', '2.41.0'],
  ['@dr.pogodin/react-native-static-server', '0.28.1'],
];

function parsePatchArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    assert(
      (flag === '--patch-dir' || flag === '--consumer') &&
        typeof value === 'string' &&
        value.trim() &&
        !value.startsWith('--'),
      '用法：node scripts/check-native-patches.cjs --patch-dir 补丁目录 [--consumer 消费者目录]',
    );
    const key = flag === '--patch-dir' ? 'patchDir' : 'consumer';
    assert(!options[key], `重复参数：${flag}`);
    options[key] = value;
  }
  assert(options.patchDir, '必须显式提供 --patch-dir，不从库内寻找补丁');
  return options;
}

function readPatches(patchDirectory) {
  assert(
    typeof patchDirectory === 'string' && patchDirectory.trim(),
    '必须显式提供补丁目录',
  );
  return SDK_PATCHES.map(([name, version]) => {
    const filename = `${name.replace('/', '+')}+${version}.patch`;
    const original = fs.readFileSync(path.join(patchDirectory, filename));
    const prefix = `node_modules/${name}/`;
    const sections = original
      .toString('utf8')
      .split(/(?=^diff --git )/m)
      .filter(Boolean);
    const files = sections.map((section) => {
      const target = section.match(/^\+\+\+ b\/(.+)$/m)?.[1];
      const blobHash = section.match(
        /^index [a-f0-9]+\.\.([a-f0-9]{7,40})(?: |$)/m,
      )?.[1];
      assert(
        target?.startsWith(prefix) && blobHash,
        `${filename}: 补丁路径或 blob hash 无效`,
      );
      const relativePath = target.slice(prefix.length);
      assert(
        relativePath &&
          !relativePath.includes('\\') &&
          relativePath
            .split('/')
            .every((part) => part && part !== '.' && part !== '..'),
        `${filename}: 补丁路径越界`,
      );
      assert(
        section.startsWith(
          `diff --git a/${prefix}${relativePath} b/${prefix}${relativePath}\n`,
        ),
        `${filename}: 补丁路径不一致`,
      );
      return { relativePath, blobHash };
    });
    assert(files.length > 0, `${filename}: 没有可核对的补丁文件`);
    return {
      name,
      version,
      filename,
      sha256: crypto.createHash('sha256').update(original).digest('hex'),
      files,
    };
  });
}

function checkInstalledPatches(consumerRoot, patches) {
  const consumerManifest = path.join(
    path.resolve(consumerRoot),
    'package.json',
  );
  const requireFromConsumer = createRequire(consumerManifest);
  const origins = [
    ...new Set([
      fs.realpathSync(consumerManifest),
      fs.realpathSync(
        requireFromConsumer.resolve('@unif/react-native-files/package.json'),
      ),
    ]),
  ];
  return patches.flatMap((patch) => {
    const manifests = new Map();
    for (const origin of origins) {
      const manifestPath = fs.realpathSync(
        createRequire(origin).resolve(`${patch.name}/package.json`),
      );
      const resolvedFrom = manifests.get(manifestPath) ?? [];
      resolvedFrom.push(origin);
      manifests.set(manifestPath, resolvedFrom);
    }
    return [...manifests].map(([manifestPath, resolvedFrom]) => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(
        manifest.version,
        patch.version,
        `${patch.name}: 安装版本不符合补丁版本`,
      );
      const sdkRoot = fs.realpathSync(path.dirname(manifestPath));
      const files = patch.files.map((file) => {
        const target = fs.realpathSync(path.join(sdkRoot, file.relativePath));
        const relative = path.relative(sdkRoot, target);
        assert(
          relative &&
            !relative.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relative),
          `${patch.name}: 原生文件路径越界`,
        );
        const bytes = fs.readFileSync(target);
        const blobHash = crypto
          .createHash('sha1')
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest('hex');
        assert(
          blobHash.startsWith(file.blobHash),
          `${patch.name}/${file.relativePath}: 不是原补丁后内容，实际 ${blobHash}，预期 ${file.blobHash}（${sdkRoot}）`,
        );
        return {
          path: file.relativePath,
          blobHash,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        };
      });
      return {
        name: patch.name,
        version: manifest.version,
        patchSha256: patch.sha256,
        sdkRoot,
        resolvedFrom,
        files,
      };
    });
  });
}

if (require.main === module) {
  try {
    const options = parsePatchArgs(process.argv.slice(2));
    const root = path.resolve(__dirname, '..');
    const patches = readPatches(path.resolve(options.patchDir));
    console.log(
      JSON.stringify(
        options.consumer
          ? {
              consumer: checkInstalledPatches(
                path.resolve(options.consumer),
                patches,
              ),
            }
          : {
              root: checkInstalledPatches(root, patches),
              example: checkInstalledPatches(
                path.join(root, 'example'),
                patches,
              ),
            },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { parsePatchArgs, readPatches, checkInstalledPatches };
