# Script para substituir certificado por template PNG

$filePath = "c:\Users\vidal\OneDrive\Documentos\13 - CLONEGIT\site_planter_projeto\server\src\infrastructure\services\PdfService.js"

# Ler o arquivo
$content = Get-Content -Path $filePath -Raw -Encoding UTF8

# SUBSTITUIÇÃO 1: Remover toda a seção de marca d'água/logos/título/texto centralizado
# e substituir por template PNG + texto à esquerda

$oldSection1 = @'
      // Marca d'água da logo UEFS (se existir)
      const hasUefs = fs.existsSync(this.uefsLogoPath);
      if (hasUefs) {
                const savedY = doc.y;
        // Marca d'água grande, ATRÁS do texto (desenhada primeiro)
        const watermarkSize = Math.min(width, height) * 0.78;
        const watermarkX = (width - watermarkSize) / 2;

        // Centraliza no miolo do certificado (entre cabeçalho e rodapé),
        // para ficar claramente atrás do texto (e não "abaixo" dele).
        const headerBottomY = 140;
        const footerTopY = height - 150;
        const contentCenterY = (headerBottomY + footerTopY) / 2;
        const watermarkY = contentCenterY - (watermarkSize / 2);
        doc.save();
        doc.opacity(0.10);
        doc.image(this.uefsLogoPath, watermarkX, watermarkY, { 
          width: watermarkSize,
          height: watermarkSize,
          fit: [watermarkSize, watermarkSize],
          align: 'center',
          valign: 'center'
        });
        doc.restore();
        // Reset explícito (garante que nada fique "lavado" ou em estado incorreto)
        doc.opacity(1);
              doc.y = savedY;
      }

      // Logos no topo (versão menor)
      const hasPlanter = fs.existsSync(this.planterLogoPath);
      if (hasUefs) {
        doc.image(this.uefsLogoPath, 50, 40, { width: 80 });
      }
      if (hasPlanter) {
        doc.image(this.planterLogoPath, width - 130, 40, { width: 80 });
      }

      // Espaçamento após logos
      doc.moveDown(4);

      // Título em letras grandes (estilo do exemplo)
      doc.font('Helvetica-Bold').fontSize(30).fillColor('#000000')
        .text('CERTIFICADO', { align: 'center' });

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000')
        .text('DE PARTICIPAÇÃO', { align: 'center' });
      
      doc.moveDown(1.5);

      // Texto principal (centralizado)
      doc.font('Helvetica').fontSize(12).fillColor('#000000');

      // Caixa de texto mais estreita para dar aparência realmente centralizada
      const bodyMargin = 90;
      const startX = bodyMargin;
      const textOptions = { align: 'center', width: width - (bodyMargin * 2) };

      const parts = [];
      parts.push(
        `Certificamos que ${nome ? nome.toUpperCase() : ''}, CPF ${cpf || 'N/A'}, participou da Atividade de Extensão ${(curso || '').toUpperCase()}`
      );
      if (coordinator) parts.push(`coordenada pelo(a) ${String(coordinator).toUpperCase()}`);
      if (department) parts.push(`promovida pelo(a) ${String(department).toUpperCase()}`);
      parts.push(`na função de ${(role || 'PARTICIPANTE').toUpperCase()}`);
      if (cargaHoraria) parts.push(`com ${cargaHoraria} de atividades desenvolvidas`);

      const mainText = parts.join(', ') + `. A atividade foi realizada ${dataEvento ? 'no dia ' + dataEvento : 'conforme programação'}.`;

      doc.text(mainText, startX, doc.y, textOptions);

      doc.moveDown(1.5);

      // A ementa e a tabela de atividades ficam na 2ª página (como anexo),
      // para manter a 1ª página "estilo certificado" limpa.

      // Texto livre adicional
      if (textoLivre) {
        doc.fontSize(11).font('Helvetica').text(textoLivre, startX, doc.y, textOptions);
        doc.moveDown(1.5);
      }

      // Assinaturas
      const assinaturaY = height - 220;
      doc.y = assinaturaY;

      // Assinatura do Coordenador
      if (coordinator) {
        doc.moveTo(startX + 50, assinaturaY)
           .lineTo(startX + 230, assinaturaY)
           .lineWidth(1)
           .strokeColor('#000000')
           .stroke();
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(coordinator.toUpperCase(), startX, assinaturaY + 5, { width: 280, align: 'center' });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text('Coordenador(a)', startX, assinaturaY + 20, { width: 280, align: 'center' });
      }

      // Local e data de emissão
      doc.y = assinaturaY + 50;
      const localEmissao = 'Feira de Santana';
      const dataEmissao = new Date().toLocaleDateString('pt-BR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(`${localEmissao}, ${dataEmissao}`, { align: 'center' });

      doc.moveDown(1.5);

      // Assinatura do Pró-Reitor (se aplicável)
      const proReitor = 'Pró-Reitor(a) de Extensão';
      doc.moveTo(width - 280, doc.y)
         .lineTo(width - 100, doc.y)
         .lineWidth(1)
         .strokeColor('#000000')
         .stroke();
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(proReitor, width - 280, doc.y + 5, { width: 180, align: 'center' });

      // Rodapé: código de verificação e número do documento
      doc.y = height - 120;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text(`Código de verificação: ${verificationCode}`, startX, doc.y, { align: 'left' });
      
      doc.fontSize(9)
         .text(`Número do Documento: ${documentNumber}`, startX, doc.y + 12, { align: 'left' });

      // Instruções de verificação
      doc.fontSize(8)
         .font('Helvetica')
         .text(
           'Para verificar a autenticidade deste documento acesse o sistema de certificados da UEFS,',
           startX, 
           doc.y + 28, 
           { width: width - 100, align: 'left' }
         );
      
      doc.text(
        'informando o número e data de emissão do documento e o código de verificação.',
        startX,
        doc.y + 2,
        { width: width - 100, align: 'left' }
      );
'@

$newSection1 = @'
      // **Página 1: TEMPLATE PNG como fundo + texto simples alinhado à esquerda**
      
      // Desenha o template PNG como fundo (já inclui logo, título CERTIFICADO, decorações)
      const templatePath = path.join(__dirname, '../../../../src/img/marca_certificado.png');
      if (fs.existsSync(templatePath)) {
        doc.image(templatePath, 0, 0, { width: width, height: height });
      }

      // Texto do certificado (alinhado à ESQUERDA para evitar decoração do lado direito)
      const leftMargin = 80;
      const topStart = 280;
      const textWidth = 480; // largura reduzida para não sobrepor a parra/decoração
      
      doc.font('Helvetica').fontSize(12).fillColor('#000000');
      
      // Texto completo em um parágrafo
      const textoCompleto = `Certificamos que ${(nome || '').toUpperCase()}, CPF ${cpf || 'N/A'}, participou da Atividade de Extensão ${(curso || '').toUpperCase()}, na função de ${(role || 'PARTICIPANTE').toUpperCase()}, com ${cargaHoraria || '0'} hora(s) de atividades desenvolvidas. A atividade foi realizada ${dataEvento ? 'no dia ' + dataEvento : 'conforme programação'}.`;
      
      doc.text(textoCompleto, leftMargin, topStart, { 
        align: 'left', 
        width: textWidth,
        lineGap: 4
      });

      // Local e data de emissão
      const localEmissao = 'Feira de Santana';
      const dataEmissao = new Date().toLocaleDateString('pt-BR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      
      doc.moveDown(2);
      doc.fontSize(11).font('Helvetica')
         .text(`${localEmissao}, ${dataEmissao}`, leftMargin, doc.y, { 
           align: 'left',
           width: textWidth
         });

      // Rodapé: código de verificação e número do documento
      const footerY = height - 80;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
         .text(`Código de verificação: ${verificationCode}`, leftMargin, footerY, { align: 'left' });
      
      doc.fontSize(9)
         .text(`Número do Documento: ${documentNumber}`, leftMargin, footerY + 14, { align: 'left' });
'@

# Fazer a substituição
$content = $content.Replace($oldSection1, $newSection1)

# Escrever de volta no arquivo
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)

Write-Host "Arquivo modificado com sucesso: template PNG aplicado!" -ForegroundColor Green
