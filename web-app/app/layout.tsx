import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مدير المحفظة الاستثمارية",
  description: "تطبيق المدير الديناميكي للمحفظة الاستثمارية الشخصية - Optimum Score Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
