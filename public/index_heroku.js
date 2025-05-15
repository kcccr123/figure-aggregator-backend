const scrapeJS = require('./scrappers/sjs.js')
const scrapeTOM = require('./scrappers/stom.js')
const scrapeSJSFeatured = require('./scrappers/sjsFeatured.js')
const scrapeSTOMFeatured = require('./scrappers/stomFeatured.js')
const express = require('express')
const app = express()
const mysql = require('mysql')
const cors = require('cors')

app.use(
  cors({
    origin: "https://figure-center.netlify.app",
    credentials: true,
  })
);
app.use(express.json())

/* 
  Connect to mySQL database

const db = mysql.createPool({
  user: '',
  host: '',
  password: '',
  database: ''
})
*/
/* 
  Basic search get request to mySQL. Applies filters applied in HTTP request.
*/
app.get('/search', (req, res) => {
  var newQuery = ""
  if (req.query.searchParem === "") {
    newQuery = "SELECT * FROM products INNER JOIN productprices ON products.name=productprices.name WHERE products.name LIKE '%%'"
  }
  else {
    newQuery = "SELECT * FROM products INNER JOIN productprices ON products.name=productprices.name WHERE products.name LIKE '% "
      + req.query.searchParem + " %'"
  }

  var filterQuery = ""
  var trackQuery = 0
  if (req.query.filters != null) {
    const dic = new Map();
    dic.set(0, 'SolarisJapan')
    dic.set(1, 'TokyoOtakuMode')
    for (let i = 0; i < req.query.filters.length; i++) {
      if (req.query.filters.charAt(i) === "1" && filterQuery == "") {
        filterQuery = " AND products.website IN ('" + dic.get(i) + "'"
        trackQuery += 1
      }
      else if (req.query.filters.charAt(i) === "1") {
        filterQuery += ", '" + dic.get(i) + "'"
        trackQuery += 1
      }
    }
    if (trackQuery > 0) {
      filterQuery += ")"
    }
  }

  var priceQuery = ""
  if (req.query.sort$ != null) {
    console.log('PRICE ORDERING')
    //code here
    if (req.query.sort$ === "high") {
      priceQuery = " ORDER BY CAST(productprices.price AS decimal(20,2)) DESC"
    } else if (req.query.sort$ === "low") {
      priceQuery = " ORDER BY CAST(productprices.price AS DECIMAL(20,2)) ASC"
    }

  }

  var orderFilter = ""
  if (req.query.ordertype != null) {
    const dic = new Map();
    dic.set(0, " AND productprices.rel != ''")
    dic.set(1, " AND productprices.rel = ''")
    dic.set(2, " AND productprices.price != ''")
    if (req.query.ordertype.slice(0, req.query.ordertype.length - 1) === "11") {
      if (req.query.ordertype.charAt(req.query.ordertype.length - 1) === "1") {
        orderFilter += dic.get(req.query.ordertype.length - 1)
      }
    }
    else {
      for (let i = 0; i < req.query.ordertype.length; i++) {
        if (req.query.ordertype.charAt(i) === "1") {
          orderFilter += dic.get(i)
        }

      }
    }
  }

  db.query(newQuery + filterQuery + orderFilter + priceQuery, (err, result) => {
    if (err) {

      console.log(err)
    } else {
      res.send(result)
    }
  })
})

/* 
  Get number of products for selected store
*/
app.get('/numInStore', (req, res) => {
  if (req.query.searchParem != "") {
    db.query("SELECT COUNT(website) AS count FROM products WHERE products.website LIKE '%" + req.query.name + "%' AND products.name LIKE '% "
      + req.query.searchParem + " %'", (err, result) => {
        if (err) {
          console.log(err)
        } else {
          res.send(result)
        }
      })
  } else {
    db.query("SELECT COUNT(website) AS count FROM products WHERE products.website LIKE '%" + req.query.name + "%'", (err, result) => {
      if (err) {
        console.log(err)
      } else {
        res.send(result)
      }
    })
  }
}
)

/* 
  Get featured items to be displayed on home page.
*/
app.get('/featuredItems', (req, res) => {
  console.log("SELECT * FROM featured WHERE featured.website LIKE '%" + req.query.store + "%'")
  db.query("SELECT * FROM featured WHERE featured.website LIKE '%" + req.query.store + "%'", (err, result) => {
    console.log('getFeaturedItems')
    if (err) {
      console.log(err)
    } else {
      res.send(result)
    }
  })
})



async function scrapeFeatured() {
  /* 
  Calls scraper to get front page on display items from websites and then uploads to mySQL database.
  */
  console.log('scraping featured')
  db.query('DELETE FROM heroku_5973ff8ebbd5109.featured')
  const products = await scrapeSJSFeatured.scrapeSJSFeatured()
  const stomProducts = await scrapeSTOMFeatured.scrapeSTOMFeatured()
  console.log(products)
  //stom broken
  // - price + .src
  console.log(stomProducts)
  for (let i = 0; i < stomProducts.length; i++) {
    products.push(stomProducts[i])
  }
  for (let i = 0; i < products.length; i++) {
    let name = products[i][0]
    let images = products[i][1]
    let website = products[i][2]
    let url = products[i][3]
    let preorder = products[i][4]
    let release = products[i][5]
    db.query('INSERT INTO heroku_5973ff8ebbd5109.featured (name, images, website, url, preorder, rel) VALUES (?, ?, ?, ?, ?, ?)',
      [name, images, website, url, preorder, release],
      (err, result) => {
        if (err) {
          console.log(err)
        }
      })
  }
  console.log('scrapeFeaturedComplete')
}

async function scrape() {
  var pageNumSJS = 1
  var pageNumStom = 1
  var sjsLen = 740
  var stomLen = await scrapeTOM.getSTOMlen()
  async function updateMax() {
    sjsLen = await scrapeJS.getSJSLength()
    stomLen = await scrapeTOM.getSTOMlen()
    console.log("max updated")
  }
  async function doScrape() {
    console.log(pageNumSJS)
    console.log(pageNumStom)
    const products = await scrapeJS.scrapeJSVari(pageNumSJS)
    const products2 = await scrapeTOM.scrapeTOMVari(pageNumStom)
    for (let i = 0; i < products2.length; i++) {
      products.push(products2[i])
    }
    for (let i = 0; i < products.length; i++) {
      db.query('INSERT INTO heroku_5973ff8ebbd5109.products (name, image, website, url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE image=image, website=website, url=url',
        [products[i][0], products[i][1], products[i][2], products[i][3]],
        (err, result) => {
          if (err) {
            console.log(err)
          }
        })
      db.query('INSERT INTO heroku_5973ff8ebbd5109.productprices (name, price, preowned, rel) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE price=price, preowned=preowned, rel=rel',
        [products[i][0], products[i][4], products[i][5], products[i][6]],
        (err, result) => {
          if (err) {
            console.log(err)
          }
        })
    }
    if (pageNumSJS >= sjsLen) {
      pageNumSJS = 1
    } else {
      pageNumSJS += 1
    }
    if (pageNumStom >= stomLen) {
      pageNumStom = 1
    } else {
      pageNumStom += 1
    }
  }
  setInterval(doScrape, 50000)
  //setInterval(updateMax, 900000)
  console.log('completeScrape')
}

app.listen(process.env.PORT || 4000, () => {
  console.log(`Example app listening on ${""}`)
  setInterval(scrapeFeatured, 1500000)
})
/* 
Run scrape() locally
run setInterval(scrapeFeatured, 900000) on heroku
*/



