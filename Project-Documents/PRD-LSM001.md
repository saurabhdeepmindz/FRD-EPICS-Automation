# Product Requirements Document (PRD)

> **Document Flow:** **PRD** → BRD → FRD → Initiative → EPICs → User Stories → Tasks → Subtasks
>
> The PRD is the **single source of truth** for the product being built. It defines the what, why,
> and for whom — bridging business intent with product execution. Every functional feature,
> integration, NFR, compliance mandate, and delivery expectation defined here must trace into one
> or more EPICs and User Stories in the backlog.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRD ID          : PRD-LSM001
Product Name    : Luggage Storage Marketplace
Version         : 1.0
Created Date    : 28-Mar-2026
Last Updated    : 28-Mar-2026
Author          : Ainesh Advani (Founder / Product Owner)
Reviewed By     : TBD
Approved By     : TBD
Status          : Draft
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
|---|---------|
| 1 | Overview / Objective of the Application |
| 2 | High-Level Scope |
| 3 | Out of Scope |
| 4 | Assumptions and Constraints |
| 5 | Actors / User Types |
| 6 | Functional Requirements / Functional Features |
| — | 6.1 Authentication & Account Creation |
| — | 6.2 Account Verification (KYC) |
| — | 6.3 Host Onboarding & Listings |
| — | 6.4 Search & Discovery |
| — | 6.5 Booking & Reservations |
| — | 6.6 Payments, Refunds & Payouts |
| — | 6.7 Drop-off & Pickup Verification |
| — | 6.8 Ratings, Reviews & Trust Badges |
| — | 6.9 Notifications & Messaging |
| — | 6.10 Terms, Conditions & Disclaimers |
| — | 6.11 Admin Panel (Back Office) |
| — | 6.12 Edge Cases & Business Rules |
| — | 6.13 Disputes, Support & Incident Handling |
| 7 | Integration Requirements |
| 8 | Customer Journeys / Flows |
| 9 | Functional Landscape |
| 10 | Non-Functional Requirements |
| — | 10.1 Performance |
| — | 10.2 Scalability |
| — | 10.3 Availability & Reliability |
| — | 10.4 Security |
| — | 10.5 Privacy & Compliance |
| — | 10.6 Maintainability |
| — | 10.7 Audit & Logs |
| 11 | Technology |
| 12 | DevOps and Observability |
| 13 | UI/UX Requirements |
| 14 | Branding Requirements |
| 15 | Compliance Requirements |
| 16 | Testing Requirements |
| 17 | Key Deliverables |
| 18 | Receivables |
| 19 | Environment |
| 20 | High-Level Timelines |
| 21 | Success Criteria |
| 22 | Miscellaneous Requirements |
| — | Revision History |

---

## 1. Overview / Objective of the Application

### 1.1 Product Vision

**Luggage Storage Marketplace** is a two-sided marketplace web platform — the "Airbnb for Luggage" — that connects travelers needing short-term luggage storage with verified space owners who have unused, secure storage capacity. It enables travelers to roam hands-free while empowering hosts to monetize idle space.

### 1.2 Problem Statement

Travelers — whether tourists, transit passengers, or day-trippers — frequently need a safe, affordable, and conveniently located place to store their luggage for hours or days. Existing options (hotel concierges, lockers at stations) are limited in availability, expensive, or lack trust. Meanwhile, thousands of shops, hotels, homes, and warehouses have unused secure space sitting idle.

### 1.3 Solution

A web-first marketplace that:
- Allows **Guests** to discover verified nearby storage locations, book by bag and duration, pay securely, and drop/pick up luggage through a verified OTP/code-based handover process.
- Allows **Hosts** to list their space, manage bookings, perform secure check-in/check-out, and receive payouts.
- Allows the **Platform (Admin)** to verify hosts, moderate listings, manage disputes/refunds, configure pricing/commissions, and monitor the marketplace health.

### 1.4 Deployment Phase

| Phase | Scope | Platform |
|-------|-------|----------|
| Phase 0 (MVP) | Core marketplace — onboarding, listing, discovery, booking, payment, check-in/out, admin | Web Application |
| Phase 1+ | Advanced pricing, mobile app, AI fraud detection, smart lockers, multi-language | Mobile App + Web Enhancements |

### 1.5 Stakeholders

| Role | Name / Team |
|------|------------|
| Founder / Owner | Ainesh Advani |
| Product Owner | Ainesh Advani |
| Development Firm | TBD |
| Operations Team | TBD |
| Support Team | TBD |

---

## 2. High-Level Scope

### 2.1 MVP (Phase 0 — Web Application)

The MVP delivers a fully functional luggage storage marketplace covering:

| # | Capability | Description |
|---|-----------|-------------|
| 1 | Seamless Onboarding & Listing | User registration/login (Guest/Host) via Google OAuth; Host KYC submission; Listing creation and admin approval workflow |
| 2 | Discovery | Location-based search using Google Maps + list view; availability-based search by dates |
| 3 | Pricing & Booking | Price per bag per day (platform-set); booking flow with overbooking prevention; full booking state machine |
| 4 | Trust & Safety | Reviews/ratings; basic KYC/ID capture (manual review); OTP/QR-based verified drop-off and pickup |
| 5 | Payments & Refunds | Stripe (international) and Razorpay (India); configurable refund rules; platform commission; host payouts; PCI compliance via gateway |
| 6 | Operations & Customer Care | Admin panel for user/listing/booking oversight; payout ledger; support ticket and incident management |
| 7 | Communication | Email notifications for all booking events; in-app chat between guest and host |

