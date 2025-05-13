// sjsFeatured.js  —  fixed lazy‑load images, logs each item
const { launchBrowser } = require('./_browser');

function resolveImg(el) {
  const tryAttrs = ['data-src', 'data-lazy-src', 'data-large_image', 'srcset', 'src'];
  for (const attr of tryAttrs) {
    const val = el.getAttribute(attr);
    if (val) {
      // srcset → take first URL before whitespace
      const url = attr === 'srcset' ? val.split(/\s+/)[0] : val;
      if (!url.startsWith('data:')) {                     // skip 1×1 gif placeholders
        // add scheme if the URL starts with //
        return url.startsWith('//') ? `https:${url}` : url;
      }
    }
  }
  return '';                                             // fallback: empty string
}

async function extractProduct(page) {
  return page.evaluate(resolveFn => {
    const resolveImgInner = new Function('el', `return (${resolveFn})(el);`);

    const $ = sel => document.querySelector(sel);

    const name = $('h1.product-single__title, h1')?.textContent.trim() || '';

    // collect distinct image URLs (ignore duplicates/empty)
    const imgs = Array.from(
      document.querySelectorAll('img[data-product-image], .product-gallery__image')
    )
      .map(resolveImgInner)
      .filter((u, i, arr) => u && arr.indexOf(u) === i);

    const images = imgs.join('>>><<<');

    const price = "$" + (() => {
        const priceSpan = document.querySelector('.product__price .money[data-product-price]');
        if (!priceSpan) return '';
        const raw = priceSpan.getAttribute('data-currency-cad') || priceSpan.textContent;
        return raw.replace(/[^\d.]/g, '');
      })();
      
    const rel = document.querySelector('#template-product > div.product-wrapper > div > div.grid__item.medium-up--one-half.product__information > div > div > div > div.product__details > div:nth-child(3) > div.product-detail__content')
              ?.textContent.trim() || '';

    return [name, images, 'SolarisJapan', window.location.href, price, rel];
  }, resolveImg.toString());
}

async function scrapeSJSFeatured() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto('https://solarisjapan.com', { waitUntil: 'networkidle0' });

    const productLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a.product-link'))
        .slice(0, 5)
        .map(a => a.href)
    );

    const results = [];
    for (let i = 0; i < productLinks.length; i++) {
      await page.goto(productLinks[i], { waitUntil: 'networkidle0' });
      const data = await extractProduct(page);
      console.log(`Featured item ${i + 1}:`, data);      // ← log each product
      results.push(data);
    }
    return results;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeSJSFeatured };

//scrapeSJSFeatured()
