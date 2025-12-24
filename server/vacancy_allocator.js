/**
 * Motor de Alocação de Vagas - Resolução CONSEPE 088/2021
 */

class VacancyAllocator {
    constructor(totalVagas, candidatos, vagasExtras = {}) {
        this.totalVagas = totalVagas;
        this.candidatos = JSON.parse(JSON.stringify(candidatos)); // Deep copy
        this.vagasExtras = vagasExtras; // Ex: { "SDR": 1, "UEFS": 1 } or just a number if generic
        
        // Configuração de Grupos
        this.grupos = {
            negros: ["Negro"],
            demais: ["Indigena", "PCD", "Trans", "Quilombola"],
            institucional: ["Servidor_UEFS", "Termo_SDR"]
        };

        this.quadroVagas = {
            AC: 0,
            Cotas_Total: 0,
            Cotas_Negros: 0,
            Cotas_Demais: 0,
            Institucional: this.vagasExtras // Pode ser um objeto ou número
        };

        this.resultado = [];
    }

    // Verifica se o candidato pertence a um grupo
    hasTag(candidato, tagsGrupo) {
        if (!candidato.tags) return false;
        return tagsGrupo.some(tag => candidato.tags.includes(tag));
    }

    calcularVagas() {
        // 1. Divisão Geral
        // "Vagas de Ações Afirmativas (Cotas) = 50% do TOTAL_VAGAS."
        // "Vagas de Ampla Concorrência = 50% do TOTAL_VAGAS."
        // "Se der número quebrado (ex: 7 vagas totais = 3.5), não arredonde agora. Mantenha o fluxo."
        
        let floatCotas = this.totalVagas * 0.5;
        let floatAC = this.totalVagas * 0.5;

        // 2. Subdivisão das Cotas (Dentro dos 50%)
        // "Cota Negros = 70% das Vagas de Ações Afirmativas."
        // "Cota Demais Grupos = 30% das Vagas de Ações Afirmativas."
        
        let floatNegros = floatCotas * 0.7;
        let floatDemais = floatCotas * 0.3;

        // 3. Regra de Arredondamento (Crítica)
        // "Se o resultado da Cota for fração >= 0.5, arredonde para o inteiro superior."
        // "Se o resultado da Cota for fração < 0.5, arredonde para o inteiro inferior."
        
        let finalNegros = this.arredondar(floatNegros);
        let finalDemais = this.arredondar(floatDemais);

        // "Exceção de Soma: A soma das subcotas não pode ultrapassar o total de vagas reservadas."
        // Aqui precisamos definir o "total de vagas reservadas" (inteiro).
        // Se Total=7, floatCotas=3.5. O total reservado é 3 ou 4?
        // O exemplo diz: "10 vagas totais = 5 reservadas".
        // Se fosse 7, seria 3.5.
        // A Resolução 088/2021 geralmente arredonda o TOTAL de cotas para cima se >= 0.5?
        // Ou segue a soma das partes?
        // O prompt diz: "Se o arredondamento estourar o total, a prioridade de arredondamento para cima é da Cota Negros".
        // Isso implica que existe um "Total" fixo que não pode ser estourado.
        // Vamos assumir que o Total de Cotas é Math.ceil(floatCotas) se >= 0.5?
        // Ou Math.floor?
        // Se Total=7, Cotas=3.5. Negros=2.45->2. Demais=1.05->1. Soma=3.
        // Se Cotas fosse 4 (arredondado pra cima), sobrou 1 vaga.
        // Se Cotas fosse 3 (arredondado pra baixo), deu exato.
        
        // Vamos assumir que o Total de Cotas segue a mesma regra de arredondamento (>=0.5 sobe).
        let totalCotasInteiro = this.arredondar(floatCotas);
        
        // Ajuste da soma
        let somaCalculada = finalNegros + finalDemais;
        
        if (somaCalculada > totalCotasInteiro) {
            // Estourou. Prioridade para Negros manterem o arredondamento para cima.
            // Significa que tiramos de Demais.
            finalDemais = totalCotasInteiro - finalNegros;
        } else if (somaCalculada < totalCotasInteiro) {
            // Sobrou vaga no total de cotas.
            // Onde colocar? Geralmente no grupo majoritário (Negros).
            finalNegros = totalCotasInteiro - finalDemais;
        }

        this.quadroVagas.Cotas_Total = totalCotasInteiro;
        this.quadroVagas.Cotas_Negros = finalNegros;
        this.quadroVagas.Cotas_Demais = finalDemais;
        
        // Vagas Extras (Institucionais)
        // IMPORTANTE: Vagas institucionais são deduzidas da Ampla Concorrência
        // conforme observado na prática (ex: Total=10, Cotas=5, Inst=4 -> Ampla=1).
        let totalInstitucional = 0;
        if (typeof this.vagasExtras === 'object') {
            for (let val of Object.values(this.vagasExtras)) {
                totalInstitucional += val;
            }
        } else if (typeof this.vagasExtras === 'number') {
            totalInstitucional = this.vagasExtras;
        }

        // Deduz da Ampla
        let amplaCalculada = this.totalVagas - totalCotasInteiro;
        this.quadroVagas.AC = Math.max(0, amplaCalculada - totalInstitucional);
        
        // Se sobrar algo negativo (impossível com max 0, mas conceitualmente),
        // significa que configuraram mais vagas institucionais do que ampla disponível.
        // Nesse caso, a Ampla fica zerada.
    }

