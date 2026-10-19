# เตรียม CD และสาธิตให้อาจารย์

## สถานะที่ต้องเข้าใจก่อน

ทดสอบ workflow ในเครื่องและ CI แล้ว ตั้ง Environment/secrets ใน fork แล้ว ส่วนการ deploy ผ่าน GitHub จริงยังต้องรวมเวอร์ชันนี้เข้า main และอนุมัติ release ก่อน จึงจะอ้างว่า CD ใช้งานจริงได้

เส้นทาง: แก้โค้ด → PR → CI → merge เข้า main → CI บน main → รอ Approve → Vercel build → ตรวจ deployment → promote ขึ้นเว็บจริง

ไม่มี hosted staging เพิ่มในรอบนี้ `develop` รัน CI แต่ไม่ปล่อยขึ้นฐานข้อมูลจริง โหมด Demo ยังคงรันแยกบนเครื่อง

## ตั้งค่าใน repo ของคุณ

Repo ที่ใช้ต่อคือ [Pathornnnnn/sdpx-assignment](https://github.com/Pathornnnnn/sdpx-assignment) ซึ่ง fork มาจาก KNIGHTKRUBPOM พร้อม branch `feature/cd-prd-readiness` ที่มีงานล่าสุด บัญชี `Pathornnnnn` เป็นเจ้าของและมีสิทธิ์ Admin ใช้บัญชีนี้ตั้งค่าเองได้ ไม่ต้องเข้าบัญชีเจ้าของต้นทาง Environment/secrets ต้องตั้งใน fork นี้ และ Vercel ยังใช้โปรเจกต์ `paireval-pilot` เดิม

เตรียมใน fork แล้ว: Environment `production`, Required reviewer `Pathornnnnn` (อนุมัติรอบที่ตัวเองเริ่มได้), อนุญาตเฉพาะ branch `main`, Vercel project/team ID และ secret `VERCEL_TOKEN` ที่เจ้าของใส่ผ่าน GitHub โดยตรง คง `DEPLOY_ENABLED=false` ระหว่างรวมโค้ด การมี secret ยังไม่ยืนยันว่า token ใช้งานได้ ต้องผ่าน release จริงก่อน

ตั้ง branch protection ของ `main` และ `develop` แล้ว: ต้องผ่าน checks `verify` และ `container` จาก GitHub Actions, รวมโค้ดผ่าน PR, บังคับใช้กับ Admin และห้าม force-push/ลบสาขา ขั้นตอนด้านล่างใช้ตรวจค่าเดิมหรือเตรียม repo ใหม่

เปิด workflow `CI` ของ fork แล้ว เพราะ workflow ที่ติดมากับ fork ยังไม่เริ่มทดสอบจนกว่าจะเปิดใช้งานและมี push ใหม่ หาก CI ไม่เริ่ม ให้ตรวจ Actions → CI ว่ายัง enabled อยู่ ส่วน deploy บน feature branch ต้องเป็น skipped ตามเงื่อนไขเดิม

การนำชุดนี้เข้าระบบใช้ PR `feature/cd-prd-readiness` → `develop` → `main` โดย feature รวม main ปัจจุบันไว้แล้ว จึงซิงก์ develop ที่เก่ากว่าพร้อมงานล่าสุดใน PR เดียว ไม่ต้อง force-push ตอนเปิด PR ให้เลือก base repository เป็น `Pathornnnnn/sdpx-assignment` เพื่อรวมเข้า fork ของคุณ

1. เข้าบัญชี `Pathornnnnn` แล้วเปิด [Settings → Environments](https://github.com/Pathornnnnn/sdpx-assignment/settings/environments)
2. New environment → ตั้งชื่อ `production`
3. Required reviewers → เลือกผู้ที่จะกดอนุมัติ เช่น เจ้าของ repo → Save protection rules หากสาธิตคนเดียวไม่เปิด Prevent self-review
4. Deployment branches and tags → Selected branches and tags → เพิ่ม Branch ชื่อ `main` เท่านั้น อย่าเพิ่ม wildcard, develop หรือ tag
5. Environment variables → เพิ่ม `VERCEL_ORG_ID` = `team_Cg6GrtO0xOVjEKm0UVlN6XK9` และ `VERCEL_PROJECT_ID` = `prj_49pVANJrZxTzr8v4Pwq27J9yE8nY` ค่าเหล่านี้เป็น ID ไม่ใช่รหัสผ่าน
6. เจ้าของบัญชี Vercel สร้าง token จาก [Account Settings → Tokens](https://vercel.com/account/settings/tokens) จำกัด scope ให้ทีม `pathornnnnns-projects` และกำหนดวันหมดอายุที่เหมาะกับการสาธิต
7. ใส่ token ผ่าน Environment secrets → Add environment secret ชื่อ `VERCEL_TOKEN` โดยตรง ไม่ส่ง token ในแชต ไม่ใส่ใน source code/ไฟล์ และไม่เพิ่มเป็น repository secret ที่ข้ามการอนุมัติ
8. ใน Vercel ตรวจว่า project คือ `paireval-pilot` และปิด Git auto-deploy ที่ปล่อย production โดยข้าม workflow นี้ หากไม่มี Git integration ก็ไม่ต้องเชื่อมเพิ่ม
9. Settings → Branches/Rulesets ป้องกัน main/develop ให้ผ่าน checks `verify` และ `container` ก่อน merge และใช้งานผ่าน PR หากตั้งการป้องกันไม่ได้ ให้เจ้าของตรวจผล CI ก่อน merge ทุกครั้ง
10. ขณะเตรียมค่า ให้ repository variable `DEPLOY_ENABLED` เป็น `false` หรือยังไม่สร้าง หลัง merge workflow ใหม่นี้เข้า main และตรวจครบแล้วจึงเปิด [Settings → Secrets and variables → Actions → Variables](https://github.com/Pathornnnnn/sdpx-assignment/settings/variables/actions) เพิ่ม `DEPLOY_ENABLED` = `true`

การเปลี่ยน variable ไม่ได้เริ่ม deploy เอง ต้องมี push ใหม่บน main จึงจะเริ่ม release รอบใหม่ ไม่ต้องรัน workflow ของ commit เก่าที่ใช้รูปแบบ secrets คนละชุด

ไม่ต้องเพิ่ม Google secrets, runtime DATABASE_URL หรือรหัสฐานข้อมูลผู้ดูแลลง GitHub ค่าแอปเดิมอยู่บน Vercel แล้ว หาก token หมดอายุให้แทนค่าใน environment secret

## ซ้อมสาธิต CD

1. สร้าง branch `feature/demo-copy` จาก main ล่าสุด แล้วแก้ข้อความเล็ก ๆ ที่หน้าเว็บ เช่นคำอธิบายใน header ให้สังเกตความต่างได้ เก็บภาพก่อนแก้ไว้
2. Commit แบบ `docs:` สำหรับเอกสาร หรือ `fix:`/`feat:` ตามการเปลี่ยนหน้าเว็บ แล้ว push เปิด PR เข้า develop
3. เปิด Actions อธิบายว่า `verify` ตรวจโค้ด/ความปลอดภัย/ฐานข้อมูล/เบราว์เซอร์ และ `container` ตรวจ build image ใน PR นี้ deploy เป็น skipped ตามที่ออกแบบ
4. หลัง CI ผ่านให้ merge เข้า develop แล้วเปิด PR develop → main ตรวจให้ผ่านและ merge
5. เปิด Actions ของ push บน main: verify/container ต้องผ่านก่อน จากนั้น deploy ต้องแสดง Waiting for review
6. ผู้ที่ตั้งใน Required reviewers กด Review deployments → production → Approve and deploy จากนั้นระบบทำต่อโดยอัตโนมัติ
7. ตรวจ deploy job ผ่านและอ่าน Summary: commit, staged URL, previous deployment และผล promote แล้วเปิด [เว็บจริง](https://paireval-pilot.vercel.app) ให้เห็นข้อความใหม่
8. ลอง Google login ด้วยบัญชีจริงที่มีสิทธิ์เข้าห้อง ดู dashboard และข้อมูลเดิม การเช็ก `/api/health` อย่างเดียวไม่พิสูจน์การเชื่อมฐานข้อมูลหรือ OAuth ครบวงจร
9. เก็บ URL ของ PR, Actions run, commit และภาพก่อน/หลังเป็นหลักฐาน ไม่ใส่ภาพ token/cookie หรือข้อมูลนักศึกษาจริงในเอกสารนำเสนอ

ถ้าต้องโชว์กรณี CI ไม่ผ่าน ให้สร้าง PR ทดลองแยกและใส่ TypeScript error ในไฟล์หน้าเว็บ แสดงว่า typecheck ไม่ผ่านและ merge ถูกบล็อกเมื่อ branch protection ทำงาน จากนั้น revert โค้ดทดลองและรอ CI ผ่าน **ไม่แก้หรือลบ tests เพื่อทำให้ผ่าน และไม่ merge โค้ดที่พัง**

## ถ้าพรุ่งนี้ยังตั้งค่าไม่ได้

- ไม่มีเมนู Environments/ปุ่มสร้าง: ใช้บัญชีเจ้าของ repo นี้ การเพิ่ม Actions secret ได้ไม่ได้ยืนยันว่าตั้ง Environment ได้
- ไม่เห็น Required reviewers: ตรวจว่า repo ยังเป็น Public และใช้บัญชีเจ้าของ ให้ `DEPLOY_ENABLED=false` ระหว่างแก้
- deploy เป็น skipped: ตรวจว่าเป็น push บน main และ repository variable `DEPLOY_ENABLED=true` การรันจาก PR/develop จะข้าม deploy เสมอ
- รออนุมัติแต่กดไม่ได้: ตรวจชื่อ Required reviewers และ Prevent self-review หากเปิดไว้ต้องให้คนอื่นที่เป็น reviewer กด
- `production must have Required reviewers` / `Only the main branch...`: ปรับ Environment ให้ตรงข้อ 3–4 ก่อน ห้ามเอาตัวตรวจออก
- `Missing VERCEL_TOKEN` / Vercel auth failed: เพิ่มหรือเปลี่ยน environment secret แล้วเริ่มรอบ release ที่ถูกต้อง ไม่ส่ง token ให้ผู้อื่นในแชต
- Schema guard หยุด: `drizzle/` ต่างจาก commit ที่กำลังอยู่บนเว็บจริง ต้องเตรียม migration/release แยกก่อน แม้ migration จะอยู่ใน push เก่าที่ข้าม deploy ก็ยังหยุด รอบเดโมข้อความหรือ font ไม่ต้องเปลี่ยน schema
- หน้า staged ติด Vercel protection: workflow ใช้ `vercel curl` ตรวจผ่านสิทธิ์ Vercel โดยไม่ปิด protection ถ้ายังไม่ได้ให้ตรวจสิทธิ์ token/team
- ตรวจ staged deployment ไม่ผ่าน: ระบบจะไม่ promote เวอร์ชันนั้น ดู Vercel build logs หรือหน้า deployment เพื่อแก้แล้วส่ง commit ใหม่ ถ้า public health check หลัง promote ไม่ผ่าน เวอร์ชันอาจขึ้นเว็บจริงแล้ว ให้ตรวจและใช้ขั้นตอน rollback ด้านล่าง

หากยังตั้ง Environment ไม่ได้ ให้โชว์ CI แล้วเจ้าของใช้วิธี deploy ด้วยมือที่ใช้อยู่ อธิบายตามจริงว่ายังไม่มี GitHub approval gate และอย่าเปิด CD ข้ามข้อกำหนด

## ย้อนกลับเวอร์ชันเว็บ

กรณีเพิ่งปล่อยเว็บแล้วมีปัญหา ให้ตั้ง `DEPLOY_ENABLED=false` ก่อน เจ้าของ Vercel ตรวจ project/team และ previous deployment URL จาก Actions Summary จากนั้นรัน `npx --yes vercel@64.0.2 rollback <previous-deployment-url>` ใน checkout ที่ link กับ `paireval-pilot` แล้วตรวจหน้า login/health/dashboard อีกครั้ง คำสั่งนี้เปลี่ยนเวอร์ชันเว็บ ไม่ใช่ restore ฐานข้อมูล

ห้ามย้อนฐานข้อมูลทับคำตอบใหม่ หลังแก้ปัญหาให้ส่ง commit ใหม่ ทดสอบครบและใช้ workflow promote ก่อนเปิดใช้งานต่อ

## สองข้อ PRD ที่แก้ในรอบนี้

- FR-AUTH-04: session ไม่ใช้งานครบ 12 ชั่วโมงจะหมดอายุ ระหว่างเปิดใช้งาน SessionProvider ต่ออายุเงียบทุก 15 นาที/เมื่อกลับมาที่แท็บ และไม่ poll ขณะ offline
- FR-ASSIGN-07: คะแนนเต็มรายบุคคล 0 ปิดเกณฑ์และการสร้างคู่รายบุคคล รวมถึงคู่ที่อาจารย์รับเพิ่ม หน้า progress แสดงว่าปิดรายบุคคล รายงานส่วนนี้เป็น 0 และไม่รอผู้ประเมินรายบุคคลก่อนเปิดคะแนนงานกลุ่ม
- ไม่ลบคู่หรือคำตอบงานเก่า หากงานเก่าคะแนนรายบุคคล 0 เคยสร้างคู่ไปแล้ว ข้อมูลเดิมยังอยู่และยังดู/ทำงานที่รับไว้ได้ ไม่มีการแปลงคะแนนย้อนหลังอัตโนมัติ
- ข้อ PRD อื่นยังมีงานค้าง ไม่ใช้ผล CD หรือสองข้อนี้อ้างว่าครบ PRD ทั้งหมด

## หลักฐานทดสอบก่อนส่งต่อ

- `npm test` / `npm run test:coverage`: ชุดก่อน fork ผ่าน 88 tests รวม 20 กรณีตรวจ release guard ด้วยบริการจำลอง; fork เพิ่มอีก 1 กรณียืนยันว่า repo ต้นทางไม่ผ่านการตรวจสิทธิ์ของ configuration นี้ ไม่ได้ deploy จริงระหว่าง unit tests
- PostgreSQL integration: 16 tests ผ่าน รวมงาน group-only ตั้งแต่สร้างคู่จน finalize และ CSV
- Browser E2E: 10 สถานการณ์ × 3 รอบ = 30 ผ่าน ครอบคลุมต่ออายุ session, logout/หมดอายุ, ฟอร์มรายบุคคล 0, progress และ tests เดิม
- Local Demo: 3 สถานการณ์ผ่าน รวม 12 บัญชีส่งประเมิน/finalize และอาจารย์รับคู่เพิ่ม
- lint, typecheck, OpenAPI lint, production build และ dependency audit ผ่าน; runtime/restore drill ผ่านบนข้อมูลสมมติ
- ยังต้องทดสอบ release ผ่าน GitHub พร้อม Environment/secrets จริงและ Google login หลังปล่อยเว็บ ไม่มีการอ้างว่าการทดสอบจำลองยืนยัน CD บน production แล้ว

## เอกสารอ้างอิง

- [GitHub: Managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Vercel: staged production deployments](https://vercel.com/docs/cli/deploying-from-cli)
- [NextAuth: session options](https://next-auth.js.org/configuration/options#session)
- [NextAuth: SessionProvider](https://next-auth.js.org/getting-started/client#sessionprovider)
