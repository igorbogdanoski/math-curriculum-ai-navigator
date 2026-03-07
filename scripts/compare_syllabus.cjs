const fs = require('fs');

function extractTsStrings(gradeFile) {
    const code = fs.readFileSync(gradeFile, 'utf8');
    const allStrings = [...code.matchAll(/['"`](.*?)['"`]/g)].map(m => m[1]);
    return allStrings;
}

function normalize(str) {
    return str.toLowerCase().replace(/[^а-ш]/g, '').substring(0, 15);
}

function checkJson(jsonFile, tsFile) {
    const raw = fs.readFileSync(jsonFile, 'utf8').replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');
    const data = JSON.parse(raw);
    const tsStrings = extractTsStrings(tsFile);
    const normalizedTsStrings = tsStrings.map(normalize);
    
    let missingCount = 0;
    const missingItems = [];
    
    const checkArray = (arr, type) => {
        arr.forEach(item => {
            const norm = normalize(item);
            if (norm.length < 5) return;
            const found = normalizedTsStrings.some(ts => ts.includes(norm));
            if (!found) missingItems.push(`  - ${type}: ${item.substring(0, 60)}...`);
        });
    };
    
    if (data.тематски_целини) {
        data.тематски_целини.forEach(t => {
            if (t.резултати_од_учење) checkArray(t.резултати_од_учење, 'Outcome');
            if (t.стандарди_за_оценување) {
                Object.values(t.стандарди_за_оценување).forEach(arr => checkArray(arr, 'Standard'));
            }
            if (t.активности) checkArray(t.активности, 'Activity');
        });
    }
    
    console.log(`\nComparison for ${jsonFile} -> ${tsFile}:`);
    if (missingItems.length > 0) {
        console.log(`Found ${missingItems.length} items present in JSON but missing/different in TS:`);
        console.log(missingItems.slice(0, 10).join('\n'));
        if (missingItems.length > 10) console.log(`  ... and ${missingItems.length - 10} more.`);
    } else {
        console.log(`Perfect match! All items in JSON seem to exist in the TS file.`);
    }
}

try { checkJson('6to.json', 'data/grade6.ts'); } catch (e) { console.error('Error in 6', e.message); }
try { checkJson('7mo.json', 'data/grade7.ts'); } catch (e) { console.error('Error in 7', e.message); }
try { checkJson('8mo.json', 'data/grade8.ts'); } catch (e) { console.error('Error in 8', e.message); }
try { checkJson('9to.json', 'data/grade9.ts'); } catch (e) { console.error('Error in 9', e.message); }
