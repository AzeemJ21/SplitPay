type CardDetails = {
  number: string;
  expiry?: string;
  cvv?: string;
};

export type ChargeResult = {
  success: boolean;
  transactionId: string;
};

export type CardChargeOptions = {
  /**
   * When true, the charge always succeeds (used for the customer’s first-ever
   * completed split payment from the store so the first checkout cannot decline).
   */
  forceSuccess?: boolean;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulated card capture. Cards starting with `0000` decline unless `forceSuccess`.
 */
export async function processCardCharge(
  cardDetails: CardDetails,
  amount: number,
  options?: CardChargeOptions,
): Promise<ChargeResult> {
  await delay(200);

  if (options?.forceSuccess) {
    return {
      success: true,
      transactionId: `txn_forced_${Math.random().toString(36).slice(2, 10)}_${Math.floor(amount * 100)}`,
    };
  }

  if (cardDetails.number.replace(/\s/g, "").startsWith("0000")) {
    return {
      success: false,
      transactionId: `fail_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  return {
    success: true,
    transactionId: `txn_${Math.random().toString(36).slice(2, 10)}_${Math.floor(amount * 100)}`,
  };
}

/**
 * Simulated reversal of a prior successful card charge (e.g. roll back card 1 when card 2 fails).
 * Cards starting with `1111` simulate a reversal failure for testing.
 */
export async function processCardRefund(
  cardDetails: CardDetails,
  amount: number,
): Promise<ChargeResult> {
  await delay(200);

  if (cardDetails.number.replace(/\s/g, "").startsWith("1111")) {
    return {
      success: false,
      transactionId: `rev_fail_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  return {
    success: true,
    transactionId: `rev_${Math.random().toString(36).slice(2, 10)}_${Math.floor(amount * 100)}`,
  };
}
