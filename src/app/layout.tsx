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

export const metadata: Metadata = {
  title: "nittei | 非公開回答・裏条件・連絡文面作成までできる日程調整ツール",
  description:
    "nitteiは、回答を参加者同士に公開せずに集められる日程調整ツールです。誰となら参加できるかなどの裏条件も扱え、ホスト向けの集計や連絡文面作成まで対応しています。",
  verification: {
    google: "6gC9z0qXRqeLIORnro7Bi-0RS-IvaIzJb_gQhQG9QvU",
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
        {children}
      </body>
    </html>
  );
}