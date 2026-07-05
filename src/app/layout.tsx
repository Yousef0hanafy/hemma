import type { Metadata, Viewport } from "next";
import { Cairo, Noto_Naskh_Arabic, Amiri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { SplashScreen } from "@/components/qudurat/SplashScreen";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const naskh = Noto_Naskh_Arabic({
  variable: "--font-naskh",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hema-lms.example.com"),
  title: "منصة همّة التعليمية — التحضير المتميّز لاختبار القدرات",
  description:
    "منصة همّة التعليمية: منصّة تعليمية متكاملة لتحضير اختبار القدرات اللفظية مع وضع المذاكرة، الاختبارات الوقتية، المراجعة الذكية، ونظام التتبّع التقدّم والإتقان.",
  keywords: [
    "منصة همّة التعليمية",
    "قدرات",
    "القدرات اللفظية",
    "تناظر لفظي",
    "إكمال جمل",
    "استيعاب المقروء",
    "اختبار القدرات",
  ],
  authors: [{ name: "Youssef Hanafy" }],
  creator: "Youssef Hanafy",
  publisher: "منصة همّة التعليمية",
  applicationName: "منصة همّة التعليمية",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: "منصة همّة التعليمية",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "منصة همّة التعليمية — التحضير المتميّز لاختبار القدرات",
    description:
      "منصّة تعليمية متكاملة لتحضير اختبار القدرات اللفظية مع وضع المذاكرة، الاختبارات الوقتية، والمراجعة الذكية.",
    url: "https://hema-lms.example.com",
    siteName: "منصة همّة التعليمية",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "منصة همّة التعليمية" }],
    type: "website",
    locale: "ar_SA",
  },
  twitter: {
    card: "summary_large_image",
    title: "منصة همّة التعليمية",
    description: "التحضير المتميّز لاختبار القدرات اللفظية",
    images: ["/og-image.png"],
  },
  formatDetection: { telephone: false },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1f1a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Preconnect to font host for faster load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${cairo.variable} ${naskh.variable} ${amiri.variable} font-sans antialiased bg-background text-foreground`}
      >
        <SplashScreen />
        {children}
        <Toaster />
        <SonnerToaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "var(--font-cairo), sans-serif",
              direction: "rtl",
            },
          }}
        />
      </body>
    </html>
  );
}
