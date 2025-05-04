import { chromium } from 'playwright';
import dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';
import { languageMap } from './utils/languages';

dotenv.config();

const EMAIL = process.env.CARDMARKET_EMAIL!;
const PASSWORD = process.env.CARDMARKET_PASSWORD!;

async function login(page: any) {
    await page.goto('https://www.cardmarket.com/es/Magic', { waitUntil: 'domcontentloaded' });
    //await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.fill('input[name="username"]', EMAIL);
    await page.fill('input[name="userPassword"]', PASSWORD);
    await page.click('input[type="submit"]');

    // Wait until you see the user menu or get redirected
    await page.waitForSelector('a[href*="/Magic"]');
    console.log('✅ Logged in');
}

async function scrapeInventory() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const csvFilePath = path.join(__dirname, 'card_inventory.csv');
    const csvStream = fs.createWriteStream(csvFilePath, { flags: 'w' });
    csvStream.write('Name,Set code,Collector number,Foil,Quantity,Language\n');

    await login(page);

    let currentPage = 1;
    const baseUrl = 'https://www.cardmarket.com/en/Magic/Stock/Offers/Singles';
    const results: string[] = [];

    while (true) {
        const url = `${baseUrl}?site=${currentPage}`;
        console.log(`Scraping: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('.table-body');

        const noResults = await page.$('.table-body .noResults');
        if (noResults) {
            console.log('🛑 No more results — stopping.');
            break;
        }

        const cards = await page.$$('[id^="articleRow"]');

        for (const card of cards) {
            const version = await card.$eval('span[data-bs-title]', el => {
                const html = el.getAttribute('data-bs-title') || '';
                const match = html.match(/\/1\/([^\/]+)\//); // Extracts the segment after '/1/'
                return match ? match[1] : 'UNKNOWN';
            });

            // Determine if the card is foil
            const foilIcon = await card.$('span.icon.st_SpecialIcon[aria-label="Foil"]');
            const foilStatus = foilIcon ? 'foil' : 'normal';

            // Extract quantity
            const quantityElement = await card.$('span.item-count.small.text-end');
            const quantityText = await quantityElement?.innerText();
            const quantity = quantityText ? parseInt(quantityText.trim(), 10) : 1;

            // Extract language
            const languageElement = await card.$('span.icon.me-2[aria-label]');
            const languageName = await languageElement?.getAttribute('aria-label');
            const languageCode = languageName ? languageMap[languageName] || 'en' : 'en';


            // Extract the card detail page URL
            const cardLink = await card.$eval(
                '.col-sellerProductInfo.col .row.g-0 .col-seller.col-12.col-lg-auto a',
                (a) => a.getAttribute('href') || ''
            );
            const cardUrl = `https://www.cardmarket.com${cardLink}`;

            // Open the card detail page in a new tab
            const detailPage = await context.newPage();

            const maxRetries = 3;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    await detailPage.goto(cardUrl, { waitUntil: 'domcontentloaded' });

                    // Wait for the Cloudflare challenge to appear
                    const challengeSelector = 'iframe[title*="challenge"]';
                    const challengeFrame = await detailPage.waitForSelector(challengeSelector, { timeout: 5000 }).catch(() => null);

                    if (challengeFrame) {
                        console.log('Cloudflare challenge detected. Please complete the verification manually.');
                        // Wait until the challenge iframe is no longer present
                        await detailPage.waitForSelector(challengeSelector, { state: 'detached', timeout: 60000 });
                        console.log('Challenge completed. Proceeding...');
                    }

                    // Proceed with your scraping logic here

                    break; // Exit the retry loop upon successful navigation
                } catch (error) {
                    console.log(`Attempt ${attempt + 1}`);
                    if (attempt < maxRetries - 1) {
                        console.log('Retrying...');
                        await detailPage.waitForTimeout(2000); // Wait before retrying
                    } else {
                        console.log('Max retries reached. Skipping this page.');
                    }
                }
            }

            // Extract the English name
            const h1Element = await detailPage.$('h1');
            let h1Text = await h1Element?.evaluate(el => el.childNodes[0].textContent?.trim());

            // Remove trailing parentheses and their content
            if (h1Text) {
                h1Text = h1Text.replace(/\s*\([^)]*\)\s*$/, '').trim();
            }

            const collectorNumberElement = await detailPage.$('dd.d-none.d-md-block.col-6.col-xl-7');
            const collectorNumberText = await collectorNumberElement?.innerText();
            const collectorNumber = collectorNumberText ? collectorNumberText.trim() : '';

            if (h1Text) {
                const csvLine = `"${h1Text}",${version},${collectorNumber},${foilStatus},${quantity},${languageCode}\n`;
                console.log("csvLine", csvLine);
                csvStream.write(csvLine);
            }

            await detailPage.close();
        }

        currentPage += 1;
    }


    await browser.close();

    csvStream.end();

    console.log(`✅ Inventory saved to ${csvFilePath}`);
}

scrapeInventory().catch(console.error);
