// Dates are stored in UTC. A Romanian shop shows them in Romanian time, whatever the server's clock is set to.
const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(date: Date) {
  return dateTime.format(date);
}

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(date: Date) {
  return dateOnly.format(date);
}
