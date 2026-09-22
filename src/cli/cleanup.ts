const cleaners = new Set<() => Promise<void> | void>();
let installed = false;

export function registerCleanup(fn: () => Promise<void> | void): () => void {
  cleaners.add(fn);
  return () => {
    cleaners.delete(fn);
  };
}

export async function runCleanup(): Promise<void> {
  const list = [...cleaners].reverse();
  cleaners.clear();
  for (const fn of list) {
    try {
      await fn();
    } catch {
      // Owned cleanup must not throw past the original error.
    }
  }
}

export function installSignalCleanup(): void {
  if (installed) return;
  installed = true;
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      void runCleanup().finally(() => {
        process.exit(signal === "SIGINT" ? 130 : 143);
      });
    });
  }
}