### 2.2 Multi-Phase Roadmap Summary

| Phase | Key Features |
|-------|-------------|
| MVP (Phase 0) | As above — web application |
| Phase 1 | Capacity locking, host-controlled pricing, OTP login, Apple/Facebook auth, AI fraud detection, loyalty/coupons, multi-language, multi-currency |
| Phase 2+ | Mobile application (iOS/Android), smart lockers, insurance workflows, corporate partnerships API |

---

## 3. Out of Scope

The following are explicitly **excluded from MVP (Phase 0)**:

### 3.1 Pricing & Booking
- Capacity locking for selected time windows (with timeout)
- Auto-disabling of storage location from search once capacity is full
- Landmark proximity filter
- Host-controlled pricing (hosts cannot set their own price in MVP; platform sets price)
- 3D image of host space and capacity management
- OTP-based authentication
- Social logins (Apple, Facebook)

### 3.2 Trust & Safety
- Smart locker integration
- Insurance claim handling workflows
- Full automated KYC/ID verification
- Luggage Tag Code
- AI fraud detection

### 3.3 Operations & Customer Care
- Loyalty program, coupons, multi-day discounts
- Host Listings automated verification
- Multi-city corporate partnerships API
- Multi-language support (beyond English)
- Full multi-timezone and local currency support (configurable)
- Mobile application (iOS/Android)
- Price review by admin and approval on host edits
- Pickup luggage from user's location (logistics pickup)

### 3.4 Payments & Refunds
- Advanced dynamic pricing determined by duration, season, or host preferences
- Refund rule updates based on post-launch user feedback (requires change management)

### 3.5 Communication
- Booking confirmation via WhatsApp and SMS
- Association/preference-driven notification channels

---

## 4. Assumptions and Constraints

| # | Assumption / Constraint |
|---|------------------------|
| AC-01 | Host KYC verification will be performed manually by the Admin in MVP |
| AC-02 | Guest and Host must be 18 years of age or above |
| AC-03 | Guest KYC verification will be performed by the Host at the time of physical drop-off using government ID |
| AC-04 | Drop-off and pickup must be verifiable via OTP or booking code |
| AC-05 | Luggage storage duration range: minimum 1 day, maximum 365 days |
| AC-06 | Location services are required (Google Maps + GPS for current location detection) |
| AC-07 | Guests must comply with the platform's and hosts' luggage rules and regulations, including prohibited items |
| AC-08 | Pricing is per bag per day. A day is counted as every 24 hours starting from the drop-off time. Partial days are rounded up to the next full day. Optional minimum charges apply. |
| AC-09 | Platform commission model: default 40% platform / 60% host (configurable by admin as percentage or fixed fee) |
| AC-10 | Supported currencies in MVP: INR, USD, EUR |
| AC-11 | Date/time and number formatting are localised to the listing's country (e.g., IST always explicit when operating in India) |
| AC-12 | All environments (Dev, Test, Staging, Production) are to be provisioned and maintained by the client on AWS |
| AC-13 | Development timelines will be estimated by the development team based on resource loading and effort estimation |
| AC-14 | In MVP, pricing is set by the platform — hosts do not have pricing control |

---

## 5. Actors / User Types

| Actor | Role | Key Permissions |
|-------|------|----------------|
| **Guest (End User)** | Traveler seeking luggage storage | Search listings, book, pay, drop-off, pickup, review host |
| **Host (Service Provider)** | Space owner offering storage | Create/manage listings, approve/reject bookings, perform check-in/out, receive payouts, review guest |
| **Admin (Platform Operator)** | Platform administrator | Verify hosts (KYC), approve/reject listings, manage disputes/refunds, configure commissions, monitor KPIs |
| **Support Agent** | Customer support | Handle tickets, manage escalations, assist in dispute resolution |
| **System (Automated)** | Background processing | Auto-reject unconfirmed bookings after 6 hours, apply late fees, trigger notifications, process payouts |

### 5.1 Dual-Role Users

A user may register as both a Guest and a Host but must use separate onboarding flows for each role. A single account can carry both roles simultaneously.

---

## 6. Functional Requirements / Functional Features

### 6.1 Module: Authentication & Account Creation

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-01 | Google OAuth Sign-up/Login | User signs up/logs in via Google OAuth through Firebase | Single OAuth provider for MVP |
| FR-02 | Role Selection at Registration | User registers as Guest, Host, or both — with separate onboarding flows per role | Dual-role allowed; flows are separate |
| FR-03 | Profile Management | Manage: Full name, phone number, alternate phone, email, profile photo, date of birth | All fields validated at input |
| FR-04 | Device & Session Management | Active sessions tracked; session timeout at 5 minutes of inactivity; session extension supported | One active session per device (configurable) |

### 6.2 Module: Account Verification (KYC)

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-05 | Host KYC Submission | Host submits: Legal Name, DOB, Country, Government ID type, Government ID number, Selfie | Mandatory before listing can be created |
| FR-06 | Admin KYC Review & Notification | Admin reviews submitted KYC and approves or rejects with reason; Host is notified via email | Host cannot create listings until KYC is approved |

