// ================================================
// Brand style tokens for email templates
// ================================================
// Email-safe values: web fonts disabled (Outlook fallback issues),
// inline-safe color hex codes, mobile-first sizing.
// ================================================

export const colors = {
  primary: "#1a4d2e",      // Dark forest green — primary brand
  accent: "#c9a961",       // Warm gold — accent / CTAs
  text: "#2c2c2c",         // Body text
  textMuted: "#6b6b6b",    // Secondary text
  background: "#ffffff",   // Email body background
  containerBg: "#f7f5f0",  // Container card background
  border: "#e0dcd2",       // Soft border
};

// Email-safe font stack: avoids @font-face which fails in Outlook 2007-2019
export const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const sizes = {
  bodyText: "16px",
  smallText: "14px",
  h1: "26px",
  h2: "20px",
  buttonText: "16px",
  containerMaxWidth: "600px",
  buttonMinHeight: "44px", // mobile tap target
};

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
};

export const logoUrl = "https://cestybezmapy.cz/email/logo.png";
export const websiteUrl = "https://cestybezmapy.cz";
export const supportEmail = "info@cestybezmapy.cz";
