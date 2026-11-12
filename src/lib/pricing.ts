// Placeholder prices until the fake supplier feed exists.
// Prices are whole cents (1799 = €17.99). Money is never stored as a float,
// because 0.1 + 0.2 !== 0.3 in floating point.

export function priceCentsFor(bookId: string, pages: number | null): number {
  // Turn the ID into a stable number, so the same book always gets the same price.
  let hash = 0;
  for (const char of bookId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  const base = 8 + (pages ?? 300) / 40; // longer books cost more
  const variation = (hash % 600) / 100; // 0.00 to 5.99, different for each book
  return (Math.floor(base + variation) + 1) * 100 - 1; // always ends in .99
}

const euros = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

export function formatPrice(cents: number) {
  return euros.format(cents / 100);
}