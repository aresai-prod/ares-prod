import "./globals.css";
import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import AnalyticsTracker from "../components/AnalyticsTracker";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "ARES — AI Operations Platform",
  description: "ARES is the AI console for enterprise analytics, workflows, and secure intelligence.",
  icons: {
    icon: "/ares-icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={notoSans.className}>
      <body>
        <AnalyticsTracker />
        {children}
      </body>
    </html>
  );
}
