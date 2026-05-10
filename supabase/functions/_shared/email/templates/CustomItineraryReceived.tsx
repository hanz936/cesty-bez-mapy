import { Heading, Text, Section } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import type { CustomItineraryReceivedProps } from "../types.ts";

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

const calloutStyle: React.CSSProperties = {
  backgroundColor: colors.containerBg,
  padding: spacing.lg,
  borderRadius: "6px",
  margin: `${spacing.lg} 0`,
};

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function CustomItineraryReceived(props: CustomItineraryReceivedProps): React.ReactElement {
  return (
    <BrandLayout preview={`Děkujeme za platbu, ${props.customerName}. Plánuju tvůj individuální itinerář.`}>
      <Heading style={headingStyle}>Děkujeme za platbu, {props.customerName}!</Heading>
      <Text style={textStyle}>
        Tvoje platba ve výši <strong>{formatCZK(props.totalAmount)}</strong> dorazila a já se hned vrhám na plánování tvého individuálního itineráře pro <strong>{props.destination}</strong>.
      </Text>
      <Section style={calloutStyle}>
        <Text style={{ ...textStyle, margin: 0 }}>
          <strong>Co bude dál?</strong> Připravím itinerář den po dni s mapami, tipy a vlastními zkušenostmi. Hotový průvodce ti pošlu na email — typicky během několika dnů.
        </Text>
      </Section>
      <Text style={textStyle}>
        Pokud máš mezitím jakékoliv další přání nebo otázky, ozvi se mi. Jsem tady pro tebe.
      </Text>
      <Text style={{ ...textStyle, fontSize: sizes.smallText, color: colors.textMuted }}>
        Číslo objednávky: #{props.orderId}
      </Text>
    </BrandLayout>
  );
}

export default CustomItineraryReceived;

CustomItineraryReceived.PreviewProps = {
  customerName: "Jana",
  orderId: "ord-67890",
  totalAmount: 2999,
  destination: "Toskánsko",
} satisfies import("../types.ts").CustomItineraryReceivedProps;
