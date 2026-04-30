import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medihospes Scheduling",
  description: "Staff scheduling and attendance platform for Medihospes clinics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
