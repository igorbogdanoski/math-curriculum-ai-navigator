const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<link rel="stylesheet" href="https:\/\/unpkg\.com\/intro\.js\/introjs\.css">/, '');
html = html.replace(/<script src="https:\/\/unpkg\.com\/intro\.js\/intro\.js"><\/script>/, '');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Removed intro.js from index.html');
