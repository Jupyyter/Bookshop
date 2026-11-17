import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { CompareTray } from "@/components/compare";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Bookshop", // used by pages that don't set their own title
    template: "%s · Bookshop", // a book page titled "Dune" shows "Dune · Bookshop"
  },
  description: "A demo bookshop built with Next.js",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        {/* The tray reads the current address (to hide itself on /compare). On pages whose address
            holds an ID, that's only known per visit, so it waits inside Suspense instead of blocking. */}
        <Suspense fallback={null}>
          <CompareTray />
        </Suspense>
      </body>
    </html>
  );
}
