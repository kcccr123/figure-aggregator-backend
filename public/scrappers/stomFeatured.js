/**
 * scrappers/stomFeatured.js
 * Scrapes the five newest Figure/Doll items on Tokyo Otaku Mode.
 * Public API: scrapeSTOMFeatured()
 * Uses shared launchBrowser() for Puppeteer.
 */

const { launchBrowser } = require('./_browser');

async function scrapeSTOMFeatured() {
  const browser = await launchBrowser({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page    = await browser.newPage();
  page.setDefaultNavigationTimeout(0);

  await page.goto('https://otakumode.com/shop/figures-dolls/?sort=new', { waitUntil: 'networkidle0' });

  const products = await page.evaluate(() => {
    const collection = document.getElementsByClassName('p-product-list__thumb');
    const lst = [];
    for (let x = 0; x < 5; x++) lst.push(collection[x].href);
    return lst;
  });

  const allProducts = [];
  for (let i = 0; i < products.length; i++) {
    await page.goto(products[i], { waitUntil: 'networkidle0' });
    const product = await page.evaluate(() => {
      const temp = [];
      temp.push(document.querySelector('#shopMainArea > article > div > div.p-product-detail-main > div.p-product-detail__contents.u-flex > div.p-product-detail-main__note > div > h1 > span').innerHTML);

      const images = [];
      images.push(document.getElementsByClassName('img-responsive img-responsive--full js-slick-image js-magnifier-0')[0]);
      images.push(document.getElementsByClassName('img-responsive img-responsive--full js-slick-image js-magnifier-1')[0]);
      images.push(document.getElementsByClassName('img-responsive img-responsive--full js-slick-image js-magnifier-2')[0]);
      images.push(document.getElementsByClassName('img-responsive img-responsive--full js-slick-image js-magnifier-3')[0]);

      console.log('check');
      console.log(images);

      try {
        let imageStr = images[0].src;
        for (let i = 1; i < images.length; i++) imageStr += '>>><<<' + images[i].src;
        temp.push(imageStr);
        temp.push('TokyoOtakuMode');
        temp.push(document.querySelector('#shopMainArea > article > div > div.p-product-detail-main > div.p-product-detail__contents.u-flex > div.p-product-detail-main__note > div > div:nth-child(4) > div.p-product-detail__sku > div > div:nth-child(1) > div > span.p-price__price > span.p-price__offscreen').innerHTML);
        temp.push(document.querySelector('#shopMainArea > article > div > div.p-product-detail-main > div.p-product-detail__contents.u-flex > div.p-product-detail-main__note > div > div:nth-child(4) > div:nth-child(2) > div > p > span.p-product-detail__release-month > a').innerHTML);
        return temp;
      } catch {
        console.log('occurs');
      }
    });
    try {
      product.splice(3, 0, products[i]);
      console.log(product);
      allProducts.push(product);
    } catch {
      i--;
    }
  }

  await browser.close();
  return allProducts;
}

module.exports = { scrapeSTOMFeatured };

//scrapeSTOMFeatured(); 
