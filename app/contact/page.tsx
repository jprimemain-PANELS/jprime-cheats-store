import { OwnerOnly } from "@/components/owner-only";

export default function ContactPage() {
  return (
    <OwnerOnly>
      <ContactPageContent />
    </OwnerOnly>
  );
}

function ContactPageContent() {
  return (
    <div className="p-10 text-white">
      <h1>Contact Us</h1>
      <p>Telegram Support: https://t.me/JPRIMEADMIN</p>
      <p>Email: jprimemain@gmail.com</p>
    </div>
  );
}