import { Text, Section, Button } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { PaymentFailedProps } from "../types.ts";

const textStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: `0 0 ${spacing.md}`,
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

const noteStyle: React.CSSProperties = {
  ...textStyle,
  fontSize: sizes.smallText,
  color: colors.textMuted,
  textAlign: "center",
  margin: 0,
};

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function PaymentFailed(props: PaymentFailedProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview="Tvá platba se nezdařila — můžeš to zkusit znovu."
      heroHeading={`Tvá platba se nezdařila, ${greeting}`}
      heroIntro={`Pokus o platbu ${formatCZK(props.amount)} za objednávku #${props.orderId} nebyl úspěšný. Z tvého účtu se nic nestrhlo.`}
    >
      <Text style={textStyle}>
        Nejčastější důvody: nedostatek prostředků, zamítnutí kartou nebo problém s 3D Secure ověřením. Můžeš to zkusit znovu — případně s jinou kartou.
      </Text>
      <Section style={buttonContainerStyle}>
        <Button href="https://cestybezmapy.cz/cestovni-pruvodci" style={buttonStyle}>
          Zkusit znovu
        </Button>
      </Section>
      <Text style={noteStyle}>
        Pokud máš s platbou opakovaný problém, ozvi se mi a najdeme řešení.
      </Text>
    </BrandLayout>
  );
}

export default PaymentFailed;

PaymentFailed.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-12345",
  amount: 199,
} satisfies PaymentFailedProps;
