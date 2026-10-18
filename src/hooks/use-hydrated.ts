import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True once rendering on the client (false during SSR and hydration). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
