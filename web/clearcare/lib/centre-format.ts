// lib/centre-format.ts
// County figures use the same price format as the centre page. The formatter lives apart from
// lib/centres.ts so the tests can load it as it is, without the server client.

// A weekly price in euro: whole euros when it has no cents, as the HSE's lists mostly are.
export function formatWeeklyPrice(price: number) {
  const cents = !Number.isInteger(price);
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(price);
}
