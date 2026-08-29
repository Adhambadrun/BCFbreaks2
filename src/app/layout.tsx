import type { Metadata } from "next";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "BCFBreaks — Team Breaks & Shift Management",
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
      <body className="min-h-screen antialiased">
        <Auth0Provider profileRoute="/api/auth/profile">{children}</Auth0Provider>
      </body>
    </html>
  );
}
