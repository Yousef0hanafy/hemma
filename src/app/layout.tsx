import type { Metadata } from "next";
import { Cairo, Noto_Naskh_Arabic, Amiri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

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
  title: "قُدرات — منصّة التحضير المتميّزة لاختبار القدرات",
  description:
    "منصة تعليمية متكاملة لتحضير اختبار القدرات اللفظية مع وضع المذاكرة، الاختبارات الوقتية، المراجعة الذكية، ونظام التتبّع التقدّم والإتقان.",
  keywords: [
    "قدرات",
    "القدرات اللفظية",
    "تناظر لفظي",
    "إكمال جمل",
    "استيعاب المقروء",
    "اختبار القدرات",
  ],
  authors: [{ name: "Qudurat LMS" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} ${naskh.variable} ${amiri.variable} font-sans antialiased bg-background text-foreground`}
      >
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
