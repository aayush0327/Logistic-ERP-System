import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    const ordersServiceUrl = process.env.ORDERS_SERVICE_URL || 'http://localhost:8003';

    return [
      // Due Days endpoints - rewrite to orders service
      {
        source: '/api/due-days/:path*',
        destination: `${ordersServiceUrl}/api/v1/due-days/:path*`,
      },
      // Orders endpoints
      {
        source: '/api/orders/:path*',
        destination: `${ordersServiceUrl}/api/v1/orders/:path*`,
      },
    ];
  },
};

export default nextConfig;
