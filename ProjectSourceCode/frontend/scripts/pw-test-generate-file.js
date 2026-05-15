/**
 * Playwright smoke for the per-row "Generate file" button in the LLD RTM
 * inline HTML viewer. Includes request-body capture so we can diagnose any
 * server-side rejection.
 *
 * Usage:  node scripts/pw-test-generate-file.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LLD_ID = '1cfaa269-88a9-409d-b76e-a54f10d106fc';
const TARGET_URL = `http://localhost:4000/api/ba/artifacts/${LLD_ID}/rtm-html-inline`;
const OUT_DIR = path.resolve(__dirname, '..', '..', '..', 'pw-artifacts');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  const consoleLines = [];
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLines.push(`[PAGEERROR] ${err.message}`));

  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });

  const networkLog = [];
  page.on('request', (req) => {
    if (req.url().includes('/rtm/generate-missing-file')) {
      networkLog.push({
        method: req.method(),
        url: req.url(),
        headers: req.headers(),
        postData: req.postData(),
      });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/rtm/generate-missing-file')) {
      const entry = networkLog[networkLog.length - 1];
      if (entry) {
        entry.status = res.status();
        try { entry.bodyPreview = (await res.text()).slice(0, 1200); }
        catch { entry.bodyPreview = '<could not read body>'; }
      }
    }
  });

  console.log(`-> navigating to ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  const embed = await page.evaluate(() => ({
    lldId: window.__LLD_ARTIFACT_ID,
    apiBase: window.__LLD_API_BASE,
    hasFn: typeof window.__generateMissing === 'function',
  }));
  console.log('embed:', JSON.stringify(embed));

  await page.screenshot({ path: path.join(OUT_DIR, '01-loaded.png'), fullPage: true });

  await page.selectOption('#filter-status', 'ToDo');
  await page.waitForTimeout(500);

  const subtaskHandles = await page.locator('aside .subtask').all();
  console.log(`-> ${subtaskHandles.length} subtask entries visible after ToDo filter`);

  let chosen = null;
  for (let i = 0; i < subtaskHandles.length; i++) {
    const el = subtaskHandles[i];
    const label = (await el.innerText()).trim().replace(/\s+/g, ' ');
    await el.scrollIntoViewIfNeeded();
    await el.click();
    await page.waitForTimeout(120);
    const btnCount = await page.locator('#detail-pane button.gen-btn').count();
    if (btnCount > 0) {
      chosen = { index: i, label };
      console.log(`-> chose subtask #${i}: ${label}`);
      break;
    }
  }

  if (!chosen) {
    console.error('!! no subtask exposes a Generate button');
    await page.screenshot({ path: path.join(OUT_DIR, '02-no-button.png'), fullPage: true });
    await browser.close();
    process.exit(2);
  }

  await page.screenshot({ path: path.join(OUT_DIR, '02-detail-with-button.png'), fullPage: true });

  const btn = page.locator('#detail-pane button.gen-btn').first();
  const btnInfo = await btn.evaluate((el) => ({
    onclick: el.getAttribute('onclick'),
    dataStid: el.getAttribute('data-stid'),
    dataFile: el.getAttribute('data-file'),
    listeners: '(can\'t introspect addEventListener)',
  }));
  console.log(`-> button attrs: ${JSON.stringify(btnInfo)}`);

  console.log('-> clicking Generate file...');
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/rtm/generate-missing-file'),
    { timeout: 360_000 },
  );
  await btn.click();

  let postResult = null;
  try {
    const res = await responsePromise;
    postResult = { status: res.status(), body: (await res.text()).slice(0, 1500) };
    console.log(`-> POST status ${postResult.status}`);
    console.log(`-> POST body: ${postResult.body}`);
  } catch (e) {
    console.error(`!! never saw POST response: ${e.message}`);
  }

  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, '03-after-click.png'), fullPage: true });

  console.log('\n=== REQUEST DETAIL ===');
  for (const n of networkLog) {
    console.log(`  ${n.method} ${n.url}`);
    console.log(`  postData: ${n.postData}`);
    console.log(`  headers: ${JSON.stringify(n.headers, null, 2)}`);
    console.log(`  -> ${n.status} :: ${n.bodyPreview}`);
  }
  console.log('\n=== DIALOGS ===');
  for (const d of dialogs) console.log(`  [${d.type}] ${d.message}`);
  console.log('\n=== CONSOLE (last 20) ===');
  for (const line of consoleLines.slice(-20)) console.log(`  ${line}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'summary.json'),
    JSON.stringify({ url: TARGET_URL, embed, chosen, btnInfo, dialogs, networkLog, consoleLines, postResult }, null, 2),
  );
  await browser.close();
  console.log('\n[done]');
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
