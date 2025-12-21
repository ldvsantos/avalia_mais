#!/bin/bash
set -e

# Diretórios
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SOURCE_DIR="$SCRIPT_DIR/../server/data"
BACKUP_DIR="$SCRIPT_DIR/../backups"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
ZIP_FILE="$BACKUP_DIR/backup-data-$TIMESTAMP.zip"

# Criar diretório de backups se não existir
mkdir -p "$BACKUP_DIR"

echo "Iniciando backup de $SOURCE_DIR para $ZIP_FILE..."

# Compactar pasta data
# Requer zip instalado (sudo apt-get install zip)
zip -r "$ZIP_FILE" "$SOURCE_DIR"

echo "Backup concluído com sucesso: $ZIP_FILE"
