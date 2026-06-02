import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vigilant.ai - Neural Tagging Active",
  description: "MVP AI CCTV Footage Auto-Tagging & Search Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
