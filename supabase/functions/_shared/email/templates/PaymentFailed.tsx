import { Heading, Text, Section, Button } from "npm:react-email@6";
import * as React from "npm:react@18";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import type { PaymentFailedProps } from "../types.ts";

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

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function PaymentFailed(props: PaymentFailedProps): React.ReactElement {
  return (
    <BrandLayout preview={`Tvá platba se nezdařila — můžeš to zkusit znovu.`}>
      <Heading style={headingStyle}>Tvá platba se nezdařila</Heading>
      <Text style={textStyle}>
        Ahoj {props.customerName},
      </Text>
      <Text style={textStyle}>
        Pokus o platbu <strong>{formatCZK(props.amount)}</strong> za objednávku <strong>#{props.orderId}</strong> nebyl úspěšný. Z tvého účtu se nic nestrhlo.
      </Text>
      <Text style={textStyle}>
        Nejčastější důvody: nedostatek prostředků, zamítnutí kartou nebo problém s 3D Secure ověřením. Můžeš to zkusit znovu — případně s jinou kartou.
      </Text>
      <Section style={buttonContainer}>
        <Button href="https://cestybezmapy.cz/cestovni-pruvodci" style={buttonStyle}>
          Zkusit znovu
        </Button>
      </Section>
      <Text style={{ ...textStyle, fontSize: sizes.smallText, color: colors.textMuted }}>
        Pokud máš s platbou opakovaný problém, ozvi se mi a najdeme řešení.
      </Text>
    </BrandLayout>
  );
}
