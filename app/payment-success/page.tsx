import { redirect } from "next/navigation";

// Legacy Cashfree sandbox page, retired for security (it read tables directly
// from the browser and relied on unauthenticated key-dispensing endpoints).
// Purchases now happen on the home page via the secure wallet / UPI flow.
export default function LegacyPageRedirect() {
  redirect("/");
}
