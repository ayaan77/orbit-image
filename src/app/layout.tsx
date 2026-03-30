import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Orbit Image — Brand-Aware Image Generation",
  description:
    "Generate on-brand images for blogs, social media, ads, and more. Powered by AI with brand context from Cortex.",
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://orbit-image.vercel.app"
  ),
  openGraph: {
    title: "Orbit Image — Brand-Aware Image Generation",
    description:
      "Generate on-brand images for blogs, social media, ads, and more. Powered by AI with brand context from Cortex.",
    type: "website",
    siteName: "Orbit Image",
  },
  twitter: {
    card: "summary",
    title: "Orbit Image — Brand-Aware Image Generation",
    description:
      "Generate on-brand images for blogs, social media, and ads with AI + brand context.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
