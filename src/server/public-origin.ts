export function getPublicOrigin(): string {
  const configured = process.env.RENDER_EXTERNAL_URL ?? process.env.PPDC_PUBLIC_ORIGIN ?? "http://localhost:3000";
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("The public origin must use HTTPS or a local loopback address.");
  }
  return url.origin;
}
