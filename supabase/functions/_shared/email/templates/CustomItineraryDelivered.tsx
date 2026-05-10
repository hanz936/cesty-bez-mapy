import { Heading, Text, Section, Button } from "npm:react-email@6";
import * as React from "npm:react@18";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import type { CustomItineraryDeliveredProps } from "../types.ts";

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
  display: "inline-block",
};

export function CustomItineraryDelivered(props: CustomItineraryDeliveredProps): React.ReactElement {
  return (
    <BrandLayout preview={`Tvůj individuální itinerář pro ${props.destination} je hotový!`}>
      <Heading style={headingStyle}>Tvůj individuální itinerář je hotový!</Heading>
      <Text style={textStyle}>
        Ahoj {props.customerName},
      </Text>
      <Text style={textStyle}>
        Dokončila jsem pro tebe individuální itinerář pro <strong>{props.destination}</strong>. Den po dni, podle tvých přání. Můžeš ho stáhnout kliknutím na tlačítko níže.
      </Text>

      <Section style={buttonContainer}>
        <Button href={props.downloadUrl} style={buttonStyle}>
          Stáhnout itinerář
        </Button>
      </Section>

      <Section style={calloutStyle}>
        <Text style={{ ...textStyle, margin: 0 }}>
          <strong>Tip:</strong> Stáhni si PDF i do mobilu, ať ho máš po ruce na cestě i offline.
        </Text>
      </Section>

      <Text style={textStyle}>
        Pokud najdeš v itineráři něco, co chceš upravit nebo doplnit, dej mi vědět. Přeju ti skvělou cestu!
      </Text>

      <Text style={{ ...textStyle, fontSize: sizes.smallText, color: colors.textMuted }}>
        Pokud tlačítko nefunguje, zkopíruj tento odkaz do prohlížeče:
        <br />
        {props.downloadUrl}
      </Text>
    </BrandLayout>
  );
}
