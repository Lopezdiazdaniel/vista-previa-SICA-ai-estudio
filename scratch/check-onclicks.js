const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('public/js').filter(f => f.endsWith('.js'));
const onclicks = new Set();
for (const file of files) {
  const content = fs.readFileSync(path.join('public/js', file), 'utf8');
  const matches = content.matchAll(/onclick=["']([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g);
  for (const m of matches) {
    onclicks.add(m[1] + '.' + m[2]);
  }
}
console.log('Found onclicks:', Array.from(onclicks).sort());
