/* eslint-env node */
/* global process, console */

console.error(
    'Deprecated: VS Code test coverage is now produced directly by `vscode-test --coverage`.' +
        ' Use `npm run test:unit:coverage` or `npm run test:integration:coverage` instead.',
);
process.exit(1);
