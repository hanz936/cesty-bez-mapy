import { Text } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { StornoInvoiceProps } from "../types.ts";

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

export function StornoInvoice(props: StornoInvoiceProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Storno faktura ${props.stornoNumber}`}
      heroHeading={`Storno faktura ${props.stornoNumber}`}
      heroIntro={`Ahoj ${greeting}, k objednávce #${props.orderId.slice(0, 8)} jsme vystavili storno fakturu (k původní faktuře ${props.originalInvoiceNumber}). Najdeš ji v příloze.`}
      footerSignoff="Měj se hezky,"
    >
      <Text style={textStyle}>
        Peníze ti vrátíme na účet, ze kterého proběhla platba, obvykle do 5–10 pracovních dní.
      </Text>
      <Text style={noteStyle}>
        Pokud máš jakékoliv otázky k fakturaci, odpověz na tento email a ozveme se.
      </Text>
    </BrandLayout>
  );
}

export default StornoInvoice;

StornoInvoice.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-12345",
  stornoNumber: "2026-S-0001",
  originalInvoiceNumber: "2026-0042",
} satisfies StornoInvoiceProps;
