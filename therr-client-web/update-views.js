/* eslint-disable */
const fs = require('fs-extra');
const path = require('path');

// We need to keep the css file path up to date becuase we use hashing in the build compilation
const replaceInFile = (fileToUpdate, replacementString) => {
    const fileNameToReplaceRegex = new RegExp(/app.*.css/);

    fs.readFile(fileToUpdate, 'utf8', function (err, data) {
        if (err) {
            return console.log(err); // eslint-disable-line
        }

        const result = data.replace(fileNameToReplaceRegex, replacementString);

        fs.writeFile(fileToUpdate, result, 'utf8', function (err) {
            if (err) {
                return console.log(err); // eslint-disable-line
            }
            console.log('Success: String was replaced in file'); // eslint-disable-line
        });
    });
};

fs.mkdir(path.join(__dirname, 'build/static/assets'), () => {
    fs.copy(path.join(__dirname, 'src/assets'), path.join(__dirname, 'build/static/assets'), (err) => {
        if (err) {
            return console.log('Failed to copy assets directory', err);
        }
    
        console.log('Successfully copied assets directory');
    });
});

// We need to keep the css file path up to date becuase we use hashing in the build compilation
fs.readdir(path.join(__dirname, 'build/static'), (err, files) => {
    const fileNameRegex = new RegExp(/^app.*\.css$/);
    const scrapJsRegex = new RegExp(/^theme-.*\.js$/);

    files.forEach(file => {
        // Delete the scrop javascript files that were used to bundle theme specific css files
        if (scrapJsRegex.test(file)) {
            console.log('FILE', file);
            fs.unlink(path.join(__dirname, `build/static/${file}`), (err) => {
                if (err) throw err;
            });
        }

        // Update view templates with the latest, hashed css file link
        if (fileNameRegex.test(file)) {
            const cssFileName = file.toString();
            const fileToUpdate = path.join(__dirname, 'src/views/index.hbs');
            replaceInFile(fileToUpdate, cssFileName);
        }
    });
});
/* eslint-enable */
