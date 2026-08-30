import type { Metadata } from "next";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    // Browser tab title — "Time Management" is the base title on every
    // route (nested pages inherit the template if they ever set their own).
    default: "Time Management",
    template: "%s — Time Management",
  },
  description: "Live production team break, attendance and shift management system",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Brand font stack — same families as the uploaded prototype
            (root index.html): Inter body, Orbitron display, Teko condensed,
            JetBrains Mono for timestamps/data. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Orbitron:wght@400;600;700;800;900&family=Teko:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="min-h-screen antialiased">
        <Auth0Provider profileRoute="/api/auth/profile">{children}</Auth0Provider>
      </body>
    </html>
  );
}
