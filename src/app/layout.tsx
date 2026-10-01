import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Medihospes Scheduling",
  description: "Manager roster planning platform for Medihospes clinics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // lang defaults to Italian; the LocaleProvider updates it to the stored
    // choice on mount. translate="no" stops the browser auto-translating over
    // our own translations.
    <html lang="it" translate="no" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
