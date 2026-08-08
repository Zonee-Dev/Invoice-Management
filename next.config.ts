import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const isProd = process.env.NODE_ENV === "production";
const isCapacitor = process.env.CAPACITOR_BUILD === "true";

const withPWA = withPWAInit({
  dest: "public",
  disable: !isProd,
});

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd && !isCapacitor ? "/website-invoice-management" : undefined,
  images: {
    unoptimized: true,
  },
  turbopack: {},
};

export default withPWA(nextConfig);
