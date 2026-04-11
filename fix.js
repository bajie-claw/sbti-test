const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Extract the TYPE_LIBRARY section
const match = html.match(/const TYPE_LIBRARY = \{[\s\S]*?\n    \};/);
if (!match) {
    console.error('TYPE_LIBRARY not found');
    process.exit(1);
}

const originalBlock = match[0];
console.log('Found TYPE_LIBRARY block, length:', originalBlock.length);

// The original block has desc: "..." with inner " that break JS parsing
// Solution: extract the TYPE_LIBRARY, parse it by replacing Chinese quotes with regular quotes,
// then write it back using JSON.stringify (which will properly escape everything)

const block = originalBlock;

// Replace the TYPE_LIBRARY block with a properly formatted one
// Strategy: change all desc: " to desc: ` and closing " to `
// But the inner " are the problem - they're ASCII " used as Chinese quotes

// Better approach: convert the whole thing to use template literals
// We need to escape backticks inside content too

// Actually, the simplest fix: just escape all " in the desc content
// Let's extract each entry and rebuild

// Find the block between { and };
const inner = block.match(/const TYPE_LIBRARY = \{([\s\S]*?)\n    \};/)[1];

// Split by entries (each entry starts with "CODE":
const entryRegex = /"([A-Z][A-Z0-9-]*|[A-Z]{2,}?)":\s*\{[^}]*\}/g;
const entries = [];
let m;
while ((m = entryRegex.exec(inner)) !== null) {
    entries.push(m[0]);
}
console.log('Found', entries.length, 'entries');

// For each entry, we need to find the desc field and escape its inner quotes
// Actually a simpler approach: replace all " that are NOT preceded by : or , or { or } or space
// with \"

// Let me try a different strategy: use the fact that inner quotes are surrounded by Chinese chars
// Replace pattern: Chinese-char + " + Chinese-char with Chinese-char + \" + Chinese-char

let fixedBlock = originalBlock;

// Find all desc: "..." patterns and fix inner quotes
// The desc field content contains " used as Chinese quotes
// Replace \" in HTML entity form back to actual escaped quotes
// But HTML entities don't work in script tags!

// New plan: just replace all Chinese-style " (U+201C U+201D) occurrences that are INSIDE strings
// These appear as plain " in the source but they're Chinese typographic quotes
// Problem: they LOOK like ASCII " so we can't distinguish them

// ACTUAL fix: the inner " chars need to be escaped as \"
// But we can't tell which " are inner vs delimiters

// SIMPLEST FIX EVER: change the desc: " delimiter to use ' (single quote)
// Since inner content has " not ', this should work!
fixedBlock = fixedBlock.replace(/desc: "/g, "desc: '");
fixedBlock = fixedBlock.replace(/" },/g, "' },");
fixedBlock = fixedBlock.replace(/" \}/g, "' }");

// But some desc content might have ' - let me check
// Actually, single quotes are used in Chinese too

// ALTERNATIVE: use template literal (backtick) for desc
// The inner ` chars are rare - let me check

console.log('Checking for backticks in desc content...');
const backtickInDesc = fixedBlock.match(/desc: "[^"]*`[^"]*"/);
console.log('Backticks in desc:', backtickInDesc ? 'YES (problem)' : 'NO (good)');

// Check for single quotes
const singleQuoteInDesc = fixedBlock.match(/desc: "[^"]*'[^"]*"/);
console.log('Single quotes in desc:', singleQuoteInDesc ? 'YES (problem)' : 'NO (good)');

// Let's just use template literals and escape any inner backticks
fixedBlock = fixedBlock.replace(/desc: "/g, 'desc: `');
fixedBlock = fixedBlock.replace(/" },/g, '` },');
fixedBlock = fixedBlock.replace(/" \}/g, '` }');

// Escape inner backticks
fixedBlock = fixedBlock.replace(/`([^`]+)`/g, (match, inner) => {
    if (inner.includes('\\"')) {
        // This is a converted string, escape backticks in content
        return '`' + inner.replace(/`/g, '\\`') + '`';
    }
    return match;
});

// Actually the issue is that inner " are now inside `...` strings which is fine!

const newHtml = html.replace(originalBlock, fixedBlock);

// Write
fs.writeFileSync('index.html', newHtml, 'utf8');

// Verify
const newContent = fs.readFileSync('index.html', 'utf8');
const ctrlMatch = newContent.match(/"CTRL":\s*\{[^}]*\}/);
if (ctrlMatch) {
    const desc = ctrlMatch[0].match(/desc: `[^`]*`/);
    console.log('CTRL desc (first 80):', desc ? desc[0].substring(0, 80) : 'NOT FOUND');
}

console.log('Done!');
