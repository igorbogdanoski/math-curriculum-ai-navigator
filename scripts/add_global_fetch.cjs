const fs = require('fs');
let code = fs.readFileSync('services/firestoreService.ts', 'utf8');

const globalFetch = `  fetchGlobalLibraryMaterials: async (): Promise<CachedMaterial[]> => {
    try {
      const q = query(
        collection(db, 'cached_ai_materials'), 
        where('isApproved', '==', true), 
        where('status', '==', 'published'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CachedMaterial));
    } catch (error) {
      console.error('Error fetching global library materials:', error);
      return [];
    }
  },

`;

code = code.replace(/publishMaterial: async \(id: string\): Promise<void> => \{/, globalFetch + '  publishMaterial: async (id: string): Promise<void> => {');
fs.writeFileSync('services/firestoreService.ts', code);
