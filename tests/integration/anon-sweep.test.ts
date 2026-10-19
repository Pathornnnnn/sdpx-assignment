import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDatabase } from "../../src/db/client";
import * as t from "../../src/db/schema";
import { PairEvalService } from "../../src/domain/service";
import { handleRequest } from "../../src/http/handler";
import type { Principal } from "../../src/domain/model";

// PRD §18: a student (and a non-member) calls every endpoint in docs/openapi.yaml.
// Covers FR-ANON-01 (no evaluator identity reaches students) and FR-AUTHZ-01/02.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Integration tests require an isolated database ending in _test");
const { db, client } = connectDatabase(url);
const suffix = crypto.randomUUID();
const owner: Principal = { id: crypto.randomUUID(), email: `sweep-owner-${suffix}@example.edu`, name: "Owner" };
const outsider: Principal = { id: crypto.randomUUID(), email: `sweep-out-${suffix}@example.edu`, name: "Outsider" };
const service = new PairEvalService(db, [owner.email], "test-export-secret");
const ctx = (user: Principal) => ({ user, requestId: crypto.randomUUID() });
const origin = new URL(process.env.NEXTAUTH_URL || "http://localhost").origin;

type Kind = "open" | "creator" | "staff" | "student";
type Op = { id: string; method: string; path: () => string; body?: () => unknown; kind: Kind };
let roomId: string, assignmentId: string, groupId: string, student: Principal, pairId: string;
let others: Principal[] = [];

const assignmentBody = () => ({
  classroomId: roomId, name: "Sweep", opensAt: new Date(Date.now() - 60_000).toISOString(),
  closesAt: new Date(Date.now() + 86_400_000).toISOString(), config: {},
  criteria: [
    { id: "g", side: "GROUP", name: "Quality", weightPct: 100 },
    { id: "i", side: "INDIVIDUAL", name: "Teamwork", weightPct: 100 },
  ],
});
const a = (rest = "") => () => `/assignments/${assignmentId}${rest}`;
const reason = () => ({ reason: "Sweep check" });
const ops: Op[] = [
  { id: "getDashboard", method: "GET", path: () => "/dashboard", kind: "open" },
  { id: "acceptPrivacy", method: "POST", path: () => "/privacy", kind: "open" },
  { id: "listClassrooms", method: "GET", path: () => "/classrooms", kind: "open" },
  { id: "createClassroom", method: "POST", path: () => "/classrooms", body: () => ({ name: "X", slug: "x", domains: ["example.edu"] }), kind: "creator" },
  { id: "getRoster", method: "GET", path: () => `/classrooms/${roomId}/roster`, kind: "staff" },
  { id: "importRoster", method: "POST", path: () => `/classrooms/${roomId}/roster:import`, body: () => `email,group_name\nx1-${suffix}@example.edu,N\nx2-${suffix}@example.edu,N`, kind: "staff" },
  { id: "addStaffMember", method: "POST", path: () => `/classrooms/${roomId}/members`, body: () => ({ email: `ta-${suffix}@example.edu`, role: "TA" }), kind: "staff" },
  { id: "updateArtifact", method: "PATCH", path: () => `/classrooms/${roomId}/groups/${groupId}`, body: () => ({ artifactUrl: "https://example.edu/x" }), kind: "staff" },
  { id: "createAssignment", method: "POST", path: () => "/assignments", body: assignmentBody, kind: "staff" },
  { id: "getAssignment", method: "GET", path: a(), kind: "student" },
  { id: "editAssignment", method: "PATCH", path: a(), body: assignmentBody, kind: "staff" },
  { id: "getFeasibility", method: "GET", path: a("/feasibility"), kind: "staff" },
  { id: "publishAssignment", method: "POST", path: a(":publish"), body: () => ({ acceptReducedCoverage: true }), kind: "staff" },
  { id: "closeAssignment", method: "POST", path: a(":close"), body: reason, kind: "staff" },
  { id: "finalizeAssignment", method: "POST", path: a(":finalize"), body: reason, kind: "staff" },
  { id: "recomputeAssignment", method: "POST", path: a(":recompute"), kind: "staff" },
  { id: "assignInstructorPair", method: "POST", path: a("/instructor-pairs"), body: () => ({ criterionId: "g", itemAId: groupId, itemBId: groupId }), kind: "staff" },
  { id: "getMyEvaluations", method: "GET", path: a("/my-evaluations?side=INDIVIDUAL"), kind: "student" },
  { id: "saveDraft", method: "PUT", path: () => `/comparisons/${pairId}`, body: () => ({ choice: 2, expectedVersion: 0 }), kind: "student" },
  { id: "submitSide", method: "POST", path: a("/submissions"), body: () => ({ side: "GROUP" }), kind: "student" },
  { id: "getMyScore", method: "GET", path: a("/my-score"), kind: "student" },
  ...["group", "individual", "coverage", "quality"].map((r): Op => ({
    id: `report${r[0].toUpperCase()}${r.slice(1)}`, method: "GET", path: a(`/reports/${r}`), kind: "staff",
  })),
  { id: "overrideScore", method: "POST", path: a("/overrides"), body: () => ({ studentId: owner.id, value: 1, reason: "Sweep check" }), kind: "staff" },
  { id: "getAudit", method: "GET", path: a("/audit"), kind: "staff" },
  { id: "exportCsv", method: "POST", path: a("/exports"), body: () => ({ report: "raw" }), kind: "staff" },
  { id: "archiveClassroom", method: "POST", path: () => `/classrooms/${roomId}:archive`, body: () => ({ name: "Sweep", reason: "Sweep check" }), kind: "staff" },
];

