const fs = require('fs');
let viewCode = fs.readFileSync('views/StudentProgressView.tsx', 'utf8');

viewCode = viewCode.replace(
  /export const StudentProgressView: React\.FC<Props> = \(\{ name: nameProp \}\) => \{/,
  `export const StudentProgressView: React.FC<Props> = ({ name: nameProp }) => {\n  const { t } = useLanguage();`
);

fs.writeFileSync('views/StudentProgressView.tsx', viewCode);
console.log('Fixed export call');