### 6.3 Module: Host Onboarding & Listings

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-07 | Create Listing | Host creates listing with: property type, title, description (auto-set initially), full address + map pin, photos (min 2, select main), storage capacity per size (Small/Regular/Large), allowed/prohibited items, operating hours, blackout days, safety features (CCTV, Staff, WiFi, Restrooms) | Listing title auto-set to "<User's property type>" initially |
| FR-08 | Listing Status Workflow | Draft → Submit → Pending Review → Approved / Not Approved → Active / Inactive | Notifications sent at each state transition |
| FR-09 | Listing Availability Management | Weekly schedule + exceptions (calendar), block times, blackout days/holidays, price per bag per day (platform-set), minimum booking duration, cancellation policy, directions (Google/Apple Maps) | Price set by platform in MVP; host cannot change |

**Bag Size Definitions:**

| Size | Examples |
|------|---------|
| Small | Tote bags, purses, handbags |
| Regular | Suitcases, backpacks |
| Large | Odd-sized goods — cartons, cycles, golf bags |

### 6.4 Module: Search & Discovery (Guest)

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-10 | Guest Search | Search by: current location (GPS), city, landmark, or map; date/time range; "open now" filter | GPS location permission must be requested |
| FR-11 | Search Results — Map + List | Results shown on both map and list view; displays price, rating, open/closed status relative to listing's local time zone | Open/closed computed against listing's timezone |
| FR-12 | Filters | Filter by: Rating, Open Now, Storage type, Security features, Restroom, WiFi | Multiple filters combinable |
| FR-13 | Listing Detail Page | Shows: property details, photos, availability, perks, total price breakdown, prohibited items (checkbox + policy link), cancellation/refund policy, reviews | Prohibited items checkbox must be confirmed at checkout |

### 6.5 Module: Booking & Reservations

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-14 | Guest Booking Selections | Select: start/end date-time, number of bags, bag size | System auto-calculates total days from drop-off time |
| FR-15 | Pricing Calculation | Price = bag count × duration (days) × rate; line items show taxes, platform fees, commission; final price is tax-inclusive | Partial days rounded up to next full day |
| FR-16 | Payment Page | Payment via UPI, Google Pay, Card; T&C acceptance (with hyperlink) mandatory before confirming | Guest must accept T&C before payment |
| FR-17 | Booking State Machine | Pending Host Confirmation → Pending Payment → Confirmed → Checked-in → Completed / Cancelled / No-show / Host Not Available → Initiate Refund → Refunded | Auto-reject after 6 hours if host does not respond; auto-accept configurable |
| FR-18 | Booking Confirmation | Sent after payment: Booking ID, host address + navigation link, drop-off instructions, secure OTP/QR code | Delivered via email |
| FR-19 | Booking Modifications | Time extension allowed if capacity permits; pricing difference collected or refunded automatically | Extension subject to host capacity |

**Booking Auto-Rejection Rule:** Booking request auto-rejected if host does not approve within 6 hours (configurable). Host can toggle between auto-accept and manual approval.

### 6.6 Module: Payments, Refunds & Payouts

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-20 | Payment Gateway Integration | Razorpay (India), Stripe (international) | Gateway selected based on guest's country |
| FR-21 | Idempotency | Idempotency key on all payment and booking create requests; retry-safe | Prevents duplicate charges |
| FR-22 | 3DS Compliance | Full 3D Secure authentication flow supported | Mandatory for card payments |
| FR-23 | Payment Status Tracking | States: Initiated / Success / Failed / Refunded | All states logged with timestamp |
| FR-24 | Refund Rules | Configurable by admin; default: full refund if cancelled ≥ 24 hours before booking start; 0% refund if cancelled within 24 hours | Admin can override per case |
| FR-25 | Host Payout Handling | Bank account setup; wallet ledger (earnings + refunds); payout schedule: monthly + post-booking-completion (configurable); exportable statements (CSV/PDF); no card data stored in backend | Payout only after booking marked Completed |

### 6.7 Module: Drop-off & Pickup Verification

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-26 | Drop-off Verification by Host | Host verifies: OTP from guest app or booking code; guest government ID; checks for prohibited items; uploads photos of ID + luggage with condition remarks | All steps mandatory; host cannot mark checked-in without completing verification |
| FR-27 | Mark Checked-In | Host marks booking as "Checked In" after successful drop-off verification | Triggers check-in notification to guest |
| FR-28 | Bag Count Confirmation | Host confirms number and size of bags at drop-off | Discrepancy noted in remarks |
| FR-29 | Optional Condition Photos | Host can optionally photograph bags and add condition notes | Useful for dispute resolution |
| FR-30 | Pickup Verification | Host verifies OTP/checkout code + government ID; uploads luggage photos; marks booking "Completed" | Mandatory for checkout completion |
| FR-31 | Late Pickup Handling | If pickup time exceeded: system applies late fee (configurable), notifies guest, shows "Overdue" on host dashboard | Late fee rules configurable by admin |

### 6.8 Module: Ratings, Reviews & Trust Badges

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-32 | Guest Reviews Host | Guest rates (1–5 stars) with optional comment after booking completion | Only available post-Completed status |
| FR-33 | Host Reviews Guest | Host can also rate and review the guest after completion | Mutual review system |
| FR-34 | Review Moderation | Admin has moderation tools to flag, hide, or remove reviews | Reviews visible only after moderation pass |
| FR-35 | Trust Badges | Displayed on listing: "Verified Provider", "CCTV Available", "High Rating", "Fast Check-in" | Auto-awarded based on data criteria |
| FR-36 | In-App Support | FAQ page; support ticket submission with booking reference; admin/support resolution workflow via email integration | Ticket status visible to guest |

