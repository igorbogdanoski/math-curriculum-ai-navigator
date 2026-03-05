const fs = require('fs');
let code = fs.readFileSync('services/firestoreService.ts', 'utf8');

code = code.replace(/notHelpfulCount\?: number;/g, 'notHelpfulCount?: number;\n  isApproved?: boolean; // Z2 feature');

const targetStr = "  unpublishMaterial: async (id: string): Promise<void> => {\n    await updateDoc(doc(db, 'cached_ai_materials', id), { status: 'draft' });\n  },";

const insertStr = \  unpublishMaterial: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { status: 'draft' });
  },

  approveMaterial: async (id: string, approved: boolean): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { isApproved: approved });
  },\;

if(code.includes(targetStr)) {
    code = code.replace(targetStr, insertStr);
    fs.writeFileSync('services/firestoreService.ts', code);
    console.log("Success add approve");
} else {
    console.log("Failed to find target str");
}
