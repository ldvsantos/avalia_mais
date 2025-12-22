const crypto = require('crypto');

class IntegrityService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.EDEN_AI_API_KEY;
    this.providerIA = config.providerIA || process.env.EDEN_AI_PROVIDER_IA || 'sapling';
    
    let plagProvider = config.providerPlagiarism || process.env.EDEN_AI_PROVIDER_PLAGIARISM || 'winstonai';
    // Fallback if env var is set to the invalid 'originalityai'
    if (plagProvider === 'originalityai') {
      plagProvider = 'winstonai';
    }
    this.providerPlagiarism = plagProvider;

    this.mockMode = config.mockMode !== false; // Default to true for now
  }

  /**
   * Orchestrates the scan (AI + Plagiarism)
   * @param {string} submissionId 
   * @param {string} text 
   * @param {string} title 
   */
  async submitTextScan(submissionId, text, title = 'Untitled') {
    console.log(`[IntegrityService] Submitting scan for ${submissionId}... Mock: ${this.mockMode}`);

    if (this.mockMode) {
      return this._mockSubmitScan(submissionId);
    }

    if (!this.apiKey) {
      throw new Error('Missing Eden AI configuration (EDEN_AI_API_KEY)');
    }

    // 1. Check AI Probability
    let aiScore = null;
    let errors = [];
    
    try {
      aiScore = await this.checkAiProbability(text);
    } catch (err) {
      console.error('[IntegrityService] AI Detection failed:', err.message);
      errors.push(`AI: ${err.message}`);
    }

    // 2. Check Plagiarism (Optional/Expensive)
    let plagiarismScore = null;
    let reportUrl = null;
    let sources = [];
    let matches = [];
    let debugInfo = '';

    try {
      const plagResult = await this.checkPlagiarism(text, title);
      plagiarismScore = plagResult.score;
      reportUrl = plagResult.reportUrl;
      sources = plagResult.sources || [];
      matches = plagResult.matches || [];
      
      // if (plagiarismScore === 0) {
      //    debugInfo = ` [Debug: ${JSON.stringify(plagResult.providerResult)}]`;
      // }
    } catch (err) {
      console.error('[IntegrityService] Plagiarism Detection failed:', err.message);
      errors.push(`Plag: ${err.message}`);
    }

    const status = (aiScore === null && plagiarismScore === null) ? 'error' : 'completed';
    let message = errors.length > 0 ? errors.join(' | ') : 'Scan completed successfully';
    
    // if (debugInfo) {
    //    message += debugInfo;
    // }

    // Generate Interpretation Report
    const interpretation = this._getInterpretation(aiScore, plagiarismScore);

    return {
      scanId: `eden_${Date.now()}`,
      status: status,
      score: plagiarismScore,
      aiScore: aiScore,
      reportUrl: reportUrl,
      sources: sources,
      matches: matches,
      scannedText: text,
      message: message,
      interpretation: interpretation
    };
  }

  _getInterpretation(aiScore, plagiarismScore) {
    // Default safe values
    let label = 'Baixo Risco';
    let color = 'green';
    let text = 'Dentro da normalidade. Provável uso apenas de corretores ortográficos (Grammarly/Editor).';

    // Logic based on AI Score (0-100)
    // Treat null as 0 for safety in logic, but display might handle differently
    const safeAi = aiScore || 0;
    const safePlag = plagiarismScore || 0;

    if (safeAi > 50) {
      label = 'Alto Risco de Autoria Sintética';
      color = 'red';
      text = `Score de IA (${safeAi}%) acima do limiar de 50%. Estatisticamente, isso indica que a maior parte da estrutura sintática e argumentativa foi gerada por modelos de linguagem (LLMs), e não apenas revisada.`;
    } else if (safeAi > 15) {
      label = 'Nível de Atenção';
      color = 'orange';
      text = `Score de IA (${safeAi}%) na faixa de incerteza (15-50%). Indica possível edição híbrida ou uso intenso de ferramentas de reescrita (paráfrase). Requer análise humana detalhada.`;
    }

    // Plagiarism Context
    if (safePlag > 20) {
        // If already high risk AI, mention both
        if (color === 'red') {
            label = 'Alto Risco (IA + Plágio)';
            text += ` ALERTA CRÍTICO: Também foi detectado ${safePlag}% de plágio (acima do limite de 20%). Verifique o Relatório Completo para ver os trechos copiados.`;
        } else {
            // If AI was low/medium but Plag is high
            label = 'Risco de Plágio';
            color = 'red';
            text = `Atenção: Índice de plágio de ${safePlag}% excede o limite de segurança (20%). Verifique o Relatório Completo para identificar os trechos copiados e suas fontes.`;
        }
    }

    return {
        status_label: label,
        color: color,
        explanation_text: text
    };
  }

  /**
   * Checks AI Probability using Eden AI
   * @param {string} text 
   * @returns {Promise<number>} Score 0-100
   */
  async checkAiProbability(text) {
    const url = 'https://api.edenai.run/v2/text/ai_detection';
    const payload = {
      providers: this.providerIA,
      text: text
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Eden AI (AI) Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    // Eden AI response structure: { [provider]: { ai_score: 0.12, ... } }
    const providerResult = data[this.providerIA];
    
    if (!providerResult) {
      throw new Error(`Provider ${this.providerIA} not found in response`);
    }

    if (providerResult.status === 'fail') {
       throw new Error(`Provider ${this.providerIA} failed: ${providerResult.error?.message}`);
    }

    // ai_score is usually 0-1
    const score = providerResult.ai_score || 0;
    return Math.round(score * 100);
  }

  /**
   * Checks Plagiarism using Eden AI
   * @param {string} text 
   * @param {string} title
   * @returns {Promise<{score: number, reportUrl: string}>}
   */
  async checkPlagiarism(text, title) {
    const url = 'https://api.edenai.run/v2/text/plagia_detection';
    const payload = {
      providers: this.providerPlagiarism,
      text: text,
      title: title
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Eden AI (Plagiarism) Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const providerResult = data[this.providerPlagiarism];

    if (!providerResult) {
      throw new Error(`Provider ${this.providerPlagiarism} not found in response`);
    }

    if (providerResult.status === 'fail') {
        throw new Error(`Provider ${this.providerPlagiarism} failed: ${providerResult.error?.message}`);
    }

    // plagiarism_score is usually 0-100
    // WinstonAI returns 'plagia_score' (0-100) in the root of providerResult
    // But sometimes it might be 'plagiarism_score' depending on Eden AI normalization
    // Based on debug log: "plagia_score": 50
    const score = providerResult.plagiarism_score || providerResult.plagia_score || 0;
    
    // Some providers return a report url
    const reportUrl = providerResult.report_url || null;

    // Extract sources and matches from items if available
    let sources = [];
    let matches = [];
    if (providerResult.items && Array.isArray(providerResult.items)) {
        const urlSet = new Set();
        providerResult.items.forEach(item => {
            const textSegment = item.text || '';
            
            if (item.candidates && Array.isArray(item.candidates)) {
                item.candidates.forEach(candidate => {
                    if (candidate.url) {
                        urlSet.add(candidate.url);
                        
                        // Add to matches list (limit to top 20)
                        // Only add if we have text context
                        if (matches.length < 20 && textSegment.length > 10) {
                             matches.push({
                                 text: textSegment,
                                 source: candidate.url,
                                 score: candidate.plagia_score || candidate.score || 0
                             });
                        }
                    }
                });
            }
        });
        sources = Array.from(urlSet).slice(0, 15); // Limit to top 15 sources
    }

    return { score, reportUrl, sources, matches, providerResult };
  }

  async processWebhook(payload) {
    return payload;
  }

  // --- Mock Implementation ---

  async _mockSubmitScan(submissionId) {
    const scanId = `scan_${crypto.randomBytes(8).toString('hex')}`;
    
    return {
      scanId,
      status: 'completed',
      score: Math.floor(Math.random() * 20), // 0-20% plagiarism
      aiScore: Math.floor(Math.random() * 100), // 0-100% AI
      reportUrl: `https://mock-integrity-report.com/view/${submissionId}`,
      message: 'Scan completed successfully (Mock)'
    };
  }
}

module.exports = IntegrityService;
