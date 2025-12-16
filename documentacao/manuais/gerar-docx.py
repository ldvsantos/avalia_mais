#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para gerar arquivos Word dos manuais do Sistema PLANTERR a partir do Markdown.

Uso: python gerar-docx.py

Gera arquivos DOCX dos manuais (Candidato, Avaliador, Admin e Presidente).
"""

import os
import subprocess
import sys
from pathlib import Path
import time

def gerar_docx(md_file, output_file, reference_doc=None):
    """
    Gera arquivo DOCX usando Pandoc.
    
    Args:
        md_file: Arquivo Markdown de entrada
        output_file: Arquivo DOCX de saída
        reference_doc: Arquivo de referência de formatação (opcional)
    
    Returns:
        0 se sucesso, 1 se erro
    """
    print(f"\nGerando {output_file.name}...")
    
    # Remover arquivo antigo se existir
    if output_file.exists():
        print(f"[INFO] Removendo arquivo antigo: {output_file.name}")
        max_attempts = 5
        for attempt in range(max_attempts):
            try:
                output_file.unlink()
                break
            except PermissionError:
                if attempt < max_attempts - 1:
                    print(f"[AVISO] Tentativa {attempt + 1}/{max_attempts}: Arquivo em uso, aguardando...")
                    time.sleep(0.6)
                else:
                    alt_output_file = output_file.with_name(output_file.stem + "_NOVO" + output_file.suffix)
                    print(f"[AVISO] Não foi possível remover '{output_file.name}' (arquivo em uso).")
                    print("[AVISO] Certifique-se de que o arquivo não está aberto no Word/OneDrive se quiser sobrescrever.")
                    print(f"[INFO] Gerando com nome alternativo: {alt_output_file.name}")
                    output_file = alt_output_file
    
    # Comando Pandoc
    cmd = [
        "pandoc",
        str(md_file),
    ]
    
    # Adicionar resource-path para encontrar figuras
    cmd.extend([
        "--resource-path", ".:../../prints/manual:../../img",
    ])
    
    # Adicionar modelo de formatação se fornecido
    if reference_doc and Path(reference_doc).exists():
        cmd.extend(["--reference-doc", str(reference_doc)])
    
    cmd.extend(["-o", str(output_file)])
    
    print("Executando Pandoc...")
    
    try:
        # Executar Pandoc
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        # Mostrar warnings/erros do Pandoc
        if result.stderr:
            print(f"\nAvisos do Pandoc para {output_file.name}:")
            print(result.stderr)
        
        # Verificar código de saída do Pandoc
        if result.returncode != 0:
            print(f"\nErro: Pandoc retornou código {result.returncode} ao gerar {output_file.name}.")
            if result.stdout:
                print("Saída:", result.stdout)
            return 1
        
        # Verificar se o arquivo foi criado
        if output_file.exists():
            print(f"\nArquivo {output_file.name} gerado com sucesso.")
            print(f"Localização: {output_file.absolute()}")
            print(f"Tamanho: {output_file.stat().st_size / 1024:.1f} KB")
            return 0
        else:
            print(f"\nErro: o arquivo {output_file.name} não foi gerado.")
            if result.stdout:
                print("Saída:", result.stdout)
            return 1
            
    except FileNotFoundError:
        print("\nErro: Pandoc não está instalado ou não está no PATH do sistema.")
        print("Instale o Pandoc em: https://pandoc.org/installing.html")
        return 1
    except Exception as e:
        print(f"\nErro inesperado: {e}")
        return 1

def main():
    # Diretório do script (documentacao/manuais)
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("=" * 70)
    print("GERADOR DE MANUAIS - SISTEMA PLANTERR")
    print("=" * 70)
    print(f"[INFO] Diretório de trabalho: {script_dir}\n")
    
    # Modelo de formatação (opcional)
    modelo = Path("modelo_formatacao.docx")
    reference_doc = modelo if modelo.exists() else None
    
    if reference_doc:
        print(f"[INFO] Usando modelo de formatação: {modelo.name}\n")
    else:
        print("[INFO] Nenhum modelo de formatação encontrado (será usado padrão do Pandoc)\n")
    
    # Manuais a serem gerados
    manuais = [
        ("MANUAL_CANDIDATO.md", "MANUAL_CANDIDATO.docx"),
        ("MANUAL_AVALIADOR.md", "MANUAL_AVALIADOR.docx"),
        ("MANUAL_ADMIN_E_PRESIDENTE.md", "MANUAL_ADMIN_E_PRESIDENTE.docx"),
        ("MANUAL_DO_USUARIO.md", "MANUAL_DO_USUARIO.docx"),
    ]
    
    # Contador de sucesso
    sucessos = 0
    total = 0
    
    # ========================================================================
    # GERAR MANUAIS
    # ========================================================================
    for md_file, docx_file in manuais:
        md_path = Path(md_file)
        docx_path = Path(docx_file)
        
        if not md_path.exists():
            print(f"[AVISO] Arquivo {md_file} não encontrado! Pulando...\n")
            continue
        
        total += 1
        result = gerar_docx(md_path, docx_path, reference_doc)
        if result == 0:
            sucessos += 1
    
    # ========================================================================
    # RESUMO FINAL
    # ========================================================================
    print("\n" + "=" * 70)
    print("📊 RESUMO DA GERAÇÃO")
    print("=" * 70)
    print(f"[OK] Arquivos gerados com sucesso: {sucessos}/{total}")
    
    if sucessos == total:
        print("\nTodos os arquivos foram gerados com sucesso.")
        return 0
    elif sucessos > 0:
        print(f"\nAlguns arquivos não foram gerados ({total - sucessos} falharam).")
        return 1
    else:
        print("\nNenhum arquivo foi gerado.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
