with open('errors.txt', 'r', encoding='utf-16') as f:
    for line in f:
        if 'error TS' in line and 'node_modules' not in line:
            print(line.strip())
