import { ClerkProvider } from '@clerk/nextjs'; // 👈 Import Clerk
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google"; // 1. Import font
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from 'sonner';

// 2. Configure the font
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans", // This variable is key
});

export const metadata: Metadata = {
  title: "Weavy",
  description: "Artistic Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider> {/* 👈 Wrap everything */}
      <html lang="en">
        {/* 3. Apply the variable to the body */}
        <body className={`${dmSans.variable} font-sans bg-[#09090b] text-slate-100 antialiased`}>
          <Providers>
            {children}
            <Toaster position="bottom-right" theme="dark" />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}