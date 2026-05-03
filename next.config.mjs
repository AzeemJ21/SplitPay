/** @type {import('next').NextConfig} */
const storeOrigin = process.env.STORE_URL || "*";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/users/verify-code",
        headers: [
          { key: "Access-Control-Allow-Origin", value: storeOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
      {
        source: "/api/split-payment",
        headers: [
          { key: "Access-Control-Allow-Origin", value: storeOrigin },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
      {
        source: "/api/demo/store-purchase",
        headers: [
          { key: "Access-Control-Allow-Origin", value: storeOrigin },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, X-Demo-Store-Secret" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/projects", destination: "/dashboard/projects", permanent: false },
      { source: "/projects/:id", destination: "/dashboard/projects/:id", permanent: false },
      { source: "/milestones", destination: "/dashboard/milestones", permanent: false },
      { source: "/transactions", destination: "/dashboard/transactions", permanent: false },
      { source: "/settings", destination: "/dashboard/settings", permanent: false },
      { source: "/disputes", destination: "/dashboard/disputes", permanent: false },
      { source: "/disputes/:id", destination: "/dashboard/disputes/:id", permanent: false },
    ];
  },
};

export default nextConfig;
