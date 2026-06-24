// @ts-nocheck — React email šablona; typy řeší esbuild při deploy, není cíl CORR-02 (viz plán F-1 Task 5)
import { Heading, Text } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { CustomItineraryReceivedProps } from "../types.ts";

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
  margin: `0 0 ${spacing.md}`,
};

const lastTextStyle: React.CSSProperties = {
  ...textStyle,
  margin: 0,
};

const orderNoteStyle: React.CSSProperties = {
  fontSize: sizes.smallText,
  lineHeight: 1.5,
  color: colors.textMuted,
  textAlign: "center",
  marginTop: spacing.xl,
  marginBottom: 0,
};

export function CustomItineraryReceived(props: CustomItineraryReceivedProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview="Děkujeme za platbu, plánuju tvůj individuální itinerář."
      heroHeading={`Děkujeme za platbu, ${greeting}!`}
      heroIntro="Tvoje platba dorazila a já se hned vrhám na plánování tvého individuálního itineráře."
      footerSignoff="Brzy se ozvu,"
    >
      <Heading as="h2" style={sectionHeadingStyle}>Co bude dál?</Heading>
      <Text style={textStyle}>
        Připravím ti itinerář den po dni, s mapami, tipy a vlastními zkušenostmi z cest. Hotový průvodce ti pošlu e-mailem, typicky během několika dnů.
      </Text>
      <Text style={lastTextStyle}>
        Mezitím se mi klidně ozvi, kdykoli budeš mít další přání nebo otázky. Jsem tu pro tebe.
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
} satisfies CustomItineraryReceivedProps;