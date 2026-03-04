# Estratégia de Revisão — avalia+Tec (V1 → V2)

**Data:** 04/03/2026  
**Objetivo:** Atender sistematicamente os pareceres dos Revisores #1 e #2 para resubmissão à SoftwareX.

---

## Mapeamento Consolidado das Críticas

As críticas dos dois revisores convergem fortemente em **6 eixos temáticos**. A tabela abaixo mapeia cada comentário ao eixo correspondente, prioridade e ação planejada.

| # | Eixo Temático | Rev. #1 | Rev. #2 | Prioridade |
|---|--------------|---------|---------|------------|
| A | **Modelo de ameaças e uso do termo "imutável"** | §1 (Major) | §4 | 🔴 ALTA |
| B | **Evidência empírica fraca / estatística insuficiente** | §2 (Major) | §2, §3 | 🔴 ALTA |
| C | **Novidade científica superestimada** | §3 (Major) | §1 | 🔴 ALTA |
| D | **Tabela comparativa superficial / enviesada** | §4 (Major) | §5 | 🟡 MÉDIA |
| E | **Conformidade LGPD não demonstrada formalmente** | — | §8 | 🟡 MÉDIA |
| F | **Categoria de submissão incorreta** | §5 (Major) | — | 🟢 SIMPLES |
| G | **Testes de carga/estresse ausentes** | — | §7 | 🟡 MÉDIA |
| H | **Sem validação formal de segurança** | — | §6 | 🟡 MÉDIA |
| I | **Dados/pacote de replicação não públicos** | — | §9 | 🟡 MÉDIA |
| J | **Artigo verboso para padrão SoftwareX** | — | §10 | 🟡 MÉDIA |

---

## Plano de Ação Detalhado

### A. Modelo de Ameaças e Termo "Imutável" 🔴

**Problema:** O artigo usa "immutable audit trail" mas admite que admin root pode reescrever a cadeia inteira. Isso invalida a afirmação central.

**Estratégia (duas frentes):**

1. **Implementação técnica — Ancoragem externa de hash (RFC 3161 ou alternativa leve):**
   - Implementar publicação periódica de checkpoint hashes em meio externo:
     - **Opção A (recomendada):** Serviço de timestamping RFC 3161 (ex.: FreeTSA.org ou DigiStamp) — gratuito, padrão reconhecido, sem dependência de blockchain.
     - **Opção B:** Publicação de hash-anchor em transação OP_RETURN do Bitcoin (custo mínimo, imutabilidade real).
     - **Opção C:** Serviço Originstamp (gratuito para uso acadêmico, ancora em Bitcoin + Ethereum).
   - Documentar a implementação no código e no artigo.

2. **Revisão textual:**
   - Substituir "immutable audit trail" por **"tamper-evident audit trail"** ou **"append-only hash-chained log"** em todo o texto.
   - Quando a ancoragem externa estiver implementada, usar **"externally anchored tamper-evident audit trail"**.
   - Reescrever a seção "Threat model and limitations" com modelo de ameaças formal:
     - Definir explicitamente: adversário interno (admin), adversário externo, insider não privilegiado.
     - Declarar o que o sistema garante e o que não garante em cada cenário.

**Seções afetadas:** Abstract, Highlights, §2 (Software Description), §3 (Illustrative Examples), §6 (Limitations), §7 (Conclusions).

**Trabalho estimado:** 3-5 dias (implementação) + 1 dia (revisão textual).

---

### B. Evidência Empírica e Estatística 🔴

**Problema:** n=60/n=6, sem intervalos de confiança, sem testes de significância, dados baseline retrospectivos e auto-reportados.

**Estratégia:**

