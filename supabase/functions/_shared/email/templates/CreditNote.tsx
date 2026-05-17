import { Text } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes } from "./styles.ts";
import { vocativeFirstName } from "../vocative.ts";
import type { CreditNoteProps } from "../types.ts";

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

export function CreditNote(props: CreditNoteProps): React.ReactElement {
  const greeting = vocativeFirstName(props.customerName);
  return (
    <BrandLayout
      preview={`Opravný daňový doklad ${props.creditNoteNumber}`}
      heroHeading={`Opravný daňový doklad ${props.creditNoteNumber}`}
      heroIntro={`Ahoj ${greeting}, k objednávce #${props.orderId.slice(0, 8)} jsme vystavili opravný daňový doklad (dobropis). Najdeš ho v příloze.`}
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

export default CreditNote;

CreditNote.PreviewProps = {
  customerName: "Jana Nováková",
  orderId: "ord-12345",
  creditNoteNumber: "2026-D-0001",
} satisfies CreditNoteProps;
