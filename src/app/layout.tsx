import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EFSANE-11",
  description: "Türk futbolunun efsanelerinden rüya 11 kur, turnuvada yarıştır ve paylaş.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
