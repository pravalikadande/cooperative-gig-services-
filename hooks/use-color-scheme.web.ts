import { useSyncExternalStore } from "react";

import { getGlobalColorScheme, subscribeToGlobalColorScheme } from "@/lib/theme-provider";

/**
 * Expo Router can evaluate web route modules before the provider tree renders.
 * Reading the provider context here caused the route to crash during startup.
 * The ThemeProvider publishes the same selected value through this external store.
 */
export function useColorScheme() {
  return useSyncExternalStore(subscribeToGlobalColorScheme, getGlobalColorScheme, getGlobalColorScheme);
}
