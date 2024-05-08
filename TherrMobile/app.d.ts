// Allows importing json files without type declaration file
declare module '*.json';
declare module '*.webp';

// Allows importing js files without type declaration file
declare module '*.js';

// Allows importing svg files without type declaration file
declare module '*.svg' {
    const content: any;
    export default content;
}

// TODO
/// <reference path="../node_modules/@types/react-redux" />
declare module 'shared/react-redux';

// Honeycomb Beeline
declare module 'honeycomb-beeline';
