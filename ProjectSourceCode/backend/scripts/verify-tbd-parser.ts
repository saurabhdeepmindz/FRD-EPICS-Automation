/**
 * Unit-style demonstration that the Section 19 parser correctly handles
 * both cases:
 *   1) AI provides no TBD-Future entries (CONFIRMED stories like US-052)
 *      → second table shows the "None" placeholder
 *   2) AI provides real TBD-Future entries (CONFIRMED-PARTIAL stories
 *      like the original US-074 with TBD-002) → second table shows the
 *      real KV rows captured from the AI output
 *
 * The placeholder is NOT hard-coded for all cases — it only fires when
 * `currentRows.length === 0` at flush time. Run this script to see for
 * yourself.
 */

// Inline copy of extractKvBlockAsGroups (the backend version) so the
// test runs without spinning up Nest.
function extractKvBlockAsGroups(rawLines: string[]) {
  const cleaned = rawLines
    .map((l) =>
      l
        .replace(/^\s*\/\*+/, '')
        .replace(/\*\/\s*$/, '')
        .replace(/^\s*\*\s?/, '')
        .replace(/\s+$/, ''),
    )
    .filter((_, idx, arr) => {
      const head = idx === 0 && !arr[0].trim();
      const tail = idx === arr.length - 1 && !arr[arr.length - 1].trim();
      return !head && !tail;
    });

  const nonEmpty = cleaned.filter((l) => l.trim() && !/^=+$/.test(l.trim()));
  const kvLines = nonEmpty.filter((l) => /^[\w\s().\-/]+:\s*\S/.test(l));
  if (nonEmpty.length < 3 || kvLines.length / nonEmpty.length < 0.6) return null;

  const groups: Array<{ title: string | null; rows: Array<[string, string]> }> = [];
  let currentTitle: string | null = null;
  let currentRows: Array<[string, string]> = [];
  let seenTbdHeader = false;
  const flush = () => {
    if (currentTitle === 'TBD-Future Dependencies' && currentRows.length === 0) {
      currentRows.push(['Status', 'None — this SubTask has no TBD-Future dependencies']);
    }
    if (currentRows.length > 0) {
      groups.push({ title: currentTitle, rows: currentRows });
    }
    currentTitle = null;
    currentRows = [];
  };

  for (const l of cleaned) {
    const t = l.trim();
    if (!t) continue;
    if (/^=+$/.test(t)) continue;
    if (/^TBD[-\s]Future\s+Dependencies\s*:?\s*$/i.test(t)) {
      flush();
      currentTitle = 'TBD-Future Dependencies';
      seenTbdHeader = true;
      continue;
    }
    const kv = /^([^:]+):\s*(.*)$/.exec(l);
    if (kv && kv[2].trim()) {
      currentRows.push([kv[1].trim(), kv[2].trim()]);
    } else if (!currentTitle && !/^\/\*|\*\/$/.test(t)) {
      currentTitle = t.replace(/^\/\*+/, '').replace(/\*\/$/, '').trim();
    }
  }
  flush();
  if (!seenTbdHeader && groups.length > 0) {
    groups.push({
      title: 'TBD-Future Dependencies',
      rows: [['Status', 'None — this SubTask has no TBD-Future dependencies']],
    });
  }
  if (groups.length === 0) return null;
  return groups;
}

function dump(label: string, groups: ReturnType<typeof extractKvBlockAsGroups>) {
  console.log(`\n────────────────────────────────────────────────`);
  console.log(`Case: ${label}`);
  console.log(`────────────────────────────────────────────────`);
  if (!groups) {
    console.log('  (no groups parsed)');
    return;
  }
  groups.forEach((g, idx) => {
    console.log(`\n  Table ${idx + 1}: ${g.title}`);
    g.rows.forEach(([k, v]) => console.log(`    ${k.padEnd(22)}│ ${v}`));
  });
}

// Case 1 — CONFIRMED story, AI emits no TBD entries (US-052 / US-053 shape)
const input1 = `/*
 * ============================================================
 * TRACEABILITY
 * ============================================================
 * Module:      MOD-04 — research-verification
 * Package:     research-verification
 * Feature:     F-04-01 — Search Previous Research Chats
 * Feature Status: CONFIRMED
 * Epic:        EPIC-04 — Research Verification Workflow
 * User Story:  US-052 — End User searches previous research chats (Frontend)
 * Story Status: CONFIRMED
 * Screen:      SCR-01 — Start Research
 * Test Cases:  TC-US052-FE-001 to TC-US052-FE-005
 * ============================================================
 * TBD-Future Dependencies:
 *   None for this SubTask.
 */`.split('\n');

dump('CONFIRMED story — no TBD entries (US-052)', extractKvBlockAsGroups(input1));

// Case 2 — CONFIRMED-PARTIAL story, AI emits real TBD entries (original US-074 shape)
const input2 = `/*
 * ============================================================
 * TRACEABILITY
 * ============================================================
 * Module:          MOD-04 — research-verification
 * Package:         research-verification
 * Feature:         F-04-08 — Manage Verification Quota
 * Feature Status:  CONFIRMED-PARTIAL
 * Epic:            EPIC-04 — Research Verification Workflow
 * User Story:      US-074 — Backend: Check and Decrement Verification Quota
 * Story Status:    CONFIRMED-PARTIAL
 * SubTask:         ST-US074-BE-01 — Implement API endpoint
 * Screen:          SCR-05, SCR-07
 * Test Cases:      TC-US074-BE-001, TC-US074-BE-002, TC-US074-BE-003
 * Generated:       [Automation Tool Name] v2.0
 *
 * TBD-Future Dependencies:
 *   TBD-002: QuotaManagementService interface — pending internal service approval
 *   Assumed: checkQuota(userId), decrementQuota(userId)
 *   Stub: QuotaManagementServiceStub — replace with real service when MOD-04 confirmed
 *   Affected: Algorithm Steps 3–5, Integration Point 1, Exception 3
 *   Resolution: Update Called Class, Method, Return type when QuotaManagementService SubTasks approved
 * ============================================================
 */`.split('\n');

dump('CONFIRMED-PARTIAL story — real TBD entries (US-074 shape)', extractKvBlockAsGroups(input2));
