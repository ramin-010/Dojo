import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

import { Sidebar } from "@/components/navigation/Sidebar";

export const metadata: Metadata = {
  title: "Revise",
  description: "A focused personal workspace for spaced repetition.",
};

import { getSubjectsWithTopics } from "@/app/actions";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const subjects = await getSubjectsWithTopics();

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased flex h-screen w-screen overflow-hidden text-foreground bg-background">
        
        {/* Collapsible Left Sidebar */}
        <Sidebar initialSubjects={subjects} />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden">
          {children}
        </main>
        
      </body>
    </html>
  );
}
