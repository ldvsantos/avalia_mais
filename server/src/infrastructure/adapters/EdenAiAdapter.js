const PlagiarismDetectorGateway = require('../../domain/gateways/PlagiarismDetectorGateway');

class EdenAiAdapter extends PlagiarismDetectorGateway {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || process.env.EDEN_AI_API_KEY;
    this.providerIA = config.providerIA || process.env.EDEN_AI_PROVIDER_IA || 'sapling';
    
    let plagProvider = config.providerPlagiarism || process.env.EDEN_AI_PROVIDER_PLAGIARISM || 'winstonai';
    // Fallback if env var is set to the invalid 'originalityai'
    if (plagProvider === 'originalityai') {
      plagProvider = 'winstonai';
    }
    this.providerPlagiarism = plagProvider;
  }

  async checkAiProbability(text) {
    if (!this.apiKey) throw new Error('Missing Eden AI configuration (EDEN_AI_API_KEY)');

    const url = 'https://api.edenai.run/v2/text/ai_detection';
    const payload = {
      providers: this.providerIA,
      text: text
    };

    try {
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
      const providerResult = data[this.providerIA];
      
      if (!providerResult) {
        throw new Error(`Provider ${this.providerIA} not found in response`);
      }

      if (providerResult.status === 'fail') {
         throw new Error(`Provider ${this.providerIA} failed: ${providerResult.error?.message}`);
      }

      const score = providerResult.ai_score || 0;
      return Math.round(score * 100);
    } catch (error) {
      console.error('[EdenAiAdapter] checkAiProbability failed:', error);
      throw error;
    }
  }

  async checkPlagiarism(text, title) {
    if (!this.apiKey) throw new Error('Missing Eden AI configuration (EDEN_AI_API_KEY)');

    const url = 'https://api.edenai.run/v2/text/plagia_detection';
    const payload = {
      providers: this.providerPlagiarism,
      text: text,
      title: title
    };

    try {
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

      const score = providerResult.plagiarism_score || providerResult.plagia_score || 0;
      const reportUrl = providerResult.report_url || null;

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
          sources = Array.from(urlSet).slice(0, 15);
      }

      return { score, reportUrl, sources, matches, rawData: providerResult };
    } catch (error) {
      console.error('[EdenAiAdapter] checkPlagiarism failed:', error);
      throw error;
    }
  }

  async checkReferences(referencesText) {
    if (!this.apiKey) throw new Error('Missing Eden AI configuration (EDEN_AI_API_KEY)');

    const url = 'https://api.edenai.run/v2/text/chat';
    const providers = ['openai', 'google', 'anthropic']; 
    
    let lastError = null;

    for (const provider of providers) {
        try {
            console.log(`[EdenAiAdapter] Checking references with provider: ${provider}`);
            
            const payload = {
              providers: provider,
              text: `Analise as seguintes referências bibliográficas quanto à sua existência real.
              
              Referências:
              ${referencesText}
              
              Responda estritamente um JSON Array com o formato:
              [
                { "ref": "texto da referencia", "status": "Real" | "Alucinação" | "Suspeita", "reason": "explicação curta" }
              ]
              Não inclua markdown, apenas o JSON cru.`,
              chatbot_global_action: "Você é um assistente bibliotecário especialista em verificar a existência de referências acadêmicas. Você deve identificar alucinações de IA.",
              temperature: 0.2,
              max_tokens: 1000
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
              throw new Error(`Eden AI (Chat) Error: ${response.status} ${errText}`);
            }

            const data = await response.json();
            const providerResult = data[provider];
            
            if (!providerResult || providerResult.status === 'fail') {
               throw new Error(`Provider ${provider} failed: ${providerResult?.error?.message}`);
            }

            const content = providerResult.generated_text || '';
            
            try {
                const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(cleanJson);
            } catch (e) {
                console.error(`Failed to parse reference check JSON from ${provider}:`, content);
                throw new Error('Invalid JSON response');
            }

        } catch (err) {
            console.warn(`[EdenAiAdapter] Reference check failed with ${provider}: ${err.message}`);
            lastError = err;
        }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }
}

module.exports = EdenAiAdapter;
