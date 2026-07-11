// @ts-nocheck — React email šablona; typy řeší esbuild při deploy, není cíl CORR-02 (viz plán F-1 Task 5)
// BrandLayout: shared email layout with cream hero panel + white body + footer.
// Hero panel sits at the top (logo, h1 heading, intro paragraph), body section
// renders children below, footer carries signature + contact + transactional disclaimer.

import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Img,
  Text,
  Heading,
  Hr,
  Link,
} from "react-email";
import * as React from "react";
import { colors, fontStack, sizes, spacing, logoUrl, websiteUrl, supportEmail } from "./styles.ts";

interface BrandLayoutProps {
  preview: string;
  heroHeading: string;
  heroIntro: string;
  footerSignoff: string;
  /** Legal disclaimer line at the very bottom of the footer. Defaults to the
   * transactional-message wording used by all order-related templates. */
  footerDisclaimer?: string;
  children: React.ReactNode;
}

const DEFAULT_FOOTER_DISCLAIMER = "Tento email je transakční zpráva související s tvou objednávkou.";

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
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

const heroSectionStyle: React.CSSProperties = {
  backgroundColor: colors.containerBg,
  borderRadius: "8px",
  padding: `${spacing.xxl} ${spacing.xl}`,
  textAlign: "center",
};

const logoLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginBottom: spacing.lg,
};

const logoStyle: React.CSSProperties = {
  height: "32px",
  width: "auto",
  display: "inline-block",
};

const heroHeadingStyle: React.CSSProperties = {
  color: colors.primary,
  fontSize: sizes.h1,
  fontWeight: 700,
  lineHeight: 1.3,
  margin: `0 0 ${spacing.md}`,
};

const heroIntroStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: 0,
};

const bodySectionStyle: React.CSSProperties = {
  paddingTop: spacing.xl,
  paddingBottom: spacing.lg,
};

const hrStyle: React.CSSProperties = {
  border: "none",
  borderTop: `1px solid ${colors.border}`,
  margin: `${spacing.xl} 0 0`,
};

const footerStyle: React.CSSProperties = {
  paddingTop: spacing.lg,
  fontSize: sizes.smallText,
  color: colors.textMuted,
  textAlign: "center",
  lineHeight: 1.6,
};

const footerLinkStyle: React.CSSProperties = {
  color: colors.primary,
  textDecoration: "underline",
};

export function BrandLayout({ preview, heroHeading, heroIntro, footerSignoff, footerDisclaimer, children }: BrandLayoutProps): React.ReactElement {
  return (
    <Html lang="cs">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={heroSectionStyle}>
            <Link href={websiteUrl} style={logoLinkStyle}>
              <Img src={logoUrl} alt="Cesty bez mapy" style={logoStyle} />
            </Link>
            <Heading style={heroHeadingStyle}>{heroHeading}</Heading>
            <Text style={heroIntroStyle}>{heroIntro}</Text>
          </Section>
          <Section style={bodySectionStyle}>
            {children}
          </Section>
          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={{ margin: 0 }}>
              {footerSignoff}<br />Jana z Cesty bez mapy
            </Text>
            <Text style={{ marginTop: spacing.md, marginBottom: 0 }}>
              <Link href={`mailto:${supportEmail}`} style={footerLinkStyle}>
                {supportEmail}
              </Link>
              {" · "}
              <Link href={websiteUrl} style={footerLinkStyle}>cestybezmapy.cz</Link>
            </Text>
            <Text style={{ marginTop: spacing.md, fontSize: "12px", marginBottom: 0 }}>
              {footerDisclaimer ?? DEFAULT_FOOTER_DISCLAIMER}
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
  heroHeading: "Vítej v Cesty bez mapy",
  heroIntro: "Tady se zobrazí krátký intro paragraph s kontextem emailu.",
  footerSignoff: "Měj se hezky,",
  children: null,
};