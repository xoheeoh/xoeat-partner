let setLoadingFunc: ((loading: boolean) => void) | null = null;
let loadingStartTime: number | null = null;

const MIN_LOADING_DURATION = 300; // 최소 0.3초 유지

export const loadingController = {
  register: (fn: (loading: boolean) => void) => {
    setLoadingFunc = fn;
  },
  start: () => {
    loadingStartTime = Date.now();
    setLoadingFunc?.(true);
  },
  stop: () => {
    const now = Date.now();

    if (loadingStartTime) {
      const elapsed = now - loadingStartTime;

      if (elapsed < MIN_LOADING_DURATION) {
        const delay = MIN_LOADING_DURATION - elapsed;
        setTimeout(() => {
          setLoadingFunc?.(false);
          loadingStartTime = null;
        }, delay);
      } else {
        setLoadingFunc?.(false);
        loadingStartTime = null;
      }
    } else {
      setLoadingFunc?.(false);
    }
  },
};
