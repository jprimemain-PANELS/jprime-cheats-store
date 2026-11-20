/** Role names that count as a reseller purchase (their prices are never shown in Telegram alerts). */
export const isResellerRole = (role: unknown) => /reseller|vip/i.test(String(role ?? ""));
