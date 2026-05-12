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

const orderNoteStyle: React.CSSProperties = {
  fontSize: sizes.smallText,
  lineHeight: 1.5,
  color: colors.textMuted,
  textAlign: "center",
  marginTop: spacing.xl,
  marginBottom: 0,
};

export function PaymentFailed(props: PaymentFailedProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview="Tvoje platba neprošla. Klidně to zkus znovu."
      heroHeading={`Platba neprošla, ${greeting}`}
      heroIntro="Tvoje platba neprošla. Z účtu se nic nestrhlo, takže můžeš zkusit znovu."
      footerSignoff="Měj se hezky,"
    >
      <Text style={textStyle}>
        Nejčastější důvody jsou nedostatek prostředků na účtu, zamítnutí kartou nebo problém s 3D Secure ověřením. Klidně to zkus znovu, případně s jinou kartou.
      </Text>
      <Section style={buttonContainerStyle}>
        <Button href="https://cestybezmapy.cz/cestovni-pruvodci" style={buttonStyle}>
          Zkusit znovu
        </Button>
      </Section>
      <Text style={noteStyle}>
        Pokud máš s platbou opakovaný problém, ozvi se mi a najdeme řešení.
      </Text>
      <Text style={orderNoteStyle}>
        Reference platby: {props.referenceId}
      </Text>
    </BrandLayout>
  );
}

export default PaymentFailed;

PaymentFailed.PreviewProps = {
  customerName: "Jana Nováková",
  referenceId: "pi_3OoExample123",
} satisfies PaymentFailedProps;
