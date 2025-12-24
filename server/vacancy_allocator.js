/**
 * Motor de Alocação de Vagas - Resolução CONSEPE 088/2021
 */

class VacancyAllocator {
    constructor(totalVagas, candidatos, vagasExtras = {}) {
        this.totalVagas = totalVagas;
        this.candidatos = JSON.parse(JSON.stringify(candidatos)); // Deep copy
        
        // Se não foram passadas vagas extras (undefined ou null), define comportamento padrão
        if (!vagasExtras || Object.keys(vagasExtras).length === 0) {
            // Regra: 40% para Institucional (20% SDR + 20% UEFS)
            // Calculamos o total institucional primeiro para evitar dupla contagem no arredondamento de números pequenos.
            // Ex: 3 vagas. 20% = 0.6 (arredonda para 1). Se calcular separado, daria 1 SDR + 1 UEFS = 2 (66% do total).
            // Calculando junto: 40% de 3 = 1.2 (arredonda para 1).
            
            // Lógica de arredondamento local para garantir consistência
            const round = (num) => {
                let decimal = num - Math.floor(num);
                decimal = parseFloat(decimal.toFixed(4));
                if (decimal >= 0.5) return Math.ceil(num);
                return Math.floor(num);
            };

            let totalInst = round(totalVagas * 0.4);
            
            // Distribui entre SDR e UEFS (Prioridade para SDR se ímpar)
            let sdr = Math.ceil(totalInst / 2);
            let uefs = Math.floor(totalInst / 2);

            this.vagasExtras = {
                "Termo_SDR": sdr,
                "Servidor_UEFS": uefs
            };
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
        
        // 1. Calcular Institucional (já definido no construtor, mas vamos somar)
        let totalInstitucional = 0;
        if (typeof this.vagasExtras === 'object') {
            for (let val of Object.values(this.vagasExtras)) totalInstitucional += val;
        } else if (typeof this.vagasExtras === 'number') {
            totalInstitucional = this.vagasExtras;
        }

        // 2. Calcular Cotas (50% do Total)
        let floatCotas = this.totalVagas * 0.5;
        let totalCotasInteiro = this.arredondar(floatCotas);
        
        // 3. Calcular Ampla (Resíduo)
        // Ampla = Total - (Cotas + Institucional)
        let amplaCalculada = this.totalVagas - (totalCotasInteiro + totalInstitucional);
        
        // 4. Ajuste de Prioridades
        // Regra 1: Ampla deve ser pelo menos 1 (se Total >= 1)
        // Regra 2: Institucional deve ser mantido (conforme pedido do usuário)
        // Conclusão: Se faltar vaga para Ampla, tirar das Cotas.
        
        if (this.totalVagas > 0 && amplaCalculada < 1) {
            let falta = 1 - amplaCalculada;
            // Tenta tirar das Cotas
            if (totalCotasInteiro >= falta) {
                totalCotasInteiro -= falta;
                amplaCalculada = 1;
            } else {
                // Se Cotas não for suficiente (ex: N=1, Cotas=1, Inst=0, Ampla=0 -> Falta 1. Tira Cotas -> Ampla=1)
                // Se N=3, Inst=2, Cotas=2 (1.5->2). Total=4. Ampla=-1. Falta 2.
                // Tira 2 de Cotas -> Cotas=0. Ampla=1. Inst=2. Total=3. OK.
                let tirou = totalCotasInteiro;
                totalCotasInteiro = 0;
                amplaCalculada += tirou;
                
                // Se ainda faltar para Ampla ser 1, teria que tirar de Institucional,
                // mas o usuário disse "sempre terão essas vagas".
                // Então assumimos que Institucional é intocável, a menos que Ampla ainda seja < 1 e não tenha mais Cotas.
                // Mas com N=3, Inst=2, Cotas=0, Ampla=1 -> Total=3. OK.
            }
        }
        
        // Atualiza Ampla Final
        this.quadroVagas.AC = Math.max(0, this.totalVagas - (totalCotasInteiro + totalInstitucional));

        // 5. Subdivisão das Cotas (com o novo total ajustado)
        if (totalCotasInteiro > 0) {
            // Mantém proporção 70/30 do novo total
            let floatNegros = totalCotasInteiro * 0.7;
            let finalNegros = this.arredondar(floatNegros);
            let finalDemais = totalCotasInteiro - finalNegros;
            
            // Ajuste fino se der negativo (não deve acontecer com lógica acima)
            if (finalDemais < 0) { finalNegros += finalDemais; finalDemais = 0; }
            
            this.quadroVagas.Cotas_Total = totalCotasInteiro;
            this.quadroVagas.Cotas_Negros = finalNegros;
            this.quadroVagas.Cotas_Demais = finalDemais;
        } else {
            this.quadroVagas.Cotas_Total = 0;
            this.quadroVagas.Cotas_Negros = 0;
            this.quadroVagas.Cotas_Demais = 0;
        }
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
