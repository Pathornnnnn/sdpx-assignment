# Gap analysis เทียบ PRD v2.0 — 2026-10-20

เอกสารนี้สรุปตามจริงว่าโค้ดรุ่น pilot ทำ requirement ใดใน PRD v2.0 ครบแล้ว (Done) ทำได้บางส่วน (Partial) หรือยังไม่ได้ทำ (Missing) โดยจัดกลุ่มตาม milestone ใน PRD §19 ทีมเลือกทำเฉพาะข้อ P0 ที่ "ห้ามตัด" (FR-ANON-01, FR-AUTHZ-01/02, FR-AUDIT-01) ให้ครบก่อน และบันทึกส่วนที่เหลือไว้ที่นี่ ไม่ได้อ้างว่าระบบผ่าน PRD ทั้งฉบับ

ตารางนี้ไม่ได้ครอบคลุมทุก ID ใน PRD แต่เลือกเฉพาะข้อที่มีผลต่อการตัดสินว่า milestone ผ่านหรือไม่ ข้อที่ไม่ได้อยู่ในตารางไม่ได้แปลว่า Done

## ข้อควรระวังเรื่องหลักฐานจาก test

- `tests/api.test.ts`, `tests/pairing.test.ts`, `tests/roster.test.ts` ทดสอบ **legacy Express app** (`src/server/app.ts`) และ engine เดิมใน `src/core/*` **ไม่ใช่** code path ที่ใช้งานจริง (production: `src/http/handler.ts` → `src/domain/service.ts`, `src/domain/pairing.ts`, `src/domain/scoring.ts`) test เหล่านี้ผ่านก็ยังไม่ใช่หลักฐานของ production
- หลักฐานที่ใช้ได้จริงสำหรับ production คือ
  - `tests/integration/*` (PostgreSQL จริง, transaction, constraint, trigger)
  - `tests/pilot-core.test.ts` — golden test ตามตัวอย่าง PRD §9.5 คำนวณผ่าน engine จริงจาก comparison (ประมาณบรรทัด 52)
  - `tests/balanced-pairing.test.ts` — property test ด้วย fast-check สำหรับ INV-1..5
  - `tests/e2e/*` (Playwright)
- กรณี "Aurora golden" ใน `tests/scoring.test.ts` เป็น test แบบวนกลับ (circular) คือค่าที่คาดหวังได้มาจากการคำนวณแบบเดียวกับโค้ด จึงจับ bug ของสูตรไม่ได้ ให้ใช้ golden test ใน `pilot-core.test.ts` แทน

## M1 — Walking Skeleton

| ID | สถานะ | หลักฐาน (file) | สิ่งที่ขาด |
|---|---|---|---|
| FR-AUTHZ-01/02 | Done | `src/http/handler.ts`, `src/domain/service.ts`, `tests/integration/*` | — |
| FR-AUTH-02 | Partial | `src/auth.ts` | ตรวจแค่ว่า `hd` ของ Google ตรงกับโดเมนของอีเมล ยังไม่บังคับรายการโดเมนที่มหาวิทยาลัยอนุญาตตอน `signIn` |
| FR-AUTH-03 | Partial | `src/domain/policy.ts` (`safeEmail`) | วิธี normalize อีเมลต่างจาก PRD โดยตั้งใจ (deliberate deviation) ยังไม่มี ADR บันทึกเหตุผล |
| FR-CLASS-01/02/03 | Partial | `src/domain/service.ts` (import CSV) | header ของ CSV เป็น case-sensitive, คอลัมน์ `student_id` ถูกทิ้ง, ไม่มีรายงาน error รายแถว (import ทั้งไฟล์ถูก reject แต่ไม่บอกว่าแถวไหนผิด) |
| FR-CLASS-06 | Missing | — | ไม่พบ guard ป้องกันการลบ Owner คนสุดท้ายในโค้ด |
| FR-SEC-04 | Missing | — | ไม่มีการ escape สูตร (`=`, `+`, `-`, `@`) ตอน import CSV |
| FR-ASSIGN-03 / FR-PAIR-11 / DR-02 | Missing | `src/domain/service.ts` | ไม่มี unpublish/republish และค่า `generation` ของ assignment ไม่เคยถูกเพิ่ม (มีคอลัมน์และใช้ใน query แต่ไม่มี path ที่ bump) |
| FR-ASSIGN-04 | Missing | — | ขยาย deadline หลัง publish ไม่ได้ |
| FR-ASSIGN-05 | Partial | `src/components/api.ts`, `src/db/schema.ts` | timezone ฮาร์ดโค้ด `Asia/Bangkok` ไม่รองรับ timezone ราย classroom |
| FR-PAIR-02/06/07/09 | Done | `src/domain/pairing.ts`, `tests/balanced-pairing.test.ts` | — |
| FR-PAIR-05 | Partial | `src/domain/pairing.ts` | ปรับลด R ได้ แต่ไม่พบการรายงานเหตุผลเป็นตัวเลขตามที่ PRD กำหนด |
| FR-PAIR-10 | Missing | — | เพิ่มผู้ประเมินหลัง generate pairs ไม่ได้ |
| FR-EVAL-01 | Missing | `src/app/` (หน้าประเมิน) | PRD ให้แสดงทุก criterion ในหน้าเดียว แต่ UI เป็น carousel ทีละคู่ |
| AR-01 | Done | `src/domain/pairing.ts`, `src/domain/scoring.ts` | — (pure functions) |
| **DoD M1** | **ไม่ผ่าน** | — | ไม่มี staging (deploy ขึ้น production ตรง) และยังไม่มีคนนอกทีมใช้จนจบ flow |

