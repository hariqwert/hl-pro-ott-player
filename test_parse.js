const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('server.ts', 'utf8');
const sourceFile = ts.createSourceFile('server.ts', code, ts.ScriptTarget.Latest, true);

function findUnclosed(node) {
    if (node.kind === ts.SyntaxKind.TemplateExpression || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
        // check if string is unclosed somehow
    }
    ts.forEachChild(node, findUnclosed);
}

// I will just parse it and print the exact line and character of the first syntax error.
const diagnostics = sourceFile.parseDiagnostics;
if (diagnostics.length > 0) {
    const error = diagnostics[0];
    const pos = sourceFile.getLineAndCharacterOfPosition(error.start);
    console.log(`Error at line ${pos.line + 1}, character ${pos.character + 1}`);
    const lineText = code.split('\n')[pos.line];
    console.log(`Line text: ${lineText}`);
    console.log(error);
} else {
    console.log('No parse diagnostics found.');
}
