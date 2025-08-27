import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/font-optimization.css";
import { FontLoadOptimizer } from "@/components/FontLoadOptimizer";
import { FontLoadingStatus } from "@/components/FontLoadingStatus";
import "@/lib/immer-setup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Optimizes font loading with fallback
  preload: true, // Preload main font for critical text
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
  adjustFontFallback: true, // Reduces layout shift
  weight: ["400", "500", "600", "700"], // Only load needed weights
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap", // Optimizes font loading
  preload: false, // Don't preload mono font - used less frequently
  fallback: ["Consolas", "Monaco", "'SF Mono'", "monospace"],
  adjustFontFallback: true, // Reduces layout shift
  weight: ["400", "500"], // Only essential mono weights
});

export const metadata: Metadata = {
  title: "Cartrita V2 - Advanced AI Orchestration Platform",
  description: "State-of-the-art multi-agent AI system with quantum computing integration, advanced analytics, and comprehensive enterprise features",
  keywords: "AI, chatbot, agents, quantum computing, automation, enterprise, analytics, machine learning",
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: "Cartrita V2 - Advanced AI Orchestration Platform",
    description: "Revolutionary multi-agent AI platform with 15+ specialized agents, quantum computing integration, and enterprise-grade features",
    type: "website",
    url: "https://cartrita.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cartrita V2 - Advanced AI Orchestration Platform",
    description: "Experience the future of AI with our quantum-enhanced multi-agent platform",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
        suppressHydrationWarning={true}
      >
        <FontLoadOptimizer />
        <FontLoadingStatus />
        {children}
      </body>
    </html>
  );
}
