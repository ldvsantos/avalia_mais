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

      const line1 = 'ASSINADO DIGITALMENTE PELO SISTEMA PLANTERR';
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

    const hasPlanter = fs.existsSync(this.planterLogoPath);
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
    
    doc.text(`Documento assinado digitalmente e auditado pelo sistema Planterr.`, startX, startY + 10, { align: 'center', width: width });
    doc.text(`Gerado por: ${userName} | IP: ${ip || 'N/A'} (${location}) | Data: ${dateStr}`, startX, startY + 22, { align: 'center', width: width });
    if (hash) {
      doc.text(`Código de Verificação (Hash): ${hash}`, startX, startY + 34, { align: 'center', width: width });
    }
    
    doc.restore();
    doc.page.margins.bottom = bottom;
  }

  async signPdf(pdfBuffer, options = {}) {
    const requireSignature = Boolean(options.requireSignature);

    try {
      const p12Buffer = certManager.getCertBuffer();
      const signer = createNodeSignPdfSigner();

      const trySign = (bufferToSign) => {
        const pdfWithPlaceholder = plainAddPlaceholder({
          pdfBuffer: bufferToSign,
          reason: 'Assinatura Digital Planterr',
          contactInfo: 'sistema@planterr.com',
          name: 'Planterr System',
          location: 'Digital',
        });

        return signer.sign(pdfWithPlaceholder, p12Buffer, { passphrase: 'planterr_secret' });
      };

      try {
        return trySign(pdfBuffer);
      } catch (err) {
        // PDFs externos (exportados por terceiros) frequentemente vêm com xref stream/linearização.
        // Quando plainAddPlaceholder não consegue ler o xref, tentamos normalizar e assinar de novo.
        if (isXrefParseError(err)) {
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
      // Layout paisagem para certificado
      const doc = new PDFDocument({ layout: 'landscape', margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const { nome, curso, data: dataEvento, cargaHoraria, textoLivre } = data;
      const width = doc.page.width;
      const height = doc.page.height;

      // Borda decorativa
      const borderPadding = 20;
      doc.lineWidth(3)
         .strokeColor('#003366')
         .rect(borderPadding, borderPadding, width - (borderPadding * 2), height - (borderPadding * 2))
         .stroke();
      
      // Borda interna fina
      doc.lineWidth(1)
         .strokeColor('#86A3C2')
         .rect(borderPadding + 5, borderPadding + 5, width - (borderPadding * 2) - 10, height - (borderPadding * 2) - 10)
         .stroke();

      // Logos (se existirem)
      const hasPlanter = fs.existsSync(this.planterLogoPath);
      const hasUefs = fs.existsSync(this.uefsLogoPath);

      if (hasUefs) {
        // UEFS na esquerda
        doc.image(this.uefsLogoPath, 60, 60, { width: 130 });
      }
      if (hasPlanter) {
        // Planterr na direita
        doc.image(this.planterLogoPath, width - 190, 60, { width: 130 });
      }

      doc.moveDown(6);

      // Título
      doc.font('Helvetica-Bold').fontSize(36).fillColor('#003366')
         .text('CERTIFICADO', { align: 'center' });
      
      doc.moveDown(1);

      // Texto Principal
      doc.font('Helvetica').fontSize(16).fillColor('#000000')
         .text('Certificamos que', { align: 'center' });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000')
         .text(String(nome || '').toUpperCase(), { align: 'center' });
      
      doc.moveDown(0.8);

      doc.font('Helvetica').fontSize(16)
         .text('participou do evento/curso:', { align: 'center' });
      
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(20).fillColor('#003366')
         .text(String(curso || ''), { align: 'center' });

      doc.moveDown(1);

      const detalhes = [];
      if (dataEvento) detalhes.push(`Realizado em: ${dataEvento}`);
      if (cargaHoraria) detalhes.push(`Carga Horária: ${cargaHoraria}`);
      
      doc.font('Helvetica').fontSize(14).fillColor('#333333')
         .text(detalhes.join('  |  '), { align: 'center' });

      if (textoLivre) {
        doc.moveDown(1);
        doc.fontSize(12).text(textoLivre, { align: 'center', width: width - 200, align: 'center' });
      }

      // Assinatura (Simulada)
      const assinaturaY = height - 130;
      doc.moveTo(width / 2 - 100, assinaturaY).lineTo(width / 2 + 100, assinaturaY).lineWidth(1).strokeColor('#000000').stroke();
      doc.fontSize(12).text('Coordenação do Evento', width / 2 - 100, assinaturaY + 10, { width: 200, align: 'center' });

      // Rodapé de Auditoria
      this.drawAuditFooter(doc, auditInfo);

      doc.end();
    });

    return this.signPdf(pdfBuffer);
  }
}

module.exports = PdfService;