    arredondar(num) {
        let decimal = num - Math.floor(num);
        // Cuidado com precisão de ponto flutuante (ex: 0.4999999)
        // Vamos usar toFixed para garantir
        decimal = parseFloat(decimal.toFixed(4));
        
        if (decimal >= 0.5) return Math.ceil(num);
        return Math.floor(num);
    }

    distribuir() {
        this.calcularVagas();
        
        // Ordenar candidatos
        let fila = [...this.candidatos].sort((a, b) => b.nota - a.nota);
        
        // Inicializar contadores
        let vagasAC = this.quadroVagas.AC;
        let vagasNegros = this.quadroVagas.Cotas_Negros;
        let vagasDemais = this.quadroVagas.Cotas_Demais;
        
        // Contadores de uso para exibição (X/Y)
        let usedAC = 0;
        let usedNegros = 0;
        let usedDemais = 0;
        let usedExtras = new Map();

        // Vagas Institucionais
        let vagasExtrasMap = new Map();
        if (typeof this.vagasExtras === 'object') {
            for (let [key, val] of Object.entries(this.vagasExtras)) {
                vagasExtrasMap.set(key, val);
                usedExtras.set(key, 0);
            }
        } else if (typeof this.vagasExtras === 'number') {
             vagasExtrasMap.set("Institucional", this.vagasExtras);
             usedExtras.set("Institucional", 0);
        }

        let aprovados = [];
        let classificados = []; // Lista de espera

        const aprovar = (candidato, tipo, detalhe, grupoConcorrencia = null) => {
            candidato.situacao = tipo;
            candidato.detalhe_situacao = detalhe;
            
            // Determinar Grupo de Concorrência para exibição
            if (grupoConcorrencia) {
                candidato.grupo_concorrencia = grupoConcorrencia;
            } else {
                // Lógica padrão se não for passado
                if (this.hasTag(candidato, this.grupos.negros)) candidato.grupo_concorrencia = "Afirmativa";
                else if (this.hasTag(candidato, this.grupos.demais)) {
                    // Tenta ser específico
                    if (candidato.tags.includes("PCD")) candidato.grupo_concorrencia = "PCD";
                    else if (candidato.tags.includes("Indigena")) candidato.grupo_concorrencia = "Indígena";
                    else if (candidato.tags.includes("Trans")) candidato.grupo_concorrencia = "Trans";
                    else if (candidato.tags.includes("Quilombola")) candidato.grupo_concorrencia = "Quilombola";
                    else candidato.grupo_concorrencia = "Afirmativa";
                }
                else if (this.hasTag(candidato, ["Servidor_UEFS"])) candidato.grupo_concorrencia = "UEFS";
                else if (this.hasTag(candidato, ["Termo_SDR"])) candidato.grupo_concorrencia = "SDR";
                else candidato.grupo_concorrencia = "Ampla";
            }

            aprovados.push(candidato);
            fila = fila.filter(c => c !== candidato);
        };

        // --- FASE 1: Ampla Concorrência ---
        let countAC = 0;
        let candidatosFase1 = [...fila];
        for (let i = 0; i < candidatosFase1.length; i++) {
            if (countAC < vagasAC) {
                usedAC++;
                aprovar(candidatosFase1[i], `Ampla Concorrência (${usedAC}/${this.quadroVagas.AC})`, "Classificação Geral");
                countAC++;
            } else {
                break;
            }
        }

        // --- FASE 2: Otimização de Duplo Perfil ---
        let duploPerfil = fila.filter(c => 
            this.hasTag(c, this.grupos.negros) && 
            this.hasTag(c, this.grupos.institucional)
        );

        for (let cand of duploPerfil) {
            let negrosRestantes = fila.filter(c => this.hasTag(c, this.grupos.negros));
            let rankNegro = negrosRestantes.indexOf(cand); 
            
            if (rankNegro < vagasNegros) {
                let tagsConvenio = cand.tags.filter(t => this.grupos.institucional.includes(t));
                let precisaLiberarVaga = false;
                for (let tag of tagsConvenio) {
                    let vagasDesseConvenio = vagasExtrasMap.get(tag) || 0;
                    if (!vagasExtrasMap.has(tag) && vagasExtrasMap.has("Institucional")) {
                        vagasDesseConvenio = vagasExtrasMap.get("Institucional");
                    }

                    if (vagasDesseConvenio > 0) {
                        let filaConvenio = fila.filter(c => c !== cand && c.tags.includes(tag));
                        if (filaConvenio.length > 0) {
                            precisaLiberarVaga = true;
                            break;
                        }
                    }
                }

                if (precisaLiberarVaga) {
                    usedNegros++;
                    aprovar(cand, `Ações Afirmativas – Negros/as (${usedNegros}/${this.quadroVagas.Cotas_Negros})`, "Estratégia Leonardo");
                    vagasNegros--;
                }
            }
        }

        // --- FASE 3: Preenchimento das Cotas ---
        
        // Cota Negros
        let candidatosNegros = fila.filter(c => this.hasTag(c, this.grupos.negros));
        for (let cand of candidatosNegros) {
            if (vagasNegros > 0) {
                usedNegros++;
                aprovar(cand, `Ações Afirmativas – Negros/as (${usedNegros}/${this.quadroVagas.Cotas_Negros})`, "Classificação Cota");
                vagasNegros--;
            }
        }

        // Cota Demais Grupos
        let candidatosDemais = fila.filter(c => this.hasTag(c, this.grupos.demais));
        for (let cand of candidatosDemais) {
            if (vagasDemais > 0) {
                usedDemais++;
                aprovar(cand, `Ações Afirmativas – Indígenas/quilombolas/ciganos/trans/PCD (${usedDemais}/${this.quadroVagas.Cotas_Demais})`, "Classificação Cota");
                vagasDemais--;
            }
        }

        // --- FASE 4: Vagas Institucionais ---
        for (let [tag, qtd] of vagasExtrasMap) {
            if (tag === "Institucional") {
                let candidatosInst = fila.filter(c => this.hasTag(c, this.grupos.institucional));
                let vagasRestantes = qtd;
                let totalInst = this.vagasExtras; // Assumindo número
                for (let cand of candidatosInst) {
                    if (vagasRestantes > 0) {
                        let current = usedExtras.get("Institucional") + 1;
                        usedExtras.set("Institucional", current);
                        aprovar(cand, `Vaga Institucional (${current}/${totalInst})`, "Classificação Específica");
                        vagasRestantes--;
                        vagasExtrasMap.set("Institucional", vagasRestantes);
                    }
                }
            } else {
                let candidatosTag = fila.filter(c => c.tags && c.tags.includes(tag));
                let vagasRestantesTag = qtd;
                let totalTag = this.vagasExtras[tag] || qtd; // Original total
                
                for (let cand of candidatosTag) {
                    if (vagasRestantesTag > 0) {
                        let current = (usedExtras.get(tag) || 0) + 1;
                        usedExtras.set(tag, current);
                        
                        let label = tag === "Servidor_UEFS" ? "UEFS" : (tag === "Termo_SDR" ? "Vaga Cooperação – SDR" : tag);
                        aprovar(cand, `${label} (${current}/${totalTag})`, "Classificação Específica");
                        
                        vagasRestantesTag--;
                        vagasExtrasMap.set(tag, vagasRestantesTag);
                    }
                }
            }
        }

        // --- FASE 5: Regra de Reversão (Sobras) ---
        // Reversão específica para gerar labels corretos
        
        // 1. Sobras de Cotas Negros
        while (vagasNegros > 0 && fila.length > 0) {
            let cand = fila[0];
            usedNegros++; // Conta como vaga de negro usada por ampla? Ou conta como vaga ampla?
            // O exemplo diz "UEFS - Ocupado por ampla".
            // Então "Ações Afirmativas - Negros/as - Ocupado por ampla"?
            // Vamos seguir o padrão.
            aprovar(cand, `Ações Afirmativas – Negros/as - Ocupado por ampla (${usedNegros}/${this.quadroVagas.Cotas_Negros})`, "Reversão de Sobras", "Ampla");
            vagasNegros--;
        }

        // 2. Sobras de Cotas Demais
        while (vagasDemais > 0 && fila.length > 0) {
            let cand = fila[0];
            usedDemais++;
            aprovar(cand, `Ações Afirmativas – Demais - Ocupado por ampla (${usedDemais}/${this.quadroVagas.Cotas_Demais})`, "Reversão de Sobras", "Ampla");
            vagasDemais--;
        }

        // 3. Sobras Institucionais
        for (let [tag, qtd] of vagasExtrasMap) {
            while (qtd > 0 && fila.length > 0) {
                let cand = fila[0];
                let current = (usedExtras.get(tag) || 0) + 1;
                usedExtras.set(tag, current);
                let totalTag = this.vagasExtras[tag] || (typeof this.vagasExtras === 'number' ? this.vagasExtras : 0);
                
                let label = tag === "Servidor_UEFS" ? "UEFS" : (tag === "Termo_SDR" ? "Vaga Cooperação – SDR" : tag);
                if (tag === "Institucional") label = "Vaga Institucional";

                aprovar(cand, `${label} - Ocupado por ampla (${current}/${totalTag})`, "Reversão de Sobras", "Ampla");
                qtd--;
                vagasExtrasMap.set(tag, qtd);
            }
        }

        for (let cand of fila) {
            cand.situacao = "Lista de Reserva";
            cand.detalhe_situacao = "Excedente";
            // Grupo de concorrência para lista de espera?
            // O exemplo deixa em branco.
            cand.grupo_concorrencia = ""; 
            classificados.push(cand);
        }

        return {
            quadro_vagas_calculado: this.quadroVagas,
            vagas_extras_config: Object.fromEntries(vagasExtrasMap),
            aprovados: aprovados.sort((a, b) => b.nota - a.nota),
            lista_espera: classificados
        };
    }
}

module.exports = VacancyAllocator;
