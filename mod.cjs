const fs = require('fs');
let code = fs.readFileSync('views/TeacherAnalyticsView.tsx', 'utf8');

const target1 = "                      <Download className=\"w-4 h-4\" />\r\n                      {t('analytics.exportCsv')}\r\n                  </button>";

const replace1 = target1 + "\n                  <button\n" +
                 "                      type=\"button\"\n" +
                 "                      onClick={handlePrint}\n" +
                 "                      disabled={results.length === 0}\n" +
                 "                      className=\"flex items-center gap-2 px-4 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-sm font-medium transition active:scale-95 disabled:opacity-40\"\n" +
                 "                  >\n" +
                 "                      <Printer className=\"w-4 h-4\" />\n" +
                 "                      PDF ?-???????\n" +
                 "                  </button>";
                 
code = code.replace(target1, replace1);
code = code.replace(target1.replace("\r\n", "\n").replace("\r\n", "\n"), replace1); // for \n only files

const target2 = "                  </>\r\n              )}\r\n          </div>\r\n      );\r\n  };";
const target2b = "                  </>\n              )}\n          </div>\n      );\n  };";

const replace2 = "                  </>\n              )}\n\n              {/* Hidden printable report */}\n              <div className=\"hidden\">\n                  <PrintableEDnevnikReport ref={printRef} results={results} />\n              </div>\n          </div>\n      );\n  };";

code = code.replace(target2, replace2);
code = code.replace(target2b, replace2);

fs.writeFileSync('views/TeacherAnalyticsView.tsx', code);
console.log('done');
