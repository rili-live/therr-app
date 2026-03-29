// Ignore CSS imports during server-side builds
module.exports = function noopCssLoader() {
    return '';
};
