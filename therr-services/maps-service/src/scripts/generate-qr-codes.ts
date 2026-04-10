/**
 * generate-qr-codes.ts
 *
 * Admin script to generate QR code PNGs for all pending spaceDisplayRequests.
 *
 * Usage:
 *   dotenv_config_path=../../.env npx ts-node -r dotenv/config \
 *     -r tsconfig-paths/register src/scripts/generate-qr-codes.ts [--output ./qr-output]
 *
 * Output:
 *   One PNG per request named {spaceId}_{displayType}.png in the output directory.
 *   QR codes encode: https://www.therr.com/spaces/{spaceId}?checkin=true
 *   Resolution: 1200×1200 px (≥ 300 DPI when printed at 4"×4")
 */

import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import Store from '../store';

export const SPACES_BASE_URL = 'https://www.therr.com/spaces';

export const buildCheckinQrUrl = (spaceId: string): string => `${SPACES_BASE_URL}/${spaceId}?checkin=true`;

const QR_SIZE_PX = 1200; // 300 DPI × 4 inches

function parseArgs(): { outputDir: string } {
    const args = process.argv.slice(2);
    const outputIndex = args.indexOf('--output');
    const outputDir = outputIndex !== -1 && args[outputIndex + 1]
        ? path.resolve(args[outputIndex + 1])
        : path.resolve(__dirname, '../../qr-output');
    return { outputDir };
}

async function main() {
    const { outputDir } = parseArgs();

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('Fetching pending display requests...');
    const pendingRequests = await Store.spaceDisplayRequests.listPendingWithSpaceInfo();

    if (pendingRequests.length === 0) {
        console.log('No pending display requests found.');
        process.exit(0);
    }

    console.log(`Found ${pendingRequests.length} pending request(s). Generating QR codes...\n`);

    const results = await Promise.all(pendingRequests.map(async (request) => {
        const { spaceId, displayType, businessName } = request;
        const qrUrl = buildCheckinQrUrl(spaceId);
        const fileName = `${spaceId}_${displayType}.png`;
        const outputPath = path.join(outputDir, fileName);

        try {
            await QRCode.toFile(outputPath, qrUrl, {
                type: 'png',
                width: QR_SIZE_PX,
                margin: 2,
                errorCorrectionLevel: 'H',
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });
            // eslint-disable-next-line no-console
            console.log(`  [OK] ${fileName}  (${businessName || spaceId})`);
            return true;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`  [FAIL] ${fileName}: ${(err as Error).message}`);
            return false;
        }
    }));

    const generated = results.filter(Boolean).length;
    const skipped = results.filter((r) => !r).length;

    console.log(`\nDone. Generated: ${generated}  Skipped: ${skipped}`);
    console.log(`Output directory: ${outputDir}`);

    process.exit(skipped > 0 ? 1 : 0);
}

// Only run when executed directly, not when imported by tests
if (require.main === module) {
    main().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
