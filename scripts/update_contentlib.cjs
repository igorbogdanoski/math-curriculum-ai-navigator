const fs = require('fs');
let code = fs.readFileSync('views/ContentLibraryView.tsx', 'utf8');

const anchor = 'const handleUnpublish = async (m: CachedMaterial) => {';
const insertion = `      const handleApproveToggle = async (m: CachedMaterial) => {
          try {
              const newStatus = !m.isApproved;
              await firestoreService.approveMaterial(m.id, newStatus);
              setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, isApproved: newStatus } : x));
              addNotification(newStatus ? 'Материјалот е одобрен и видлив за сите! ✅' : 'Одобрувањето е повлечено.', 'success');
          } catch { addNotification('Грешка при одобрување.', 'error'); }
      };

`;
code = code.replace(anchor, insertion + anchor);

// Add button
const uiAnchor = "{m.status === 'published' ? (";
const uiInsertion = `<button onClick={() => handleApproveToggle(m)} className={\`text-xs flex items-center gap-1 font-medium px-2 py-1 rounded transition-colors \${m.isApproved ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}\`}>
    {m.isApproved ? <><Check size={14}/> Одобрен (Јавен)</> : <><Globe size={14}/> Одобри за сите</>}
</button>
`;

code = code.replace(uiAnchor, uiInsertion + uiAnchor);
fs.writeFileSync('views/ContentLibraryView.tsx', code);