const call = (op: Op, user: Principal) => {
  const body = op.body?.();
  return handleRequest(
    new Request(`${origin}/api${op.path()}`, {
      method: op.method,
      headers: { origin, "idempotency-key": `sweep-${crypto.randomUUID()}` },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    user,
    service,
  );
};

// Flags evaluator/snapshot keys and any string equal to a forbidden id/email, anywhere in a body.
function leaks(value: unknown, forbidden: Set<string>, path = "$"): string[] {
  if (typeof value === "string") return forbidden.has(value.toLowerCase()) ? [`${path}=${value}`] : [];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const here = `${path}.${k}`;
    if (/evaluator|snapshot/i.test(k)) return [`${here} (key)`];
    return leaks(v, forbidden, here);
  });
}

// FR-EVAL-02: an evaluator must see who/what they are rating, so the identities of the
// items in the caller's own comparisons are allowed in my-evaluations (and nowhere else).
// FR-ANON-01 still forbids every other peer id/email, i.e. anyone who rates the caller.
function evaluateeIdentities(body: { comparisons?: { leftItem?: { id: string; name: string }; rightItem?: { id: string; name: string } }[] }) {
  const items = (body.comparisons ?? []).flatMap((c) => [c.leftItem, c.rightItem]).filter((i) => !!i);
  return new Set(items.flatMap((i) => [i.id, i.name.toLowerCase(), ...others.filter((u) => u.id === i.id).map((u) => u.email.toLowerCase())]));
}

beforeAll(async () => {
  await db.insert(t.users).values([owner, outsider]);
  roomId = (await service.createClassroom(ctx(owner), { name: "Sweep", slug: "sweep", domains: ["example.edu"] })).id;
  const rows = Array.from({ length: 12 }, (_, i) => `sw${i}-${suffix}@example.edu,Group ${Math.floor(i / 4)}`);
  await service.importRoster(ctx(owner), roomId, `email,group_name\n${rows.join("\n")}`);
  const roster = await service.roster(ctx(owner), roomId);
  for (const g of roster.groups) await service.updateArtifact(ctx(owner), roomId, g.id, { artifactUrl: "https://example.edu/p" });
  groupId = roster.groups[0].id;
  const students = roster.members.filter((m) => m.role === "STUDENT");
  student = students.find((m) => m.email.startsWith("sw0-"))!;
  others = [owner, ...students.filter((m) => m.id !== student.id)];
  assignmentId = (await service.createAssignment(ctx(owner), assignmentBody())).id;
  await service.publish(ctx(owner), assignmentId, { acceptReducedCoverage: true });
  for (const peer of others.slice(1))
    for (const side of ["GROUP", "INDIVIDUAL"] as const) {
      for (const p of (await service.evaluations(ctx(peer), assignmentId, side)).comparisons)
        await service.save(ctx(peer), p.pairAssignmentId, { choice: 2, expectedVersion: 0 });
      await service.submit(ctx(peer), assignmentId, { side }, `peer-${side}-${peer.id}`);
    }
  pairId = (await service.evaluations(ctx(student), assignmentId, "GROUP")).comparisons[0].pairAssignmentId;
});
afterAll(async () => {
  await client.end();
});

describe.sequential("Every API operation as a student and as an outsider", () => {
  it("covers every operation in docs/openapi.yaml", () => {
    const spec = JSON.parse(readFileSync("docs/openapi.yaml", "utf8"));
    const documented = Object.values(spec.paths as Record<string, Record<string, { operationId?: string }>>)
      .flatMap((p) => Object.values(p).map((o) => o.operationId).filter(Boolean));
    expect(ops.map((o) => o.id).sort()).toEqual([...documented].sort());
  });

  it("denies staff routes (403 student / 404 outsider) and leaks no evaluator identity", async () => {
    const forbidden = new Set(others.flatMap((u) => [u.id, u.email.toLowerCase()]));
    const failures: string[] = [];
    for (const op of ops)
      for (const [who, user] of [["student", student], ["outsider", outsider]] as const) {
        const res = await call(op, user);
        const expected =
          op.kind === "open" ? 200
          : op.kind === "creator" ? 403
          : op.kind === "staff" ? (who === "student" ? 403 : 404)
          : who === "student" ? 200 : 404;
        const text = await res.text();
        if (res.status !== expected) failures.push(`${op.id} as ${who}: ${res.status} (want ${expected}) ${text.slice(0, 120)}`);
        if (!res.ok) continue;
        const body = JSON.parse(text);
        const allowed = op.id === "getMyEvaluations" ? evaluateeIdentities(body) : new Set<string>();
        const scoped = new Set([...forbidden].filter((v) => !allowed.has(v)));
        for (const leak of leaks(body, scoped)) failures.push(`${op.id} as ${who} leaks ${leak}`);
      }
    expect(failures).toEqual([]);
  });
});
