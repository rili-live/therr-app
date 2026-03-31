import { version as packageVersion } from '../../package.json';

const getRedocHtml = (): string => `<!DOCTYPE html>
<html>
<head>
    <title>Therr API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <redoc spec-url='/v${packageVersion.split('.')[0]}/docs/openapi.json'
           hide-hostname
           expand-responses="200,201"
           theme='{
               "colors": { "primary": { "main": "#1a1a2e" } },
               "typography": { "fontFamily": "system-ui, -apple-system, sans-serif" }
           }'
    ></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;

export default getRedocHtml;
