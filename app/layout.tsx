import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Life Sorted — Budget",
  description: "Factual budgeting and cashflow tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
