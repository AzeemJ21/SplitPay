type CardDetails = {
  number: string;
  expiry?: string;
  cvv?: string;
};

type ChargeResult = {
  success: boolean;
  transactionId: string;
};

export async function processCardCharge(
  cardDetails: CardDetails,
  amount: number,
): Promise<ChargeResult> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  if (cardDetails.number.replace(/\s/g, "").startsWith("0000")) {
    return {
      success: false,
      transactionId: `fail_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  return {
    success: true,
    transactionId: `txn_${Math.random().toString(36).slice(2, 10)}_${Math.floor(amount)}`,
  };
}
