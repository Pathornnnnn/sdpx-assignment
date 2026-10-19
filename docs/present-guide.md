# Present guide — WS-01 ถึง WS-08

คู่มือนี้ชี้ว่าหัวข้อที่ต้อง present ของแต่ละ WS (ตาม `present.md` ใน repo วิชา [CE-SDPX/SDPX-AI](https://github.com/CE-SDPX/SDPX-AI)) อยู่ที่ไฟล์ไหนใน repo นี้ และใช้คำสั่งอะไรโชว์

- ทุกคำสั่งรันที่ root ของ repo
- ข้อที่ต้องใช้ DB ต้องเปิด Docker Desktop ไว้ก่อน
- ห้ามโชว์ตัวเลข ภาพหน้าจอ หรือ URL ที่ไม่ได้มาจากการรันจริง (ดู [ws-evidence.md](ws-evidence.md))

## WS-01 First deploy

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| Live URL | https://paireval-pilot.vercel.app (เช็ค health ได้ที่ `/api/health`) |
| Repo, README, AGENTS | [README.md](../README.md), [AGENTS.md](../AGENTS.md) และ branch `develop` |
| Deploy loop | แก้ข้อความ → PR `feature/*` → `develop` → `main` → approve `production` → ดู URL ใหม่ (ขั้นตอนอยู่ใน [cd-demo.md](cd-demo.md)) |

**ถ้าถาม "deploy พังจะรู้ตอนไหน":** [scripts/release-production.mjs](../scripts/release-production.mjs) stage build ก่อน แล้ว smoke check `/api/health`, `/login` และ Google provider ถ้าไม่ผ่านจะไม่ promote หลัง promote แล้วยังเช็ค public health ซ้ำอีกรอบ

## WS-02 Requirement & design

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| Backlog / user story | [backlog.md](backlog.md) และ `memory-bank/units/*/unit-brief.md` ⚠️ ไม่ได้อยู่ใน GitHub Issues |
| Architecture / ERD | [architecture.md](architecture.md), [erd.md](erd.md) (Mermaid) |
| Validate spec | `npm run lint:spec` แล้วเปิด [openapi.yaml](openapi.yaml) ใน Swagger Editor |

**Endpoint ที่แนะนำให้ defend:** submit evaluation ใช้ `Idempotency-Key`, ได้ 409 เมื่อ version ชนกัน และกดซ้ำแล้วไม่สร้างคำตอบซ้ำ (FR-API-01/02)

## WS-03 Unit test

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| รัน suite แล้วบอกเวลา | `npm test` (ดูเวลาท้ายผล) หรือ `npm run test:coverage` |
| Fake repository | [src/storage/memory-store.ts](../src/storage/memory-store.ts) |
| Factory | `makeComparisonsForQ` ใน [tests/scoring.test.ts](../tests/scoring.test.ts) |
| Break it live | แก้ `.div(5)` เป็น `.div(4)` ใน [src/domain/scoring.ts](../src/domain/scoring.ts) → รัน `npx vitest run tests/pilot-core.test.ts` จะแดง → undo หรือรัน `npx tsx scripts/test-fidelity.ts` ให้ทดลองแล้วคืนค่าเอง |
| Test ที่น่าสนใจ | golden test §9.5 ใน [tests/pilot-core.test.ts](../tests/pilot-core.test.ts) และ property test INV-1..5 ใน [tests/balanced-pairing.test.ts](../tests/balanced-pairing.test.ts) |

⚠️ `tests/api.test.ts`, `pairing.test.ts` และ `roster.test.ts` test โค้ด legacy (`src/server/app.ts`, `src/core/*`) ไม่ใช่ production path ดูรายละเอียดใน [gap-analysis.md](gap-analysis.md)

## WS-04 E2E (Playwright)

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| รัน E2E | `npm run build` แล้ว `npx tsx scripts/test-database.ts e2e --repeat-each=3` |
| HTML report | `npx playwright show-report` |
| Page Object | [tests/e2e/pages/evaluation.ts](../tests/e2e/pages/evaluation.ts) มีแค่ action ส่วน `expect` อยู่ใน spec |
| Seed fixture | [tests/e2e/fixtures/pilot.ts](../tests/e2e/fixtures/pilot.ts) |
| Specs | `tests/e2e/*.spec.ts` ได้แก่ pilot, progress, archive, group-only, session, workspace-ux (ส่วนใหญ่มี axe a11y scan) |

**ไม่มี `/api/test/seed` โดยตั้งใจ:** PRD FR-SEC-05 ห้ามมี seed หรือ reset endpoint ใน production
- seed ทำได้ผ่าน CLI [scripts/seed-demo.ts](../scripts/seed-demo.ts) เท่านั้น
- guard ใน [src/demo/config.ts](../src/demo/config.ts) ยอมให้รันเฉพาะบน localhost กับ DB ชื่อ `paireval_demo`
- มี test คุมอยู่ที่ [tests/demo-security.test.ts](../tests/demo-security.test.ts)

## WS-05 Docker

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| Dockerfile | [Dockerfile](../Dockerfile) (multi-stage, non-root) |
| Compose | [compose.yaml](../compose.yaml) (dev), [compose.test.yaml](../compose.test.yaml) (test, DB อยู่บน `tmpfs` เป็น ephemeral) |
| Exit code | ทำให้ test แดง 1 ตัว แล้วรัน `POSTGRES_PASSWORD=temp docker compose -f compose.test.yaml up --build --exit-code-from test` ซึ่งยังไม่ได้ซ้อมรันบนเครื่องจริง ควรลองก่อน present |
| Demo ในเครื่อง | `npm run demo` แล้วเปิด http://localhost:3101/login (ดู [demo.md](demo.md)) |

⚠️ ยังไม่มี `docs/setup-steps.md` (before/after)

## WS-06 CI/CD

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| Pipeline | [.github/workflows/ci.yml](../.github/workflows/ci.yml) (workflow ชื่อ `CI/CD`) |
| Jobs | `verify` นานสุด ประมาณ 4–5 นาที: gitleaks → lint → typecheck → OpenAPI → coverage → audit → build → integration → restore drill → e2e ×3 → k6 → demo<br>`container` build image<br>`deploy` approval + smoke check + promote |
| Branch protection | `main`/`develop`: require `verify` + `container`, branch ต้อง up to date, resolve conversation, `enforce_admins` |
| Merge ถูก block | เปิด PR ที่มี test แดงแล้วชี้ปุ่ม merge ที่กดไม่ได้ |

ตอบคำถามที่มักเจอ:
- `permissions: contents: read` ทำให้ token มีสิทธิ์น้อยที่สุด
- `concurrency` ยกเลิก run เก่าเฉพาะ branch ที่ไม่ใช่ main เพื่อไม่ให้ deploy ถูกตัดกลางทาง
- Secret `VERCEL_TOKEN` เก็บใน Actions secrets ส่วน org/project ID เก็บใน variables

⚠️ ยังไม่มี `docs/loop-metrics.md` ให้ใช้เวลาจริงจากหน้า Actions แทน

## WS-07 Performance

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| k6 | [performance/load-test.js](../performance/load-test.js) รันด้วย `npx tsx scripts/test-database.ts perf` |
| ผล baseline | [performance/results/baseline.json](../performance/results/baseline.json), [verification.md](verification.md) |
| Structured log | [src/http/handler.ts](../src/http/handler.ts) เขียน JSON ต่อ request พร้อม `requestId` และ `duration_ms` และมี header `X-Request-Id` |
| Threshold ทำ CI แดง | ขั้น "Performance gate" ใน job `verify` |

⚠️ load test ใช้ 30 VU แต่ PRD กำหนด 200

## WS-08 Code quality

| ต้องโชว์ | ที่อยู่ / คำสั่ง |
|---|---|
| Refactor | [refactoring-plan.md](refactoring-plan.md) และพิสูจน์ว่าไม่ได้แก้ test ด้วย `git diff --stat main...HEAD -- tests/` |
| Security + test | [security-pre-check.md](security-pre-check.md); forged header ได้ 401 และ cross-origin ได้ 403 ใน [tests/integration/pilot.test.ts](../tests/integration/pilot.test.ts); anon/authz sweep อยู่ใน [tests/integration/anon-sweep.test.ts](../tests/integration/anon-sweep.test.ts) |
| ADR | [docs/adr/](adr/) ตั้งแต่ ADR-001 ถึง ADR-004 แนะนำ ADR-003 (feasibility pairing) หรือ ADR-004 (pilot deployment) |
| กัน agent แก้ test | กฎใน [AGENTS.md](../AGENTS.md) ห้ามแก้หรือลบ test เพื่อให้ผ่าน |

## สิ่งที่โจทย์ขอแต่ยังไม่มี

- GitHub Issues (WS-02) ตอนนี้ใช้ `backlog.md` แทน
- `docs/setup-steps.md` (WS-05)
- `docs/loop-metrics.md` (WS-06)
- ช่องว่างเทียบกับ PRD ทั้งหมดอยู่ใน [gap-analysis.md](gap-analysis.md)
