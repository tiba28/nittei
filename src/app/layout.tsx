import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://nittei-green.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "匿名で使える無料の日程調整ツール｜nittei（ニッテイ）",
    template: "%s｜nittei",
  },
  description:
    "nittei（ニッテイ）は、回答を他の参加者に見られずに使える無料の匿名日程調整ツールです。「あの人が来るなら参加」などの裏条件も匿名で設定でき、飲み会やイベントの幹事の負担を減らします。登録不要・URLを送るだけ。",
  keywords: [
    "日程調整",
    "日程調整 無料",
    "匿名 日程調整",
    "日程調整 ツール",
    "調整さん 代わり",
    "飲み会 日程調整",
    "出欠確認",
    "スケジュール調整",
    "幹事",
    "nittei",
    "ニッテイ",
  ],
  applicationName: "nittei",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: siteUrl,
    siteName: "nittei",
    title: "匿名で使える無料の日程調整ツール｜nittei（ニッテイ）",
    description:
      "回答を他の参加者に見られない、無料の匿名日程調整ツール。「あの人が来るなら参加」などの裏条件も匿名で設定可能。登録不要・URLを送るだけ。",
  },
  twitter: {
    card: "summary",
    title: "匿名で使える無料の日程調整ツール｜nittei（ニッテイ）",
    description:
      "回答を他の参加者に見られない、無料の匿名日程調整ツール。裏条件も匿名で設定可能。登録不要・URLを送るだけ。",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "6gC9z0qXRqeLIORnro7Bi-0RS-IvaIzJb_gQhQG9QvU",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "nittei",
  alternateName: "ニッテイ",
  url: siteUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "ja",
  description:
    "回答を他の参加者に見られずに使える無料の匿名日程調整ツール。裏条件も匿名で設定できる。",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}