### 6.9 Module: Notifications & Messaging

| FR-ID | Feature | Description | Business Rule |
|-------|---------|-------------|---------------|
| FR-37 | Email Notifications | Triggered for: Booking Request, Booking Confirmation, Payment Confirmation, Payout Confirmation, Reminder before drop-off/pickup, Cancellation/Refund updates, Check-in/out updates, Overdue pickup, Refund Issued, Admin push notifications | Email is primary notification channel in MVP; SMS/WhatsApp in future phases |
| FR-38 | In-App Chat | Messaging between Guest ↔ Host after booking is confirmed; phone numbers masked (not shared by default) | Chat disabled before booking confirmation |

### 6.10 Module: Terms, Conditions & Disclaimers

| FR-ID | Feature | Description |
|-------|---------|-------------|
| FR-39 | Host Disclaimer | Hosts must confirm they list only spaces that belong to them |
| FR-40 | Guest Disclaimer | Guests must carry government ID at time of drop-off |
| FR-41 | Refund Policy Link | "Refund Policy" link displayed adjacent to the Confirm Booking button |
| FR-42 | Guest Warranty | Guest represents and warrants that all luggage deposited belongs to them |

### 6.11 Module: Admin Panel (Back Office)

| FR-ID | Feature | Description |
|-------|---------|-------------|
| FR-43 | Admin Dashboard | KPI view: total bookings, revenue, active disputes, average ratings, host/guest counts |
| FR-44 | User/Host Management | Verify (Approve/Reject with reason), Suspend/Blacklist, View/search users, Reset verification status, Audit log, Document review |
| FR-45 | Listing Management | Approve/Reject listings, Edit, Deactivate, Flag suspicious listings; all listings visible only post-approval |
| FR-46 | Booking Management | Cancel in unusual circumstances, issue refunds, resolve disputes |
| FR-47 | Policy Configuration | Manage commissions, taxes, policies, coupons |
| FR-48 | Audit Logs | Critical actions logged with user ID, timestamp, session ID |
| FR-49 | Financial Controls | Configure commission/service fees; taxes/fee rules by city/country; refund overrides; payout batch management; export reports (CSV/PDF) |

### 6.12 Module: Edge Cases & Business Rules

| FR-ID | Rule | Description |
|-------|------|-------------|
| FR-50 | Post-Check-in Booking Change | Guest can extend or reduce booking duration post-check-in; price difference collected or refunded automatically |
| FR-97 | Minimum Booking Duration | 1 day |
| FR-98 | Maximum Booking Duration | 365 days |
| FR-99A | Multiple Active Bookings | A guest **cannot** have multiple active bookings at the same time |
| FR-99B | Same Listing Double Booking | A guest **cannot** book the same listing twice concurrently |
| FR-100 | Deactivated Listings | Deactivated or rejected listings do not appear in search results |
| FR-101 | Cancellation Policy | Full refund ≥ 24 hours prior to start; 0% refund within 24 hours (admin-configurable) |
| FR-102 | Booking Mode Toggle | Host can toggle between "Instant Booking" (auto-accept) and "Manual Approval" |
| FR-103 | Prohibited Items Enforcement | Prohibited items list must be acknowledged by guest at booking confirmation |

### 6.13 Module: Disputes, Support & Incident Handling

| FR-ID | Feature | Description |
|-------|---------|-------------|
| FR-51 | Dispute Types | Damaged item, Missing item, Provider unavailable, Wrong charges / refund issue |
| FR-52 | Dispute Console | Assign to agent; facilitate photo uploads by guest/host; view chat logs, check-in/out evidence, booking event lifecycle; apply adjustments/refunds |
| FR-53 | Support Ticket System | In-app ticket creation with attachments; status tracking; admin resolution workflow |

---

## 7. Integration Requirements

| INT-ID | Integration | Provider | Purpose | Phase |
|--------|------------|---------|---------|-------|
| INT-01 | Google Maps Platform | Google | Geocoding, map pins, location search, distance, navigation links | MVP |
| INT-02 | Payment Gateway — India | Razorpay | INR payment processing, 3DS, refunds, payouts | MVP |
| INT-03 | Payment Gateway — International | Stripe | USD/EUR payment processing, 3DS, refunds, payouts | MVP |
| INT-04 | Authentication | Firebase Auth | Google OAuth sign-in | MVP |
| INT-05 | Email Notifications | SendGrid | Transactional email (booking, confirmation, alerts) | MVP |
| INT-06 | SMS Notifications | Twilio (or local provider) | SMS alerts | Phase 1 |
| INT-07 | Push Notifications | Firebase Cloud Messaging | In-app push notifications | Phase 1 |
| INT-08 | Analytics | GA4 + Mixpanel | User behaviour, funnel tracking, KPI monitoring | MVP |
| INT-09 | Cloud Storage | AWS S3 | Host listing photos, luggage photos, KYC documents | MVP |
| INT-10 | WhatsApp Notifications | TBD | Booking confirmation + alerts | Phase 1 |

---

## 8. Customer Journeys / Flows

### 8.1 Guest Journey

