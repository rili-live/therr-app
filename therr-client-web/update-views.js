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

// We need to keep the css file path up to date because we use hashing in the build compilation
fs.readdir(path.join(__dirname, 'build/static'), (err, files) => {
    if (err) {
        console.log(err);
        return;
    }

    const appCssRegex = /^app\.([\w]+\.)?css$/;
    const vendorCssRegex = /^vendor\.([\w]+\.)?css$/;
    const scrapJsRegex = /^theme-.*\.js$/;

    let appCssFileName = null;
    let vendorCssFileName = null;

    files.forEach(file => {
        // Delete the scrap javascript files that were used to bundle theme specific css files
        if (scrapJsRegex.test(file)) {
            console.log('FILE', file);
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
    });

    // Update all view templates in a single pass to avoid race conditions
    viewFiles.forEach(viewFile => {
        fs.readFile(viewFile, 'utf8', function (readErr, data) {
            if (readErr) {
                return console.log(readErr);
            }

            let result = data;

            if (appCssFileName) {
                result = result.replace(/app[\w.]*\.css/g, appCssFileName);
            }

            if (vendorCssFileName) {
                result = result.replace(/vendor[\w.]*\.css/g, vendorCssFileName);
            }

            fs.writeFile(viewFile, result, 'utf8', function (writeErr) {
                if (writeErr) {
                    return console.log(writeErr);
                }
                console.log('Success: CSS paths updated in', path.basename(viewFile));
            });
        });
    });
});
/* eslint-enable */
