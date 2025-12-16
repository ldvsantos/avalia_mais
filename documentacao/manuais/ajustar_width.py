import re
from pathlib import Path

def corrigir_width(conteudo):
    # Adicionar width=60% nas imagens que não têm
    conteudo = re.sub(r'!\[\]\(([^)]+)\)(?!\{)', r'![](\1){width=60%}', conteudo)
    
    # Corrigir width que estão com sintaxe diferente (tipo pandoc figure)
    conteudo = re.sub(r'\{#fig:\d+\s+width="\d+%"\}', '{width=60%}', conteudo)
    
    return conteudo

# Processar todos os manuais
manuais = [
    'MANUAL_CANDIDATO.md',
    'MANUAL_AVALIADOR.md',
    'MANUAL_ADMIN_E_PRESIDENTE.md',
    'MANUAL_DO_USUARIO.md'
]

for manual in manuais:
    arquivo = Path(manual)
    if arquivo.exists():
        print(f'Processando {manual}...')
        conteudo = arquivo.read_text(encoding='utf-8')
        novo_conteudo = corrigir_width(conteudo)
        arquivo.write_text(novo_conteudo, encoding='utf-8')
        print(f'  ✓ {manual} corrigido')
    else:
        print(f'  ✗ {manual} não encontrado')

print('\nConcluído!')
