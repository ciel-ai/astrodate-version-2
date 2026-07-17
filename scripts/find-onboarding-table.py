import os

dir_path = 'supabase/migrations'
for filename in os.listdir(dir_path):
    if filename.endswith('.sql'):
        filepath = os.path.join(dir_path, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'onboarding_responses' in content.lower():
                print(f'{filename}: contains onboarding_responses')
                # Find lines that mention it
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if 'onboarding_responses' in line.lower() or 'create table' in line.lower():
                        if any(term in line.lower() for term in ['create table', 'alter table', 'add column']):
                            print(f'  L{i+1}: {line}')
