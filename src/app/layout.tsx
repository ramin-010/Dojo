import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revise",
  description: "A focused personal workspace for spaced repetition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex h-screen w-screen overflow-hidden text-foreground bg-background">
        
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar border-r flex flex-col">
          <div className="p-4 border-b font-semibold text-sm">
            Revise
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            <Link href="/dashboard" className="block px-3 py-2 rounded-md hover:bg-hover text-sm">
              Dashboard
            </Link>
            {/* Subjects will be populated here */}
            <div className="mt-6 mb-2 px-3 text-xs uppercase text-foreground/50 font-semibold tracking-wider">
              Subjects
            </div>
            <Link href="/subject/1" className="block px-3 py-2 rounded-md hover:bg-hover text-sm">
              TypeScript Prep
            </Link>
          </nav>
          <div className="p-4 border-t text-xs text-foreground/50">
            Settings
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full relative overflow-y-auto">
          {children}
        </main>
        
      </body>
    </html>
  );
}
