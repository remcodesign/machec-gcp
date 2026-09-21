import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AuthProvider } from "@/hooks/useAuth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MACHEC | Installatiemateriaal",
  description: "Elektrisch installatiemateriaal voor vakmensen.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#fffdf8] text-stone-950">
        <AuthProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <Suspense
            fallback={
              <div className="h-24 border-t border-stone-200 bg-stone-950" />
            }
          >
            <SiteFooter />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
