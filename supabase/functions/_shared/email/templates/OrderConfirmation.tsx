import {
  Heading,
  Text,
  Section,
  Button,
  Row,
  Column,
} from "npm:react-email@6";
import * as React from "npm:react@18";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import type { OrderConfirmationProps } from "../types.ts";

const headingStyle: React.CSSProperties = {
  color: colors.primary,
  fontSize: sizes.h1,
  margin: `0 0 ${spacing.md}`,
};

const textStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: `0 0 ${spacing.md}`,
};

const itemRowStyle: React.CSSProperties = {
  paddingTop: spacing.sm,
  paddingBottom: spacing.sm,
  borderBottom: `1px solid ${colors.border}`,
};

const totalStyle: React.CSSProperties = {
  ...textStyle,
  fontWeight: "bold",
  fontSize: sizes.h2,
  paddingTop: spacing.md,
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center",
  padding: `${spacing.xl} 0`,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: colors.primary,
  color: "#ffffff",
  fontSize: sizes.buttonText,
  fontWeight: "bold",
  padding: `${spacing.md} ${spacing.xl}`,
  borderRadius: "6px",
  textDecoration: "none",
  minHeight: sizes.buttonMinHeight,
  display: "inline-block",
};

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function OrderConfirmation(props: OrderConfirmationProps): React.ReactElement {
  return (
    <BrandLayout preview={`Tvůj průvodce je připraven ke stažení (objednávka #${props.orderId})`}>
      <Heading style={headingStyle}>Děkujeme za nákup, {props.customerName}!</Heading>
      <Text style={textStyle}>
        Tvůj průvodce je připraven ke stažení. Klikni na tlačítko níže — odkaz funguje bez časového omezení.
      </Text>

      <Section style={{ paddingTop: spacing.lg, paddingBottom: spacing.lg }}>
        <Text style={{ ...textStyle, fontWeight: "bold", marginBottom: spacing.sm }}>
          Objednávka #{props.orderId}
        </Text>
        {props.items.map((item, idx) => (
          <Row key={idx} style={itemRowStyle}>
            <Column style={{ width: "70%" }}>
              <Text style={{ ...textStyle, margin: 0 }}>
                {item.productTitle}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </Text>
            </Column>
            <Column style={{ width: "30%", textAlign: "right" }}>
              <Text style={{ ...textStyle, margin: 0 }}>
                {formatCZK(item.priceAtPurchase * item.quantity)}
              </Text>
            </Column>
          </Row>
        ))}
        <Row>
          <Column style={{ width: "70%" }}>
            <Text style={totalStyle}>Celkem</Text>
          </Column>
          <Column style={{ width: "30%", textAlign: "right" }}>
            <Text style={totalStyle}>{formatCZK(props.totalAmount)}</Text>
          </Column>
        </Row>
      </Section>

      <Section style={buttonContainer}>
        <Button href={props.downloadUrl} style={buttonStyle}>
          Stáhnout průvodce
        </Button>
      </Section>

      <Text style={{ ...textStyle, fontSize: sizes.smallText, color: colors.textMuted }}>
        Pokud tlačítko nefunguje, zkopíruj tento odkaz do prohlížeče:
        <br />
        {props.downloadUrl}
      </Text>
    </BrandLayout>
  );
}
