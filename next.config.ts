import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.SGAP_TEST_RUN === "1" ? ".next-test" : ".next",
  allowedDevOrigins: [
    "192.168.100.28",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
