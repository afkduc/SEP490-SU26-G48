# Unit test scope audit

Date: 2026-09-16

## Decision rules

Keep unit tests for:

- business validation and authorization;
- state transitions and concurrency guards;
- calculations, normalization, filtering, and non-trivial mappings;
- happy paths plus meaningful boundary and failure paths.

Do not unit-test:

- controllers and routes that only forward calls to services/framework APIs;
- repository/database behavior and other direct IO;
- service methods that only return repository values unchanged;
- duplicate cases created only to mirror a spreadsheet row.

## Removed tests

| Removed test file/cases | Reason |
| --- | --- |
| `CommonTest/AuthController.spec.js` | Controller forwarding and HTTP response wiring; belongs in API integration tests. |
| `CommonTest/authRoutes.spec.js` | Express route/framework behavior and session IO; belongs in integration tests. |
| `ManagerTest/ManagerImportExportRequest.spec.js` | Duplicated import/export service coverage already present in warehouse tests. |
| `TeamLeaderTest/VehicleBayService.spec.js` | `listMine` and `listByBranch` directly return repository results without business logic. |
| `WarehouseStaffTest/SupplierService.spec.js` | Read-only list/detail DTO mapping and repository lookup; better covered by integration tests. |
| `ServiceAdvisorTest/ServiceRequestExtra.spec.js` | Mixed duplicate spreadsheet-oriented cases and thin repository/DTO tests; core request validation and state rules remain in `ServiceRequestService.spec.js`. |
| Four “used by the Excel case” import/export tests | Same inputs and behavior as the primary list/detail tests. |
| One duplicated create-service happy path | Two tests called the same method with the same payload; assertions were combined into one test. |
| Five thin `RepairOrderExtra` list/detail/empty tests | Repository forwarding/DTO behavior. The non-trivial technician flag mapping test remains. |

## Mock-data policy

- Unit tests do not connect to SQL Server.
- Use small objects containing only fields read by the function under test.
- Use obvious identifiers such as `branchId: 1`, `userId: 7`, and `SV-TEST-001`.
- Use valid but fictional contact data such as `advisor@test.local` and `0901234567`.
- Add fields only when the production schema or tested branch reads them.
- Use explicit invalid values (`null`, `''`, `-1`, malformed email, reversed dates) for negative and boundary cases.
- Avoid production account names, IDs, passwords, and database snapshots in unit tests.

## Retained high-value coverage

- authentication, account/branch status, authorization, and session replacement;
- employee, service, package, technician, user, and branch validation;
- appointment ownership and state transitions;
- repair settlement totals, signatures, payment, NG decisions, and gate exit;
- repair-order claiming, technician assignment, checklist/NG workflow, and completion guards;
- inventory adjustment, low-stock behavior, search normalization, import/export validation, and concurrency guards;
- SQL error sanitization and session-closing safeguards.

## Verification

After cleanup: 17 test suites and 472 tests pass, with no snapshots.
