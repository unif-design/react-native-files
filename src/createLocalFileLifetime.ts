import type { LocalFileLifetime } from './types';

export function createLocalFileLifetime(
  cleanup: () => void,
): LocalFileLifetime {
  let retired = false;
  let released = false;
  let holders = 0;
  const release = () => {
    if (!retired || holders || released) return;
    released = true;
    cleanup();
  };
  return {
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
    retire() {
      retired = true;
      release();
    },
  };
}
