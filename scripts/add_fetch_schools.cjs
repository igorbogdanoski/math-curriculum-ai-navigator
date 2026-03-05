const fs = require('fs');
let code = fs.readFileSync('services/firestoreService.ts', 'utf8');

const fetchSchoolsImpl = `
  fetchSchools: async (): Promise<any[]> => {
    try {
      const q = query(collection(db, 'schools'), orderBy('name'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching schools:', error);
      return [];
    }
  },`;

if (!code.includes('fetchSchools:')) {
  code = code.replace('export const firestoreService = {', 'export const firestoreService = {\n' + fetchSchoolsImpl);
  fs.writeFileSync('services/firestoreService.ts', code);
  console.log('Added fetchSchools');
} else {
  console.log('Already exists');
}
