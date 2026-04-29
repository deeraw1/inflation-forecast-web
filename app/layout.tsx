import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nigerian Inflation Forecasting Model",
  description: "Holt-Winters triple exponential smoothing on NBS CPI data — 3, 6, and 12-month forecasts with confidence intervals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
