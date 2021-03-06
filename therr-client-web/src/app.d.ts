// Allows importing json files without type declaration file
declare module '*.json'

// Allows importing js files without type declaration file
declare module '*.js'

// Allows importing svg files without type declaration file
declare module '*.svg' {
    const content: any;
    export default content;
}

// Honeycomb Beeline
declare module 'honeycomb-beeline';
