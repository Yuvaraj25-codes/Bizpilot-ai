# BizPilot AI Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` and its subcollections (`private`, `products`, `orders`, `expenses`, `invoices`) MUST carry `ownerId == request.auth.uid == userId` and require `request.auth.token.email_verified == true`.
2. **Master Gate Integrity**: Subcollection writes (`products`, `orders`, `expenses`, `invoices`, `private`) require the parent `/users/{userId}` workspace document to exist.
3. **Immutable Ownership & Creation Time**: `ownerId` and `createdAt` cannot change after creation; `createdAt` and `updatedAt` must match `request.time`.
4. **Terminal State Locking**: Orders with `status == 'cancelled'` and Invoices with `status == 'paid'` cannot be modified after reaching their terminal state.
5. **Bounded Arrays & Strict String Sizes**: `items` arrays on Orders and Invoices are bounded to `1 <= items.size() <= 25` with `items[0] is map`, and all string fields enforce explicit `.size()` bounds.
6. **PII Isolation**: User email/displayName live under `/users/{userId}/private/profile`, readable and writable only by the authenticated owner.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /users/uid1/products/prod1` with `auth == null`.
2. **Unverified Email Write**: `CREATE /users/uid1` with `auth = { uid: 'uid1', token: { email_verified: false } }`.
3. **Cross-Tenant Read**: `GET /users/uid1/orders/ord1` authenticated as `uid2`.
4. **Identity Spoofing on Create**: `CREATE /users/uid1/products/prod1` with `ownerId: 'uid2'` authenticated as `uid1`.
5. **Shadow / Ghost Field Injection**: `CREATE /users/uid1/products/prod1` including extra field `isAdmin: true`.
6. **ID Poisoning**: `CREATE /users/uid1/products/bad$id!withSpaces` failing `isValidId()`.
7. **Orphan Subcollection Write**: `CREATE /users/uid1/products/prod1` when parent `/users/uid1` does not exist.
8. **Client-Spoofed Timestamp**: `CREATE /users/uid1/expenses/exp1` with `createdAt: '2020-01-01T00:00:00Z'` instead of `request.time`.
9. **Immutable Field Mutation**: `UPDATE /users/uid1/orders/ord1` attempting to alter `createdAt` or `ownerId`.
10. **Terminal State Bypass**: `UPDATE /users/uid1/invoices/inv1` when `existing.status == 'paid'`.
11. **Unbounded Array / Type Poisoning**: `CREATE /users/uid1/orders/ord1` with `items: []` or `items.size() > 25` or `items[0]: "string"`.
12. **Blanket List Query Scraping**: `LIST /users/uid1/orders` requested by `uid2` without owner match.
