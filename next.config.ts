import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's driver adapter + node-postgres ship native/Node-specific code —
  // keep them external to the server bundler.
  serverExternalPackages: ["pg", "@prisma/adapter-pg", ".prisma", "@prisma/client"],
  outputFileTracingExcludes: {
    "*": ["./.pgdata/**"],
  },
};

export default nextConfig;