1. **Análise estatística formal dos dados existentes:**
   - Computar **intervalos de confiança de 95%** para todas as métricas reportadas (tempo de ciclo, tempo do avaliador, etc.).
   - Aplicar **teste Mann-Whitney U** (não-paramétrico, adequado para n pequeno) para comparar pré vs. pós.
   - Calcular **tamanho de efeito** (Cohen's d ou rank-biserial correlation).
   - Reportar **poder estatístico** da amostra e declarar limitações explicitamente.

2. **Moderar as afirmações:**
   - Trocar linguagem assertiva por **hedged language**:
     - ~~"yielded a 65% reduction"~~ → "was associated with a 65% reduction (95% CI: [X%, Y%])"
     - ~~"elimination of formal disputes"~~ → "no formal disputes were observed during the monitoring period (0/60, p = X, Fisher exact test vs. historical 4.8%)"
   - Adicionar subseção "Threats to Validity" na seção de Limitações.

3. **Reconhecer limitações do design:**
   - Declarar explicitamente: "This is a single-institution, pre-post observational study without a randomized control group."
   - Mencionar viés de recordação, efeito Hawthorne, fatores de confusão.
   - *Nota: a seção de Limitações atual já cobre parte disso — reforçar e expandir.*

**Seções afetadas:** Abstract, §5 (Impact), §6 (Limitations), §7 (Conclusions).

**Trabalho estimado:** 2-3 dias (análise estatística com dados existentes) + 1 dia (revisão textual).

---

### C. Novidade Científica Superestimada 🔴

**Problema:** SHA-256 + HMAC + RBAC são práticas padrão. O artigo precisa posicionar a contribuição corretamente.

**Estratégia:**

1. **Reposicionar a contribuição explicitamente:**
   - A contribuição NÃO é em primitivas criptográficas — é em **engenharia de integração para resolver um problema real e pouco atendido**.
   - Alinhar com o escopo da SoftwareX: "original software publications" que descrevem software com impacto na pesquisa.
   - Adicionar parágrafo explícito: *"The scientific contribution does not reside in novel cryptographic primitives but in the systematic engineering of well-established techniques into a unified, deployable, open-source workflow that addresses a concrete and underserved organizational problem."*
   - **Nota: o artigo atual (versão pt-br) já contém essa frase na seção Motivação — destacá-la mais e torná-la central.**

2. **Reforçar o que é de fato novo:**
   - A integração de hash chains + HMAC + blind review + LGPD compliance em um único sistema open-source para processos seletivos institucionais.
   - Nenhum sistema existente (SIGAA, EasyChair, HotCRP, OpenReview, SUCUPIRA) oferece essa combinação para esse domínio.
   - Enfatizar a dimensão **SoftwareX-appropriate**: software funcional, documentado, testado, publicamente disponível.

**Seções afetadas:** Abstract, §1 (Motivation and Significance), §7 (Conclusions).

**Trabalho estimado:** 1 dia.

---

### D. Tabela Comparativa (Table 3) Superficial e Enviesada 🔴→🟡

**Problema:** Critérios parecem selecionados para favorecer o avalia+Tec. Comparação binária simplista, sem considerar extensibilidade/plugins.

**Estratégia:**

1. **Expandir critérios de comparação:**
   - Adicionar colunas: **Extensibilidade/Plugins**, **Comunidade/Suporte**, **Escala comprovada**, **Conformidade GDPR** (para plataformas internacionais).
   - Substituir Sim/Não por escala: ✓ (nativo), ◐ (via extensão/config), ✗ (indisponível).

2. **Metodologia de comparação:**
   - Declarar fonte de cada avaliação (documentação oficial, testes diretos, literatura).
   - Adicionar nota de rodapé explicando a metodologia.
   - Reconhecer que algumas plataformas poderiam integrar criptografia via extensão.

3. **Adicionar nuance:**
   - EasyChair/HotCRP: projetados para peer review de conferências, não para seleção institucional — comparação é funcional, não normativa.
   - SIGAA: sistema fechado, impossível auditar todas as funcionalidades.

**Seções afetadas:** §1 (Tabela 3 / comparação), rodapé da tabela.

**Trabalho estimado:** 1-2 dias.

---

### E. Conformidade LGPD Não Demonstrada Formalmente 🟡

**Problema:** Compliance é afirmada descritivamente, sem mapeamento formal de requisitos, DPIA ou auditoria legal.

**Estratégia:**

1. **Criar tabela de mapeamento LGPD:**
   - Mapear artigos relevantes da LGPD (arts. 6, 7, 46, 50) para mecanismos técnicos implementados no avalia+Tec.
   - Incluir como tabela no artigo ou apêndice.

2. **Moderar a afirmação:**
   - ~~"LGPD compliance"~~ → **"LGPD-aware design"** ou **"technical controls supporting LGPD compliance"**
   - Declarar: "Full LGPD compliance requires organizational, legal, and technical measures. This platform provides the technical layer; institutional policy and legal assessment remain the responsibility of the deploying organization."

3. **Mencionar DPIA como trabalho futuro** (ou, se viável, realizar uma DPIA básica e incluir no apêndice) = 🟡 vamos mencionar como trabalho futuro.

**Seções afetadas:** Abstract, Highlights, §1, §2, §7.

**Trabalho estimado:** 1-2 dias.

---

### F. Categoria de Submissão Incorreta 🟢

**Problema:** Submetido em "Humanities, Arts and Social Sciences" ao invés de área de engenharia de software.

**Ação:** Resubmeter na categoria **"Computer Science"** ou **"Software Engineering"**.

**Trabalho:** 5 minutos na plataforma de submissão.

---

### G. Testes de Carga/Estresse Ausentes 🟡

**Problema:** Sem testes de concorrência ou escalabilidade além de n=60.

**Estratégia:**

1. **Implementar benchmark de carga:**
   - Usar **autocannon** ou **k6** para simular carga concorrente no backend.
   - Cenários: 100, 500, 1000 submissões simultâneas.
   - Métricas: throughput (req/s), latência (p50, p95, p99), taxa de erro.

2. **Adicionar subseção ou tabela em §4 (Computational Performance):**
   - Reportar resultados de stress test.
   - Discutir escalabilidade arquitetural (horizontal scaling, read replicas).

**Seções afetadas:** §4 (Performance), §6 (Limitations).

**Trabalho estimado:** 2-3 dias.

---

### H. Sem Validação Formal de Segurança 🟡

**Problema:** Nenhum pentest, auditoria externa, ou verificação de gerenciamento de chaves.

**Estratégia:**

1. **Documentar práticas de segurança existentes:**
   - Key management: descrever como JWT secrets e HMAC keys são gerados, armazenados (env vars, não hardcoded), e rotacionados.
   - Adicionar parágrafo sobre práticas implementadas: rate limiting, input validation, helmet.js, etc.

2. **Realizar análise de segurança básica:**
   - Executar **npm audit** e incluir resultados.
   - Executar scanner OWASP ZAP (básico) ou Snyk e reportar.
   - Se possível, solicitar revisão de segurança por colega.

3. **Reconhecer a limitação:**
   - "No formal penetration testing or external security audit has been conducted. This represents future work."

**Seções afetadas:** §2 (Software Description — threat model), §6 (Limitations).

**Trabalho estimado:** 1-2 dias.

---

### I. Dados/Pacote de Replicação Não Públicos 🟡

**Problema:** Artigo diz "available upon request" mas SoftwareX exige transparência e reprodutibilidade.

**Estratégia:**

1. **Publicar dataset anonimizado:**
   - Criar dataset com métricas anonimizadas (tempos de ciclo, tempos de avaliação, contagens).
   - Publicar no **Zenodo** ou **Figshare** com DOI permanente.
   - Incluir scripts de análise estatística (Python/R) para reprodutibilidade.

2. **Atualizar seção "Data Availability":**
   - Referenciar o DOI do dataset.
   - Incluir link para scripts de análise.

**Seções afetadas:** Data Availability statement.

**Trabalho estimado:** 1-2 dias.

---

### J. Artigo Verboso para Padrão SoftwareX 🟡

**Problema:** Texto longo, seções de fundamentos criptográficos e fluxogramas poderiam ser condensadas.

**Estratégia:**

1. **Condensar seções:**
   - Mover fundamentos criptográficos detalhados para apêndice.
   - Reduzir descrições repetitivas de SHA-256/HMAC.
   - Comprimir a Seção 3 (Illustrative Examples) — manter 1 listagem de código em vez de 2.
   - Considerar mover uma das figuras TikZ para material suplementar.

2. **Limite de palavras:**
   - Artigo SoftwareX: tipicamente 3000-6000 palavras (artigo atual ≈ 5500 palavras contando corpo). Verificar contagem após edições.

**Trabalho estimado:** 1 dia.

---

## Cronograma Sugerido

| Semana | Atividades |
|--------|-----------|
| **Sem. 1** | (F) Corrigir categoria de submissão; (C) Reposicionar contribuição no texto; (J) Condensar texto |
| **Sem. 2** | (A) Implementar ancoragem RFC 3161 + revisar terminologia "immutable" |
| **Sem. 3** | (B) Análise estatística formal + moderar afirmações; (I) Publicar dataset no Zenodo |
| **Sem. 4** | (D) Expandir tabela comparativa; (E) Mapeamento LGPD |
| **Sem. 5** | (G) Testes de carga; (H) Análise de segurança + documentação |
| **Sem. 6** | Revisão final, carta de resposta aos revisores, resubmissão |

---

## Modelo da Carta de Resposta aos Revisores

A resposta deve seguir o formato:

```
> Reviewer #X, Comment Y: [transcrição do comentário]

**Response:** [descrição da ação tomada]

**Changes in manuscript:** [indicação das seções/páginas alteradas]
```

Cada ponto deve ser respondido individualmente, com referência exata ao trecho modificado no manuscrito.

---

## Checklist de Entrega

- [ ] Categoria de submissão corrigida (Computer Science / Software Engineering)
- [ ] Terminologia "immutable" revisada → "tamper-evident" em todo o texto
- [ ] Ancoragem externa de hash implementada (RFC 3161 ou blockchain)
- [ ] Modelo de ameaças formal adicionado
- [ ] Análise estatística (IC 95%, Mann-Whitney U, tamanho de efeito) realizada
- [ ] Afirmações moderadas com hedged language
- [ ] Contribuição reposicionada (engenharia de integração, não primitivas)
- [ ] Tabela comparativa expandida com critérios independentes
- [ ] Mapeamento LGPD adicionado (tabela artigos → mecanismos técnicos)
- [ ] Testes de carga realizados e reportados
- [ ] Práticas de segurança documentadas + limitações reconhecidas
- [ ] Dataset anonimizado publicado no Zenodo com DOI
- [ ] Texto condensado (remover redundâncias, mover detalhes ao apêndice)
- [ ] Carta de resposta ponto-a-ponto redigida
- [ ] Revisão final de linguagem e formatação
