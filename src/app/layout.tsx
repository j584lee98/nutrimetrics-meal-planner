import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriMetrics",
  description: "A personal meal planning foundation powered by USDA food data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
