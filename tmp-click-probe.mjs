import puppeteer from "puppeteer-core";

const chrome =
  process.env.CHROME ||
  "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

async function probe(width) {
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));
  await page.setViewport({ width, height: 800, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector('button[aria-label="Sound settings"]');

  const overlay = await page.evaluate(() => {
    const sound = document.querySelector('button[aria-label="Sound settings"]');
    const theme = document.querySelector('button[aria-label="Switch to dark mode"]');
    const students = document.querySelector('label[for]');
    const r1 = sound.getBoundingClientRect();
    const r2 = theme.getBoundingClientRect();
    const r3 = students.getBoundingClientRect();
    const at = (el, r) => {
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        target: el.tagName + (el.getAttribute("aria-label") || el.textContent || "").slice(0, 40),
        hit: hit ? `${hit.tagName}.${hit.className}`.slice(0, 120) : "null",
        hitIsSelf: el === hit || el.contains(hit),
        x,
        y,
      };
    };
    const portal = document.querySelector("nextjs-portal");
    const portalBox = portal ? portal.getBoundingClientRect() : null;
    const portalStyle = portal ? getComputedStyle(portal) : null;
    return {
      sound: at(sound, r1),
      theme: at(theme, r2),
      students: at(students, r3),
      portal: portal
        ? {
            display: portalStyle.display,
            pointerEvents: portalStyle.pointerEvents,
            zIndex: portalStyle.zIndex,
            width: portalBox.width,
            height: portalBox.height,
            innerHTML: portal.innerHTML.slice(0, 300),
          }
        : null,
    };
  });

  await page.click('button[aria-label="Sound settings"]');
  const soundAfter = await page.$eval('button[aria-label="Sound settings"]', (el) => el.getAttribute("aria-expanded"));

  await page.click('button[aria-label="Switch to dark mode"]').catch((e) => logs.push(`[click-theme] ${e.message}`));
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));

  console.log(JSON.stringify({ width, overlay, soundAfter, dark, logs }, null, 2));
  await page.close();
}

await probe(1280);
await probe(375);
await browser.close();
