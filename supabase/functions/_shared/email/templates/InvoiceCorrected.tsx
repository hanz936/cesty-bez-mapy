import { Text } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { InvoiceCorrectedProps } from "../types.ts";

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

export function InvoiceCorrected(props: InvoiceCorrectedProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Opravená faktura ${props.newInvoiceNumber}`}
      heroHeading={`Opravená faktura ${props.newInvoiceNumber}`}
      heroIntro={`Ahoj ${greeting}, vystavili jsme novou fakturu ${props.newInvoiceNumber}. Původní fakturu ${props.oldInvoiceNumber} jsme stornovali.`}
      footerSignoff="Měj se hezky,"
    >
      <Text style={textStyle}>
        Použij prosím přiloženou fakturu pro účetnictví. Starou nepoužívej.
      </Text>
      <Text style={noteStyle}>
        Pokud máš jakékoliv otázky k fakturaci, odpověz na tento email a ozveme se.
      </Text>
    </BrandLayout>
  );
}

export default InvoiceCorrected;

InvoiceCorrected.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-12345",
  oldInvoiceNumber: "2026-0042",
  newInvoiceNumber: "2026-0043",
} satisfies InvoiceCorrectedProps;
