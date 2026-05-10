import {
  Heading,
  Text,
  Section,
  Button,
  Row,
  Column,
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

const fallbackTextStyle: React.CSSProperties = {
  fontSize: sizes.smallText,
  lineHeight: 1.5,
  color: colors.textMuted,
  textAlign: "center",
  margin: 0,
};

const fallbackUrlStyle: React.CSSProperties = {
  wordBreak: "break-all",
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
      heroIntro="Tvůj průvodce je připraven ke stažení. Klikni níže — odkaz funguje bez časového omezení."
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

      <Section style={buttonContainerStyle}>
        <Button href={props.downloadUrl} style={buttonStyle}>
          Stáhnout průvodce
        </Button>
      </Section>

      <Text style={fallbackTextStyle}>
        Pokud tlačítko nefunguje, zkopíruj tento odkaz:<br />
        <span style={fallbackUrlStyle}>{props.downloadUrl}</span>
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
