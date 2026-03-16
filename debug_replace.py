import sys
path = r'c:\Users\pc4all\Downloads\math-curriculum-ai-navigator\views\StudentPlayView.tsx'
content = open(path, encoding='utf-8').read()
old = """    // 1. Save quiz result
    let savedDocId = '';
    try {
      savedDocId = await firestoreService.saveQuizResult({"""
new = """    // 1. Save quiz result
    let savedDocId = '';
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MODE__;
    if (isE2E) {
      console.log("[E2E DEBUG] Bypassing Firestore saveQuizResult");
      savedDocId = "mock-doc-id";
    } else {
      try {
        savedDocId = await firestoreService.saveQuizResult({"""

# Also need to close the else block later.
# Find where the try-catch for saveQuizResult ends
end_marker = "      console.error('[Quiz] saveQuizResult failed:', err);\n    }"
if old in content and end_marker in content:
    content = content.replace(old, new)
    content = content.replace(end_marker, end_marker + "\n    }")
    open(path, 'w', encoding='utf-8').write(content)
    print("REPLACED")
else:
    print("NOT FOUND")
