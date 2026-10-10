import { redirect } from "next/navigation";

// Legacy page removed: it queried the users table directly from the browser
// (plaintext passwords). Authentication now lives on /login (server-verified).
export default function LegacyAuthRedirect() {
  redirect("/login");
}
