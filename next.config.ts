import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node addon; keep it external to the bundler
  // (ADR-0005). Route handlers already use runtime = "nodejs".
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Prevent Jest worker child process exceptions by disabling worker threads / reducing concurrency
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
