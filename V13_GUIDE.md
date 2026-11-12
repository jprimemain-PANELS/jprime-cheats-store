# v13 - Wallet QR upgrade
- QR now valid 5 minutes (or less if the gateway says so). Countdown ring turns red in the last minute.
- At zero: one last payment check, then "Payment session expired" is shown and the wallet closes and sends the customer to the home page.
- New secure-style QR screen: secure badge, live-check dot, big exact amount, steps, order id, UPI ID copy, security note.
- Only components/wallet-modal.tsx changed. No SQL. Success flow, Telegram and polling are unchanged.
