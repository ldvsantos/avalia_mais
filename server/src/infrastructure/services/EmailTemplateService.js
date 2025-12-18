const fs = require('fs');
const path = require('path');

class EmailTemplateService {
  constructor() {
    this.logoUrl = 'http://13.59.123.67/img/logo_avalia_horizontal.png';
    this.primaryColor = '#4CAF50'; // Green from the site theme
  }

  getCandidatePhaseResultEmail({ nome, protocoloInscricao, etapaLabel, statusLabel, score, siteUrl }) {
    const scoreLine = (score != null && Number.isFinite(Number(score)))
      ? `<p><strong>Nota:</strong> ${Number(score).toFixed(2)}</p>`
      : '';

    const portalUrl = siteUrl ? `${String(siteUrl).replace(/\/$/, '')}/consulta` : null;

    const content = `
      <h2>Atualização de Status - ${etapaLabel}</h2>
      <p>Olá <strong>${nome}</strong>,</p>
      <p>Há uma atualização no seu processo de avaliação.</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${this.primaryColor}; margin: 20px 0;">
        <p><strong>Protocolo de Inscrição:</strong> ${protocoloInscricao}</p>
        <p><strong>Etapa:</strong> ${etapaLabel}</p>
        <p><strong>Status:</strong> ${statusLabel}</p>
        ${scoreLine}
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <p>Para consultar detalhes, acesse o Portal do Candidato.</p>
      ${portalUrl ? `<p><a href="${portalUrl}">${portalUrl}</a></p>` : ''}
    `;

    return this._getLayout(content);
  }

  getCandidateAppealDecisionEmail({ nome, protocoloRecurso, protocoloInscricao, etapaLabel, decisionLabel, siteUrl }) {
    const portalUrl = siteUrl ? `${String(siteUrl).replace(/\/$/, '')}/consulta` : null;
    const content = `
      <h2>Decisão do Recurso</h2>
      <p>Olá <strong>${nome}</strong>,</p>
      <p>Há uma atualização na análise do seu recurso.</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${this.primaryColor}; margin: 20px 0;">
        <p><strong>Protocolo do Recurso:</strong> ${protocoloRecurso}</p>
        <p><strong>Protocolo de Inscrição:</strong> ${protocoloInscricao}</p>
        <p><strong>Etapa:</strong> ${etapaLabel}</p>
        <p><strong>Decisão:</strong> ${decisionLabel}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <p>Para acompanhar o seu processo, acesse o Portal do Candidato.</p>
      ${portalUrl ? `<p><a href="${portalUrl}">${portalUrl}</a></p>` : ''}
    `;

    return this._getLayout(content);
  }

  getRegistrationEmail(data, protocol) {
    const content = `
      <h2>Confirmação de Inscrição</h2>
      <p>Olá <strong>${data.nome}</strong>,</p>
      <p>Sua inscrição no sistema <strong>Avalia Mais</strong> foi realizada com sucesso!</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${this.primaryColor}; margin: 20px 0;">
        <p><strong>Protocolo:</strong> ${protocol}</p>
        <p><strong>Projeto:</strong> ${data.titulo_projeto || 'Não informado'}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <p>Em anexo, você encontrará uma cópia da sua inscrição em formato PDF para seus registros.</p>
      <p>Agradecemos sua participação. Fique atento ao seu email para futuras atualizações sobre o processo de avaliação.</p>
    `;
    return this._getLayout(content);
  }

  getAdminNewSubmissionNotificationEmail(data, protocol) {
    const content = `
      <h2>Nova Inscrição Recebida</h2>
      <p>Uma nova inscrição foi registrada no sistema <strong>Avalia Mais</strong>.</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${this.primaryColor}; margin: 20px 0;">
        <p><strong>Protocolo:</strong> ${protocol}</p>
        <p><strong>Candidato:</strong> ${data.nome || 'Não informado'}</p>
        <p><strong>Email:</strong> ${data.email || 'Não informado'}</p>
        <p><strong>Projeto:</strong> ${data.titulo_projeto || 'Não informado'}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <p>Em anexo, segue o PDF da inscrição para conferência.</p>
    `;
    return this._getLayout(content);
  }

  getAppealEmail(data, protocol) {
    const content = `
      <h2>Recebimento de Recurso</h2>
      <p>Olá <strong>${data.nome}</strong>,</p>
      <p>Confirmamos o recebimento do seu recurso referente ao processo de avaliação.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${this.primaryColor}; margin: 20px 0;">
        <p><strong>Protocolo do Recurso:</strong> ${protocol}</p>
        <p><strong>Protocolo de Inscrição:</strong> ${data.protocolo_inscricao || 'Não informado'}</p>
        <p><strong>Projeto:</strong> ${data.titulo_projeto || 'Não informado'}</p>
        <p><strong>Etapa Questionada:</strong> ${data.etapa_processo}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <p>Em anexo, você encontrará uma cópia do seu recurso em formato PDF para seus registros.</p>
      <p>Nossa equipe analisará sua solicitação e retornará em breve.</p>
    `;
    return this._getLayout(content);
  }

  getAdminNewAppealNotificationEmail(data, protocol) {
    const content = `
      <h2>Novo Recurso Recebido</h2>
      <p>Um novo recurso foi registrado no sistema <strong>Avalia Mais</strong>.</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${this.primaryColor}; margin: 20px 0;">
        <p><strong>Protocolo do Recurso:</strong> ${protocol}</p>
        <p><strong>Protocolo de Inscrição:</strong> ${data.protocolo_inscricao || 'Não informado'}</p>
        <p><strong>Candidato:</strong> ${data.nome || 'Não informado'}</p>
        <p><strong>Email:</strong> ${data.email || 'Não informado'}</p>
        <p><strong>Projeto:</strong> ${data.titulo_projeto || 'Não informado'}</p>
        <p><strong>Linha de pesquisa:</strong> ${data.linha_pesquisa || 'Não informado'}</p>
        <p><strong>Etapa:</strong> ${data.etapa_processo || 'Não informado'}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <p>Em anexo, segue o PDF do recurso para conferência.</p>
    `;
    return this._getLayout(content);
  }

  _getLayout(content) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee; }
          .header img { max-width: 200px; }
          .content { padding: 20px 0; }
          .footer { text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${this.logoUrl}" alt="Avalia Mais Logo">
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Avalia Mais. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = EmailTemplateService;
