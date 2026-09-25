const fs = require('fs');
const players = require('../lib/players.json');

const pairs = new Set();
for (const p of players) {
  const parts = p.name.split(' ');
  if (parts.length >= 2) {
    let f = parts[0][0].toUpperCase();
    let l = parts[parts.length - 1][0].toUpperCase();
    
    // Normalize Turkish chars just for letter grouping, or keep them?
    // User said "A ve B". Ş and S are different. Let's keep them as they are, but maybe standardize.
    // Actually standardizing A-Z is safer for a grid.
    const map = { 'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'I': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U' };
    f = map[f] || f;
    l = map[l] || l;
    
    // Sort so A-B and B-A are the same key
    const key = [f, l].sort().join('-');
    pairs.add(key);
  }
}
console.log(`Total unique letter pairs: ${pairs.size}`);
