import { NextResponse } from "next/server";

/**
 * Public discovery endpoint for the SplitPay storefront (or any client) to read
 * dashboard base URL and API paths. No secrets.
 *
 * CORS: allow any origin so a store on another domain can fetch this once at build/runtime.
 */
export async function GET(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    requestOrigin;

  const storeOrigin =
    process.env.STORE_URL?.replace(/\/$/, "") || "https://splitpay-store.onrender.com";

  const body = {
    name: "SplitPay Dashboard",
    baseUrl: base,
    endpoints: {
      verifySplitCode: `${base}/api/users/verify-code`,
      splitPayment: `${base}/api/split-payment`,
      demoStorePurchase: `${base}/api/demo/store-purchase`,
    },
    headers: {
      splitPayment: {
        Authorization: "Bearer <merchant API key from dashboard → API Integration>",
        "Content-Type": "application/json",
      },
      demoStorePurchase: {
        "Content-Type": "application/json",
        "X-Demo-Store-Secret": "<same value as DEMO_STORE_SECRET on dashboard and store>",
      },
    },
    setup: {
      onDashboard: {
        NEXTAUTH_URL: base,
        STORE_URL: storeOrigin,
        DEMO_STORE_SECRET: "<generate a shared secret>",
      },
      onStore: {
        SPLITPAY_API_URL: base,
        DEMO_STORE_SECRET: "<match dashboard DEMO_STORE_SECRET>",
      },
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
