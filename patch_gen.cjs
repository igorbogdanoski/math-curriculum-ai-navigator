const fs = require('fs');
let code = fs.readFileSync('views/MaterialsGeneratorView.tsx', 'utf-8');
code = code.replace(/(<span className="text-gray-500 block leading-tight mt-1">Користи примери од локалната средина \(денари, македонски градови, имиња\)\.<\/span>\n\s*<\/div>\n\s*<\/label>\n\s*<\/div>)/, `$1
                                  <div className="flex items-center mt-3">
                                      <label className="flex items-start cursor-pointer p-4 bg-teal-50 rounded-xl border border-teal-100 hover:bg-teal-100 transition-colors w-full">
                                          <div className="flex items-center h-5 mt-0.5">
                                              <input type="checkbox" checked={state.includeWorkedExamples || false} onChange={(e: any) => dispatch({ type: 'SET_FIELD', payload: { field: 'includeWorkedExamples', value: e.target.checked } })} className="focus:ring-teal-500 h-5 w-5 text-teal-600 border-gray-300 rounded" />
                                          </div>
                                          <div className="ml-3 text-sm">
                                              <span className="font-bold text-gray-800 block">Вклучи решени примери (Worked Examples - П6)</span>
                                              <span className="text-gray-500 block leading-tight mt-1">Првите 1-2 прашања ќе бидат целосно решени за учење преку пример (Scaffolding).</span>
                                          </div>
                                      </label>
                                  </div>`);
fs.writeFileSync('views/MaterialsGeneratorView.tsx', code);
console.log('done');