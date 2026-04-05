/* eslint-disable */
const fs = require('fs-extra');
const path = require('path');

const viewFiles = [
    path.join(__dirname, 'src/views/index.hbs'),
    path.join(__dirname, 'src/views/invite.hbs'),
    path.join(__dirname, 'src/views/locations.hbs'),
    path.join(__dirname, 'src/views/spaces.hbs'),
    path.join(__dirname, 'src/views/moments.hbs'),
    path.join(__dirname, 'src/views/thoughts.hbs'),
    path.join(__dirname, 'src/views/users.hbs'),
    path.join(__dirname, 'src/views/events.hbs'),
    path.join(__dirname, 'src/views/groups.hbs'),
];

// We need to keep the css/js file paths up to date because we use content hashing in the build compilation
fs.readdir(path.join(__dirname, 'build/static'), (err, files) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    const appCssRegex = /^app\.([\w]+\.)?css$/;
    const vendorCssRegex = /^vendor\.([\w]+\.)?css$/;
    const runtimeJsRegex = /^runtime\.([\w]+\.)?js$/;
    const vendorJsRegex = /^vendor\.([\w]+\.)?js$/;
    const appJsRegex = /^app\.([\w]+\.)?js$/;
    const scrapJsRegex = /^theme-.*\.js(\.gz|\.br|\.map)?$/;

    let appCssFileName = null;
    let vendorCssFileName = null;
    let runtimeJsFileName = null;
    let vendorJsFileName = null;
    let appJsFileName = null;

    files.forEach(file => {
        // Delete the scrap javascript files that were used to bundle theme specific css files
        if (scrapJsRegex.test(file)) {
            console.log('Deleting scrap theme JS:', file);
            fs.unlink(path.join(__dirname, `build/static/${file}`), (unlinkErr) => {
                if (unlinkErr) throw unlinkErr;
            });
        }

        if (appCssRegex.test(file)) {
            appCssFileName = file.toString();
        }

        if (vendorCssRegex.test(file)) {
            vendorCssFileName = file.toString();
        }

        if (runtimeJsRegex.test(file)) {
            runtimeJsFileName = file.toString();
        }

        if (vendorJsRegex.test(file)) {
            vendorJsFileName = file.toString();
        }

        if (appJsRegex.test(file)) {
            appJsFileName = file.toString();
        }
    });

    // Update all view templates in a single pass to avoid race conditions
    viewFiles.forEach(viewFile => {
        fs.readFile(viewFile, 'utf8', function (readErr, data) {
            if (readErr) {
                console.error(readErr);
                process.exit(1);
            }

            let result = data;

            if (appCssFileName) {
                result = result.replace(/app[\w.]*\.css/g, appCssFileName);
            }

            if (vendorCssFileName) {
                result = result.replace(/vendor[\w.]*\.css/g, vendorCssFileName);
            }

            // Replace JS filenames with hashed versions
            // Use src="..." anchoring to avoid matching unrelated filenames
            if (runtimeJsFileName) {
                result = result.replace(/src="\/runtime[\w.]*\.js"/g, `src="/${runtimeJsFileName}"`);
            }

            if (vendorJsFileName) {
                result = result.replace(/src="\/vendor[\w.]*\.js"/g, `src="/${vendorJsFileName}"`);
            }

            if (appJsFileName) {
                result = result.replace(/src="\/app[\w.]*\.js"/g, `src="/${appJsFileName}"`);
            }

            fs.writeFile(viewFile, result, 'utf8', function (writeErr) {
                if (writeErr) {
                    console.error(writeErr);
                    process.exit(1);
                }
                console.log('Success: asset paths updated in', path.basename(viewFile));
            });
        });
    });
});
/* eslint-enable */
