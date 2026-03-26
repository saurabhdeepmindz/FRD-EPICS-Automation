# SubTask Template

> **Document Flow:** BRD → FRD → Initiative → EPIC → User Story → **SubTask**
>
> A SubTask is the most granular unit of work in the delivery hierarchy. It belongs
> to exactly one User Story and is owned by one developer, tester, or engineer.
> Unlike the User Story which describes *what* to build and *why*, the SubTask
> describes *how* to build it — with detailed, sequential implementation steps
> that a team member can follow from start to finish.
>
> One User Story can have multiple SubTasks. SubTasks are independently
> assignable, estimable, and completable within a sprint.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SubTask ID      : ST-[XXX]
User Story ID   : US-[XXX]
EPIC ID         : EPIC-[XXX]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Sprint          : Sprint-[XX]
Assigned To     : [Name / Role]
Estimated Hours : [X hrs]
Status          : [ To Do | In Progress | In Review | Done ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 1 | EPIC Context |
| 2 | User Story Context |
| 3 | SubTask ID |
| 4 | SubTask Description |
| 5 | Steps |
| — | Revision History |

---

## 1. EPIC Context

> **Guideline:** Provides the top-level traceability anchor for this SubTask.
> Copy these values directly from the parent EPIC document.
> This context helps any reader immediately understand the business domain
> this SubTask operates in without needing to open multiple documents.

```
EPIC ID          : EPIC-[XXX]
EPIC Description : [One-line description of the EPIC's purpose and scope]

Example:
  EPIC ID          : EPIC-001
  EPIC Description : End-to-end digital onboarding covering customer registration,
                     document upload, OCR extraction, and KYC verification.
```

---

## 2. User Story Context

> **Guideline:** Provides the immediate parent context for this SubTask.
> All fields must match exactly what is recorded in the parent User Story document.
> Screen ID and Screen Description apply to Frontend stories only.
> For Backend and Integration stories, mark Screen ID and Screen Description as N/A.

```
User Story ID          : US-[XXX]
User Story Type        : [ Frontend | Backend | Integration ]
Screen ID              : SCR-[XXX]  or  N/A
Screen Description     : [Brief description of the screen this SubTask works on]  or  N/A
Flow                   : [ Primary | Alternate ]
User Story Description :
  As a    : [Actor]
  I want  : [Goal]
  So that : [Benefit]

Example:
  User Story ID          : US-001
  User Story Type        : Frontend
  Screen ID              : SCR-002
  Screen Description     : Personal Details — Step 1 of 3 registration form capturing
                           name, date of birth, email, mobile number, and gender
  Flow                   : Primary
  User Story Description :
    As a    : New Customer
    I want  : to complete a multi-step registration form with my personal and address details
    So that : I can create my account on the portal and proceed to KYC document verification
```

---

## 3. SubTask ID

> **Guideline:** A unique identifier scoped within the parent User Story.
> Format: ST-[XXX] where XXX is a zero-padded sequential number starting from 001.
> SubTask IDs are unique within a User Story but may repeat across different
> User Stories (e.g., US-001/ST-001 and US-002/ST-001 are different SubTasks).
> Always reference the User Story ID alongside the SubTask ID for full uniqueness.

```
SubTask ID : ST-[XXX]

Example:
  SubTask ID : ST-002
  Full Reference : US-001 / ST-002
```

---

## 4. SubTask Description

> **Guideline:** A concise, action-oriented description of the work this SubTask covers.
> Must start with a verb (Implement, Create, Build, Configure, Write, Integrate, etc.).
> Should be specific enough that a developer or tester can understand the full scope
> of the work without reading the Steps section.
> Should be completable by one person within the sprint.

```
[Action-oriented description of the work — start with a verb]

Example:
  Implement client-side field validation for Step 1 of the registration form
  (Personal Details screen) covering all mandatory fields, format rules, and
  the customer age eligibility check.
```

---

## 5. Steps

> **Guideline:** This is the core section of the SubTask. Provide a detailed,
> sequential list of implementation steps that must be followed to complete
> this SubTask. Each step must have:
>
> - **Step ID** — Sequential identifier (STEP-001, STEP-002, …)
> - **Step Description** — A detailed description of exactly what to do at this step.
>   The description must be comprehensive enough for a developer or tester to execute
>   without needing additional clarification. Include:
>   - The specific action to perform
>   - The file, component, class, function, or system to work on
>   - The expected output or result of completing the step
>   - Any conditions, constraints, or dependencies that apply at this step
>   - Code patterns, configuration values, or data formats where relevant
>
> Steps must be written at a production implementation level — not at a POC or
> prototype level. Assume the reader is implementing for a real, production system
> with proper error handling, logging, and code quality standards.

```
| Step ID  | Step Description                                                             |
|----------|------------------------------------------------------------------------------|
| STEP-001 | [Detailed description of exactly what to do at this step, including the      |
|          |  component/file/function to work on, the expected output, and any conditions] |
| STEP-002 | [Detailed description of the next step]                                      |

Example — partial:
| Step ID  | Step Description                                                             |
|----------|------------------------------------------------------------------------------|
| STEP-001 | Create a ValidationService module at src/services/validationService.js.      |
|          | This module will export individual validation functions for each field.       |
|          | It must be stateless — each function takes a value and returns an object      |
|          | with { isValid: boolean, errorMessage: string | null }.                      |
| STEP-002 | Implement the validateFirstName(value) function. The function must:          |
|          |  - Return error "First Name is required" if value is null, undefined, or     |
|          |    an empty/whitespace-only string.                                           |
|          |  - Return error "First Name must contain letters only, max 100 characters"   |
|          |    if value contains non-letter characters (except spaces) or exceeds 100    |
|          |    characters. Use regex: /^[a-zA-Z\s]{1,100}$/                              |
|          |  - Return { isValid: true, errorMessage: null } if all checks pass.         |
```

---

## Revision History

> **Guideline:** Track all changes to this SubTask document.

```
| Version | Date         | Author         | Changes Made                              |
|---------|--------------|----------------|-------------------------------------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial draft                             |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]            |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

---
---

# EXAMPLES

> Three examples are provided — one each for Frontend, Backend, and Integration.
> All are drawn from **EPIC-001: Customer Registration & KYC Verification**.
>
> | Example | SubTask | Parent Story | Type |
> | --- | --- | --- | --- |
> | 1 | US-001 / ST-002 | Multi-Step Customer Registration Form | Frontend |
> | 2 | US-003 / ST-003 | Draft Customer Record Creation — Backend API | Backend |
> | 3 | US-004 / ST-002 | Third-Party KYC API — Identity Verification | Integration |

---
---

# EXAMPLE 1 — Frontend SubTask

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SubTask ID      : ST-002
User Story ID   : US-001
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Sprint          : Sprint-01
Assigned To     : Frontend Developer
Estimated Hours : 3 hrs
Status          : To Do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. EPIC Context
```
EPIC ID          : EPIC-001
EPIC Description : End-to-end digital onboarding covering customer registration,
                   document upload, OCR extraction, and KYC verification.
```

## 2. User Story Context
```
User Story ID          : US-001
User Story Type        : Frontend
Screen ID              : SCR-002
Screen Description     : Personal Details — Step 1 of 3 registration form.
                         Captures First Name, Last Name, Date of Birth, Email
                         Address, Mobile Number, and Gender (optional).
                         Renders a "Next" button that triggers validation before
                         advancing to Step 2 (Address Details — SCR-003).
Flow                   : Primary
User Story Description :
  As a    : New Customer
  I want  : to complete a multi-step registration form with my personal and address details
  So that : I can create my account on the portal and proceed to KYC document verification
```

## 3. SubTask ID
```
SubTask ID     : ST-002
Full Reference : US-001 / ST-002
```

## 4. SubTask Description
```
Implement client-side field validation for Step 1 of the registration form
(Personal Details — SCR-002), covering all six fields: First Name, Last Name,
Date of Birth, Email Address, Mobile Number, and Gender. Validation must enforce
mandatory rules, format rules, and the minimum age eligibility business rule
(customer must be at least 18 years old). Errors must display inline beneath
each field in real time on blur and on "Next" button click.
```

## 5. Steps

| Step ID | Step Description |
|---------|-----------------|
| STEP-001 | **Create the Validation Utility Module.** Create the file `src/utils/registrationValidations.js`. This module will export one named validation function per field. Each function must follow the contract: `validateFieldName(value: string): { isValid: boolean, errorMessage: string or null }`. The module must be stateless — no side effects, no DOM access. This allows the functions to be unit tested independently of the component. |
| STEP-002 | **Implement `validateFirstName(value)`.** The function must: (a) Trim leading and trailing whitespace before evaluation. (b) Return `{ isValid: false, errorMessage: "First Name is required" }` if the trimmed value is empty or null. (c) Return `{ isValid: false, errorMessage: "First Name must contain letters only, max 100 characters" }` if the value contains digits, special characters, or exceeds 100 characters. Use the regex `/^[a-zA-Z\s]{1,100}$/` for the format check. (d) Return `{ isValid: true, errorMessage: null }` if all checks pass. Apply identical logic for `validateLastName(value)` with the same rules and error messages substituting "Last Name". |
| STEP-003 | **Implement `validateDateOfBirth(value)`.** The function must: (a) Return `{ isValid: false, errorMessage: "Date of Birth is required" }` if the value is null, undefined, or an empty string. (b) Parse the value using the ISO 8601 format (YYYY-MM-DD as stored internally, even if the display format is DD/MM/YYYY). Return `{ isValid: false, errorMessage: "Please enter a valid date of birth" }` if the value cannot be parsed as a valid calendar date (e.g., 30 Feb, invalid month). (c) Calculate the customer's age by comparing the parsed date against today's date (use `new Date()` — do not hardcode). If the calculated age is less than 18 full years, return `{ isValid: false, errorMessage: "You must be at least 18 years old to register" }`. (d) Return `{ isValid: true, errorMessage: null }` if all checks pass. Note: Age calculation must account for the exact calendar day — a customer born on 25-Mar-2008 turns 18 on 25-Mar-2026, not before. |
| STEP-004 | **Implement `validateEmail(value)`.** The function must: (a) Return `{ isValid: false, errorMessage: "Email Address is required" }` if the trimmed value is empty or null. (b) Validate the format using the regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Return `{ isValid: false, errorMessage: "Please enter a valid email address" }` if the format check fails. (c) Return `{ isValid: true, errorMessage: null }` if all checks pass. Note: This function performs format validation only. Uniqueness (duplicate email) is a server-side check handled by US-003 — do not call any API from this function. |
| STEP-005 | **Implement `validateMobileNumber(value)`.** The function must: (a) Strip any non-numeric characters before evaluation (users may type spaces or hyphens). (b) Return `{ isValid: false, errorMessage: "Mobile Number is required" }` if the cleaned value is empty or null. (c) Return `{ isValid: false, errorMessage: "Please enter a valid 10-digit mobile number" }` if the cleaned value is not exactly 10 digits or contains any non-numeric character. Use the regex `/^\d{10}$/` on the cleaned value. (d) Return `{ isValid: true, errorMessage: null }` if all checks pass. Note: As with email, uniqueness is server-side (US-003) — do not call any API here. |
| STEP-006 | **Gender field requires no mandatory validation** (it is optional per Business Rule BR-04 in US-001). No validation function is required. Confirm the Gender radio button group is not included in the "Next" button's validation run. Add a comment in the component code noting: `// Gender is optional — intentionally excluded from validation per BR-04`. |
| STEP-007 | **Wire Validations to the "Next" Button Handler.** In the `PersonalDetailsStep` component (`src/components/registration/PersonalDetailsStep.jsx`), implement the `handleNext()` function. When the customer clicks "Next", this function must: (a) Call each of the five validation functions (First Name, Last Name, DOB, Email, Mobile) with the current field values from component state. (b) Collect all returned `errorMessage` values into an `errors` state object keyed by field name. (c) If any validation returns `isValid: false`, update the `errors` state to display all error messages simultaneously — do not stop at the first error. All errors must be surfaced in a single click. (d) Only advance to Step 2 (render `AddressDetailsStep`) if every validation returns `isValid: true`. |
| STEP-008 | **Implement Real-Time Inline Error Display on Field Blur.** For each of the five validated fields, attach an `onBlur` event handler that calls the field's corresponding validation function as soon as the customer moves focus away from the field. On blur: (a) Call the validation function for that specific field. (b) If `isValid: false` — display the error message in a `<span>` element directly beneath the field, styled with the error style class (`input-error-message`). The field border must change to the error colour (`#D32F2F` red). (c) If `isValid: true` after a previous error — clear the error message and restore the default field border colour. This provides immediate feedback without waiting for the "Next" click. |
| STEP-009 | **Implement Error Clearing on Re-Input.** For each of the five validated fields, attach an `onChange` event handler. When the customer starts typing in a field that currently shows an error: (a) Clear the error message for that field from the `errors` state immediately (do not wait for blur or Next). (b) This prevents the field from showing a stale error message while the customer is actively correcting their input. The error will re-evaluate on the next blur or Next click. |
| STEP-010 | **Export and Register the Validation Module.** Ensure `registrationValidations.js` exports all five functions as named exports. Import the module in `PersonalDetailsStep.jsx`. Confirm there are no circular dependencies. Run the linter (`npm run lint`) and resolve any warnings before marking this step done. |

---
---

# EXAMPLE 2 — Backend SubTask

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SubTask ID      : ST-003
User Story ID   : US-003
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Sprint          : Sprint-01
Assigned To     : Backend Developer
Estimated Hours : 3 hrs
Status          : To Do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. EPIC Context
```
EPIC ID          : EPIC-001
EPIC Description : End-to-end digital onboarding covering customer registration,
                   document upload, OCR extraction, and KYC verification.
```

## 2. User Story Context
```
User Story ID          : US-003
User Story Type        : Backend
Screen ID              : N/A
Screen Description     : N/A — Backend User Story; no UI screens involved.
Flow                   : Primary
User Story Description :
  As a    : Registration Backend Service
  I want  : to receive customer registration data from the frontend form, validate
            it server-side, and persist a draft customer record in the database
  So that : the customer's details are securely stored and available for the
            KYC verification flow in the next step
```

## 3. SubTask ID
```
SubTask ID     : ST-003
Full Reference : US-003 / ST-003
```

## 4. SubTask Description
```
Implement server-side business rule validations for the customer registration
API endpoint (POST /api/v1/registrations). This SubTask covers three business
rules: (1) customer age must be >= 18 years, (2) submitted email must not
already exist in an active or pending record, and (3) submitted mobile number
must not already exist in an active or pending record. Each rule must return a
specific HTTP error code and structured error body on failure, and must be
integrated into the endpoint handler pipeline before the database INSERT.
```

## 5. Steps

| Step ID | Step Description |
|---------|-----------------|
| STEP-001 | **Create the Business Rule Validation Service.** Create the file `src/services/registrationBusinessRuleService.js` (Node.js / Express) or `src/main/java/com/onboarding/service/RegistrationBusinessRuleService.java` (Spring Boot). This service is responsible exclusively for business rule validation — it must not handle payload format validation (that is handled by the payload validator in ST-002) and must not perform the database INSERT (that is handled in ST-005). The service must expose three public methods: `validateCustomerAge(dateOfBirth)`, `validateEmailUniqueness(email, db)`, and `validateMobileUniqueness(mobileNumber, db)`. Each method must return a result object with `{ passed: boolean, errorCode: string or null, httpStatus: number or null }`. |
| STEP-002 | **Implement `validateCustomerAge(dateOfBirth)`.** This function must: (a) Accept a date string in ISO 8601 format (YYYY-MM-DD). (b) Calculate the customer's exact age in full years as of today's date. Use server time (UTC) — never client-provided time. The calculation must account for whether the customer's birthday has occurred yet in the current year. (c) If the calculated age is less than 18, return `{ passed: false, errorCode: "UNDERAGE_CUSTOMER", httpStatus: 422 }`. (d) If the age is 18 or above, return `{ passed: true, errorCode: null, httpStatus: null }`. (e) If the `dateOfBirth` value is malformed or cannot be parsed as a valid date, throw an `InvalidArgumentException` — payload validation (ST-002) should have caught this before this service is called, so a malformed date here indicates a programming error, not a user error. Log the anomaly with ERROR level before throwing. |
| STEP-003 | **Implement `validateEmailUniqueness(email, db)`.** This function must: (a) Accept the customer's email string (already trimmed and lowercased by the payload validator) and a database connection or ORM instance. (b) Execute a parameterised query against the `customer_draft` table: `SELECT COUNT(*) FROM customer_draft WHERE LOWER(email) = LOWER($1) AND status IN ('DRAFT', 'PENDING_KYC', 'ACTIVE')`. The status filter must explicitly exclude `EXPIRED` and `REJECTED` records — a customer who previously had an expired draft must be allowed to re-register with the same email. (c) If the count is greater than zero, return `{ passed: false, errorCode: "DUPLICATE_EMAIL", httpStatus: 409 }`. (d) If the count is zero, return `{ passed: true, errorCode: null, httpStatus: null }`. (e) This query must use a parameterised statement — never string interpolation — to prevent SQL injection. Use the database index on the `email` column (created in ST-004) to ensure this query executes in O(log n) time, not a full table scan. |
| STEP-004 | **Implement `validateMobileUniqueness(mobileNumber, db)`.** Apply the same logic as STEP-003, substituting the `mobile_number` field. The query must be: `SELECT COUNT(*) FROM customer_draft WHERE mobile_number = $1 AND status IN ('DRAFT', 'PENDING_KYC', 'ACTIVE')`. Return `{ passed: false, errorCode: "DUPLICATE_MOBILE", httpStatus: 409 }` on conflict or `{ passed: true, errorCode: null, httpStatus: null }` on success. Use the index on `mobile_number` (created in ST-004). |
| STEP-005 | **Run Business Rule Validations in Parallel Where Possible.** In the endpoint handler (`src/routes/registrationHandler.js` or the service layer), after payload validation passes, run the three business rule checks. Age validation is synchronous and must run first (it requires no DB call). Email uniqueness and mobile uniqueness checks are both asynchronous DB queries — run them in parallel using `Promise.all([validateEmailUniqueness(...), validateMobileUniqueness(...)])` to avoid sequential latency. Do not short-circuit after the first failure — collect all failures so the caller (US-001 Frontend) can surface all errors in a single response rather than forcing the customer to fix one error at a time. |
| STEP-006 | **Build the Structured Error Response.** If one or more business rule validations fail, the endpoint must return a structured JSON error body. Use the HTTP status of the first (highest priority) failure — 422 for age, 409 for duplicate. The response body must follow this schema: `{ "success": false, "errors": [ { "field": "dateOfBirth", "errorCode": "UNDERAGE_CUSTOMER", "message": "Customer must be at least 18 years old" }, { "field": "email", "errorCode": "DUPLICATE_EMAIL", "message": "This email address is already registered" } ] }`. Multiple errors can appear in the `errors` array. Never expose internal details (table names, stack traces, query text) in the error response. |
| STEP-007 | **Integrate Business Rule Validation Service into the Endpoint Pipeline.** In the route handler for POST `/api/v1/registrations`, the execution order must be: (1) Payload structure validation (ST-002) → (2) Business rule validation (this SubTask) → (3) Database INSERT (ST-005). If business rule validation fails, the handler must return the error response immediately and must not proceed to the INSERT step. Add a middleware or pipeline pattern so the order is enforced consistently and cannot be bypassed by future code changes. |
| STEP-008 | **Add Structured Logging for Each Validation Outcome.** For each business rule check, emit a structured log entry at INFO level for passes and WARN level for failures. Log format (JSON): `{ "timestamp": "...", "level": "WARN", "service": "RegistrationBusinessRuleService", "userId": null, "action": "VALIDATE_EMAIL_UNIQUENESS", "result": "FAILED", "errorCode": "DUPLICATE_EMAIL" }`. Do not log the actual email address or mobile number in the log entry — log only the field name and error code. This prevents PII from appearing in log files. |
| STEP-009 | **Write Unit Tests for Each Validation Function.** Create the test file `src/services/registrationBusinessRuleService.test.js`. Write the following test cases: (a) Age validation — passing (exactly 18 today), passing (over 18), failing (17 years 364 days), failing (malformed date throws). (b) Email uniqueness — passing (no existing record), failing (DRAFT record exists), failing (PENDING_KYC record exists), passing (EXPIRED record exists — re-registration allowed), failing (ACTIVE record exists). (c) Mobile uniqueness — same set of cases as email. Use a mock database object (jest.fn() or equivalent) — do not connect to a real database in unit tests. Verify that the correct `errorCode` and `httpStatus` are returned for each failure case. Target: 100% branch coverage for all three validation functions. |

---
---

# EXAMPLE 3 — Integration SubTask

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SubTask ID      : ST-002
User Story ID   : US-004
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Sprint          : Sprint-02
Assigned To     : Integration Developer
Estimated Hours : 4 hrs
Status          : To Do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. EPIC Context
```
EPIC ID          : EPIC-001
EPIC Description : End-to-end digital onboarding covering customer registration,
                   document upload, OCR extraction, and KYC verification.
```

## 2. User Story Context
```
User Story ID          : US-004
User Story Type        : Integration
Screen ID              : N/A
Screen Description     : N/A — Integration User Story; no UI screens involved.
Flow                   : Primary
User Story Description :
  As a    : KYC Integration Service
  I want  : to send the customer's extracted identity data to the third-party KYC
            API and receive a verification status response
  So that : the customer's identity can be verified automatically without manual
            intervention, enabling instant account activation on successful verification
```

## 3. SubTask ID
```
SubTask ID     : ST-002
Full Reference : US-004 / ST-002
```

## 4. SubTask Description
```
Build the KYC Vendor API Adapter — a self-contained integration component that
encapsulates all communication with the third-party KYC vendor's REST API
(v1.2). The adapter is responsible for constructing the vendor-specific request
payload from internal customer data, authenticating with the vendor using API
key-based auth, executing the HTTP POST call, parsing the response into a
normalised internal result object, and logging the full request and response
payloads to the kyc_request audit table. The adapter must expose a clean
interface to the rest of the KYC Integration Service, hiding all vendor-specific
details behind an abstraction layer so the vendor can be replaced with minimal
code change.
```

## 5. Steps

| Step ID | Step Description |
|---------|-----------------|
| STEP-001 | **Define the Adapter Interface / Contract.** Before writing any implementation, define the public interface that the adapter will expose to the rest of the KYC Integration Service. Create the interface file `src/integration/kyc/IKycAdapter.js` (or an abstract base class in Java/Python). The interface must declare one method: `verifyIdentity(customerPayload: KycRequestPayload): Promise<KycVerificationResult>`. Define the `KycRequestPayload` type/schema: `{ customerId: string (UUID), fullName: string, dateOfBirth: string (YYYY-MM-DD), documentType: string, documentNumber: string, documentExpiryDate: string }`. Define the `KycVerificationResult` type/schema: `{ status: "VERIFIED" | "FAILED" | "ERROR", vendorReferenceId: string or null, failureReasonCode: string or null, rawResponsePayload: object }`. This interface is what the queue consumer (ST-001) will call — it must never call the vendor API directly. |
| STEP-002 | **Implement the Concrete Adapter Class.** Create `src/integration/kyc/KycVendorAdapter.js` that implements `IKycAdapter`. The constructor must accept a configuration object — do not hardcode any vendor-specific values (base URL, API key, timeout) directly in the class. Accept: `{ baseUrl: string, apiKey: string, timeoutMs: number }`. Load these values from environment variables in the configuration layer (`src/config/kycConfig.js`), not in the adapter itself. This separation ensures the adapter can be tested with mock config and deployed to different environments (dev, staging, production) without code changes. |
| STEP-003 | **Build the Request Payload Constructor.** Implement the private method `buildVendorRequestPayload(customerPayload)` within the adapter. This method maps the internal `KycRequestPayload` schema to the vendor's expected request schema as defined in KYC Vendor API Specification v1.2 (referenced in the EPIC's Reference Documents). The vendor's required fields are: `{ "client_ref": customerId, "subject": { "full_name": fullName, "dob": dateOfBirth (in DD-MM-YYYY format — note: vendor uses DD-MM-YYYY, not ISO), "id_document": { "type": documentType, "number": documentNumber, "expiry": documentExpiryDate (DD-MM-YYYY) } } }`. The adapter is responsible for this date format conversion (ISO → DD-MM-YYYY). Add a comment in the code noting the format difference with the vendor and the version of the spec this maps to. |
| STEP-004 | **Implement Authentication Header Construction.** The KYC vendor API uses API Key authentication via an HTTP header: `X-API-Key: <apiKey>`. Implement the private method `buildAuthHeaders()` that returns: `{ "Content-Type": "application/json", "X-API-Key": this.config.apiKey, "X-Client-Version": "1.0" }`. The API key must never be logged in any log output at any level. Add a unit test that verifies the auth header is constructed correctly and that the key value is present but also add a negative test to verify no log statement ever outputs the key value. |
| STEP-005 | **Implement the HTTP POST Call with Timeout.** In the `verifyIdentity(customerPayload)` method: (a) Call `buildVendorRequestPayload(customerPayload)` to construct the request body. (b) Call `buildAuthHeaders()` to get the headers. (c) Execute the HTTP POST to `${this.config.baseUrl}/api/verify` using `axios` (or `fetch` with AbortController) with a timeout of `this.config.timeoutMs` milliseconds (default: 5000ms). (d) Do not catch errors at this level — let the caller (the queue consumer in ST-001) handle retry logic. Let the HTTP timeout throw a `TimeoutError` that the retry handler (ST-003) can detect by checking `error.code === 'ECONNABORTED'` (axios) or equivalent. (e) If the HTTP call succeeds (any 2xx response), pass the response body to `parseVendorResponse()` (STEP-006). |
| STEP-006 | **Implement the Response Parser.** Create the private method `parseVendorResponse(httpResponse, customerId)`. This method must: (a) Extract `httpResponse.data.verification_status` from the vendor response body. (b) If `verification_status === "VERIFIED"`: return `{ status: "VERIFIED", vendorReferenceId: httpResponse.data.reference_id || null, failureReasonCode: null, rawResponsePayload: httpResponse.data }`. (c) If `verification_status === "FAILED"`: return `{ status: "FAILED", vendorReferenceId: null, failureReasonCode: httpResponse.data.reason_code || "UNKNOWN", rawResponsePayload: httpResponse.data }`. (d) If `verification_status` is missing or has an unexpected value: log a WARN entry with the customer ID and unexpected value, then return `{ status: "ERROR", vendorReferenceId: null, failureReasonCode: "UNEXPECTED_VENDOR_RESPONSE", rawResponsePayload: httpResponse.data }`. Never throw from the parser — always return a typed result so the caller can handle all outcomes. |
| STEP-007 | **Persist Request and Response Payloads for Audit.** After receiving the vendor response (whether VERIFIED, FAILED, or ERROR), persist the full request and response payloads to the `kyc_request` table for audit compliance (required by Business Rule BR-06 in US-004). This must happen inside the adapter's `verifyIdentity` method before returning the result to the caller. Execute an UPDATE statement: `UPDATE kyc_request SET request_payload = $1, response_payload = $2, updated_at = NOW() WHERE customer_id = $3 AND status = 'IN_PROGRESS'`. The `request_payload` is the vendor request body (the output of `buildVendorRequestPayload`). The `response_payload` is `rawResponsePayload` from the parser result. If the UPDATE affects zero rows, log a WARN — this indicates a concurrency or data integrity issue — but do not throw. The DB persistence must not be allowed to fail silently: wrap in a try/catch and log any DB error at ERROR level. |
| STEP-008 | **Implement Structured Request/Response Logging.** Before sending the HTTP POST, emit a structured INFO log: `{ "action": "KYC_API_REQUEST", "customerId": "[UUID]", "vendorEndpoint": "/api/verify", "timestamp": "..." }`. After receiving the response, emit: `{ "action": "KYC_API_RESPONSE", "customerId": "[UUID]", "verificationStatus": "VERIFIED|FAILED|ERROR", "vendorReferenceId": "...|null", "durationMs": "[elapsed time]" }`. Critically: never log the full request payload or response payload to the application log — it contains PII (name, DOB, document number). PII is stored only in the encrypted `kyc_request` database table (STEP-007). The application log must contain only non-PII identifiers (customer UUID, status, reference ID). |
| STEP-009 | **Write Unit Tests for the KYC Vendor Adapter.** Create `src/integration/kyc/KycVendorAdapter.test.js`. Mock the HTTP client (axios.post) using jest.mock(). Write the following test cases: (a) VERIFIED response — verifies `status: "VERIFIED"` and `vendorReferenceId` populated. (b) FAILED response — verifies `status: "FAILED"` and `failureReasonCode` populated from vendor `reason_code`. (c) Unexpected `verification_status` — verifies `status: "ERROR"` and `failureReasonCode: "UNEXPECTED_VENDOR_RESPONSE"`. (d) HTTP timeout — mock axios to throw a timeout error; verify the error propagates (is not swallowed) so the retry handler can catch it. (e) Date format conversion — verify that an input DOB of `1990-05-15` (ISO) is converted to `15-05-1990` in the vendor request payload. (f) PII not in logs — use a log spy to confirm no test case logs any PII field values. Target: 100% branch coverage for `parseVendorResponse()` and `buildVendorRequestPayload()`. |
| STEP-010 | **Register the Adapter in the Dependency Injection Container.** Register `KycVendorAdapter` in the application's DI container or service factory (`src/config/serviceContainer.js`) as a singleton bound to the `IKycAdapter` interface. Inject `kycConfig` (from environment) as its constructor argument. Verify the binding by running the application locally against the KYC vendor's sandbox environment and confirming that a test customer payload reaches the vendor's `/api/verify` endpoint and returns a VERIFIED response in the application log. Document the sandbox test result (customer UUID used, timestamp, vendor reference ID received) in the PR description for reviewer traceability. |

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*
