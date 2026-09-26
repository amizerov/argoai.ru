import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import ChatPopup from "@/components/ChatPopup";
import "./globals.css";

const geistSans = localFont({
  src: "../node_modules/next/dist/next-devtools/server/font/geist-latin-ext.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "../node_modules/next/dist/next-devtools/server/font/geist-mono-latin-ext.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://argoai.ru"),
  title: "ARGO SOFT — Artificial Intelligence & Software Engineering",
  description: "Разработка систем искусственного интеллекта, RAG, семантического поиска, локальных LLM и интеллектуальной интеграции данных.",
  applicationName: "ARGO SOFT",
  keywords: ["ARGO SOFT", "AI", "RAG", "LLM", "семантический поиск", "интеграция данных"],
  openGraph: {
    title: "ARGO SOFT — Artificial Intelligence & Software Engineering",
    description: "Инженерные AI-системы для поиска, анализа и объединения знаний.",
    url: "https://argoai.ru", siteName: "ARGO SOFT", locale: "ru_RU", type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#050608" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}><body>{children}<ChatPopup /></body></html>;
}