## M2 — Core Complete

| ID | สถานะ | หลักฐาน (file) | สิ่งที่ขาด |
|---|---|---|---|
| §9 scoring (golden §9.5) | Done | `src/domain/scoring.ts`, `tests/pilot-core.test.ts` | — |
| FR-SCORE-05 | Partial | `src/domain/scoring.ts`, `src/domain/service.ts` | ติดธง `LOW_CONFIDENCE` ได้ แต่ finalize ไม่ block เมื่อยังมีธงนี้ |
| FR-SCORE-09 | Done | `src/domain/service.ts`, `tests/integration/*` | — (snapshot ตอน finalize เปลี่ยนไม่ได้) |
| FR-SCORE-12 | Partial | `src/domain/scoring.ts` | เกณฑ์ 60%/90% ฮาร์ดโค้ด อาจารย์ปรับไม่ได้ |
| FR-REPORT-01..04 | Partial | `src/app/` (หน้า report) | ไม่มี UI แยกราย criterion, quality flags แสดงแค่จำนวน ไม่มีรายละเอียด |
| FR-EXPORT-05 | Partial | `src/http/handler.ts` | ชื่อไฟล์ export ไม่ตรงรูปแบบที่ PRD กำหนด |
| FR-API-01..03 | Done | `src/http/handler.ts`, `docs/openapi.yaml` | — |
| **DoD M2** | **ไม่ผ่าน** | — | ยังไม่ได้ทดลองกับห้องเรียนจริง |

## M3 — Trustworthy

| ID | สถานะ | หลักฐาน (file) | สิ่งที่ขาด |
|---|---|---|---|
| FR-ANON-01/02 | Done | `src/domain/service.ts`, `tests/integration/*` | — (staff เห็นเป็น HMAC pseudonym) |
| FR-AUDIT-01 | Done | `src/db/schema.ts`, `tests/integration/*` | — |
| FR-AUDIT-03 | Done | `drizzle/0000_massive_magdalene.sql` (trigger append-only), `scripts/test-operations.ts` | — |
| FR-PRIV-02/03 | Missing | `src/app/privacy/page.tsx` | ไม่มี auto-anonymize ตามระยะเก็บรักษา, ไม่มี self-export ให้นักศึกษา และหน้า privacy ระบุเก็บ 1 ปีการศึกษา ขณะที่ PRD กำหนด 2 ปี |
| FR-QS-03, QS-06 | Missing | — | quality signal สองข้อนี้ยังไม่ได้ทำ |
| Appeals | Missing | — | เลื่อนไปหลังส่งงาน (ดู `docs/backlog.md`) |
| A11Y-02 | Partial | `src/app/` | ฟอร์มบางส่วนไม่มี label ที่มองเห็นได้ |
| A11Y-07 | Partial | `tests/e2e/*` (axe) | ไม่มีหลักฐานทดสอบด้วย screen reader จริง |
| **DoD M3** | **ไม่ผ่าน** | `docs/security-pre-check.md` | ยังไม่มี security review และ privacy review ที่ลงนามอย่างเป็นทางการ |

## M4 — Production Ready

| ID | สถานะ | หลักฐาน (file) | สิ่งที่ขาด |
|---|---|---|---|
| FR-NOTIF-01..06 | Missing | — | ไม่มีการส่งอีเมลเลย |
| FR-EXPORT-02 | Missing | — | ไม่มี export XLSX (มีแค่ CSV) |
| FR-API-04 | Missing | — | ไม่มี rate limit |
| NFR-PERF-04/05 | Missing | — | ยังไม่ได้วัด |
| SCALE-01/02 | Missing | `docs/verification.md` | load test k6 แค่ 30 VU ยังไม่ถึง 200 คน |
| OBS-02 | Missing | — | ยังไม่มี |
| AVAIL-01 | Missing | — | ไม่มีการวัดหรือรับรอง SLA |
| Browser coverage | Partial | `tests/e2e/*` | Playwright รันแค่ chromium และไม่มีเทสที่ความกว้าง 320px |
| **DoD M4** | **ไม่ผ่าน** | — | ยังไม่ได้ใช้กับห้อง 200 คนจริง |

## ข้อความใน memory-bank ที่อ้างเกินจริง

`memory-bank/units/*/unit-brief.md` บางไฟล์อ้างความสามารถที่โค้ดยังไม่มี ทีมยังไม่ได้แก้ไฟล์เหล่านี้ (ต้องตกลงกันก่อนตาม AGENTS.md) จึงบันทึกไว้ที่นี่แทน

- `memory-bank/units/roster-classroom/unit-brief.md` — อ้างว่าป้องกันการลบ Owner คนสุดท้าย (FR-CLASS-06) แต่ไม่พบ guard นี้ในโค้ด
- `memory-bank/units/pairing-engine/unit-brief.md` — อ้างว่ารายงานเหตุผลการลด R เป็นตัวเลข (FR-PAIR-05) แต่ไม่พบในโค้ด

ถ้าข้อความในเอกสารนี้ขัดกับ unit-brief ให้ถือเอกสารนี้และตัวโค้ดเป็นหลัก
