import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growlytics AI — AI Growth Manager for E-commerce",
  description:
    "Your AI Co-Pilot for Smarter E-commerce Growth. Unified analytics and AI recommendations across Shopify, Ads, GA4, Klaviyo and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