```
Register/Login (Google OAuth)
        │
        ▼
Select City / Use Current Location / Browse Map
        │
        ▼
Search Storage Locations (Map + List view)
        │
        ▼
View Listing Detail (price, photos, reviews, restrictions)
        │
        ▼
Select Drop-off & Pickup Date-Time + Bag Count + Bag Size
        │
        ▼
Initiate Booking → Await Host Confirmation (auto or manual, ≤6 hrs)
        │
        ▼
Confirm T&C + Make Payment (UPI / Card / Google Pay)
        │
        ▼
Receive Booking Confirmation (email + OTP/QR code + navigation link)
        │
        ▼
Drop Luggage → Host Verifies OTP + Government ID → Mark Checked-In
        │
        ▼
Pick Up Luggage → Host Verifies OTP + Government ID → Mark Completed
        │
        ▼
Receive Invoice Receipt
        │
        ▼
Rate / Review Host
        │
        ▼
Raise Support Request (if needed)
```

### 8.2 Host Journey

```
Signup/Login as Host → Create Profile
        │
        ▼
Submit KYC (Legal Name, DOB, Govt. ID, Selfie)
        │
        ▼
Admin Reviews & Approves KYC → Host Notified
        │
        ▼
Create Listing (address, photos, capacity, hours, rules, safety features)
        │
        ▼
Submit Listing → Admin Review → Approved → Active
        │
        ▼
Receive Booking Request → Approve or Reject with Reason
        │
        ▼
At Drop-off: Collect Govt. ID + OTP Verification + Upload Photos → Mark Checked-In
        │
        ▼
At Pickup: Verify OTP + Govt. ID + Upload Photos → Mark Completed
        │
        ▼
View Earnings Dashboard → Request Payout
        │
        ▼
Rate / Review Guest
```

### 8.3 Admin Journey

```
Monitor KPI Dashboard (bookings, revenue, disputes, ratings)
        │
        ├── Review & Approve Host KYC
        ├── Approve / Reject / Edit Listings
        ├── Manage Users (suspend, blacklist, reset)
        ├── Handle Disputes & Issue Refunds
        ├── Configure Commissions, Taxes, Policies
        ├── Monitor Reviews
        └── Finance Reconciliation (payouts, ledger, exports)
```

### 8.4 Support Agent Journey

```
View Open Tickets → Assign to Self
        │
        ▼
Review Booking Evidence (photos, chat logs, lifecycle)
        │
        ▼
Communicate with Guest/Host → Apply Resolution (refund / adjustment)
        │
        ▼
Close Ticket → Log Resolution
```

---

## 9. Functional Landscape

The platform consists of the following functional modules and their interactions:

| Module | Consumes | Provides |
|--------|---------|---------|
| Auth & Profiles | Firebase Auth, User DB | Identity token, role, session |
| KYC & Verification | Admin workflow, AWS S3 (docs) | Verified host status |
| Listings | KYC status, Google Maps, S3 | Available listings, search index |
| Search & Discovery | Google Maps, Listings DB, Geo index | Filtered listing results |
| Booking Engine | Listings, Pricing config, User | Booking record, state transitions |
| Payments | Razorpay/Stripe, Booking | Payment confirmation, refund, payout |
| Drop-off/Pickup | Booking, OTP service, S3 | Verified check-in/out, condition records |
| Notifications | SendGrid, FCM | Email/push alerts to all actors |
| Reviews & Trust | Completed bookings | Ratings, badges |
| In-App Chat | Confirmed bookings | Masked messaging channel |
| Admin Panel | All modules | Full oversight and configuration |
| Dispute/Support | Booking, Chat, Photos, Payment | Resolved disputes, refunds |
| Analytics | All events | GA4 / Mixpanel dashboards |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| NFR-ID | Requirement | Target |
|--------|------------|--------|
| NFR-P01 | Search result load time | < 1 second under normal load |
| NFR-P02 | Responsive UI | Works on all screen sizes (desktop, tablet, mobile browser) |
| NFR-P03 | Booking transactional integrity | No double-booking by same user; database-level locks with indexing |
| NFR-P04 | Session timeout | 5 minutes of inactivity; session extension supported |
| NFR-P05 | Map / Geo performance | Use geohash or PostGIS (GIST index) on coordinates; pre-compute "open now" flags per day/hour |

### 10.2 Scalability

| NFR-ID | Requirement |
|--------|------------|
| NFR-S01 | Platform must support multi-city expansion without re-architecture |
| NFR-S02 | Architecture must allow independent horizontal scaling of API, database, and search layers |

### 10.3 Availability & Reliability

| NFR-ID | Requirement | Target |
|--------|------------|--------|
| NFR-A01 | Uptime target (MVP) | 99.9999% |
| NFR-A02 | Automated backups | Daily automated backups; disaster recovery plan documented |

### 10.4 Security

| NFR-ID | Requirement |
|--------|------------|
| NFR-SEC01 | All data in transit encrypted via TLS |
| NFR-SEC02 | Payment handling compliant with PCI DSS (via gateway) |
| NFR-SEC03 | Role-based access control: Guest / Host / Admin / Support Agent |
| NFR-SEC04 | Rate limiting and anti-bot protection on login, OTP, and booking endpoints |
| NFR-SEC05 | Logging and monitoring for suspicious activity |
| NFR-SEC06 | Vulnerability Assessment and Penetration Testing (VAPT) prior to go-live |
| NFR-SEC07 | Multiple attempt restrictions on booking, editing, and authentication actions |
| NFR-SEC08 | OWASP Top 10 protections implemented |

