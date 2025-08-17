// src/index.ts
/**
 * Handles logging into Cardmarket.
 * @param page The Playwright page object.
 */
import { chromium, Page, Locator } from 'playwright';
import dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';
import { languageMap } from './utils/languages';

dotenv.config();
const EMAIL = process.env.CARDMARKET_EMAIL!;
const PASSWORD = process.env.CARDMARKET_PASSWORD!;

// --- Helper Functions START ---

/**
 * Handles logging into Cardmarket.
 * @param page The Playwright page object.
 */
async function login(page: Page): Promise<void> {
    console.log('🚀 Attempting to log in...');
    const initialUrl = 'https://www.cardmarket.com/en/Pokemon/Stock/Offers/Singles';
    await page.goto(initialUrl, { waitUntil: 'domcontentloaded' });

    // Handle the cookie banner
    const acceptCookiesButton = page.locator('#onetrust-accept-btn-handler');
    if (acceptCookiesButton && await acceptCookiesButton.isVisible({ timeout: 5000 })) {
        console.log('🍪 Accepting cookies...');
        await acceptCookiesButton.click();
        await page.waitForTimeout(500); // Small wait for stability
    }

    console.log('📝 Filling login credentials...');
    await page.fill('input[name="username"]', EMAIL);
    await page.fill('input[name="userPassword"]', PASSWORD);

    const loginButtonSelector = 'input[type="submit"][value="Log in"]';

    console.log('Waiting for login button to be visible...');
    await page.locator(loginButtonSelector).waitFor({ state: 'visible', timeout: 30000 });

    console.log('Attempting to click the login button using page.evaluate...');
    
    await page.evaluate((selector) => {
        // Explicitly cast to HTMLInputElement to satisfy TypeScript
        const button = document.querySelector(selector) as HTMLInputElement | null;
        if (button) {
            button.click();
        } else {
            console.error(`Login button not found with selector: ${selector}`);
            throw new Error(`Login button not found with selector: ${selector}`);
        }
    }, loginButtonSelector);
    
    console.log('Waiting for navigation after login attempt...');
    // This waits for navigation but doesn't enforce the exact URL,
    // allowing for variations after a login post.
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check for the presence of an element that indicates a successful login and navigation.
    try {
        // The HTML shows: <span class="d-none d-lg-block">LeonidTCG</span>
        // We'll look for a span within the line-height115 div that contains the username.
        await page.waitForSelector('.line-height115 span.d-none.d-lg-block', { timeout: 30000 });
        console.log('✅ Login successful and detected!');
    } catch (error) {
        // If the user element isn't found, it's likely the login failed or redirected elsewhere.
        console.warn('Warning: Could not detect user element after login. The page may not have loaded correctly or login failed.');
    }
}

/**
 * Processes a single card row and writes its data to the CSV.
 * @param row The Playwright Locator for the card row.
 * @param csvStream The write stream for the CSV file.
 */
async function processCardRow(row: Locator, csvStream: fs.WriteStream): Promise<void> {
    try {
        // 1. Get Name and Collector Number from the main product link's text.
        const linkElement = row.locator('div.col-sellerProductInfo a').first();
        const linkText = await linkElement.textContent() || '';
        
        let name = linkText.trim();
        let setCode = 'UNKNOWN';
        let collectorNumber = 'N/A';

        // Improved parsing to handle various formats:
        // "Cheren (xWHT 081)" -> name="Cheren", setCode="xWHT", collectorNumber="081"
        // "Spinda Lv.25 (SW 111)" -> name="Spinda Lv.25", setCode="SW", collectorNumber="111"
        // "Staravia (SVI 149)" -> name="Staravia", setCode="SVI", collectorNumber="149"
        
        const nameAndMetaMatch = linkText.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (nameAndMetaMatch && nameAndMetaMatch[1] && nameAndMetaMatch[2]) {
            name = nameAndMetaMatch[1].trim();
            const metaText = nameAndMetaMatch[2].trim();
            
            // Split the meta text by spaces
            const parts = metaText.split(/\s+/);
            if (parts.length >= 2) {
                // Last part is the number, everything else is the set code
                collectorNumber = parts.pop() || 'N/A';
                setCode = parts.join(' ');
            } else if (parts.length === 1) {
                // Only one part - could be just set code or just number
                const part = parts[0];
                if (/^\d+[a-zA-Z]*$/.test(part)) {
                    // Looks like a number with optional suffix (e.g., "081" or "111a")
                    collectorNumber = part;
                } else {
                    // Looks like a set code
                    setCode = part;
                }
            }
        }

        // 3. Foil status (checking for 'Reverse Holo' as seen in HTML)
        // The HTML shows: <span ... aria-label="Reverse Holo">
        // This selector targets spans with class 'st_SpecialIcon' that have 'Holo' in their aria-label.
        const foilIndicator = row.locator('.product-attributes span.icon.st_SpecialIcon[aria-label*="Holo"], .product-attributes span.icon.st_SpecialIcon[aria-label*="Foil"]');
        const isFoil = await foilIndicator.count() > 0; // Check if any such element is found
        const foilStatus = isFoil ? 'foil' : 'normal';

        // Quantity is usually in '.item-count'
        // Looking at the HTML, the quantity is in a span with class "item-count small text-end"
        // And it's inside a div with class "amount-container"
        let quantity = 1; // Default value
        try {
            const quantityElement = row.locator('div.amount-container span.item-count').first();
            const quantityText = await quantityElement.textContent() || '1';
            const parsedQuantity = parseInt(quantityText.trim(), 10);
            if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
                quantity = parsedQuantity;
            } else {
                console.warn(`     -> Could not parse quantity "${quantityText}" for ${name}. Defaulting to 1.`);
            }
        } catch (quantityError) {
            console.warn(`     -> Error getting quantity for ${name}. Defaulting to 1.`, quantityError);
        }

        // Language is typically found using 'onmouseover' attribute on a span icon.
        const languageElement = row.locator('.product-attributes span.icon.me-2[onmouseover]');
        const languageLabel = await languageElement.getAttribute('onmouseover');
        let languageCode = 'en'; // Default to English
        if (languageLabel) {
            const langMatch = languageLabel.match(/showMsgBox\(this,`([^`]+)`\)/);
            if (langMatch && langMatch[1]) {
                const langName = langMatch[1];
                languageCode = languageMap[langName] || 'en'; // Look up the code in our map
            }
        }
        
        // Construct CSV line
        const csvLine = `"${name}","${setCode}","${collectorNumber}","${foilStatus}",${quantity},"${languageCode}"\n`;
        
        csvStream.write(csvLine);
        console.log(`   -> Writing: Name="${name}", Set="${setCode}", Num="${collectorNumber}" (Foil: ${foilStatus}, Qty: ${quantity}, Lang: ${languageCode})`);

    } catch (e) {
        console.error('   -> Error processing a card row. Skipping.', e);
    }
}

/**
 * Navigates to a URL with retry logic and exponential backoff
 * @param page The Playwright page object
 * @param url The URL to navigate to
 * @param maxRetries Maximum number of retries
 * @returns boolean indicating success
 */
async function navigateWithRetry(page: Page, url: string, maxRetries: number = 4): Promise<boolean> {
    const baseDelay = 15000; // 15 seconds base delay
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`   🔁 Attempt ${i + 1}/${maxRetries} to navigate to: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            return true;
        } catch (error: any) {
            console.warn(`   ⚠️  Navigation attempt ${i + 1} failed:`, error.message || error);
            if (i < maxRetries - 1) {
                const delay = baseDelay * (i + 1); // 15s, 30s, 45s, 60s
                console.log(`   ⏳ Waiting ${delay/1000} seconds before retry...`);
                await page.waitForTimeout(delay);
            }
        }
    }
    console.error(`   ❌ All ${maxRetries} navigation attempts failed for: ${url}`);
    return false;
}

