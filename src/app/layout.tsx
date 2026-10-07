import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PayPal Deal Checker",
  description: "Understand the deal. See the evidence. You decide.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
