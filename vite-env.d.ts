/// <reference types="vite/client" />

// No `VITE_*` variables are used by design: Auth0 configuration (including every
// secret) lives on the server — see `serverAuth.ts` and `.env.example`. Anything
// declared here would be inlined into the public browser bundle, which is exactly
// why the client secret must never appear in a Vite env var.
