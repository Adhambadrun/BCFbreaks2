/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma's driver adapter + node-postgres ship native/Node-specific code —
  // keep them external to the server bundler.
  //
  // ⚠️ `@auth0/nextjs-auth0` is deliberately NOT in serverExternalPackages.
  // Marking it external makes Node `require()` the SDK at runtime for
  // server-side rendering of the client `Auth0Provider` (root layout), which
  // pulls a SECOND React instance into the prerender worker and crashes
  // static generation of /_not-found with:
  //   TypeError: Cannot read properties of null (reading 'useContext')
  // Bundling the SDK (default behavior) is fully supported — the Edge-runtime
  // build failures the external flag was meant to avoid are instead solved
  // structurally: src/middleware.ts uses the WebCrypto-native session shim in
  // src/lib/edge-session.ts (zero SDK imports on the Edge), and the full SDK
  // runs only in the Node-runtime route mount src/app/api/auth/[auth0]/route.ts.
  serverExternalPackages: [
    "pg",
    "@prisma/adapter-pg",
    ".prisma",
    "@prisma/client",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // The auth stack (SDK + jose) lazily references optional Node stream
      // integrations (CompressionStream/DecompressionStream) that are only
      // exercised for `zip`-encoded JWE — never used by this app. Suppress the
      // resulting dynamic-import warnings for clean production builds.
      config.ignoreWarnings = [
        { module: /node_modules\/@auth0\/nextjs-auth0/ },
        { module: /node_modules\/jose/ },
      ];
    }
    return config;
  },
  outputFileTracingExcludes: {
    "*": ["./.pgdata/**"],
  },
};

export default nextConfig;
