const puppeteer = require('puppeteer');

/**
 * Launches a headless Puppeteer browser with recommended flags.
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

module.exports = { launchBrowser };
