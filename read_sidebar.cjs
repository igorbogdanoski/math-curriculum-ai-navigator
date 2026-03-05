const fs=require('fs');
const lines=fs.readFileSync('components/Sidebar.tsx', 'utf8').split('\n');
for(let i=160;i<180;i++) {
    if(lines[i]) console.log((i+1) + ': ' + lines[i]);
}