/**
 * Scrapes the user's inventory from Cardmarket and saves it to a CSV file.
 */
async function scrapeInventory() {
    const browser = await chromium.launch({ headless: false }); // Set to true for production
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const csvFilePath = path.join(__dirname, 'card_inventory.csv');
    // Ensure the directory exists
    fs.mkdirSync(path.dirname(csvFilePath), { recursive: true });
    const csvStream = fs.createWriteStream(csvFilePath, { flags: 'w' });
    
    try {
        await login(page);
        
        let currentPage = 1;
        const baseUrl = 'https://www.cardmarket.com/en/Pokemon/Stock/Offers/Singles';
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3;

        while (true) {
            const url = `${baseUrl}?site=${currentPage}&sortBy=price&order=asc`;
            console.log(`\n📄 Scraping page ${currentPage}: ${url}`);
            
            const navigationSuccess = await navigateWithRetry(page, url, 4);
            if (!navigationSuccess) {
                consecutiveErrors++;
                console.error(`Failed to navigate to page ${currentPage}. Consecutive errors: ${consecutiveErrors}`);
                
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.error(`Maximum consecutive errors (${maxConsecutiveErrors}) reached. Exiting.`);
                    break;
                }
                currentPage++;
                continue;
            }
            
            // Reset consecutive errors counter on successful navigation
            consecutiveErrors = 0;

            // Wait for the main content container and check if there are any results
            try {
                await page.waitForSelector('.table-body', { timeout: 30000 });
            } catch (waitError) {
                console.warn(`Timeout waiting for table on page ${currentPage}. Continuing...`);
                currentPage++;
                continue;
            }
            
            const noResultsSelector = '.table-body .noResults';
            // Use locator.count() to check if the "no results" element exists.
            const hasResults = await page.locator(noResultsSelector).count() === 0;

            if (!hasResults) {
                console.log('🛑 No more results found on this page. Scraping complete.');
                break;
            }

            // Select all card rows within the table body
            const cardRows = await page.locator('.table-body .article-row').all();
            console.log(`🔍 Found ${cardRows.length} cards on this page.`);

            // Process each card row
            for (const row of cardRows) {
                await processCardRow(row, csvStream);
            }
            
            // Check for the "Next page" button to decide if we should continue
            // Fix for strict mode violation - select the first one specifically
            const nextPageButton = page.locator('.pagination .pagination-control[aria-label="Next page"]').first();
            
            // Correct way to check for a class on a locator:
            // Evaluate JavaScript in the browser to check the element's classList
            const isNextPageDisabled = await nextPageButton.evaluate((el: HTMLElement) => el.classList.contains('disabled')).catch(() => true);

            if (isNextPageDisabled) {
                console.log('🏁 Reached the last page. Scraping complete.');
                break; // Exit loop if next button is disabled
            }
            
            // If next page button is not disabled, click it
            // Wait for navigation to complete
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                    nextPageButton.click()
                ]);
            } catch (navError: any) {
                console.warn(`Navigation after clicking next page button failed. Continuing anyway...`, navError.message || navError);
            }
            
            currentPage++;
            // Wait a bit to ensure the page is ready for the next iteration
            await page.waitForTimeout(3000); 
        }
    } catch (error) {
        console.error('An error occurred during the overall scraping process:', error);
    } finally {
        await browser.close();
        csvStream.end();
        console.log(`\n✅ Inventory successfully saved to ${csvFilePath}`);
    }
}

// --- Main Execution ---
scrapeInventory().catch(console.error);