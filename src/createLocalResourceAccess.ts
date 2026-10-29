import StaticServer, {
  getActiveServer,
  STATES,
} from '@dr.pogodin/react-native-static-server';
import { LOCAL_FILE_MESSAGES, LOCAL_RESOURCE_HOSTNAME } from './constants';
import { localFileFailed } from './localFileFailed';
import {
  getLocalResourcePath,
  getLocalResourceRoot,
} from './localResourcePath';
import type {
  CloseLocalResourceResult,
  LocalResourceAccess,
  LocalResourceAccessInput,
} from './types';

export function createLocalResourceAccess(
  input: LocalResourceAccessInput,
): LocalResourceAccess {
  const rootPath = getLocalResourceRoot(input);
  let server: StaticServer | undefined;
  let starting: Promise<string> | undefined;
  let closing: Promise<CloseLocalResourceResult> | undefined;

  async function stop(): Promise<CloseLocalResourceResult> {
    if (!server) return { status: 'success' };
    try {
      // SDK stop shares its start semaphore, including a pending/failed start.
      const active = getActiveServer();
      if (active && active !== server) {
        return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceOccupied);
      }
      await server.stop();
      return { status: 'success' };
    } catch (cause) {
      return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceCloseFailed, {
        cause,
      });
    }
  }

  return {
    async getUrl(uri) {
      if (closing)
        return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceClosed);
      const path = getLocalResourcePath(rootPath, uri);
      if (typeof path !== 'string') return path;

      const active = getActiveServer();
      if (active && active !== server) {
        return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceOccupied);
      }
      try {
        server ??= new StaticServer({
          fileDir: rootPath,
          hostname: LOCAL_RESOURCE_HOSTNAME,
          port: 0,
        });
        if (!starting && server.state !== STATES.ACTIVE) {
          starting = server.start().finally(() => {
            starting = undefined;
          });
        }
        if (starting) await starting;
        if (closing)
          return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceClosed);
        if (server.state !== STATES.ACTIVE) {
          return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceUnavailable);
        }
        return { status: 'success', url: `${server.origin}/${path}` };
      } catch (cause) {
        return localFileFailed('io', LOCAL_FILE_MESSAGES.resourceUnavailable, {
          cause,
        });
      }
    },
    close() {
      closing ??= stop();
      return closing;
    },
  };
}
