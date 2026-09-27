import type { Metadata } from "next";
import { Lato, Source_Sans_3 } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Same typefaces as baystatebullets.com: Lato for headings, Source Sans for text.
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bay State Bullets · Team Communication",
  description: "Plan and send emails to teams",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${lato.variable} ${sourceSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