### 10.5 Privacy & Compliance

| NFR-ID | Requirement |
|--------|------------|
| NFR-PRIV01 | Comply with India DPDP Act and GDPR (if operating globally) |
| NFR-PRIV02 | Clear data retention and deletion processes documented and implemented |
| NFR-PRIV03 | Explicit user consent required for GPS/location permissions |

### 10.6 Maintainability

| NFR-ID | Requirement |
|--------|------------|
| NFR-M01 | Clean, modular codebase with documented REST APIs (Swagger/OpenAPI) |
| NFR-M02 | Automated tests for booking and payment flows |
| NFR-M03 | CI/CD pipeline for automated build, test, and deployment |

### 10.7 Audit & Logs

| NFR-ID | Requirement |
|--------|------------|
| NFR-LOG01 | Action logs for all Admin, User, and Host critical actions |
| NFR-LOG02 | Booking lifecycle event log from booking creation to cancellation or completion |
| NFR-LOG03 | Every transaction tracked via session ID; all actions tagged against it |

---

## 11. Technology

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Node.js | Primary API and business logic layer |
| AI / ML | Python | Used for any AI/ML features (Phase 1+: fraud detection, recommendations) |
| Frontend | Next.js | Server-side rendering, responsive across all screen sizes |
| Database | PostgreSQL | Primary relational database; PostGIS extension for geospatial queries |
| Authentication | Firebase Auth | Google OAuth sign-in |
| Payment — India | Razorpay | INR transactions |
| Payment — International | Stripe | USD/EUR transactions |
| Maps | Google Maps Platform | Geocoding, map pins, distance, navigation |
| Email | SendGrid | Transactional email notifications |
| Cloud Storage | AWS S3 | Photos, KYC documents, luggage condition images |
| Analytics | GA4 + Mixpanel | Behavioural analytics and funnel tracking |
| CSS Framework | Tailwind CSS + Material Design | UI component styling |

---

## 12. DevOps and Observability

| Area | Technology | Detail |
|------|-----------|--------|
| Cloud Provider | AWS | All environments hosted on AWS |
| Source Control | GitHub | Mono-repo or split-repo (to be decided by dev team) |
| CI/CD | GitHub Actions | Automated build, test, lint, and deploy pipelines |
| Containerisation | Docker + Docker Compose | Local dev and deployment containers |
| Environment Provisioning | Client-managed on AWS | Dev, Test, Staging, Production environments |
| Monitoring | TBD (AWS CloudWatch / Datadog) | Application and infrastructure monitoring |
| Logging | TBD | Centralised log aggregation |
| Alerting | TBD | Threshold-based alerts for errors, latency, fraud signals |

---

## 13. UI/UX Requirements

### 13.1 Design Direction

