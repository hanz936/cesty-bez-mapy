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
import type { AdminOrderNotificationProps } from "../types.ts";

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

const customItineraryBannerStyle: React.CSSProperties = {
  backgroundColor: colors.containerBg,
  border: `2px solid ${colors.primary}`,
  padding: spacing.lg,
  borderRadius: "6px",
  margin: `${spacing.lg} 0`,
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

export function AdminOrderNotification(props: AdminOrderNotificationProps): React.ReactElement {
  return (
    <BrandLayout
      preview={
        props.hasCustomItinerary
          ? `Zaplacený itinerář na míru — ${props.customerName} (${formatCZK(props.totalAmount)})`
          : `Nová objednávka — ${props.customerName} (${formatCZK(props.totalAmount)})`
      }
      heroHeading={props.hasCustomItinerary ? "Zaplacený itinerář na míru! 🗺️" : "Nová objednávka! 🛒"}
      heroIntro={`${props.customerName} (${props.customerEmail}) právě zaplatil(a) ${formatCZK(props.totalAmount)}.`}
      footerSignoff="Toto je interní notifikace,"
    >
      {props.hasCustomItinerary && (
        <Section style={customItineraryBannerStyle}>
          <Text style={{ ...textStyle, fontWeight: 700 }}>
            🗺️ Obsahuje itinerář na míru — zákazník čeká na plánování.
          </Text>
        </Section>
      )}

      <Heading as="h2" style={sectionHeadingStyle}>Obsah objednávky</Heading>
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

      {props.adminOrderUrl && (
        <Section style={buttonContainerStyle}>
          <Button href={props.adminOrderUrl} style={buttonStyle}>
            Otevřít v administraci
          </Button>
        </Section>
      )}

      <Text style={orderNoteStyle}>
        ID objednávky: {props.orderId}
      </Text>
    </BrandLayout>
  );
}

export default AdminOrderNotification;

AdminOrderNotification.PreviewProps = {
  orderId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  customerName: "Petr Novák",
  customerEmail: "petr@example.com",
  items: [
    { productTitle: "Individuální itinerář", quantity: 1, priceAtPurchase: 2499 },
    { productTitle: "Toskánsko – cestovní průvodce", quantity: 1, priceAtPurchase: 199 },
  ],
  totalAmount: 2698,
  hasCustomItinerary: true,
  adminOrderUrl: "https://admin.example.com/#/orders/a1b2c3d4",
} satisfies AdminOrderNotificationProps;
