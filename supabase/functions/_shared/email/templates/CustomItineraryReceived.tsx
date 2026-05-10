import { Text, Section } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { CustomItineraryReceivedProps } from "../types.ts";

const textStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: 0,
};

const calloutStyle: React.CSSProperties = {
  backgroundColor: colors.containerBg,
  padding: spacing.lg,
  borderRadius: "6px",
  margin: `${spacing.lg} 0`,
};

const orderNoteStyle: React.CSSProperties = {
  fontSize: sizes.smallText,
  lineHeight: 1.5,
  color: colors.textMuted,
  textAlign: "center",
  marginTop: spacing.lg,
  marginBottom: 0,
};

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function CustomItineraryReceived(props: CustomItineraryReceivedProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Děkujeme za platbu — plánuju tvůj individuální itinerář pro ${props.destination}`}
      heroHeading={`Děkujeme za platbu, ${greeting}!`}
      heroIntro={`Tvoje platba ${formatCZK(props.totalAmount)} dorazila a já se hned vrhám na plánování individuálního itineráře pro ${props.destination}.`}
    >
      <Section style={calloutStyle}>
        <Text style={{ ...textStyle, fontWeight: 700, marginBottom: spacing.sm }}>
          Co bude dál?
        </Text>
        <Text style={textStyle}>
          Připravím itinerář den po dni s mapami, tipy a vlastními zkušenostmi. Hotový průvodce ti pošlu na email — typicky během několika dnů.
        </Text>
      </Section>
      <Text style={textStyle}>
        Pokud máš mezitím jakékoliv další přání nebo otázky, ozvi se mi. Jsem tady pro tebe.
      </Text>
      <Text style={orderNoteStyle}>
        Číslo objednávky: #{props.orderId}
      </Text>
    </BrandLayout>
  );
}

export default CustomItineraryReceived;

CustomItineraryReceived.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-67890",
  totalAmount: 2999,
  destination: "Toskánsko",
} satisfies CustomItineraryReceivedProps;
