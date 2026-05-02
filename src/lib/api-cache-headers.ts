/** Cache-Control for authenticated GET responses that are not real-time. */
export const CACHE_CONTROL_LIST = "s-maxage=30, stale-while-revalidate=59";

/** Financial / session-sensitive lists — avoid stale balances after payments. */
export const CACHE_CONTROL_PRIVATE_NO_STORE = "private, no-store, must-revalidate";
