const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const geoip = require('geoip-lite');
const nodeSignPdf = require('node-signpdf');
const { PDFDocument: PDFLibDocument, StandardFonts, rgb } = require('pdf-lib');
const { plainAddPlaceholder } = nodeSignPdf;
const certManager = require('../security/CertManager');

function createNodeSignPdfSigner() {
  const SignPdfCtor = nodeSignPdf.SignPdf || nodeSignPdf.default;
  if (typeof SignPdfCtor === 'function') return new SignPdfCtor();

  // fallback defensivo (caso a lib exporte um objeto pronto)
  if (SignPdfCtor && typeof SignPdfCtor === 'object' && typeof SignPdfCtor.sign === 'function') return SignPdfCtor;
  if (nodeSignPdf && typeof nodeSignPdf.sign === 'function') return { sign: nodeSignPdf.sign };

  throw new Error('node-signpdf: export inválido (não foi possível criar signer)');
}

async function normalizePdfForSigning(pdfBuffer) {
  // Regrava o PDF em formato mais "clássico" para compatibilidade com plainAddPlaceholder.
  // useObjectStreams=false tende a evitar xref stream.
  const pdfDoc = await PDFLibDocument.load(pdfBuffer, { ignoreEncryption: true });
  const bytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

function isXrefParseError(err) {
  const msg = String(err?.message || '');
  return msg.includes('Expected xref') || msg.includes('xref') || msg.includes('readRefTable');
}

class PdfService {
  constructor() {
    // Assets em /src/img (a partir de server/src/infrastructure/services/)
    this.avaliaLogoPath = path.join(__dirname, '../../../../src/img/logo_avalia_horizontal.png');
    this.avaliaLogoSquarePath = path.join(__dirname, '../../../../src/img/logo_avalia_quadrado.png');
    this.planterLogoPath = path.join(__dirname, '../../../../src/img/logo_planter.png');
    this.uefsLogoPath = path.join(__dirname, '../../../../src/img/logo_uefs.png');
  }

  drawAllocationHeader(doc, editalYear) {
    const leftX = 50;
    const topY = 40;
    const rightX = doc.page.width - 50;

    const hasPlanter = false;
    const hasUefs = false;

    if (hasPlanter) {
      doc.image(this.planterLogoPath, leftX, topY, { width: 110 });
    }

    if (hasUefs) {
      const uefsWidth = 105;
      doc.image(this.uefsLogoPath, rightX - uefsWidth, topY, { width: uefsWidth });
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor('black');
    doc.text('INSTITUIÇÃO EXEMPLO', leftX, topY + 5, {
      width: doc.page.width - 100,
      align: 'center',
    });

    doc.font('Helvetica').fontSize(10);
    doc.text('Programa de Pós-Graduação', {
      width: doc.page.width - 100,
      align: 'center',
    });
    doc.text('Mestrado Profissional', {
      width: doc.page.width - 100,
      align: 'center',
    });

    if (editalYear) {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(11).text(`EDITAL DE SELEÇÃO PARA ALUNO/A REGULAR ${editalYear}`, {
        width: doc.page.width - 100,
        align: 'center',
      });
    }

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).text('RESULTADO FINAL', {
      width: doc.page.width - 100,
      align: 'center',
    });

    // posiciona o cursor após o cabeçalho
    doc.y = Math.max(doc.y, 150);
  }

  async stampUploadedPdf(pdfBuffer, stampInfo) {
    // Carimbo VISUAL (para aparecer no navegador). Deve ser aplicado ANTES de assinar.
    const createdAt = stampInfo?.createdAt ? new Date(stampInfo.createdAt) : new Date();
    const createdStr = createdAt.toLocaleString('pt-BR');
    const hash = String(stampInfo?.hash || '').trim();

    const pdfDoc = await PDFLibDocument.load(pdfBuffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let avaliaSquareImage = null;
    try {
      if (fs.existsSync(this.avaliaLogoSquarePath)) {
        const imgBytes = fs.readFileSync(this.avaliaLogoSquarePath);
        // O asset do repo é PNG; se no futuro trocar, apenas ajuste para embedJpg.
        avaliaSquareImage = await pdfDoc.embedPng(imgBytes);
      }
    } catch {
      avaliaSquareImage = null;
    }

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();

      const fontSize = 9;
      const lineGap = 11;
      const marginX = 36;
      const bottomPadding = 14; // sobe um pouco para evitar cortes no rodapé

      const logoSize = 22;
      const logoMargin = 10;

      const y2 = Math.min(Math.max(0, bottomPadding), Math.max(0, height - 1));
      const y1 = Math.min(y2 + lineGap, Math.max(0, height - 1));

      const line1 = 'ASSINADO DIGITALMENTE PELO SISTEMA AVALIA+';
      const line2 = `Data: ${createdStr}${hash ? ` | Hash: ${hash}` : ''}`;

      const hasLogo = Boolean(avaliaSquareImage);
      const textMaxWidth = Math.max(0, width - marginX * 2 - (hasLogo ? (logoSize + logoMargin) : 0));

      // Faixa branca semitransparente para o carimbo ficar legível mesmo em PDFs escuros/escaneados.
      const bandPaddingX = 8;
      const bandPaddingY = 6;
      const bandHeight = Math.max(logoSize, (y1 - y2) + fontSize) + bandPaddingY * 2;
      const bandY = Math.max(0, y2 - bandPaddingY);
      const bandWidth = Math.max(0, width - marginX * 2);

      page.drawRectangle({
        x: marginX - bandPaddingX,
        y: bandY,
        width: bandWidth + bandPaddingX * 2,
        height: bandHeight,
        color: rgb(1, 1, 1),
        opacity: 0.82,
        borderColor: rgb(0.75, 0.75, 0.75),
        borderWidth: 0.5,
      });

      if (hasLogo) {
        page.drawImage(avaliaSquareImage, {
          x: Math.max(marginX, width - marginX - logoSize),
          y: Math.max(0, bandY + (bandHeight - logoSize) / 2),
          width: logoSize,
          height: logoSize,
          opacity: 0.98,
        });
      }

      page.drawText(line1, {
        x: marginX,
        y: y1,
        size: fontSize,
        font,
        color: rgb(0.05, 0.05, 0.05),
        maxWidth: textMaxWidth,
      });

      page.drawText(line2, {
        x: marginX,
        y: y2,
        size: fontSize,
        font,
        color: rgb(0.05, 0.05, 0.05),
        maxWidth: textMaxWidth,
      });
    }

    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }

  drawHeader(doc) {
    const leftX = 50;
    const topY = 45;
    const rightX = doc.page.width - 50;

    const hasPlanter = false;
    const hasAvalia = fs.existsSync(this.avaliaLogoPath);

    if (hasPlanter) {
      doc.image(this.planterLogoPath, leftX, topY, { width: 120 });
    }

    if (hasAvalia) {
      const avaliaWidth = 150;
      doc.image(this.avaliaLogoPath, rightX - avaliaWidth, topY, { width: avaliaWidth });
    }

    if (!hasPlanter && hasAvalia) {
      // fallback compatível com o layout antigo
      doc.image(this.avaliaLogoPath, leftX, topY, { width: 150 });
    }

    if (!hasPlanter && !hasAvalia) {
      doc.fontSize(20).text('Avalia Mais', leftX, topY);
    }

    // posiciona o cursor após o cabeçalho
    doc.y = 140;
  }

  drawAuditFooter(doc, auditInfo) {
    console.log('drawAuditFooter called with:', auditInfo);
    if (!auditInfo) return;

    const { ip, user, hash, createdAt } = auditInfo;
    const geo = ip ? geoip.lookup(ip) : null;
    const location = geo ? `${geo.city || 'Desconhecido'}, ${geo.country || ''}` : 'Localização não identificada';
    const dateStr = createdAt ? new Date(createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    const userName = user ? (user.name || user.username || 'Usuário Sistema') : 'Sistema Automático';

    // Se o conteúdo estiver muito próximo do rodapé, adiciona nova página
    const footerHeight = 80;
    if (doc.y > doc.page.height - footerHeight - 20) {
      doc.addPage();
    }

    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    
    const startY = doc.page.height - footerHeight;
    const startX = 50;
    const width = doc.page.width - 100;

    doc.save();
    doc.fontSize(8).font('Helvetica');
    
    // Linha separadora
    doc.moveTo(startX, startY).lineTo(startX + width, startY).stroke();
    
    doc.text(`Documento assinado digitalmente e auditado pelo sistema Avalia Mais.`, startX, startY + 10, { align: 'center', width: width });
    doc.text(`Gerado por: ${userName} | IP: ${ip || 'N/A'} (${location}) | Data: ${dateStr}`, startX, startY + 22, { align: 'center', width: width });
    if (hash) {
      doc.text(`Código de Verificação (Hash): ${hash}`, startX, startY + 34, { align: 'center', width: width });
    }
    
    doc.restore();
    doc.page.margins.bottom = bottom;
  }

  async signPdf(pdfBuffer, options = {}) {
    const requireSignature = Boolean(options.requireSignature);
    console.log('[PdfService] signPdf started');

    try {
      const p12Buffer = certManager.getCertBuffer();
      console.log('[PdfService] Certificate loaded, size:', p12Buffer.length);
      
      const signer = createNodeSignPdfSigner();

      const trySign = (bufferToSign) => {
        console.log('[PdfService] Attempting to sign...');
        const pdfWithPlaceholder = plainAddPlaceholder({
          pdfBuffer: bufferToSign,
          reason: 'Assinatura Digital Avalia Mais',
          contactInfo: 'sistema@avaliamais.tec.br',
          name: 'Avalia Mais System',
          location: 'Digital',
        });
        console.log('[PdfService] Placeholder added');

        const signed = signer.sign(pdfWithPlaceholder, p12Buffer, { passphrase: 'planterr_secret' });
        console.log('[PdfService] Signed successfully');
        return signed;
      };

      try {
        return trySign(pdfBuffer);
      } catch (err) {
        console.warn('[PdfService] First sign attempt failed:', err.message);
        // PDFs externos (exportados por terceiros) frequentemente vêm com xref stream/linearização.
        // Quando plainAddPlaceholder não consegue ler o xref, tentamos normalizar e assinar de novo.
        if (isXrefParseError(err)) {
          console.log('[PdfService] Normalizing PDF for signing...');
          const normalized = await normalizePdfForSigning(pdfBuffer);
          return trySign(normalized);
        }
        throw err;
      }
    } catch (err) {
      console.error('Error signing PDF:', err);
      if (requireSignature) throw err;
      return pdfBuffer; // best-effort para PDFs gerados internamente
    }
  }

  async generateAllocationReport(data, auditInfo) {
    console.log('[PdfService] generateAllocationReport started');
    const editalYear = data?.editalYear;
    const pdfBuffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            console.log('[PdfService] PDF stream ended');
            resolve(Buffer.concat(buffers));
        });
        doc.on('error', (err) => {
            console.error('[PdfService] PDF stream error:', err);
            reject(err);
        });

        // Header (modelo publicado: UEFS + PLANTERR)
        this.drawAllocationHeader(doc, editalYear);

        const drawConvocadosTable = (title, candidates) => {
          if (!candidates || candidates.length === 0) return;

          doc.fontSize(12).font('Helvetica-Bold').text(title, { underline: true });
          doc.moveDown(0.5);

          const startX = 50;
          // Modelo: NOME + VAGA OCUPADA (sem nota e sem coluna de classificação)
          const colWidths = [260, 235]; // Total 495
          const headers = ['NOME DO/A CANDIDATO/A', 'VAGA OCUPADA'];
          
          let currentY = doc.y;
          
          // Header Row
          doc.fontSize(9).font('Helvetica-Bold');
          doc.rect(startX, currentY, 495, 20).fill('#e0e0e0');
          doc.fillColor('black');
          
          let currentX = startX + 5;
          headers.forEach((h, i) => {
            doc.text(h, currentX, currentY + 5, { width: colWidths[i], align: 'left' });
            currentX += colWidths[i];
          });
          
          currentY += 20;
          doc.font('Helvetica').fontSize(9);

          candidates.forEach((c, i) => {
            // Check page break
            if (currentY > doc.page.height - 100) {
              doc.addPage();
              this.drawAllocationHeader(doc, editalYear);
              currentY = doc.y;
            }

            const rowHeight = 20;
            // Alternating row color
            if (i % 2 === 0) {
              doc.rect(startX, currentY, 495, rowHeight).fill('#f9f9f9');
              doc.fillColor('black');
            }

            currentX = startX + 5;
            const values = [
              String(c.nome || '').substring(0, 60),
              String(c.situacao || '')
            ];

            values.forEach((v, idx) => {
              doc.text(v, currentX, currentY + 5, { width: colWidths[idx], align: 'left' });
              currentX += colWidths[idx];
            });

            currentY += rowHeight;
          });

          doc.moveDown(2);
        };

        const drawListaReservaTable = (title, candidates) => {
          if (!candidates || candidates.length === 0) return;

          doc.fontSize(12).font('Helvetica-Bold').text(title, { underline: true });
          doc.moveDown(0.5);

          const startX = 50;
          const colWidths = [495];
          const headers = ['NOME DO/A CANDIDATO/A'];

          let currentY = doc.y;

          doc.fontSize(9).font('Helvetica-Bold');
          doc.rect(startX, currentY, 495, 20).fill('#e0e0e0');
          doc.fillColor('black');

          doc.text(headers[0], startX + 5, currentY + 5, { width: colWidths[0], align: 'left' });

          currentY += 20;
          doc.font('Helvetica').fontSize(9);

          candidates.forEach((c, i) => {
            if (currentY > doc.page.height - 100) {
              doc.addPage();
              this.drawAllocationHeader(doc, editalYear);
              currentY = doc.y;
            }

            const rowHeight = 20;
            if (i % 2 === 0) {
              doc.rect(startX, currentY, 495, rowHeight).fill('#f9f9f9');
              doc.fillColor('black');
            }

            doc.text(String(c.nome || '').substring(0, 80), startX + 5, currentY + 5, { width: 490, align: 'left' });
            currentY += rowHeight;
          });

          doc.moveDown(2);
        };

        const processLine = (lineName, lineData) => {
          if (!lineData || !lineData.resultado) return;

          if (doc.y > doc.page.height - 150) doc.addPage();

          doc.fontSize(14).font('Helvetica-Bold').fillColor('#2e7d32').text(lineName);
          doc.fillColor('black');
          doc.moveDown(0.5);

          const { resultado, total, allocator } = lineData;
          const { quadro_vagas_calculado, aprovados, lista_espera } = resultado;
          const vagasExtras = allocator.vagasExtras || {};

          // Summary Box
          doc.fontSize(10).font('Helvetica');
          doc.text(`Total de Vagas: ${total}`);
          
          const extrasText = Object.entries(vagasExtras).map(([k, v]) => `${v} (${k.replace('_', ' ')})`).join(', ') || 'Nenhuma';
          doc.text(`Vagas Extras (Institucionais): ${extrasText}`);
          
          doc.moveDown(0.5);
          doc.text('Distribuição Calculada:', { underline: true });
          doc.text(`Ampla: ${quadro_vagas_calculado.AC} | Cotas (Negros): ${quadro_vagas_calculado.Cotas_Negros} | Cotas (Demais): ${quadro_vagas_calculado.Cotas_Demais}`);
          
          const instText = Object.entries(quadro_vagas_calculado.Institucional || {}).map(([k, v]) => `${v} (${k.replace('_', ' ')})`).join(', ') || '0';
          doc.text(`Institucionais: ${instText}`);
          
          doc.moveDown(1);

          drawConvocadosTable('CANDIDATOS/AS APROVADOS/AS – CONVOCADOS/AS', aprovados);
          drawListaReservaTable('CANDIDATOS/AS APROVADOS/AS – EM LISTA DE RESERVA', lista_espera);
        };

        processLine('Linha de Pesquisa 1', data.linha1);
        processLine('Linha de Pesquisa 2', data.linha2);

        // Instruções pós-resultado (conforme modelo publicado 2026)
        if (doc.y > doc.page.height - 220) {
          doc.addPage();
          this.drawAllocationHeader(doc, editalYear);
        }
        doc.font('Helvetica').fontSize(10).fillColor('black');
        doc.moveDown(0.5);
        doc.text('• Os/as candidatos/as convocados/as deverão encaminhar a documentação para a pré-matrícula (conforme item 11 do Edital de seleção) pelo e-mail planterr@uefs.br indicando também o dia/turno de apresentação dos originais dos documentos.', {
          align: 'justify',
        });
        doc.moveDown(0.4);
        doc.text('• A apresentação dos originais deve ser agendada para os seguintes dias/horários: 03 a 05/02/2026, das 09 às 12 horas ou das 14 às 17 horas.', {
          align: 'justify',
        });
        doc.moveDown(0.4);
        doc.text('• Endereço do Colegiado do PLANTERR: Módulo 7 (MA 7 – Módulo Administrativo), em frente ao Departamento de Ciências Humanas e Filosofia.', {
          align: 'justify',
        });

        doc.moveDown(1);
        doc.text(`Feira de Santana, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.`);

        // Signatures
        if (doc.y > doc.page.height - 150) doc.addPage();
        doc.moveDown(4);
        
        const sigY = doc.y;
        const sigWidth = 200;
        const gap = 50;
        const startX = (doc.page.width - (sigWidth * 2 + gap)) / 2;

        doc.moveTo(startX, sigY).lineTo(startX + sigWidth, sigY).stroke();
        doc.text('Presidente da Comissão', startX, sigY + 10, { width: sigWidth, align: 'center' });

        doc.moveTo(startX + sigWidth + gap, sigY).lineTo(startX + sigWidth + gap + sigWidth, sigY).stroke();
        doc.text('Membro da Comissão', startX + sigWidth + gap, sigY + 10, { width: sigWidth, align: 'center' });

        // Footer Audit
        this.drawAuditFooter(doc, auditInfo);

        console.log('[PdfService] Calling doc.end()');
        doc.end();
      } catch (err) {
        console.error('[PdfService] Error inside promise:', err);
        reject(err);
      }
    });

    console.log('[PdfService] PDF generated, signing...');
    return this.signPdf(pdfBuffer);
  }

  async generateSubmissionPdf(submission, auditInfo) {
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const protocol = submission?.protocol || 'N/A';
      const createdAt = submission?.createdAt ? new Date(submission.createdAt) : new Date();
      const hash = submission?.hash || '';
      const identified = submission?.identified || {};
      const project = submission?.project || {};

      // Header
      this.drawHeader(doc);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Comprovante de Inscrição', { align: 'center' });
      doc.moveDown();

      // Protocol Info
      doc.fontSize(12).font('Helvetica').text(`Protocolo: ${protocol}`, { align: 'right' });
      doc.text(
        `Data: ${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR')}`,
        { align: 'right' }
      );
      if (hash) {
        doc.fontSize(10).text(`Hash: ${hash}`, { align: 'right' });
      }
      doc.moveDown(2);

      const writeField = (label, value) => {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value || 'N/A'));
      };

      // Applicant Details
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Candidato');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Nome', identified.nome || identified.nome_social);
      if (identified.nome_social) writeField('Nome social', identified.nome_social);
      writeField('CPF', identified.cpf);
      writeField('RG', identified.rg);
      writeField('Órgão expedidor', identified.orgao_expedidor);
      writeField('Data de expedição', identified.data_expedicao);
      writeField('Data de nascimento', identified.data_nascimento);
      writeField('Email', identified.email);
      writeField('Celular', identified.celular);
      writeField('Telefone residencial', identified.telefone_residencial);
      writeField('Endereço', identified.endereco);
      writeField('Cidade/Estado', identified.cidade_estado);
      writeField('CEP', identified.cep);
      writeField('Curso de graduação', identified.curso_graduacao);
      writeField('Instituição', identified.instituicao);
      writeField('Ano de conclusão', identified.ano_conclusao);
      writeField('Vaga institucional', identified.vaga_institucional);
      writeField('Vaga cooperação', identified.vaga_cooperacao);
      writeField('Vaga reservada', identified.vaga_reservada);
      writeField('Cotas', identified.cotas);
      writeField('Raça/Cor', identified.raca_cor);
      writeField('Língua estrangeira', identified.lingua_estrangeira);
      writeField('Vínculo empregatício', identified.vinculo_empregaticio);
      writeField('Carga horária', identified.carga_horaria);
      writeField('Empresa', identified.empresa_vinculo);
      writeField('Termo de compromisso', identified.termo_compromisso);

      doc.moveDown(1.5);

      // Project Details
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Projeto');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Título (PT)', project.titulo_pt);
      writeField('Título (EN)', project.titulo_en);
      writeField('Área', project.area);
      writeField('Palavras-chave (PT)', project.palavras_pt);
      writeField('Palavras-chave (EN)', project.palavras_en);

      const writeSection = (title, value) => {
        const text = String(value || '').trim();
        if (!text) return;
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
        doc.font('Helvetica').text(text, { align: 'justify' });
      };

      writeSection('Resumo', project.resumo);
      writeSection('Justificativa / Enquadramento', project.justificativa_enquadramento);
      writeSection('Introdução', project.introducao);
      writeSection('Problema de pesquisa', project.problema_pesquisa);
      writeSection('Justificativa / Relevância', project.justificativa_relevancia);
      writeSection('Objetivo geral', project.objetivo_geral);
      writeSection('Objetivos específicos', project.objetivos_especificos);
      writeSection('Objetivos (campo alternativo)', project.objetivos);
      writeSection('Metas', project.metas);
      writeSection('Revisão de literatura', project.revisao_literatura);
      writeSection('Procedimentos metodológicos', project.procedimentos_metodologicos);
      writeSection('Cronograma', project.cronograma);
      writeSection('Referências', project.referencias);

      // Footer Audit
      this.drawAuditFooter(doc, {
        ...auditInfo,
        hash: hash || auditInfo?.hash,
        createdAt: createdAt
      });

      doc.end();
    });

    return this.signPdf(pdfBuffer);
  }

  async generateAppealPdfLegacy(data, protocol) {
    // Assinatura antiga (mantida por compatibilidade)
    return this.generateAppealPdfFromData(data, protocol);
  }

  async generateAppealPdfFromData(data, protocol, auditInfo) {
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const createdAt = data?.createdAt ? new Date(data.createdAt) : new Date();

      // Header
      this.drawHeader(doc);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Comprovante de Recurso', { align: 'center' });
      doc.moveDown();

      // Protocol Info
      doc.fontSize(12).font('Helvetica').text(`Protocolo: ${protocol || 'N/A'}`, { align: 'right' });
      doc.text(
        `Data: ${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR')}`,
        { align: 'right' }
      );
      doc.moveDown(2);

      const writeField = (label, value) => {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value || 'N/A'));
      };

      const writeSection = (title, value) => {
        const text = String(value || '').trim();
        if (!text) return;
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
        doc.font('Helvetica').text(text, { align: 'justify' });
      };

      // Applicant Details
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Candidato');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Nome', data?.nome);
      writeField('CPF', data?.cpf);
      writeField('Email', data?.email);

      doc.moveDown(1.5);

      // Project
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Projeto');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Protocolo de inscrição', data?.protocolo_inscricao);
      writeField('Título do projeto', data?.titulo_projeto);
      writeField('Linha de pesquisa', data?.linha_pesquisa);

      doc.moveDown(1.5);

      // Appeal details
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Recurso');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Etapa do processo', data?.etapa_processo);
      writeSection('Decisão objeto da contestação', data?.decisao_contestacao);
      writeSection('Argumentação', data?.argumentacao);

      // Footer Audit
      this.drawAuditFooter(doc, {
        ...auditInfo,
        createdAt: createdAt
      });

      doc.end();
    });

    return this.signPdf(pdfBuffer);
  }

  async generateAppealPdf(appeal, auditInfo) {
    // Nova assinatura: recebe a entidade persistida do recurso
    const protocol = appeal?.protocol || 'N/A';
    const data = {
      createdAt: appeal?.createdAt,
      protocolo_inscricao: appeal?.submissionProtocol,
      nome: appeal?.nome,
      cpf: appeal?.cpf,
      email: appeal?.email,
      titulo_projeto: appeal?.tituloProjeto,
      linha_pesquisa: appeal?.linhaPesquisa,
      etapa_processo: appeal?.etapa,
      decisao_contestacao: appeal?.decisaoContestacao,
      argumentacao: appeal?.argumentacao,
    };
    return this.generateAppealPdfFromData(data, protocol, auditInfo);
  }

  async generateCertificatePdf(data, auditInfo) {
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const {
        nome,
        cpf,
        curso,
        data: dataEvento,
        cargaHoraria,
        coordinator,
        department,
        speakers,
        role,
        syllabus,
        activities,
      } = data;

      const width = doc.page.width;
      const height = doc.page.height;

      const verificationCode = this.generateVerificationCode();
      const documentNumber = this.generateDocumentNumber();

      // Página 1: template como fundo + texto por cima
      const templatePath = path.join(__dirname, '../../../../src/img/marca_certificado.png');
      if (fs.existsSync(templatePath)) {
        doc.image(templatePath, 0, 0, { width, height });
      }

      // Texto alinhado à esquerda para não invadir a "parra" do lado direito
      const leftMargin = 80;
      const topStart = 280;
      const textWidth = 480;

      const formatWorkload = (value) => {
        if (value === null || value === undefined) return '0 hora(s)';
        if (typeof value === 'number') return `${value} hora(s)`;
        const str = String(value).trim();
        if (!str) return '0 hora(s)';
        // Se já vier com "hora", não adiciona de novo.
        if (/hora/i.test(str)) return str;
        return `${str} hora(s)`;
      };

      const workloadText = formatWorkload(cargaHoraria);

      doc.font('Helvetica').fontSize(13).fillColor('#000000');
      const speakersText = speakers ? `, ministrado por ${String(speakers).toUpperCase()}` : '';
      const textoCompleto = `Certificamos que ${(nome || '').toUpperCase()}, CPF ${cpf || 'N/A'}, participou da Atividade de Extensão ${(curso || '').toUpperCase()}${speakersText}, na função de ${(role || 'PARTICIPANTE').toUpperCase()}, com ${workloadText} de atividades desenvolvidas. A atividade foi realizada ${dataEvento ? 'no dia ' + dataEvento : 'conforme programação'}.`;
      doc.text(textoCompleto, leftMargin, topStart, { align: 'left', width: textWidth, lineGap: 4 });

      const localEmissao = 'Feira de Santana';
      const dataEmissao = new Date().toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      doc.fontSize(11).font('Helvetica').text(`${localEmissao}, ${dataEmissao}`, leftMargin, doc.y + 24, {
        align: 'left',
        width: textWidth,
      });

      const footerY = height - 80;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`Código de verificação: ${verificationCode}`, leftMargin, footerY, { align: 'left', width: textWidth });
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      doc.text(`Número do Documento: ${documentNumber}`, leftMargin, footerY + 14, { align: 'left', width: textWidth });

      // Página 2 (anexo): ementa/atividades, se houver
      const parsedActivities = (() => {
        if (!activities) return null;
        if (Array.isArray(activities)) return activities;
        if (typeof activities === 'string') {
          try {
            const parsed = JSON.parse(activities);
            return Array.isArray(parsed) ? parsed : null;
          } catch {
            return null;
          }
        }
        return null;
      })();

      const hasAnnex = (syllabus && String(syllabus).trim()) || (parsedActivities && parsedActivities.length > 0);
      if (hasAnnex) {
        doc.addPage({ margin: 50, size: 'A4', layout: 'landscape' });

        const w2 = doc.page.width;
        const h2 = doc.page.height;
        const startX2 = 50;
        const textOptions2 = { align: 'justify', width: w2 - 100 };

        doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text('ANEXO - ATIVIDADES E EMENTA', { align: 'center' });
        doc.moveDown(1);

        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text(`Evento: ${(curso || '').toUpperCase()}`, startX2, doc.y, textOptions2);
        doc.text(`Participante: ${(nome || '').toUpperCase()}  |  CPF: ${cpf || 'N/A'}`, startX2, doc.y + 2, textOptions2);
        if (speakers) doc.text(`Palestrante(s)/Ministrante(s): ${String(speakers).toUpperCase()}`, startX2, doc.y + 2, textOptions2);
        if (coordinator) doc.text(`Coordenador(a): ${String(coordinator).toUpperCase()}`, startX2, doc.y + 2, textOptions2);
        if (department) doc.text(`Departamento/Órgão Promotor: ${String(department).toUpperCase()}`, startX2, doc.y + 2, textOptions2);

        doc.moveDown(1);

        if (syllabus && String(syllabus).trim()) {
          doc.fontSize(11).font('Helvetica-Bold').text('Ementa:', startX2, doc.y);
          doc.fontSize(10).font('Helvetica').text(String(syllabus).trim(), startX2, doc.y + 2, textOptions2);
          doc.moveDown(1);
        }

        if (parsedActivities && parsedActivities.length > 0) {
          doc.fontSize(11).font('Helvetica-Bold').text('Atividades:', startX2, doc.y);
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const tableLeft = startX2;
          const totalWidth = w2 - 100;
          const colAtividade = Math.floor(totalWidth * 0.62);
          const colFuncao = Math.floor(totalWidth * 0.24);
          const colCarga = totalWidth - colAtividade - colFuncao;

          doc.rect(tableLeft, tableTop, totalWidth, 20).fillAndStroke('#f0f0f0', '#000000');
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
          doc.text('Atividades', tableLeft + 5, tableTop + 6, { width: colAtividade - 10 });
          doc.text('Função', tableLeft + colAtividade + 5, tableTop + 6, { width: colFuncao - 10 });
          doc.text('Carga', tableLeft + colAtividade + colFuncao + 5, tableTop + 6, { width: colCarga - 10 });

          let currentY = tableTop + 20;
          doc.fontSize(8).font('Helvetica').fillColor('#000000');

          parsedActivities.forEach((activity) => {
            const rowHeight = 18;
            doc.rect(tableLeft, currentY, totalWidth, rowHeight).stroke('#000000');
            doc.text(String(activity?.name || ''), tableLeft + 5, currentY + 5, { width: colAtividade - 10 });
            doc.text(String(activity?.role || ''), tableLeft + colAtividade + 5, currentY + 5, { width: colFuncao - 10 });
            doc.text(String(activity?.workload || '0'), tableLeft + colAtividade + colFuncao + 5, currentY + 5, { width: colCarga - 10 });
            currentY += rowHeight;
          });

          const totalWorkload = parsedActivities.reduce((sum, act) => sum + (parseFloat(act?.workload) || 0), 0);
          doc.rect(tableLeft, currentY, totalWidth, 20).fillAndStroke('#f0f0f0', '#000000');
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
          doc.text('Total', tableLeft + 5, currentY + 6, { width: colAtividade + colFuncao - 10 });
          doc.text(`${totalWorkload} hora(s)`, tableLeft + colAtividade + colFuncao + 5, currentY + 6, { width: colCarga - 10 });

          doc.y = currentY + 30;
        }

        doc.y = h2 - 90;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text(
          `Código de verificação: ${verificationCode}  |  Número do Documento: ${documentNumber}`,
          startX2,
          doc.y,
          { align: 'left' }
        );
      }

      doc.end();
    });

    return this.signPdf(pdfBuffer);
  }

  generateVerificationCode() {
    // Gera código de verificação de 10 caracteres hexadecimais
    const crypto = require('crypto');
    return crypto.randomBytes(5).toString('hex');
  }

  generateDocumentNumber() {
    // Gera número de documento baseado em timestamp
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${timestamp}${random}`.substring(0, 12);
  }

  async generateIntegrityReportPdf(submission, integrity, auditInfo) {
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header (Logos)
      this.drawHeader(doc);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Relatório de Integridade Acadêmica', { align: 'center' });
      doc.moveDown();

      // Metadata
      const protocol = submission?.protocol || 'N/A';
      const title = submission?.project?.titulo_pt || 'N/A';
      const createdAt = new Date();

      doc.fontSize(10).font('Helvetica').text(`Gerado em: ${createdAt.toLocaleString('pt-BR')}`, { align: 'right' });
      doc.moveDown();
      
      doc.fontSize(12).font('Helvetica-Bold').text(`Protocolo: ${protocol}`);
      doc.font('Helvetica').text(`Título: ${title}`);
      doc.moveDown();

      // Scores
      const score = integrity.score != null ? integrity.score + '%' : '—';
      const aiScore = integrity.aiScore != null ? integrity.aiScore + '%' : '—';
      
      doc.fontSize(14).font('Helvetica-Bold').text('1. Resumo da Análise', { underline: true });
      doc.moveDown(0.5);
      
      // Draw Score Box
      const startY = doc.y;
      doc.rect(50, startY, 250, 60).stroke();
      doc.fontSize(12).text('Índice de Plágio', 60, startY + 10);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(integrity.score > 20 ? 'red' : 'green').text(score, 60, startY + 30);
      
      doc.rect(310, startY, 250, 60).stroke();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text('Probabilidade de IA', 320, startY + 10);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(integrity.aiScore > 50 ? 'red' : 'orange').text(aiScore, 320, startY + 30);
      
      doc.fillColor('black').moveDown(4);

      // Interpretation
      const interpretation = integrity.interpretation || {};
      if (interpretation.status_label) {
          doc.fontSize(12).font('Helvetica-Bold').text('Parecer do Sistema:');
          doc.font('Helvetica').text(interpretation.status_label, { continued: true });
          doc.text(' - ' + (interpretation.explanation_text || ''));
          doc.moveDown();
      }

      // Sources Table (CopySpider Style)
      const matches = integrity.matches || [];
      const sources = integrity.sources || [];
      const scannedText = integrity.scannedText || '';
      const totalLength = scannedText.length;
      
      // Aggregate matches by source to calculate percentage of text from that source
      const sourceStats = {};
      sources.forEach(url => { sourceStats[url] = 0; });

      if (totalLength > 0) {
          matches.forEach(m => {
              if (m.source) {
                  if (typeof sourceStats[m.source] === 'undefined') sourceStats[m.source] = 0;
                  sourceStats[m.source] += m.text.length;
              }
          });
          
          // Convert to percentage
          Object.keys(sourceStats).forEach(url => {
              sourceStats[url] = (sourceStats[url] / totalLength) * 100;
          });
      } else {
          // Fallback to max score if no text length
          matches.forEach(m => {
              if (m.source && (!sourceStats[m.source] || m.score > sourceStats[m.source])) {
                  sourceStats[m.source] = m.score;
              }
          });
      }

      if (Object.keys(sourceStats).length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('2. Fontes Identificadas', { underline: true });
          doc.moveDown(0.5);
          
          // Table Header
          const tableTop = doc.y;
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Fonte (URL)', 50, tableTop);
          doc.text('Similaridade', 450, tableTop, { width: 100, align: 'right' });
          doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
          doc.moveDown();

          // Table Rows
          doc.font('Helvetica');
          Object.entries(sourceStats)
              .sort(([,a], [,b]) => b - a) // Sort by score desc
              .forEach(([url, score]) => {
                  // Filter out very small percentages if desired, or show all
                  if (score < 0.1) return; 

                  const y = doc.y;
                  // Check page break
                  if (y > doc.page.height - 100) {
                      doc.addPage();
                      doc.y = 50;
                  }
                  doc.fillColor('blue').text(url, 50, doc.y, { link: url, width: 380, lineBreak: false, ellipsis: true });
                  doc.fillColor(score > 3 ? 'red' : 'black').text(`${score.toFixed(2)}%`, 450, doc.y, { width: 100, align: 'right' });
                  doc.moveDown(0.5);
              });
          doc.fillColor('black').moveDown();
      }

      // Detailed Matches (CopySpider Style)
      if (matches.length > 0) {
          doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').text('3. Detalhamento dos Trechos (Evidências)', { underline: true });
          doc.moveDown();
          
          matches.forEach((match, index) => {
              // Avoid page break inside a block if possible
              if (doc.y > doc.page.height - 150) doc.addPage();

              doc.fontSize(11).font('Helvetica-Bold').fillColor('black').text(`Coincidência #${index + 1}`);
              doc.fontSize(10).font('Helvetica').text(`Fonte: ${match.source}`, { link: match.source });
              doc.text(`Similaridade do Trecho: ${match.score}%`);
              doc.moveDown(0.5);
              
              // Box with text
              doc.font('Helvetica-Oblique').fillColor('#8B0000'); // Dark Red
              doc.text(`"${match.text}"`, { indent: 20 });
              doc.fillColor('black');
              doc.moveDown();
              doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke().strokeColor('black'); // Separator
              doc.moveDown();
          });
      }

      // Reference Analysis (Hallucination Check)
      const refAnalysis = integrity.referenceAnalysis;
      if (refAnalysis && Array.isArray(refAnalysis) && refAnalysis.length > 0) {
          doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').text('4. Verificação de Referências (Alucinações)', { underline: true });
          doc.fontSize(10).font('Helvetica-Oblique').text('(Análise automática de existência das referências citadas)', { color: 'gray' });
          doc.moveDown();

          refAnalysis.forEach((item) => {
              if (doc.y > doc.page.height - 100) doc.addPage();

              let color = 'black';
              let icon = '[?]';
              if (item.status === 'Real') { color = 'green'; icon = '[OK]'; }
              if (item.status === 'Suspeita') { color = 'orange'; icon = '[!]'; }
              if (item.status === 'Alucinação') { color = 'red'; icon = '[X]'; }

              doc.fontSize(11).font('Helvetica-Bold').fillColor(color).text(`${icon} ${item.status}`, { continued: true });
              doc.font('Helvetica').fillColor('black').text(`: ${item.reason || ''}`);
              
              doc.fontSize(10).font('Helvetica-Oblique').text(item.ref, { indent: 15 });
              doc.moveDown(0.5);
          });
          doc.moveDown();
      }

      // Full Text Analysis
      if (scannedText) {
          doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').text(refAnalysis ? '5. Texto Completo Analisado' : '4. Texto Completo Analisado', { underline: true });
          doc.fontSize(10).font('Helvetica-Oblique').text('(Os trechos acima foram localizados dentro deste conteúdo)', { color: 'gray' });
          doc.moveDown();
          doc.fontSize(10).font('Helvetica').fillColor('black').text(scannedText, {
              align: 'justify',
              lineGap: 2
          });
          doc.moveDown();
      }

      // Tips
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text(refAnalysis ? '6. Dicas de Verificação (Vícios de IA)' : '5. Dicas de Verificação (Vícios de IA)', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.list([
          'Estrutura Padronizada: Uso excessivo de listas ou travessões.',
          'Tom Enciclopédico: Texto excessivamente didático.',
          'Conectivos Repetitivos: Uso mecânico de "Além disso", "Por outro lado".',
          'Alucinação Bibliográfica: Citações inexistentes.'
      ]);

      // Footer Audit
      this.drawAuditFooter(doc, {
        ...auditInfo,
        createdAt: createdAt
      });

      doc.end();
    });

    return this.signPdf(pdfBuffer);
  }
}

module.exports = PdfService;
