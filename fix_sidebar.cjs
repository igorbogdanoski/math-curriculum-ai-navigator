const fs=require('fs');
let code = fs.readFileSync('components/Sidebar.tsx', 'utf8');
code = code.replace(/ÐšÐ¾Ñ€Ð¸ÑÐ½Ð¸Ðº/g, 'Корисник');
code = code.replace(/ÐžÐ´Ñ˜Ð°Ð²Ð¸ Ñ\s*Ðµ/g, 'Одјави се');
fs.writeFileSync('components/Sidebar.tsx', code, 'utf8');
console.log('Fixed auth strings');
