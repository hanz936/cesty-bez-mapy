// ================================================
// BrandLayout: shared email layout
// ================================================
// Wraps each email template with consistent header (logo) and footer
// (signature, support email, unsubscribe note for transactional context).
// ================================================

import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Img,
  Text,
  Hr,
  Link,
} from "react-email";
import * as React from "react";
import { colors, fontStack, sizes, spacing, logoUrl, websiteUrl, supportEmail } from "./styles.ts";

interface BrandLayoutProps {
  preview: string; // shown in inbox snippet (preheader)
  children: React.ReactNode;
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: colors.background,
  fontFamily: fontStack,
  color: colors.text,
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: sizes.containerMaxWidth,
  margin: "0 auto",
  padding: spacing.lg,
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: spacing.xl,
};

const logoStyle: React.CSSProperties = {
  height: "48px",
  width: "auto",
  display: "inline-block",
};

const footerStyle: React.CSSProperties = {
  paddingTop: spacing.xl,
  fontSize: sizes.smallText,
  color: colors.textMuted,
  textAlign: "center",
  lineHeight: 1.6,
};

const hrStyle: React.CSSProperties = {
  border: "none",
  borderTop: `1px solid ${colors.border}`,
  margin: `${spacing.xl} 0`,
};

const linkStyle: React.CSSProperties = {
  color: colors.primary,
  textDecoration: "underline",
};

export function BrandLayout({ preview, children }: BrandLayoutProps): React.ReactElement {
  return (
    <Html lang="cs">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Link href={websiteUrl}>
              <Img src={logoUrl} alt="Cesty bez mapy" style={logoStyle} />
            </Link>
          </Section>
          {children}
          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={{ margin: 0 }}>
              S láskou,<br />Jana z Cesty bez mapy
            </Text>
            <Text style={{ marginTop: spacing.md, marginBottom: 0 }}>
              <Link href={`mailto:${supportEmail}`} style={linkStyle}>
                {supportEmail}
              </Link>
              {" · "}
              <Link href={websiteUrl} style={linkStyle}>cestybezmapy.cz</Link>
            </Text>
            <Text style={{ marginTop: spacing.md, fontSize: "12px", marginBottom: 0 }}>
              Tento email je transakční zpráva související s tvou objednávkou.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default BrandLayout;

BrandLayout.PreviewProps = {
  preview: "Náhled layoutu",
  children: null,
};
