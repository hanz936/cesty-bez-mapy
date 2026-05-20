import { Text } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { InvoiceProps } from "../types.ts";

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

export function Invoice(props: InvoiceProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Faktura ${props.invoiceNumber} – Cesty bez mapy`}
      heroHeading={`Faktura ${props.invoiceNumber}`}
      heroIntro={`Ahoj ${greeting}, v příloze najdeš fakturu za objednávku #${props.orderId.slice(0, 8)}.`}
      footerSignoff="Měj se hezky,"
    >
      <Text style={textStyle}>
        Děkujeme za nákup! PDF faktury je přílohou tohoto emailu.
      </Text>
      <Text style={noteStyle}>
        Pokud máš jakékoliv otázky k fakturaci, odpověz na tento email a ozveme se.
      </Text>
    </BrandLayout>
  );
}

export default Invoice;

Invoice.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-12345",
  invoiceNumber: "2026-0042",
} satisfies InvoiceProps;
