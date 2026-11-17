import { randomInt } from "node:crypto";
import type { ShipmentEventType } from "@/db/schema";
import { distanceKm, type Place } from "@/lib/romania";

// "Demo Courier", a pretend delivery company. When an order is paid it plans the whole trip at once,
// with a time for every step. The tracking page shows the steps whose time has already passed.
// Real deliveries take days; this one takes about 13 minutes, so visitors can watch it happen.

export const CARRIER_NAME = "Demo Courier";

const WAREHOUSE: Place = { name: "Bookshop warehouse, Bucharest", lat: 44.4497, lng: 25.9815 };

// One sorting hub per region, on the edge of its city like real ones (so the last stretch to
// the buyer shows on the map). Every parcel goes through Bucharest, then the hub nearest the buyer.
const BUCHAREST_HUB: Place = { name: "Bucharest sorting hub", lat: 44.49, lng: 26.2 };
const HUBS: Place[] = [
  BUCHAREST_HUB,
  { name: "Cluj-Napoca hub", lat: 46.81, lng: 23.74 },
  { name: "Iași hub", lat: 47.18, lng: 27.68 },
  { name: "Timișoara hub", lat: 45.77, lng: 21.29 },
  { name: "Brașov hub", lat: 45.66, lng: 25.51 },
  { name: "Craiova hub", lat: 44.37, lng: 23.73 },
  { name: "Constanța hub", lat: 44.23, lng: 28.56 },
];

export type PlannedEvent = {
  type: ShipmentEventType;
  description: string;
  place: Place;
  happensAt: Date;
};

export function planShipment(destination: Place, paidAt: Date) {
  const at = (minutes: number) => new Date(paidAt.getTime() + minutes * 60_000);
  const regionalHub = HUBS.reduce((best, hub) =>
    distanceKm(hub, destination) < distanceKm(best, destination) ? hub : best,
  );

  const events: PlannedEvent[] = [
    { type: "packed", description: "Packed at the warehouse", place: WAREHOUSE, happensAt: at(1) },
    { type: "picked_up", description: `Picked up by ${CARRIER_NAME}`, place: WAREHOUSE, happensAt: at(2) },
    { type: "arrived_at_hub", description: "Arrived at the sorting hub", place: BUCHAREST_HUB, happensAt: at(3) },
  ];

  let lastHubTime = 3;
  if (regionalHub !== BUCHAREST_HUB) {
    events.push(
      { type: "departed_hub", description: "On its way to the regional hub", place: BUCHAREST_HUB, happensAt: at(5) },
      { type: "arrived_at_hub", description: "Arrived at the regional hub", place: regionalHub, happensAt: at(9) },
    );
    lastHubTime = 9;
  }

  events.push(
    { type: "out_for_delivery", description: "Out for delivery", place: regionalHub, happensAt: at(lastHubTime + 2) },
    { type: "delivered", description: "Delivered", place: destination, happensAt: at(lastHubTime + 4) },
  );

  // Tracking numbers look like real ones: "DC" plus 10 random digits.
  const trackingNumber = `DC${randomInt(1_000_000_000, 10_000_000_000)}`;
  return { trackingNumber, events };
}

// What the buyer sees for each step, and how far along the progress bar it is (0 = just paid).
export const PROGRESS_STEPS = ["Paid", "Packed", "Shipped", "Out for delivery", "Delivered"] as const;

export function progressFor(latest: ShipmentEventType | null): { step: number; label: string } {
  switch (latest) {
    case null:
      return { step: 0, label: "Preparing your order" };
    case "packed":
      return { step: 1, label: "Packed" };
    case "picked_up":
      return { step: 2, label: "Shipped" };
    case "arrived_at_hub":
    case "departed_hub":
      return { step: 2, label: "In transit" };
    case "out_for_delivery":
      return { step: 3, label: "Out for delivery" };
    case "delivered":
      return { step: 4, label: "Delivered" };
  }
}
