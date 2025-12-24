/**
 * Motor de Alocação de Vagas - Resolução CONSEPE 088/2021
 */

class VacancyAllocator {
    constructor(totalVagas, candidatos, vagasExtras = {}) {
        this.totalVagas = totalVagas;
        this.candidatos = JSON.parse(JSON.stringify(candidatos)); // Deep copy
        
        // Se não foram passadas vagas extras (undefined ou null), define comportamento padrão
        if (!vagasExtras || Object.keys(vagasExtras).length === 0) {
            if (totalVagas >= 6) {
                this.vagasExtras = {
                    "Termo_SDR": Math.floor(totalVagas * 0.2),
                    "Servidor_UEFS": Math.floor(totalVagas * 0.2)
                };
            } else {
                // 3 a 5 vagas: Sem convênios automáticos
                this.vagasExtras = {
                    "Termo_SDR": 0,
                    "Servidor_UEFS": 0
                };
            }
        } else {
            this.vagasExtras = vagasExtras;
        }
        
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
            Institucional: this.vagasExtras
        };

        this.resultado = [];
    }

    // Verifica se o candidato pertence a um grupo
    hasTag(candidato, tagsGrupo) {
        if (!candidato.tags) return false;
        return tagsGrupo.some(tag => candidato.tags.includes(tag));
    }

    calcularVagas() {
        // Reset
        this.quadroVagas = { AC: 0, Cotas_Total: 0, Cotas_Negros: 0, Cotas_Demais: 0, Institucional: this.vagasExtras };
        
        if (this.totalVagas >= 6) {
            // Regra Geral (>= 6 vagas)
            let floatCotas = this.totalVagas * 0.5;
            
            // Arredondamento do Total de Cotas (>= 0.5 sobe)
            let totalCotasInteiro = this.arredondar(floatCotas);
            
            // Subdivisão das Cotas
            let floatNegros = floatCotas * 0.7;
            let finalNegros = this.arredondar(floatNegros);
            
            // Demais Grupos é o restante para fechar o Total de Cotas
            let finalDemais = totalCotasInteiro - finalNegros;
            
            // Proteção contra negativos (improvável, mas seguro)
            if (finalDemais < 0) {
                finalNegros += finalDemais; // Reduz negros para caber
                finalDemais = 0;
            }

            this.quadroVagas.Cotas_Total = totalCotasInteiro;
            this.quadroVagas.Cotas_Negros = finalNegros;
            this.quadroVagas.Cotas_Demais = finalDemais;
            
            // Institucional
            let totalInstitucional = 0;
            if (typeof this.vagasExtras === 'object') {
                for (let val of Object.values(this.vagasExtras)) totalInstitucional += val;
            } else if (typeof this.vagasExtras === 'number') {
                totalInstitucional = this.vagasExtras;
            }
            
            // Ampla Concorrência é o RESÍDUO
            this.quadroVagas.AC = Math.max(0, this.totalVagas - (totalCotasInteiro + totalInstitucional));
            
        } else if (this.totalVagas >= 3) {
            // Regra de Exceção (3 a 5 vagas) - Tabela Fixa
            let table = {
                3: { AC: 1, Negros: 1, Demais: 1 },
                4: { AC: 2, Negros: 1, Demais: 1 },
                5: { AC: 2, Negros: 2, Demais: 1 }
            };
            
            let rule = table[this.totalVagas];
            
            this.quadroVagas.Cotas_Negros = rule.Negros;
            this.quadroVagas.Cotas_Demais = rule.Demais;
            this.quadroVagas.Cotas_Total = rule.Negros + rule.Demais;
            
            // Institucional (se forçado)
            let totalInstitucional = 0;
            if (typeof this.vagasExtras === 'object') {
                for (let val of Object.values(this.vagasExtras)) totalInstitucional += val;
            } else if (typeof this.vagasExtras === 'number') {
                totalInstitucional = this.vagasExtras;
            }
            
            // Ampla Concorrência é o RESÍDUO
            // Se houver institucional forçado, ele come da Ampla (ou do total, reduzindo a Ampla)
            // A tabela define AC base, mas se tiver institucional, reduzimos AC.
            // Ex: 5 vagas -> Tabela diz 2 AC. Se tiver 1 SDR forçado -> 1 AC.
            // Mas a fórmula de resíduo é mais segura: Total - (Cotas + Inst)
            
            let calculatedAC = this.totalVagas - (this.quadroVagas.Cotas_Total + totalInstitucional);
            this.quadroVagas.AC = Math.max(0, calculatedAC);
            
        } else {
            // < 3 vagas (1 ou 2)
            // Assume tudo Ampla por padrão se não especificado
            this.quadroVagas.AC = this.totalVagas;
        }
    }
        
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
