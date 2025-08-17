# Cardmarket Inventory Exporter

A Node.js script that automatically scrapes your Cardmarket Pokemon inventory and exports it to a CSV file for easy management and analysis.

## Features

- ✅ **Automated Login**: Securely logs into your Cardmarket account
- 📊 **Complete Inventory Export**: Exports all your Pokemon cards with detailed information
- 📝 **Rich Data Extraction**: Captures card name, set code, collector number, foil status, quantity, and language
- 🛡️ **Robust Error Handling**: Implements retry logic with exponential backoff for network issues
- 📁 **CSV Output**: Generates a clean CSV file ready for import into spreadsheets or databases

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (version 14 or higher)
- npm (usually comes with Node.js)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/cardmarket-inventory-exporter.git
cd cardmarket-inventory-exporter
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Cardmarket credentials:
```env
CARDMARKET_EMAIL=your_email@example.com
CARDMARKET_PASSWORD=your_password
```

## Usage

Run the script:
```bash
npm start
```

Or for development with auto-restart on file changes:
```bash
npm run dev
```

The script will:
1. Launch a browser window (visible mode for debugging)
2. Navigate to Cardmarket and log in with your credentials
3. Navigate through all pages of your inventory
4. Extract card data and save it to `card_inventory.csv` in the src folder

## Output Format

The generated CSV file contains the following columns:
- **Name**: Card name
- **Set**: Set code (e.g., "SVI", "xWHT", "SW")
- **Num**: Collector number
- **Foil Status**: "foil" or "normal"
- **Quantity**: Number of cards you own
- **Language**: Language code (en, fr, de, etc.)

Example row:
```
"Cheren","xWHT","081","foil",1,"en"
```

## Configuration

### Environment Variables

Create a `.env` file with your credentials:
```env
CARDMARKET_EMAIL=your_actual_email@domain.com
CARDMARKET_PASSWORD=your_actual_password
```

### Browser Mode

To run in headless mode (no visible browser window), change this line in `src/index.ts`:
```typescript
const browser = await chromium.launch({ headless: true }); // Set to false for debugging
```

## Troubleshooting

### Common Issues

1. **Login Failed**: Verify your credentials in `.env` file
2. **Navigation Timeouts**: The script includes retry logic with increasing delays (15s, 30s, 45s, 60s)
3. **Rate Limiting**: Cardmarket may temporarily block requests; the script will retry automatically
4. **Captcha**: If Cardmarket shows a captcha, you'll need to solve it manually in the browser window

### Error Handling

- **Consecutive Error Limit**: Script exits after 3 consecutive page failures
- **Retry Logic**: Up to 4 attempts per page with exponential backoff
- **Graceful Exit**: Data is saved even if the script encounters errors

## Development

### Project Structure

```
cardmarket-inventory-exporter/
├── src/
│   ├── index.ts          # Main scraping logic
│   └── utils/
│       └── languages.ts   # Language code mappings
├── node_modules/         # Installed dependencies (auto-generated)
├── .env                 # Your credentials (gitignored)
├── .gitattributes       # Git attributes configuration
├── .gitignore           # Excludes sensitive files
├── nodemon.json         # Nodemon configuration
├── package-lock.json    # Locked dependency versions
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── LICENSE              # CC BY-NC-SA 4.0 License file
└── README.md           # (hey this is me! 👋)
```

### Dependencies

See `package.json` for the complete list of dependencies.

## Security & Privacy

- 🔒 Credentials are stored locally in `.env` file
- 👁️ Browser mode allows you to monitor the scraping process
- 🚫 No data is sent to external servers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/WowAnAmazingFeature`)
3. Commit your changes (`git commit -m 'Add a very wow AmazingFeature'`)
4. Push to the branch (`git push origin feature/WowAnAmazingFeature`)
5. Open a pull request

## Disclaimer

This tool is for personal use only. Please ensure you comply with Cardmarket's Terms of Service when using this scraper. The developers are not responsible for any account restrictions that may result from using this tool. Use it at your own risk.

## License

<a href="https://github.com/leonid-dalin/cardmarket-inventory-exporter/">Cardmarket Inventory Exporter</a> © 2025 by <a href="https://github.com/leonid-dalin/">Leonid Dalin</a> is licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a><img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;"><img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;"><img src="https://mirrors.creativecommons.org/presskit/icons/nc.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;"><img src="https://mirrors.creativecommons.org/presskit/icons/sa.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;">

The use of any content on this repository for training any artificial intelligence (AI) model, or for any form of AI to remix, adapt, or build upon my works, is strictly prohibited.