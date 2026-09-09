const fs = require('fs-extra');
const path = require('path');
const nativeFs = require('fs');

// Get the argument from command line
const arg = process.argv[2];
let targetDirName;
let targetDirPath = '../serveronet-app/storage/app/developed_sites/';

if (arg === 'prod') {
    targetDirName = targetDirPath+'Tech-Demo-Site';
} else if (arg === 'dev' || arg === 'watch') {
    targetDirName = targetDirPath+'Tech-Demo-Site-Dev';
} else {
    // Default to the provided argument or the production path
    targetDirName = arg || targetDirPath+'Tech-Demo-Site';
}

const srcDir = path.join(__dirname, 'src');
const destDir = path.resolve(__dirname, targetDirName);
const protectedFiles = ['site_config_export.json'];

let buildTimer = null;

async function build() {
    try {
        // 1. Clean the destination directory if it exists, but preserve protected files
        if (fs.existsSync(destDir)) {
            const files = await fs.readdir(destDir);
            for (const file of files) {
                const filePath = path.join(destDir, file);
                const stat = await fs.stat(filePath);
                // Skip the protected file during cleanup
                if (protectedFiles.includes(file)) {
                    continue;
                }
                if (stat.isDirectory()) {
                    await fs.remove(filePath);
                } else if (stat.isFile()) {
                    await fs.unlink(filePath);
                }
            }
            console.log(`Cleaned: ${destDir} (preserved protected files)`);
        } else {
            await fs.ensureDir(destDir);
            console.log(`Created: ${destDir}`);
        }
        
        // 2. Copy src contents to the target directory
        await fs.copy(srcDir, destDir);
        console.log(`Successfully copied src to ${targetDirName}`);
        
    } catch (err) {
        console.error('Build failed:', err);
        process.exit(1);
    }
}

function scheduleBuild(reason) {
    if (buildTimer) {
        clearTimeout(buildTimer);
    }
    buildTimer = setTimeout(() => {
        buildTimer = null;
        console.log(`\nChange detected (${reason}), rebuilding...`);
        build();
    }, 100);
}

function watch() {
    console.log(`Watching ${srcDir} for changes...`);
    console.log(`Output: ${destDir}\n`);

    build().then(() => {
        nativeFs.watch(srcDir, { recursive: true }, (eventType, filename) => {
            if (!filename) {
                return;
            }
            scheduleBuild(`${eventType}: ${filename}`);
        });
    });
}

if (arg === 'watch') {
    watch();
} else {
    build();
}
