// @ts-nocheck — React email šablona; typy řeší esbuild při deploy, není cíl CORR-02 (viz plán F-1 Task 5)
import { Text } from "react-email";
import * as React from "react";
import { BrandLayout } from "./BrandLayout.tsx";
import { colors, sizes } from "./styles.ts";
import type { InvoiceAlertProps } from "../types.ts";

const textStyle: React.CSSProperties = {
  fontSize: sizes.bodyText,
  lineHeight: 1.6,
  color: colors.text,
  margin: `0 0 ${sizes.bodyText}`,
};

const errorStyle: React.CSSProperties = {
  ...textStyle,
  fontFamily: "monospace",
  fontSize: sizes.smallText,
  backgroundColor: "#f5f5f5",
  padding: "12px",
  borderRadius: "4px",
  whiteSpace: "pre-wrap",
};

export function InvoiceAlert(props: InvoiceAlertProps): React.ReactElement {
  return (
    <BrandLayout
      preview={`Fakturoid chyba: order ${props.orderId}`}
      heroHeading="Fakturoid chyba"
      heroIntro={`Akce '${props.action}' na objednávce ${props.orderId.slice(0, 8)} selhala.`}
      footerSignoff="Toto je interní alert,"
    >
      <Text style={textStyle}>
        <strong>Order ID:</strong> {props.orderId}
      </Text>
      <Text style={textStyle}>
        <strong>Akce:</strong> {props.action}
      </Text>
      <Text style={errorStyle}>
        {props.errorMessage}
      </Text>
    </BrandLayout>
  );
}

export default InvoiceAlert;

InvoiceAlert.PreviewProps = {
  orderId: "ord-12345-abc",
  action: "create_invoice",
  errorMessage: "Fakturoid 422: subject.registration_no can't be blank",
} satisfies InvoiceAlertProps;