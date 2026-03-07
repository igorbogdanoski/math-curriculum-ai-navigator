const fs = require('fs');
const content = fs.readFileSync('check_activities.py', 'utf8');
const match = content.match(/"""([\s\S]*?)"""/);
if (match) {
  fs.writeFileSync('grade9_activities.json', match[1].trim());
  console.log('Extracted!');
} else {
  console.log('Failed!');
}
