import { button, DEMO_NOTICE, emailLayout, heading, MUTED, paragraph } from "@/emails/layout";
import { formatDateTime } from "@/lib/dates";
import type { Email } from "@/lib/email";
import { escapeHtml } from "@/lib/email";
import type { OrderDetails } from "@/lib/orders";
import { formatPrice } from "@/lib/pricing";

// The "order confirmed" email, built twice: as HTML and as plain text.

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function orderConfirmationEmail(order: OrderDetails, siteUrl: string): Omit<Email, "to"> {
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const trackingUrl = new URL(`/orders/${order.id}`, siteUrl).toString();
  const firstName = order.shippingName?.trim().split(/\s+/)[0];
  const delivery = order.events.find((event) => event.type === "delivered");

  const address = order.shippingAddress;
  const addressLines = [
    order.shippingName,
    address?.line1,
    address?.line2,
    [[address?.postal_code, address?.city].filter(Boolean).join(" "), address?.state].filter(Boolean).join(", "),
    address?.country ? countryNames.of(address.country) : null,
  ].filter((line): line is string => Boolean(line));

  const totals: [string, string][] = [
    ["Subtotal", formatPrice(order.subtotalCents)],
    ["Shipping", order.shippingCents !== null ? formatPrice(order.shippingCents) : "—"],
    ["Total paid", order.totalCents !== null ? formatPrice(order.totalCents) : "—"],
  ];

  const subject = `Order ${orderNumber} confirmed`;
  const greeting = firstName ? `Hi ${firstName}, we've` : "We've";
  const intro = `${greeting} received your payment for order ${orderNumber}. Your books are being packed now.`;

  // ---- Plain text ----
  const text = [
    "Thank you for your order!",
    "",
    intro,
    "",
    `Track your order: ${trackingUrl}`,
    "",
    "Your books",
    ...order.items.map((item) => `- ${item.title} × ${item.quantity}: ${formatPrice(item.unitPriceCents * item.quantity)}`),
    "",
    ...totals.map(([label, value]) => `${label}: ${value}`),
    "",
    "Ships to",
    ...addressLines,
    ...(order.shipment ? ["", `${order.shipment.carrier}, tracking number ${order.shipment.trackingNumber}`] : []),
    ...(delivery ? [`Estimated delivery: ${formatDateTime(delivery.happensAt)}`] : []),
    "",
    DEMO_NOTICE,
  ].join("\n");

  // ---- HTML ----
  // Every value that came from outside (book titles from Open Library, names and addresses typed
  // on the payment page) goes through escapeHtml, so it shows as text and never runs as HTML.
  const e = escapeHtml;
  const cell = "padding:8px 0;border-bottom:1px solid #e4e4e7";

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="${cell}">${e(item.title)} <span style="${MUTED}">× ${item.quantity}</span></td>
          <td align="right" style="${cell};white-space:nowrap">${formatPrice(item.unitPriceCents * item.quantity)}</td>
        </tr>`,
    )
    .join("");

  const totalRows = totals
    .map(([label, value], index) => {
      const isLast = index === totals.length - 1;
      const style = isLast ? "padding:8px 0 0;font-weight:700;font-size:16px" : `padding:4px 0;${MUTED}`;
      return `
        <tr>
          <td style="${style}">${label}</td>
          <td align="right" style="${style}">${value}</td>
        </tr>`;
    })
    .join("");

  const shipmentHtml = order.shipment
    ? `<p style="margin:16px 0 0;${MUTED}">${e(order.shipment.carrier)} · tracking number
         <span style="font-family:monospace">${e(order.shipment.trackingNumber)}</span>
         ${delivery ? `<br>Estimated delivery: ${formatDateTime(delivery.happensAt)}` : ""}</p>`
    : "";

  const html = emailLayout({
    title: subject,
    preview: intro,
    body: `
      ${heading("Thank you for your order!")}
      ${paragraph(intro)}
      ${button(trackingUrl, "Track your order")}

      <h2 style="margin:0 0 4px;font-size:16px">Your books</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}${totalRows}</table>

      <h2 style="margin:32px 0 4px;font-size:16px">Ships to</h2>
      <p style="margin:0;line-height:1.5">${addressLines.map(e).join("<br>")}</p>
      ${shipmentHtml}`,
  });

  return { subject, html, text };
}
