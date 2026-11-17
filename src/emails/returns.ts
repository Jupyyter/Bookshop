import { button, DEMO_NOTICE, emailLayout, heading, MUTED, paragraph } from "@/emails/layout";
import type { Email } from "@/lib/email";
import { escapeHtml } from "@/lib/email";
import { formatPrice } from "@/lib/pricing";

type ReturnForEmail = {
  id: string;
  returnCode: string;
  refundCents: number;
  includesShipping: boolean;
  items: { title: string; quantity: number; unitPriceCents: number }[];
};

function itemsBlock(ret: ReturnForEmail) {
  const text = ret.items.map((item) => `- ${item.title} × ${item.quantity}`);
  const html = `<p style="margin:0 0 16px;line-height:1.6">${ret.items
    .map((item) => `${escapeHtml(item.title)} <span style="${MUTED}">× ${item.quantity}</span>`)
    .join("<br>")}</p>`;
  return { text, html };
}

function build(subject: string, title: string, lines: string[], ret: ReturnForEmail, url: string, label: string): Omit<Email, "to"> {
  const items = itemsBlock(ret);
  return {
    subject,
    text: [title, "", ...lines, "", "Books in this return:", ...items.text, "", `${label}: ${url}`, "", DEMO_NOTICE].join("\n"),
    html: emailLayout({
      title: subject,
      preview: lines[0],
      body: `${heading(title)}${lines.map(paragraph).join("")}
        <h2 style="margin:24px 0 8px;font-size:16px">Books in this return</h2>${items.html}
        ${button(url, label)}`,
    }),
  };
}

export function returnStartedEmail(ret: ReturnForEmail, siteUrl: string) {
  const amount = formatPrice(ret.refundCents);
  return build(
    `Return ${ret.returnCode} started`,
    "Your return has started",
    [
      `Pack the books and write the code ${ret.returnCode} on the parcel, then hand it to any Demo Courier point.`,
      `Once the books are back with us, we refund ${amount}${ret.includesShipping ? " (including shipping)" : ""} to the card you paid with.`,
      "This is a demo: the courier collects the parcel on its own after a couple of minutes.",
    ],
    ret,
    `${siteUrl}/account/returns/${ret.id}`,
    "Follow your return",
  );
}

export function refundSentEmail(ret: ReturnForEmail, siteUrl: string) {
  const amount = formatPrice(ret.refundCents);
  return build(
    `${amount} refunded for return ${ret.returnCode}`,
    `We've refunded ${amount}`,
    [
      `Your books arrived, so we've sent ${amount} back to the card you paid with.`,
      "Banks usually take 5 to 10 business days to show a refund on your statement.",
    ],
    ret,
    `${siteUrl}/account/returns/${ret.id}`,
    "See your return",
  );
}
