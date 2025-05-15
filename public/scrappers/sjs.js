// sjs.js
/**
 * SolarisJapan scraper (browser‑reuse version)
 *
 * Exports
 *   • scrapeJSVari(pageNum = 1) → scrape one page (opens/close browser itself)
 *   • scrapeJS()                → scrape all pages; re‑uses one browser/page
 *   • getSJSLength()            → optional helper (still opens/close browser)
 *
 * When run directly with `node sjs.js`, it scrapes all pages and prints JSON.
 */

const { launchBrowser } = require('./_browser');

/* ───────────── Helpers ───────────── */
const clean = t => (t || '').replace(/[^\d.]/g, '').trim();

/**
 * Extract product data from the *current* page object.
 *   page   – puppeteer Page already positioned on the collection page
 *   return – array of [name, image, 'SolarisJapan', url, price, preOwned, rel]
 */
async function extractFromPage(page) {
  return page.evaluate(() => {
    const cleanInner = txt => (txt || '').replace(/[^\d.]/g, '').trim();

    return Array.from(document.querySelectorAll('[data-product-id]')).map(card => {
      const name  = card.querySelector('.product-title, .title')?.textContent.trim() || '';
      const image = card.querySelector('img')?.src || '';
      const url   = card.querySelector('a')?.href || '';

      let price = '', preOwned = '', rel = '';
      const bn   = card.querySelector('.product-label--brand-new .money');
      const po   = card.querySelector('.product-label--pre-order .money');
      const pre  = card.querySelector('.product-label--pre-owned .money');
      const r    = card.querySelector('.product-label--release .product-label__detail');

      if (bn) price = cleanInner(bn.textContent);
      else if (po) price = cleanInner(po.textContent);

      if (pre) preOwned = cleanInner(pre.textContent);
      if (r)   rel      = r.textContent.trim();

      return [name, image, 'SolarisJapan', url, price, preOwned, rel];
    });
  });
}



/** Scrape a single page of results (opens and closes its own browser). */
async function scrapeJSVari(pageNum = 1) {
  if (pageNum < 1) throw new Error('pageNum must be ≥ 1');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(
      `https://solarisjapan.com/collections/figures?page=${pageNum}`,
      { waitUntil: 'networkidle0' }
    );
    const data = await extractFromPage(page);
    console.log(`Page ${pageNum}:`, data);            // log each result array
    return data;
  } finally {
    await browser.close();
  }
}

/** Scrape *all* pages by re‑using one browser & page (faster, no timeouts). */
async function scrapeJS() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const all  = [];
    let pageNum = 1;

    while (true) {
      await page.goto(
        `https://solarisjapan.com/collections/figures?page=${pageNum}`,
        { waitUntil: 'networkidle0' }
      );

      const results = await extractFromPage(page);
      console.log(`Page ${pageNum}:`, results);        // log each page’s data

      if (!results.length) break;                     // empty → we’re done
      all.push(...results);
      pageNum++;
    }
    return all;
  } finally {
    await browser.close();
  }
}

/** Optional: determine max page count (not used by scrapeJS). */
async function getSJSLength() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto('https://solarisjapan.com/collections/figures', { waitUntil: 'networkidle0' });
    const len = await page.evaluate(() => {
      const nums = Array.from(document.querySelectorAll('ul.pagination__list li a'))
        .map(a => parseInt(a.textContent.trim(), 10))
        .filter(n => !isNaN(n));
      return nums.length ? Math.max(...nums) : 1;
    });
    return len;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeJSVari, scrapeJS, getSJSLength };

//scrapeJS()