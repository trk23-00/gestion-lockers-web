import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.SGAP_TEST_RUN === "1" ? ".next-test" : ".next",
};

export default nextConfig;
