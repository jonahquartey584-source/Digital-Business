import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaInstall } from "@/components/pwa-install";

export const metadata: Metadata = {
  title: {
    default: "Qp Digital — SaaS tools for growing businesses",
    template: "%s · Qp Digital",
  },
  description:
    "Qp Digital gives your business a subscription-based home for CRM and more — on the web and as an app.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Qp Digital",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121212",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
