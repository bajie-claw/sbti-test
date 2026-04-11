const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Strategy: parse each TYPE_LIBRARY entry and rebuild with proper escaping
// The problem: desc field uses "..." but content has unescaped " inside
// Solution: extract each entry, find the desc value, and properly escape

// Find TYPE_LIBRARY block
const typeLibMatch = html.match(/const TYPE_LIBRARY = \{[\s\S]*?\n    \};/);
if (!typeLibMatch) {
    console.error('TYPE_LIBRARY not found');
    process.exit(1);
}

let block = typeLibMatch[0];

// Extract all entries using regex
// Each entry is like: "CODE": { ... }
const entryRegex = /"([A-Z][A-Z0-9_-]*)":\s*\{([^}]+)\}/g;
let newBlock = block;
let match;

// Process each entry
while ((match = entryRegex.exec(block)) !== null) {
    const code = match[1];
    const props = match[2];
    
    // Find the desc property
    const descMatch = props.match(/desc:\s*"([^"]*)"/);
    if (!descMatch) continue;
    
    const originalDesc = descMatch[0]; // e.g., desc: "content"
    const content = descMatch[1]; // the string content
    
    // Check if content has unescaped quotes (ASCII " inside)
    if (content.includes('"')) {
        // Need to escape - but since we're changing to template literal,
        // we just need to escape any backticks in the content
        let newContent = content;
        if (content.includes('`')) {
            newContent = content.replace(/`/g, '\\`');
        }
        
        const newDesc = 'desc: `' + newContent + '`';
        newBlock = newBlock.replace(originalDesc, newDesc);
    }
}

// Actually, let me use a simpler approach:
// For ALL desc fields, convert to template literal
// desc: "content" -> desc: `content`
// But escape any ` in content with \`

// First, let's just find all desc: "..." patterns in the block
const descRegex = /desc:\s*"((?:[^"\\]|\\.)*)"/g;
let count = 0;
newBlock = block.replace(descRegex, (full, content) => {
    count++;
    // content is already properly escaped if it has \"
    // But we need to convert to template literal
    // Escape any backticks
    let safeContent = content;
    if (content.includes('`')) {
        safeContent = content.replace(/`/g, '\\`');
    }
    return 'desc: `' + safeContent + '`';
});

console.log(`Fixed ${count} desc fields`);

// Now rebuild the HTML
const newHtml = html.replace(block, newBlock);

fs.writeFileSync('index.html', newHtml, 'utf8');
console.log('Written!');

// Verify
const verify = fs.readFileSync('index.html', 'utf8');
const ctrlMatch = verify.match(/"CTRL":\s*\{[^}]+\}/);
if (ctrlMatch) {
    const desc = ctrlMatch[0].match(/desc:\s*`[^`]*`/);
    console.log('CTRL desc (80 chars):', desc ? desc[0].slice(0, 80) : 'NOT FOUND');
}
