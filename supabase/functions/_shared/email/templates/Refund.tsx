// @ts-nocheck — React email šablona; typy řeší esbuild při deploy, není cíl CORR-02 (viz plán F-1 Task 5)
import { Text } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { RefundProps } from "../types.ts";

const textStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: `0 0 ${sizes.bodyText}`,
};

const noteStyle: React.CSSProperties = {
  ...textStyle,
  color: colors.textMuted,
  fontSize: sizes.smallText,
  margin: 0,
};

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

export function Refund(props: RefundProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Vrátili jsme ti ${formatCZK(props.amount)} za objednávku #${props.orderId}.`}
      heroHeading={`Vrátili jsme ti peníze, ${greeting}`}
      heroIntro={`Právě jsme ti vrátili ${formatCZK(props.amount)} za objednávku #${props.orderId}.`}
      footerSignoff="Měj se hezky,"
    >
      <Text style={textStyle}>
        Peníze by se měly objevit na tvém účtu během několika pracovních dnů. Záleží to na tvojí bance.
      </Text>
      <Text style={noteStyle}>
        Pokud máš jakékoli otázky, ozvi se mi. Děkuju za pochopení.
      </Text>
    </BrandLayout>
  );
}

export default Refund;

Refund.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-12345",
  amount: 199,
} satisfies RefundProps;