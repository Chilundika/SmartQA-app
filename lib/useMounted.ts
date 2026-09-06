"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * false during SSR and hydration, true once running in the browser.
 * Lets components gate browser-only reads (localStorage, local clock) without a setState-in-effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
