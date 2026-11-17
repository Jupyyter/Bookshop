// The return policy, as plain functions with no database or server code, so both the server
// (which decides) and the return form in the browser (which shows the amount live) use the same rules.

export const RETURN_WINDOW_DAYS = 30;

export const RETURN_REASONS = ["changed_mind", "damaged", "wrong_item", "arrived_late", "other"] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  changed_mind: "I changed my mind",
  damaged: "It arrived damaged",
  wrong_item: "I got the wrong book",
  arrived_late: "It arrived too late",
  other: "Something else",
};

// Our mistake (not the buyer's): then the shipping they paid is refunded too.
const OUR_FAULT: ReturnReason[] = ["damaged", "wrong_item"];

export type ReturnLine = { unitPriceCents: number; quantity: number };

// What the buyer gets back: the price of every book they return. Shipping is added when it was our
// fault AND this return sends back everything that was still left in the order.
export function refundFor(opts: {
  lines: ReturnLine[];
  reason: ReturnReason;
  returnsEverythingLeft: boolean;
  shippingCents: number;
}): { itemsCents: number; shippingCents: number; totalCents: number } {
  const itemsCents = opts.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const shippingCents = opts.returnsEverythingLeft && OUR_FAULT.includes(opts.reason) ? opts.shippingCents : 0;
  return { itemsCents, shippingCents, totalCents: itemsCents + shippingCents };
}

// The simulated trip back to us, like the delivery: shortened to minutes so you can watch it happen.
export function planReturnTrip(startedAt: Date) {
  const later = (minutes: number) => new Date(startedAt.getTime() + minutes * 60_000);
  return {
    droppedOffAt: later(2), // the courier picks the parcel up
    receivedAt: later(4), // it arrives at our warehouse
    refundDueAt: later(5), // checked, refund goes out
  };
}

export const RETURN_STEPS = ["Return started", "On its way back", "Received", "Refunded"] as const;
