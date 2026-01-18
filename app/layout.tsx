import { ClerkProvider } from '@clerk/nextjs'; 
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google"; 
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from 'sonner';
import { TRPCProvider } from "@/components/TRPCProvider"; // ✅ Imported

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans", 
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
    <ClerkProvider>
      <html lang="en">
        <body className={`${dmSans.variable} font-sans bg-[#09090b] text-slate-100 antialiased`}>
          {/* ✅ Wrap application with TRPCProvider */}
          <TRPCProvider>
            <Providers>
              {children}
              <Toaster position="bottom-right" theme="dark" />
            </Providers>
          </TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}