The platform UI/UX shall take design inspiration from [claude.ai](https://claude.ai/) — clean, minimal, professional, content-focused aesthetic.

### 13.2 Design System

| Element | Standard |
|---------|---------|
| Component Library | Material Design (Google) |
| CSS Utility Framework | Tailwind CSS |
| Responsive Breakpoints | Mobile (≥320px), Tablet (≥768px), Desktop (≥1280px) |
| Accessibility | WCAG 2.1 AA compliance target |

### 13.3 Guest App Screens

| Screen | Description |
|--------|------------|
| Onboarding / Login | Google OAuth sign-in, role selection |
| Home / Search + Map | Location input, map view with listing pins, date picker |
| Filters + Listing Cards | Filter panel, listing grid/list cards |
| Listing Detail | Full details, price breakdown, reviews, prohibited items, booking CTA |
| Booking Checkout + Payment | Bag selections, pricing summary, payment form, T&C |
| My Bookings | Upcoming and completed bookings list |
| Booking Details | Drop-off/pickup OTP/QR code, status, navigation link |
| Profile | User details, edit profile |
| Support | FAQ, raise ticket |
| Reviews | View and submit reviews |

### 13.4 Host App Screens

| Screen | Description |
|--------|------------|
| Host Dashboard | Booking summary, earnings snapshot, alerts |
| Create / Edit Listing | Multi-step listing creation form |
| Availability Calendar | Schedule view, blackout management |
| Booking Requests & Schedule | Incoming requests, approve/reject |
| Verify Drop-off / Pickup | OTP entry, photo upload, bag count confirmation |
| Earnings & Payouts | Wallet ledger, payout request, export |
| Profile Settings | Host profile, KYC status |
| Guest Reviews | Review guests, view own reviews |

### 13.5 Admin Web Panel Screens

| Screen | Description |
|--------|------------|
| Dashboard | Platform KPIs |
| User Management | Host/Guest search, verify, suspend |
| Listing Management | Approve, reject, deactivate |
| Booking / Payment Management | View, cancel, refund |
| Dispute / Support Management | Ticket queue, dispute console |
| Configuration | Commission, fees, refund rules, policies |

---

## 14. Branding Requirements

| Element | Value |
|---------|-------|
| Product Name | **Luggage Storage Marketplace** (final brand name) |
| Tagline | TBD — Owner to provide |
| Logo | TBD — Owner to provide |
| Brand Colour Palette | TBD — to be aligned with design during UI/UX phase |
| Typography | TBD — Material Design / Tailwind defaults as baseline |
| Tone of Voice | Trustworthy, friendly, professional |

> **Note:** Logo, colour palette, and tagline to be provided by the owner before UI design commences. Design phase blocked on brand assets.

---

## 15. Compliance Requirements

| Compliance Area | Requirement |
|-----------------|------------|
| Data Privacy — India | India Digital Personal Data Protection (DPDP) Act compliance |
| Data Privacy — Global | GDPR compliance for users in the EU/EEA |
| Payment Security | PCI DSS compliance enforced via payment gateway (Razorpay / Stripe) |
| 3DS Authentication | 3D Secure (3DS) flows implemented for card payments |
| Location Data | Explicit user consent required before accessing GPS |
| Age Restriction | Platform enforces minimum age of 18 years at registration |
| Prohibited Items | Platform maintains and enforces a prohibited items policy acknowledged at checkout |
| Data Retention | Data retention and deletion processes defined, documented, and implemented |
| Audit Trail | All critical actions logged with user ID, timestamp, and session ID |

---

## 16. Testing Requirements

### 16.1 Testing Types

| Type | Scope |
|------|-------|
| Unit Testing | Backend services, frontend components |
| API Testing | All REST API endpoints |
| Integration Testing | Payment flows, Google Maps, email notifications, audit trail |
| UAT | End-to-end user journeys (Guest, Host, Admin) |
| Security Testing | VAPT (Vulnerability Assessment and Penetration Testing) |
| Performance Testing | End-to-end flow under load; search response time < 1s |
| Regression Testing | After each release |

### 16.2 Must-Pass Test Scenarios

| # | Scenario |
|---|---------|
| TP-01 | Search → Initiate Booking → ID Verification & Host Approval → Payment → Drop-off Verified → Pickup Verified → Review |
| TP-02 | Overbooking prevention under concurrent booking attempts |
| TP-03 | Full payment workflow (UPI, Card, Google Pay) |
| TP-04 | Refund workflow end-to-end |
| TP-05 | Admin disables a listing → listing disappears from search immediately |
| TP-06 | Host payout ledger reconciles correctly after cancellations and refunds |
| TP-07 | Guest cannot make multiple active bookings simultaneously |
| TP-08 | Guest cannot book the same listing twice concurrently |
| TP-09 | Booking auto-rejected after 6 hours with no host response |
| TP-10 | Late pickup triggers late fee and "Overdue" status on host dashboard |

---

## 17. Key Deliverables

### 17.1 Documentation

| # | Deliverable |
|---|------------|
| D-01 | Requirements Specifications (this PRD + FRD) |
| D-02 | High-Level Design (HLD) covering system architecture and user flows |
| D-03 | Low-Level Design (LLD) covering component and data model design |
| D-04 | Test Cases and Results for SIT, UAT, Performance Testing, NFR Testing |
| D-05 | Installation and Configuration Manual |
| D-06 | Operations Document |
| D-07 | User Manual (Guest + Host + Admin) |

### 17.2 Software

| # | Deliverable |
|---|------------|
| S-01 | Backend APIs with Swagger / Postman collection |
| S-02 | Web Application (Next.js, responsive) |
| S-03 | Deployment setup scripts + environment configuration |
| S-04 | Source code repository (GitHub) |
| S-05 | Docker Compose files for local and staging environments |

### 17.3 Post-Go-Live

| # | Deliverable |
|---|------------|
| PGL-01 | Post-go-live support plan |
| PGL-02 | Defined SLAs for production support |

---

## 18. Receivables

Items to be provided **by the client** to the development team before or during development:

| # | Receivable | Required By | Owner |
|---|-----------|------------|-------|
| R-01 | GitHub access (organisation and repository) | Project kick-off | Ainesh Advani |
| R-02 | Jira access (project board and backlog) | Project kick-off | Ainesh Advani |
| R-03 | Google Maps API key | Before search/discovery development | Ainesh Advani |
| R-04 | Razorpay account credentials (test + production) | Before payment development | Ainesh Advani |
| R-05 | Stripe account credentials (test + production) | Before payment development | Ainesh Advani |
| R-06 | AWS account access (IAM roles for dev team) | Before infrastructure setup | Ainesh Advani |
| R-07 | SendGrid API key | Before notifications development | Ainesh Advani |
| R-08 | Firebase project credentials (Google OAuth) | Before auth development | Ainesh Advani |
| R-09 | Brand assets (logo, colour palette, typography) | Before UI design phase | Ainesh Advani |
| R-10 | Domain name and SSL certificate | Before staging/production setup | Ainesh Advani |
| R-11 | Approved UAT test users (Guest and Host) | Before UAT phase | Ainesh Advani |

---

## 19. Environment

All environments are to be provisioned and maintained by the **client on AWS**.

| Environment | Purpose | Managed By |
|------------|---------|-----------|
| Development | Active development and unit testing | Development team |
| Test / SIT | System integration testing | QA team |
| Staging | UAT and pre-production validation | Client + Dev team |
| Production | Live system for end users | Client (with dev team support) |

**Environment Requirements:**
- Each environment to have independent AWS infrastructure (EC2/ECS, RDS PostgreSQL, S3 buckets)
- Environment-specific secrets managed via AWS Secrets Manager or `.env` files (not committed to Git)
- Staging must mirror production configuration exactly
- Database snapshots from Staging used for performance testing

---

## 20. High-Level Timelines

> Development timelines will be estimated and shared by the development team based on best resource loading and effort estimation following PRD sign-off.

| Milestone | Description | Target Date |
|-----------|------------|------------|
| M-01 | PRD Sign-off | TBD — Owner to approve |
| M-02 | HLD / LLD Completion | TBD — Dev team to estimate |
| M-03 | Development Completion (MVP) | TBD — Dev team to estimate |
| M-04 | SIT Completion | TBD — Dev team to estimate |
| M-05 | UAT Completion | TBD — Owner + Dev team |
| M-06 | VAPT Completion | TBD — Security team |
| M-07 | Staging Deployment | TBD |
| M-08 | Production Go-Live (MVP) | TBD |
| M-09 | Post-Go-Live Hypercare End | TBD — typically 2–4 weeks post go-live |

---

## 21. Success Criteria

### 21A. Business Success Criteria

| SC-ID | Criterion | Target | Measurement Method | Window | Owner |
|-------|----------|--------|-------------------|--------|-------|
| SC-B01 | All test cases executed successfully | 100% pass rate (0 P1/P2 defects open) | Test execution report | Before go-live | QA Lead |
| SC-B02 | End-to-end booking flow functional | Guest can search → book → pay → drop-off → pickup without manual intervention | UAT sign-off | UAT phase | Product Owner |
| SC-B03 | Host onboarding operational | Host can register, submit KYC, create listing, and receive first booking | UAT sign-off | UAT phase | Product Owner |
| SC-B04 | Payment reconciliation accurate | Host payout ledger reconciles with payments collected — 0 discrepancy | Financial reconciliation report | Post-UAT | Finance |
| SC-B05 | Dispute resolution workflow live | Admin can raise, assign, and resolve a dispute end-to-end | Functional test | SIT phase | QA Lead |

### 21B. Operational / Technical Success Criteria

| SC-ID | Criterion | Target | Measurement Method | Window | Owner | Related NFR |
|-------|----------|--------|-------------------|--------|-------|-------------|
| SC-T01 | Search performance | < 1 second under normal load | Performance test report | Pre-go-live | Dev Lead | NFR-P01 |
| SC-T02 | Platform uptime | 99.9999% | AWS CloudWatch uptime report | First 30 days post go-live | DevOps | NFR-A01 |
| SC-T03 | Security — VAPT clear | Zero Critical/High vulnerabilities open at go-live | VAPT report | Pre-go-live | Security team | NFR-SEC06 |
| SC-T04 | Double-booking prevention | Zero duplicate active bookings per guest | Automated regression test | Pre-go-live | QA Lead | FR-99A |
| SC-T05 | Payment success rate | ≥ 95% of initiated payments complete successfully | Payment gateway dashboard | First 30 days | Dev Lead | NFR-SEC02 |

### 21C. Hypercare / Go-Live Readiness Gate

The following conditions must all be met before production go-live is approved:

1. All Must-Pass Test Scenarios (TP-01 to TP-10) passed with sign-off
2. VAPT completed — zero Critical or High severity findings open
3. All SC-B01 to SC-B05 and SC-T01 to SC-T05 satisfied
4. All Receivables (R-01 to R-11) provided by the client
5. Production environment provisioned and smoke-tested
6. Post-go-live support plan and SLAs agreed and signed
7. Admin and Support Agent training completed
8. Rollback plan documented and tested

**Sign-off Owners:** Product Owner (Ainesh Advani), QA Lead, Dev Lead, DevOps Lead

---

## 22. Miscellaneous Requirements

### 22A. Raw Input Log

> Verbatim inputs from customer that do not fit existing sections — preserved as-is for traceability.

**Input 1 — Source: SRS v1.0 Section 9.4 (Business Rules), 15-Feb-2026**
> "FR-99 Multiple bookings check"

*(This was an undescribed rule in the SRS — clarified via gap analysis on 28-Mar-2026)*

**Input 2 — Source: Gap Analysis Response, 28-Mar-2026 (Ainesh Advani)**
> "No the guest cannot have multiple active bookings at the same time. The guest cannot book the same listing twice concurrently."

### 22B. Structured Miscellaneous Requirements

| MISC-ID | Summary | Source | Classification | Migration Target | Owner | Related EPICs | Status |
|---------|---------|--------|---------------|-----------------|-------|--------------|--------|
| MISC-001 | Guest cannot have multiple active bookings simultaneously | Gap Analysis — Ainesh Advani, 28-Mar-2026 | Business Rule | Section 6.12 (FR-99A) | Product Owner | EPIC: Booking Engine | Migrated — FR-99A |
| MISC-002 | Guest cannot book the same listing twice concurrently | Gap Analysis — Ainesh Advani, 28-Mar-2026 | Business Rule | Section 6.12 (FR-99B) | Product Owner | EPIC: Booking Engine | Migrated — FR-99B |

### 22C. Migration Tracker

| MISC-ID | Migrated To | Migration Date | Notes |
|---------|------------|---------------|-------|
| MISC-001 | Section 6.12, FR-99A | 28-Mar-2026 | Clarification of ambiguous FR-99 in SRS |
| MISC-002 | Section 6.12, FR-99B | 28-Mar-2026 | Clarification of ambiguous FR-99 in SRS |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 28-Mar-2026 | Ainesh Advani / PRD Author | Initial PRD created from SRS v1.0 (15-Feb-2026) using 22-section PRD template; gap analysis conducted; Sections 21 and 22 added |
