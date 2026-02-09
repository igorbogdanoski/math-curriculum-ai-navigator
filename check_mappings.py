
import json
import re
import os

def extract_ids_from_ts(file_path, pattern):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return re.findall(pattern, content)

def check_mappings():
    standards_path = r'c:\Users\pc4all\Downloads\math-curriculum-ai-navigator\data\national-standards.ts'
    
    # Extract Standard IDs and their related concepts
    with open(standards_path, 'r', encoding='utf-8') as f:
        standards_content = f.read()
    
    # Very basic parser for the TS structure
    standards = []
    current_std = {}
    for line in standards_content.split('\n'):
        if '"id":' in line:
            current_std['id'] = re.search(r'"id":\s*"([^"]+)"', line).group(1)
        if '"relatedConceptIds":' in line:
            match = re.search(r'"relatedConceptIds":\s*\[([^\]]*)\]', line)
            if match:
                ids_str = match.group(1)
                current_std['relatedConceptIds'] = [id.strip().strip('"') for id in ids_str.split(',') if id.strip()]
        if '},' in line or ']' in line:
            if 'id' in current_std:
                standards.append(current_std)
                current_std = {}

    grades = [6, 7, 8, 9]
    all_missing_standards = {}

    for grade in grades:
        grade_path = f'c:\\Users\\pc4all\\Downloads\\math-curriculum-ai-navigator\\data\\grade{grade}.ts'
        if not os.path.exists(grade_path):
            continue
            
        with open(grade_path, 'r', encoding='utf-8') as f:
            grade_content = f.read()
            
        # Find all concepts in the grade file
        concept_matches = re.finditer(r'"id":\s*"([^"]+)"[^}]+?"nationalStandardIds":\s*\[([^\]]*)\]', grade_content, re.DOTALL)
        concepts = {}
        for match in concept_matches:
            c_id = match.group(1)
            s_ids_str = match.group(2)
            s_ids = [id.strip().strip('"') for id in s_ids_str.split(',') if id.strip()]
            concepts[c_id] = s_ids
            
        missing_in_grade = []
        
        # Check standards for this grade
        for std in standards:
            # Simple heuristic for grade level from ID
            if f'M-{grade}-' in std['id']:
                # If standard has related concepts, check if those concepts have the standard ID
                if 'relatedConceptIds' in std:
                    for c_id in std['relatedConceptIds']:
                        if c_id in concepts and std['id'] not in concepts[c_id]:
                            missing_in_grade.append(f"Concept {c_id} missing standard {std['id']}")
                            
        # Check concepts for this grade
        for c_id, s_ids in concepts.items():
            if not s_ids:
                missing_in_grade.append(f"Concept {c_id} has NO standards mapped.")

        all_missing_standards[grade] = missing_in_grade

    for grade, missing in all_missing_standards.items():
        print(f"\n--- Grade {grade} ---")
        if not missing:
            print("No missing mappings found.")
        else:
            for m in missing[:15]: # Limit output
                print(m)
            if len(missing) > 15:
                print(f"... and {len(missing)-15} more.")

if __name__ == "__main__":
    check_mappings()
