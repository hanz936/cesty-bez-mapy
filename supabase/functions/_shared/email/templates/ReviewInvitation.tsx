// @ts-nocheck — React email šablona; typy řeší esbuild při deploy, není cíl CORR-02 (viz plán F-1 Task 5)
import { Text, Section, Button } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { ReviewInvitationProps } from "../types.ts";

const textStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: `0 0 ${spacing.md}`,
};

const listStyle: React.CSSProperties = {
  ...textStyle,
  fontWeight: 600,
};

const buttonContainerStyle: React.CSSProperties = {
  textAlign: "center",
  paddingTop: spacing.lg,
  paddingBottom: spacing.lg,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: colors.primary,
  color: "#ffffff",
  fontSize: sizes.bodyText,
  padding: "12px 32px",
  borderRadius: "6px",
  textDecoration: "none",
};

export function ReviewInvitation({ customerName, reviewUrl, productTitles }: ReviewInvitationProps) {
  return (
    <BrandLayout
      preview="Jak se ti s průvodcem cestovalo? Budu ráda za tvou recenzi."
      heroHeading="Jak se ti cestovalo?"
      heroIntro="Budu moc ráda za tvou recenzi."
      footerSignoff="Šťastné cesty,"
      footerDisclaimer="Toto je obchodní sdělení zaslané jednorázově k tvé objednávce. Pokud si podobné zprávy nepřeješ, napiš mi na cestybezmapy@gmail.com a další ti nepřijdou."
    >
      <Text style={textStyle}>Ahoj {vocativeFirstName(customerName)},</Text>
      <Text style={textStyle}>
        před pár týdny sis ode mě {productTitles.length > 1 ? "pořídil/a tyto průvodce" : "pořídil/a průvodce"}:
      </Text>
      {productTitles.map((title) => (
        <Text key={title} style={listStyle}>• {title}</Text>
      ))}
      <Text style={textStyle}>
        Moc by mi pomohlo, kdyby ses podělil/a o svou zkušenost. Recenze pomáhá dalším
        cestovatelům při výběru — a mně říká, co dělat líp.
      </Text>
      <Section style={buttonContainerStyle}>
        <Button href={reviewUrl} style={buttonStyle}>Napsat recenzi</Button>
      </Section>
      <Text style={textStyle}>
        Odkaz je jen pro tebe (platí 12 měsíců) — díky němu bude recenze označená
        jako „Ověřeno nákupem“.
      </Text>
    </BrandLayout>
  );
}

export default ReviewInvitation;

ReviewInvitation.PreviewProps = {
  customerName: "Jana Nováková",
  reviewUrl: "https://cestybezmapy.cz/recenze?token=example123",
  productTitles: ["Toskánsko – cestovní průvodce"],
} satisfies ReviewInvitationProps;
