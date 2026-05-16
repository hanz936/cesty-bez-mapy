import {
  Heading,
  Text,
  Section,
  Button,
  Row,
  Column,
  Link,
} from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { OrderConfirmationProps } from "../types.ts";

const sectionHeadingStyle: React.CSSProperties = {
  color: colors.primary,
  fontSize: sizes.h2,
  fontWeight: 700,
  margin: `0 0 ${spacing.lg}`,
  textAlign: "center",
};

const textStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: 0,
};

const itemRowStyle: React.CSSProperties = {
  paddingTop: spacing.md,
  paddingBottom: spacing.md,
  borderBottom: `1px solid ${colors.border}`,
};

const totalRowStyle: React.CSSProperties = {
  paddingTop: spacing.md,
};

const totalLabelStyle: React.CSSProperties = {
  ...textStyle,
  fontWeight: 700,
  fontSize: sizes.h2,
};

const buttonContainerStyle: React.CSSProperties = {
  textAlign: "center",
  paddingTop: spacing.xl,
  paddingBottom: spacing.md,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: colors.primary,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
};

const tipCalloutStyle: React.CSSProperties = {
  backgroundColor: colors.containerBg,
  padding: spacing.lg,
  borderRadius: "6px",
  margin: `${spacing.md} 0 ${spacing.lg}`,
};

const fallbackTextStyle: React.CSSProperties = {
  fontSize: sizes.smallText,
  lineHeight: 1.5,
  color: colors.textMuted,
  textAlign: "center",
  margin: 0,
};

const fallbackLinkStyle: React.CSSProperties = {
  color: colors.primary,
  textDecoration: "underline",
  wordBreak: "break-all",
};

const orderNoteStyle: React.CSSProperties = {
  fontSize: sizes.smallText,
  lineHeight: 1.5,
  color: colors.textMuted,
  textAlign: "center",
  marginTop: spacing.xl,
  marginBottom: 0,
};

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function OrderConfirmation(props: OrderConfirmationProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Tvůj průvodce je připraven ke stažení (objednávka #${props.orderId})`}
      heroHeading={`Děkujeme za nákup, ${greeting}!`}
      heroIntro="Tvůj nový průvodce je připraven. Stáhni si ho a vyraž na cestu!"
      footerSignoff="Šťastnou cestu,"
    >
      <Heading as="h2" style={sectionHeadingStyle}>Shrnutí objednávky</Heading>
      <Section>
        {props.items.map((item, idx) => (
          <Row key={idx} style={itemRowStyle}>
            <Column style={{ width: "70%" }}>
              <Text style={textStyle}>
                {item.productTitle}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </Text>
            </Column>
            <Column style={{ width: "30%", textAlign: "right" }}>
              <Text style={textStyle}>
                {formatCZK(item.priceAtPurchase * item.quantity)}
              </Text>
            </Column>
          </Row>
        ))}
        <Row style={totalRowStyle}>
          <Column style={{ width: "70%" }}>
            <Text style={totalLabelStyle}>Celkem</Text>
          </Column>
          <Column style={{ width: "30%", textAlign: "right" }}>
            <Text style={totalLabelStyle}>{formatCZK(props.totalAmount)}</Text>
          </Column>
        </Row>
      </Section>

      {props.downloadUrl && (
        <>
          <Section style={buttonContainerStyle}>
            <Button href={props.downloadUrl} style={buttonStyle}>
              Stáhnout průvodce
            </Button>
          </Section>

          <Section style={tipCalloutStyle}>
            <Text style={{ ...textStyle, margin: 0 }}>
              <strong>Tip:</strong> Než vyrazíš, ulož si průvodce do mobilu. Bude ti dělat společnost i tam, kde nemáš signál.
            </Text>
          </Section>

          <Text style={fallbackTextStyle}>
            Pokud tlačítko nefunguje, klikni na tento odkaz:<br />
            <Link href={props.downloadUrl} style={fallbackLinkStyle}>{props.downloadUrl}</Link>
          </Text>
        </>
      )}

      <Text style={orderNoteStyle}>
        Číslo objednávky: #{props.orderId}
      </Text>
    </BrandLayout>
  );
}

export default OrderConfirmation;

OrderConfirmation.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-12345",
  items: [
    { productTitle: "Toskánsko – cestovní průvodce", quantity: 1, priceAtPurchase: 199 },
    { productTitle: "Provence – cestovní průvodce", quantity: 2, priceAtPurchase: 199 },
  ],
  totalAmount: 597,
  downloadUrl: "https://cestybezmapy.cz/stahnout?token=preview123",
} satisfies OrderConfirmationProps;
