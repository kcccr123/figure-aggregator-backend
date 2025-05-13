require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const scrapeJS = require('./scrappers/sjs.js');
const scrapeTOM = require('./scrappers/stom.js');
const scrapeSJSFeatured = require('./scrappers/sjsFeatured.js');
const scrapeSTOMFeatured = require('./scrappers/stomFeatured.js');
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
const allowedOrigins = [
  'https://figure-center.netlify.app',  
  'http://localhost:3000'               
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: access denied from ${origin}`));
  },
  credentials: true
}));
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'aggregatordb',
  connectionLimit: 10
});

// pulse check for GCP
app.get('/', (_, res) => res.status(200).send('ok'));

/**
 * GET /search
 * Query products with optional search term, filters, sort, and order.
 */
app.get('/search', (req, res) => {
  console.log('/search req.query:', req.query);

  const term       = (req.query.query    || '').trim();
  const filters    = req.query.filters   || '';
  const sort$      = req.query.sort$;
  const ordert     = req.query.ordertype;
  const onlyPre    = req.query.preorder === 'true';   // Pre-Order Only = rel exists
  const onlyUsed   = req.query.preowned === 'true';   // Pre-Owned Only = preowned exists

  let sql = `
    SELECT
      p.name,
      p.image,
      p.website,
      p.url,
      pp.price,
      pp.preowned,
      pp.rel
    FROM products p
    JOIN productprices pp ON p.name = pp.name
  `;

  const where = [];

  // term search
  if (term) {
    where.push(`p.name LIKE ${mysql.escape('%' + term + '%')}`);
  }

  // store filters
  {
    const map   = ['SolarisJapan','TokyoOtakuMode'];
    const sites = [...filters]
      .map((b,i) => b==='1' ? map[i] : null)
      .filter(Boolean);
    if (sites.length) {
      where.push(`p.website IN (${sites.map(s=>mysql.escape(s)).join(',')})`);
    }
  }

  // order-type flags (upcoming vs released vs in-stock) —
  if (ordert) {
    const ops = [
      'pp.rel IS NOT NULL',    // has any rel
      'pp.rel IS NULL',        // no rel
      'pp.price IS NOT NULL'   // has price
    ];
    const picks = [...ordert]
      .map((b,i) => b==='1'? ops[i]: null)
      .filter(Boolean);
    if (picks.length) {
      where.push(picks.join(' AND '));
    }
  }

  // Pre-Order Only: rel exists (not null or empty)
  if (onlyPre) {
    where.push("(pp.rel IS NOT NULL AND pp.rel <> '')");
  }

  // Pre-Owned Only: preowned exists (not null or empty)
  if (onlyUsed) {
    where.push("(pp.preowned IS NOT NULL AND pp.preowned <> '')");
  }

  // glue WHERE
  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  // price sorting 
  if (sort$ === 'high')      sql += ' ORDER BY pp.price DESC';
  else if (sort$ === 'low')  sql += ' ORDER BY pp.price ASC';

  console.log('/search SQL →', sql);
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('/search error →', err);
      return res.status(500).send({ error: err.sqlMessage || 'DB error' });
    }
    res.send(rows);
  });
});

/**
 * GET /numInStore
 * Return count of products for a given store and search term.
 */
app.get('/numInStore', (req, res) => {
  const name = req.query.name?.trim() || '';
  const term = req.query.searchParem?.trim() || '';
  console.log(term, 'HELLELHEOHOEHLEH')
  let sql = 'SELECT COUNT(*) AS count FROM products p';
  const where = [];
  if (name) where.push(`p.website LIKE ${db.escape('%' + name + '%')}`);
  if (term) where.push(`p.name LIKE ${db.escape('%' + term + '%')}`);
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  db.query(sql, (e, rows) => (e ? res.status(500).send({ error: 'DB error' }) : res.send(rows)));
});

/**
 * GET /featuredItems
 * Fetch featured items for the specified store.
 */
app.get('/featuredItems', (req, res) => {
  const store = req.query.store?.trim() || '';
  const sql = `
    SELECT f.featured_id, p.name, f.images, f.website, f.url,
           f.preorder AS preorder, f.rel AS rel
    FROM featured f
    JOIN products p ON f.name = p.name
    WHERE f.website LIKE ${db.escape('%' + store + '%')}
  `;
  db.query(sql, (e, rows) => (e ? res.status(500).send({ error: 'DB error' }) : res.send(rows)));
});

/**
 * scrapeFeatured
 * Scrape and upsert featured items into the database.
 */
async function scrapeFeatured() {
  await db.query('DELETE FROM featured');
  const items = [
    ...(await scrapeSJSFeatured.scrapeSJSFeatured()),
    ...(await scrapeSTOMFeatured.scrapeSTOMFeatured())
  ];
  for (const [name, images, website, url, preorder, release] of items) {
    const primaryImage = Array.isArray(images) ? images[0] : images.split('>>><<<')[0];
    await new Promise(r =>
      db.query(
        `INSERT INTO products (name,image,website,url)
         VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE image=VALUES(image),website=VALUES(website),url=VALUES(url)`,
        [name, primaryImage, website, url],
        r
      )
    );
    await new Promise(r =>
      db.query(
        `INSERT INTO featured (name,images,website,url,preorder,rel)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE images=VALUES(images),preorder=VALUES(preorder),rel=VALUES(rel)`,
        [name, images, website, url, preorder, release],
        r
      )
    );
  }
}

/**
 * scrape
 * Crawl all pages to upsert products and prices into the database.
 */
async function scrape() {
  const lenS = 5;  // number of pages to scrape for SJS
  const lenT = 5;  // number of pages to scrape for TOM
  for (let pageS = 1; pageS <= lenS; pageS++) {
    const prods = await scrapeJS.scrapeJSVari(pageS);
    for (const [name, image, website, url, price, preowned, rel] of prods) {
      await new Promise(r =>
        db.query(
          `INSERT INTO products (name,image,website,url)
           VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE image=VALUES(image),website=VALUES(website),url=VALUES(url)`,
          [name, image, website, url],
          r
        )
      );
      await new Promise(r =>
        db.query(
          `INSERT INTO productprices (name,price,preowned,rel)
           VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE price=VALUES(price),preowned=VALUES(preowned),rel=VALUES(rel)`,
          [name, price, preowned, rel],
          r
        )
      );
    }
  }
  for (let pageT = 1; pageT <= lenT; pageT++) {
    const prods = await scrapeTOM.scrapeTOMVari(pageT);
    for (const [name, image, website, url, price, preowned, rel] of prods) {
      await new Promise(r =>
        db.query(
          `INSERT INTO products (name,image,website,url)
           VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE image=VALUES(image),website=VALUES(website),url=VALUES(url)`,
          [name, image, website, url],
          r
        )
      );
      await new Promise(r =>
        db.query(
          `INSERT INTO productprices (name,price,preowned,rel)
           VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE price=VALUES(price),preowned=VALUES(preowned),rel=VALUES(rel)`,
          [name, price, preowned, rel],
          r
        )
      );
    }
  }
}

app.listen(4000, async () => {
  setInterval(scrapeFeatured, 24 * 60 * 60 * 1000);
  //scrape();                       
});
