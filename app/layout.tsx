import type { Metadata, Viewport } from "next";
import { Amiri, Outfit } from "next/font/google";
import PwaRegister from "./pwa-register";
import "./globals.css";

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Memoriq",
  description: "PWA Solo de Mémorisation du Coran",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/memoriq-logo.svg", type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Memoriq",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${amiri.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f6f8f5] text-[#1e2522] font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
