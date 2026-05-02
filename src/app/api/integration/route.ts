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

  const body = {
    name: "SplitPay Dashboard",
    baseUrl: base,
    endpoints: {
      verifySplitCode: `${base}/api/users/verify-code`,
      splitPayment: `${base}/api/split-payment`,
    },
    headers: {
      splitPayment: {
        Authorization: "Bearer <merchant API key from dashboard → API Integration>",
        "Content-Type": "application/json",
      },
    },
    setup: {
      onDashboard: {
        NEXTAUTH_URL: base,
        STORE_URL: "<your store origin, e.g. https://splitpay-store.onrender.com — no trailing slash>",
      },
      onStore: {
        SPLITPAY_API_URL: base,
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
