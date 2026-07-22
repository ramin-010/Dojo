import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "highlight.js/styles/tokyo-night-dark.css";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Revise",
  description: "A focused personal workspace for spaced repetition.",
};

import { Toaster } from 'sonner';
import { GlobalQuickNoteModal } from "@/components/global/GlobalQuickNoteModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="font-sans antialiased flex h-screen w-screen overflow-hidden text-foreground bg-background">
        {children}
        
        <Toaster theme="dark" position="bottom-right" toastOptions={{
          style: {
            background: '#18181b', // zinc-900
            border: '1px solid #27272a', // zinc-800
            color: '#e4e4e7', // zinc-200
          }
        }} />
        <GlobalQuickNoteModal />
      </body>
    </html>
  );
}
