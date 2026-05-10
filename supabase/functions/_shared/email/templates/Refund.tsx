import { Heading, Text } from "npm:react-email@6";
import * as React from "npm:react@18";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes, spacing } from "./styles.ts";
import type { RefundProps } from "../types.ts";

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

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function Refund(props: RefundProps): React.ReactElement {
  return (
    <BrandLayout preview={`Vrátili jsme ti peníze za objednávku #${props.orderId}.`}>
      <Heading style={headingStyle}>Refund proběhl</Heading>
      <Text style={textStyle}>
        Ahoj {props.customerName},
      </Text>
      <Text style={textStyle}>
        Právě jsme ti vrátili <strong>{formatCZK(props.amount)}</strong> za objednávku <strong>#{props.orderId}</strong>. Peníze by se měly objevit na tvém účtu během několika pracovních dnů — záleží na tvojí bance.
      </Text>
      <Text style={textStyle}>
        Pokud cokoliv k refundu, ozvi se mi. Děkuji za pochopení.
      </Text>
    </BrandLayout>
  );
}
