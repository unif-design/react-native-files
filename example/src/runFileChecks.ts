import {
  clearLocalDirectory,
  copyLocalFile,
  createLocalFileLifetime,
  createLocalResourceAccess,
  deleteLocalFile,
  downloadLocalFile,
  getLocalDirectorySize,
  getLocalFileSize,
  getNativeTemporaryRoot,
  readLocalFile,
  writeLocalFile,
} from '@unif/react-native-files';

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

export async function runFileChecks(): Promise<string[]> {
  const root = getNativeTemporaryRoot();
  check(root, '当前平台没有原生文件根目录');
  const rootUri = `${root}/UnifFilesExample`;
  const sourceUri = `${rootUri}/hello%20%E6%96%87%E4%BB%B6.txt`;
  const targetUri = `${rootUri}/copy.txt`;
  const downloadUri = `${rootUri}/download.txt`;
  const results: string[] = [];
  const access = createLocalResourceAccess({ rootUri });
  try {
    check(
      (await clearLocalDirectory(rootUri)).status === 'success',
      '准备目录失败',
    );
    check(
      (await writeLocalFile({ uri: sourceUri, content: 'hello' })).status ===
        'success',
      '写入失败',
    );
    const read = await readLocalFile({ uri: sourceUri, encoding: 'utf8' });
    check(
      read.status === 'success' && read.content === 'hello',
      '读取内容不一致',
    );
    const size = await getLocalFileSize(sourceUri);
    check(size.status === 'success' && size.sizeBytes === 5, '文件大小不一致');
    results.push('通过：原生 UTF-8 读写、中文与空格路径、实际大小');

    check(
      (await copyLocalFile({ sourceUri, targetUri })).status === 'success',
      '复制失败',
    );
    check(
      (await copyLocalFile({ sourceUri, targetUri })).status === 'failed',
      '重复复制不应覆盖',
    );
    const directorySize = await getLocalDirectorySize(rootUri);
    check(
      directorySize.status === 'success' && directorySize.sizeBytes === 10,
      '目录大小不一致',
    );
    results.push('通过：复制、拒绝覆盖与目录统计');

    const url = await access.getUrl(sourceUri);
    check(url.status === 'success', '回环服务启动失败');
    const response = await fetch(url.url);
    check(
      response.ok && (await response.text()) === 'hello',
      '回环 HTTP 读取失败',
    );
    const download = await downloadLocalFile({
      sourceUrl: url.url,
      targetUri: downloadUri,
      maxBytes: 5,
    });
    check(
      download.status === 'success' && download.sizeBytes === 5,
      '原生下载失败',
    );
    const outside = await access.getUrl(`${root}/outside.txt`);
    check(
      outside.status === 'failed' && outside.error.reason === 'outside_root',
      '公开根目录边界失效',
    );
    results.push('通过：真实回环 HTTP、RNFS 下载与根目录边界');

    const controller = new AbortController();
    controller.abort();
    const cancelled = await downloadLocalFile(
      { sourceUrl: url.url, targetUri: `${rootUri}/cancelled.txt` },
      { signal: controller.signal },
    );
    check(cancelled.status === 'cancelled', '预取消语义不一致');
    check((await deleteLocalFile(targetUri)).status === 'success', '删除失败');
    let cleanups = 0;
    const lifetime = createLocalFileLifetime(() => {
      cleanups += 1;
    });
    const release = lifetime.retain();
    lifetime.retire();
    check(cleanups === 0, '持有期间不应清理');
    release?.();
    release?.();
    check(Number(cleanups) === 1, '清理必须且只能执行一次');
    results.push('通过：预取消、单文件删除与持有后清理');
  } finally {
    const closed = await access.close();
    check(closed.status === 'success', '回环服务未确认停止');
    const cleared = await clearLocalDirectory(rootUri);
    check(cleared.status === 'success', '示例文件未完全清理');
  }
  const rootDelete = await deleteLocalFile(rootUri);
  check(
    rootDelete.status === 'failed' &&
      rootDelete.error.reason === 'invalid_input',
    '清理后根目录应继续存在',
  );
  results.push('通过：服务关闭、目录内容清理与根目录保留');
  return results;
}
