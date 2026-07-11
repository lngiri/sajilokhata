# Business Logic, Limits, and Edge Cases

## 1. Dispute Resolution Pipeline
- If a discrepancy arises between a merchant and a customer, either party can flag a transaction as `Disputed`.
- Disputed entries are excluded from active credit balances and held in a `Pending` state until both parties review, modify, and mutually re-approve the log.

## 2. Risk Mitigation & Credit Caps
- Merchants can assign an explicit `Credit Limit` (e.g., NPR 5,000) to each customer.
- The system automatically locks the customer's ability to log new credit entries once this limit is breached, forcing a settlement before further credit extensions.

## 3. Delivery Spoofing Defenses (Geofencing)
- When logging a doorstep delivery, the app queries the delivery agent's native GPS.
- The entry is blocked if the coordinates deviate significantly from the customer's registered home coordinate, eliminating remote or fraudulent logs.

## 4. Partial Payment Settlements
- The architecture treats settlements dynamically. If a total debt is NPR 7,350 and the customer pays NPR 5,000, the ledger treats the incoming cash as a credit entry (`type: credit`).
- The system computes the current balance recursively to update the active outstanding due.

## 5. Account Migration & Recovery
- If a user loses their SIM card or changes numbers, a secure administrative dashboard allows the platform admin to map historical UUID profiles to the new verified MSISDN without losing ledger data.