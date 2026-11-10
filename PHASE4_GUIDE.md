# v7 – what changed

Push the code (git add . / commit / push). No new SQL. (If you have not run SQL 004, 005, 006 yet, run them first.)

## Co-admin: Add Product (new, simpler)
1. **Delivery (from durations)** is now a choice: Local Stock, your own API sellers (by the name the store gave), or **JPRIME API stock**.
2. Choose JPRIME API stock -> a **JPRIME products** box appears. Pick any of your products. Its durations appear with your cost, the name box is filled in, and the store only sets its own prices.
3. The store can change the product name (for example "silent panel - root mobile") or leave yours.
4. The list now includes ALL your products: API ones and local-key ones. Local-key products are sold from your own key stock and the cost is taken from the store wallet the same way.

## Domain
- When a store upgrades to its own domain and it is live, its old free address shows: "This website has changed to a new address. Click the new website link."
- The store admin has to log in again on the new address.
- The Domain tab is only usable when you switch **Custom domain: on** for that store (Co-admins tab) and SQL 004 is run.

## Delete store (Co-admins tab)
- "Delete store" -> type the store name. Its website address stops working immediately and the name becomes free. Customer and money history is kept (hidden, store suspended). To fully erase data it must be done in the database.

## Setup Guide tab (both admin pages)
Easy steps with buttons: Cloudinary (video link), image2url (image link), and the payment gateway (gateway.anujbots.in) with exactly where to paste each link.

## Honest limits
- Tested with automated tests (174) and a build, not clicked on a live site.
- For local-key products sold via JPRIME, if your key stock is empty the customer sees an error and the store is refunded automatically.
- Gateway steps come from that site's public page today; if their screens change, the guide text may need an update.
