import type { Metadata } from "next";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Breaks & Shift Management App",
  description: "Live production team break and attendance system",
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
