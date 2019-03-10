/* eslint-disable */
const fs = require('fs');
const path = require('path');

// We need to keep the css file path up to date becuase we use hashing in the build compilation
const replaceInFile = (fileToUpdate, replacementString) => {
    const fileNameToReplaceRegex = new RegExp(/app.*.css/);

    fs.readFile(fileToUpdate, 'utf8', function (err, data) {
        if (err) {
            return console.log(err); // tslint:disable-line
        }

        const result = data.replace(fileNameToReplaceRegex, replacementString);

        fs.writeFile(fileToUpdate, result, 'utf8', function (err) {
            if (err) {
                return console.log(err); // tslint:disable-line
            }
            console.log('Success: String was replaced in file'); // tslint:disable-line
        });
    });
};

// We need to keep the css file path up to date becuase we use hashing in the build compilation
fs.readdir(path.join(__dirname, 'build/static'), (err, files) => {
    const fileNameRegex = new RegExp(/^app.*.css$/);

    files.forEach(file => {
        if (fileNameRegex.test(file)) {
            const cssFileName = file.toString();
            const fileToUpdate = path.join(__dirname, 'src/views/index.hbs');
            replaceInFile(fileToUpdate, cssFileName);
        }
    });
});
/* eslint-enable */
