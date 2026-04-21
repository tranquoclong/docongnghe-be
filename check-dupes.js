const fs = require('fs');
const content = fs.readFileSync('test/helpers/test-helpers.ts', 'utf8');

// Extract the permissionsData array section
const startIdx = content.indexOf('const permissionsData = [');
const endIdx = content.indexOf(']', content.indexOf("module: 'CONVERSATION'", content.lastIndexOf("name: 'message.search'")));
const section = content.substring(startIdx, endIdx + 1);

// Extract all path+method pairs using regex
const regex = /path:\s*'([^']+)'.*?method:\s*'([^']+)'/gs;
let match;
const pairs = [];
let lineNum = 0;
while ((match = regex.exec(section)) !== null) {
  pairs.push({ path: match[1], method: match[2], idx: pairs.length });
}

// Find duplicates
const seen = new Map();
for (const p of pairs) {
  const key = `${p.method} ${p.path}`;
  if (!seen.has(key)) {
    seen.set(key, []);
  }
  seen.get(key).push(p.idx);
}

console.log('Total permission entries:', pairs.length);
console.log('Unique path+method combos:', seen.size);
console.log('\nDuplicates:');
let dupeCount = 0;
for (const [key, indices] of seen) {
  if (indices.length > 1) {
    dupeCount += indices.length - 1;
    console.log(`  ${key} (appears ${indices.length} times, indices: ${indices.join(', ')})`);
  }
}
console.log(`\nTotal duplicate entries: ${dupeCount}`);
console.log(`Expected to create: ${pairs.length - dupeCount}`);

