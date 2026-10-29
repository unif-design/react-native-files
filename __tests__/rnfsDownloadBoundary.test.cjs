// Execute the installed RNFS JavaScript wrapper; native methods remain controlled boundaries.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const sdkRoot = path.dirname(
  require.resolve('@dr.pogodin/react-native-fs/package.json'),
);
function fixture(download) {
  const subscriptions = [];
  const listen = (listener) => {
    const sub = {
      listener,
      removed: 0,
      remove() {
        this.removed++;
      },
    };
    subscriptions.push(sub);
    return sub;
  };
  const resumes = [];
  const native = {
    getConstants: () => ({}),
    downloadFile: download,
    onDownloadBegin: listen,
    onDownloadProgress: listen,
    onDownloadResumable: listen,
    resumeDownload: (id) => resumes.push(id),
  };
  const cache = new Map();
  function load(name) {
    if (name === './NativeReactNativeFs.js')
      return { __esModule: true, default: native };
    if (!name.startsWith('.')) return require(name);
    if (cache.has(name)) return cache.get(name);
    const filename = path.join(sdkRoot, 'lib/module', name);
    const source = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
      filename,
      configFile: false,
      babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
    const module = { exports: {} };
    cache.set(name, module.exports);
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, {
      filename,
    })(load, module, module.exports);
    return module.exports;
  }
  return { sdk: load('./index.js'), subscriptions, resumes };
}
for (const mode of ['success', 'failure', 'synchronous-start-failure']) {
  test(`RNFS JS ordinary ${mode} removes each event subscription once`, async () => {
    const error = new Error('controlled native terminal');
    let options;
    const f = fixture((input) => {
      options = input;
      if (mode === 'synchronous-start-failure') throw error;
      return mode === 'failure'
        ? Promise.reject(error)
        : Promise.resolve({
            jobId: input.jobId,
            statusCode: 200,
            bytesWritten: 1,
          });
    });
    const job = f.sdk.downloadFile({
      fromUrl: 'https://example.invalid/file',
      toFile: '/fixture/file',
      begin() {},
      progress() {},
    });
    if (mode === 'success') assert.equal((await job.promise).statusCode, 200);
    else await assert.rejects(job.promise, error);
    assert.equal(options.hasResumableCallback, false);
    assert.deepEqual(
      f.subscriptions.map((sub) => sub.removed),
      [1, 1],
    );
  });
}
test('RNFS JS resumable notification does not settle the original promise or release listeners', async () => {
  let finish;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let paused = 0,
    settled = false;
  const job = f.sdk.downloadFile({
    fromUrl: 'https://example.invalid/file',
    toFile: '/fixture/file',
    resumable() {
      paused++;
    },
  });
  job.promise.then(() => {
    settled = true;
  });
  f.subscriptions[0].listener({ jobId: job.jobId });
  await Promise.resolve();
  assert.equal(paused, 1);
  assert.equal(settled, false);
  assert.equal(f.subscriptions[0].removed, 0);
  f.sdk.resumeDownload(job.jobId);
  assert.deepEqual(f.resumes, [job.jobId]);
  finish({ jobId: job.jobId, statusCode: 200, bytesWritten: 1 });
  await job.promise;
  assert.equal(f.subscriptions[0].removed, 1);
});
