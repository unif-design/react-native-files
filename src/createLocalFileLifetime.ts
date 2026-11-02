import type { LocalFileLifetime } from './types';

export function createLocalFileLifetime(
  cleanup: () => void,
): LocalFileLifetime {
  let retired = false;
  let released = false;
  let holders = 0;
  let reading = false;
  const release = () => {
    if (!retired || holders || released) return;
    released = true;
    cleanup();
  };
  const lifetime: LocalFileLifetime = {
    retain() {
      if (released) return;
      holders++;
      let retained = true;
      return () => {
        if (!retained) return;
        retained = false;
        holders--;
        release();
      };
    },
    retainRead() {
      if (retired || reading) return;
      const releaseRead = lifetime.retain();
      if (!releaseRead) return;
      reading = true;
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        reading = false;
        releaseRead();
      };
    },
    isReading: () => reading,
    retire() {
      retired = true;
      release();
    },
  };
  return lifetime;
}
