import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "BankScan - Financial Tracker",
  description: "Track your finances, upload bank statements, and manage expenses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-muted/10 min-h-screen pb-20 md:pb-0 md:pt-14`}
      >
        <BottomNav />
        <main className="container max-w-2xl mx-auto px-4 py-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
