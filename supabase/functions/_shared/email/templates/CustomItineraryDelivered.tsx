import { Text, Section, Button } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { CustomItineraryDeliveredProps } from "../types.ts";

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

const buttonContainerStyle: React.CSSProperties = {
  textAlign: "center",
  paddingTop: spacing.lg,
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

export function CustomItineraryDelivered(props: CustomItineraryDeliveredProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Tvůj individuální itinerář pro ${props.destination} je hotový!`}
      heroHeading={`Tvůj individuální itinerář je hotový, ${greeting}!`}
      heroIntro={`Dokončila jsem pro tebe individuální itinerář pro ${props.destination}. Plánovala jsem ho den po dni přesně podle tvých přání.`}
    >
      <Section style={buttonContainerStyle}>
        <Button href={props.downloadUrl} style={buttonStyle}>
          Stáhnout itinerář
        </Button>
      </Section>
      <Section style={calloutStyle}>
        <Text style={{ ...textStyle, margin: 0 }}>
          <strong>Tip:</strong> Než vyrazíš, ulož si průvodce do mobilu. Bude ti dělat společnost i tam, kde nemáš signál.
        </Text>
      </Section>
      <Text style={textStyle}>
        Pokud najdeš v itineráři něco, co chceš upravit nebo doplnit, dej mi vědět. Přeju ti skvělou cestu!
      </Text>
      <Text style={fallbackTextStyle}>
        Pokud tlačítko nefunguje, zkopíruj tento odkaz:<br />
        <span style={fallbackUrlStyle}>{props.downloadUrl}</span>
      </Text>
    </BrandLayout>
  );
}

export default CustomItineraryDelivered;

CustomItineraryDelivered.PreviewProps = {
  customerName: "Jana Nováková",
  destination: "Toskánsko",
  downloadUrl: "https://cestybezmapy.cz/stahnout?token=preview456",
} satisfies CustomItineraryDeliveredProps;
