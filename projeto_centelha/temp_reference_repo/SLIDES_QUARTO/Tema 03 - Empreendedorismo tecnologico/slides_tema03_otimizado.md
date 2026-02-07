---
marp: true
theme: default
size: 16:9
paginate: true
style: |
  @import url('../theme-ufs.css');
---

<!-- _class: lead -->

# Empreendedorismo Tecnológico

## Da Geração da Ideia à Criação de Startups

### Universidade Federal de Sergipe
**Concurso Público para Docente**

---

## 📋 Agenda da Aula

<div class="two-columns">

<div>

### Fundamentos (20 min)
1. Empreendedorismo tecnológico
2. Modelo P-Start
3. Lean Startup

</div>

<div>

### Aplicações (20 min)
4. Business Model Canvas
5. Ecossistemas de Inovação
6. Caso Sergipe/CISE

### Síntese (10 min)
7. Conclusões e perspectivas

</div>

</div>

---

## 💡 Questão Provocativa

<div class="center" style="font-size: 48px; margin-top: 100px;">

**Por que 90% das startups fracassam nos primeiros 3 anos?**

</div>

<div class="box-info" style="margin-top: 80px;">

📊 **Dados**: Falta de validação de mercado é a causa #1 de falha (CB Insights, 2023)

</div>

<!-- 
NOTAS DO APRESENTADOR:
- CB Insights: análise de 100+ post-mortems de startups
- 42% fracassam por falta de necessidade de mercado
- 29% por falta de recursos financeiros
- 23% por equipe inadequada
- Justifica necessidade de metodologias estruturadas
- Timing: 2 minutos
-->

---

## 🚀 Empreendedorismo Tradicional vs. Tecnológico

<div class="two-columns">

<div>

### Tradicional

**Base**
- Oportunidades de mercado existentes
- Modelos de negócio testados

**Recursos**
- Capital inicial moderado
- Conhecimento de gestão

**Risco**
- Mercadológico (demanda, concorrência)
- Operacional

**Crescimento**
- Incremental e local

</div>

<div>

### Tecnológico (Bailetti, 2012)

**Base**
- Resultados científicos
- Tecnologias emergentes

**Recursos**
- P&D intensiva
- Know-how especializado
- Proteção de PI

**Risco**
- **Radical** (técnico + mercado)
- Incerteza tecnológica

**Crescimento**
- Disruptivo e escalável globalmente

</div>

</div>

<!-- 
NOTAS:
- Bailetti, T. (2012). Technology Entrepreneurship
- Intensidade P&D: startups tech gastam 15-25% receita em P&D vs. 2-5% tradicionais
- Exemplo BR: Movile, 99, Nubank (unicórnios tecnológicos)
- Timing: 4 minutos
-->

---

## 📐 Modelo P-Start (Souza, 2022)

```mermaid
graph TB
    A[Fase 1:<br/>Identificação de<br/>Oportunidade] --> B[Fase 2:<br/>Validação<br/>Técnico-Mercadológica]
    B --> C[Fase 3:<br/>Desenvolvimento<br/>MVP]
    C --> D[Fase 4:<br/>Escalabilidade e<br/>Crescimento]
    
    A --> A1[Prospecção tecnológica<br/>Vigilância de patentes<br/>Cruzamento mercado-tech]
    B --> B1[Lean Startup<br/>Customer Development<br/>Ciclos curtos]
    C --> C1[Protótipo funcional<br/>Características essenciais<br/>Feedback usuários]
    D --> D1[Planejamento estratégico<br/>Financiamento<br/>Proteção PI]
    
    style A fill:#003366,color:#fff
    style B fill:#0066CC,color:#fff
    style C fill:#00A859,color:#fff
    style D fill:#FF8C00,color:#fff
```

<!-- 
NOTAS:
- Souza, M. (2022). Modelo P-Start para startups tecnológicas
- Fase 1 reduz risco de soluções desconectadas da realidade
- Fase 2 usa metodologias ágeis (Lean, Design Thinking)
- Fase 3 privilegia MVP sobre produto completo
- Fase 4 exige instrumentos de financiamento (seed, venture capital)
- Timing: 5 minutos
-->

---

## 🔄 Lean Startup (Ries, 2011)

<div class="box-destaque">

### Ciclo Build-Measure-Learn

"Minimizar tempo total através deste ciclo de feedback é essência do Lean Startup"

</div>

```mermaid
graph LR
    I[IDEIAS] --> B[BUILD<br/>MVP]
    B --> P[PRODUTO]
    P --> M[MEASURE<br/>Dados]
    M --> D[DATA]
    D --> L[LEARN<br/>Validação]
    L --> I
    
    style I fill:#003366,color:#fff
    style B fill:#00A859,color:#fff
    style P fill:#0066CC,color:#fff
    style M fill:#00A859,color:#fff
    style D fill:#0066CC,color:#fff
    style L fill:#FF8C00,color:#fff
```

### Princípios Fundamentais

<div class="three-columns">

<div>

#### Empreendedores estão em toda parte
Não apenas garagens do Vale do Silício

</div>

<div>

#### Empreender é gerenciar
Requer estrutura e processo

</div>

<div>

#### Aprendizado validado
Testar hipóteses sistematicamente

</div>

</div>

<!-- 
NOTAS:
- Eric Ries, "The Lean Startup" (2011)
- Origem: Toyota Production System adaptado para startups
- MVP: versão mais simples para testar hipóteses
- Pivot vs. Persevere: mudar estratégia com base em dados
- Exemplos: Dropbox (vídeo como MVP), Zappos (fotos de sapatos)
- Timing: 5 minutos
-->

---

## 🎨 Business Model Canvas (Osterwalder, 2010)

```mermaid
graph TB
    subgraph "Canvas"
    P[Parcerias-Chave]
    A[Atividades-Chave]
    R[Recursos-Chave]
    PV[Proposta de Valor]
    RC[Relacionamento<br/>com Clientes]
    C[Canais]
    SC[Segmentos<br/>de Clientes]
    EC[Estrutura de Custos]
    FR[Fontes de Receita]
    end
    
    P --> A
    A --> PV
    R --> PV
    PV --> RC
    PV --> C
    RC --> SC
    C --> SC
    A --> EC
    R --> EC
    SC --> FR
    
    style PV fill:#FF8C00,color:#fff,stroke-width:3px
    style SC fill:#00A859,color:#fff
    style FR fill:#003366,color:#fff
    style EC fill:#0066CC,color:#fff
```

<div class="box-info">

### 9 Dimensões Fundamentais

**Lado Direito (Valor)**: Clientes, Proposta de Valor, Canais, Relacionamento, Receitas  
**Lado Esquerdo (Eficiência)**: Recursos, Atividades, Parcerias, Custos

</div>

<!-- 
NOTAS:
- Osterwalder & Pigneur, "Business Model Generation" (2010)
- Canvas permite visualização integrada do modelo de negócio
- Proposta de Valor no centro: o que resolve problema do cliente?
- Adaptável para contextos de economia solidária e desenvolvimento territorial
- Exemplo UFS: Spin-offs podem usar Canvas para estruturar modelo
- Timing: 5 minutos
-->

---

## 🔬 Transferência de Tecnologia

<div class="two-columns">

<div>

### Modalidades Estratégicas

#### 1. Licenciamento
- **Exclusivo**: Um único licenciado
- **Não-exclusivo**: Múltiplos licenciados
- **Territoriais**: Limitações geográficas

#### 2. Spin-offs
- Criação de nova empresa
- Transferência de tecnologia da universidade
- Participação acionária

#### 3. Joint Ventures
- Parceria estratégica
- Compartilhamento de riscos e benefícios
- Desenvolvimento conjunto

#### 4. Parcerias P&D
- Projetos colaborativos
- Proof of Concept
- Pesquisa aplicada

</div>

<div class="box-info">

### Instrumentos Jurídicos

**NDA** (Non-Disclosure Agreement)
- Proteção de informações confidenciais
- Fase exploratória

**Contrato de Licenciamento**
- Cessão de direitos de uso
- Royalties e contrapartidas

**Termo de Cooperação Tecnológica**
- Desenvolvimento conjunto
- Repartição de PI gerada

### Decisão Multicritério (AHP)

**Critérios de Avaliação:**
- Retorno econômico
- Controle intelectual
- Complexidade implementação
- Alinhamento estratégico
- Risco envolvido

</div>

</div>

<!-- 
NOTAS:
- Bozeman, B. (2000). Technology Transfer and Public Policy
- Arora et al. (2001). Markets for Technology
- AHP (Analytic Hierarchy Process): método de tomada de decisão multicritério
- Brasil: Lei 10.973/2004 regula transferência universidade-empresa
- Timing: 5 minutos
-->

---

## 🌐 Ecossistemas de Inovação: Tríplice Hélice

```mermaid
mindmap
  root((Ecossistema<br/>de Inovação))
    Universidade
      Pesquisa básica
      Capital humano
      NITs
        Agitte.se UFS
      Incubadoras
        CISE
    Empresa
      P&D aplicado
      Comercialização
      Investimento
        Angels
        VC
    Governo
      Políticas públicas
        Lei de Inovação
        Marco Legal CT&I
      Financiamento
        FAPITEC-SE
        FINEP
        BNDES
      Regulação
        INPI
        ANPEI
    Sociedade
      Demandas
      Validação
      Adoção
```

<!-- 
NOTAS:
- Etzkowitz & Leydesdorff (2000). Triple Helix model
- Evolução: Tríplice → Quádrupla (sociedade) → Quíntupla (meio ambiente)
- Governança, confiança mútua e compartilhamento de benefícios são essenciais
- Timing: 4 minutos
-->

---

## 🏢 Ecossistema Sergipano de Inovação

<div class="two-columns">

<div>

### CISE - Centro de Inovação UFS

📊 **Dados CISE (2024)**
- **23 startups** incubadas
- **R$ 4,5 milhões** captados
- **180 empregos** gerados
- **8 graduadas** (taxa sucesso 35%)

#### Programas de Apoio
- Pré-incubação (6 meses)
- Incubação (até 24 meses)
- Aceleração
- Mentoria especializada
- Conexão com investidores

#### Setores Atendidos
- TICs e Software
- Biotecnologia
- Energia renovável
- Agronegócio 4.0

</div>

<div class="box-info">

### FAPITEC-SE

**Editais de Fomento 2024:**
- R$ 12 milhões em CT&I
- 150+ projetos aprovados
- Bolsas de inovação tecnológica
- Subvenção a empresas

### TechSE - Ecossistema Local

**Atores-Chave:**
- **UFS, IFS, UNIT**: Formação e pesquisa
- **CISE, Sergipetec**: Incubação
- **FAPITEC-SE**: Financiamento
- **SEDETEC**: Políticas públicas
- **Startups locais**: 60+ ativas

**Desafios:**
- Baixa densidade de capital de risco
- Êxodo de talentos
- Mercado local limitado

**Oportunidades:**
- Óleo & gás offshore
- Aquicultura marinha
- Energias renováveis
- Turismo tecnológico

</div>

</div>

<!-- 
NOTAS:
- CISE inaugurado em 2017, referência regional
- Taxa de sucesso de incubadoras BR: 25-40%
- Sergipe: 60+ startups ativas (2024), crescimento 20% a.a.
- Oportunidade: diversificação econômica além petróleo
- Timing: 5 minutos
-->

---

## 💰 Financiamento de Startups Tecnológicas

```mermaid
graph LR
    A[Seed<br/>R$ 50k-500k] --> B[Series A<br/>R$ 1-5 mi]
    B --> C[Series B<br/>R$ 5-20 mi]
    C --> D[Series C+<br/>R$ 20+ mi]
    
    A --> A1[Angels<br/>FFF<br/>Incubadoras]
    B --> B1[Seed VC<br/>Aceleradoras]
    C --> C1[Venture Capital<br/>Corporate VC]
    D --> D1[Growth Equity<br/>IPO<br/>M&A]
    
    style A fill:#003366,color:#fff
    style B fill:#0066CC,color:#fff
    style C fill:#00A859,color:#fff
    style D fill:#FF8C00,color:#fff
```

### Instrumentos Brasileiros

<div class="three-columns">

<div>

#### Públicos
- FINEP (Inovacred, Centelha)
- BNDES (Criatec, MPME)
- FAPITEC-SE (Subvenção)
- EMBRAPII

</div>

<div>

#### Privados
- Venture Capital (600+ fundos BR)
- Angels (15.000+ investidores)
- Corporate VC
- Crowdfunding equity

</div>

<div>

#### Alternativos
- Bootstrapping
- Revenue-based financing
- Venture debt
- Aceleradoras corporativas

</div>

</div>

<!-- 
NOTAS:
- FFF: Friends, Family, Fools
- Brasil investiu US$ 3,2 bi em VC (2023), -15% vs. 2021
- 47 unicórnios brasileiros (2024)
- Desafio: Vale da Morte (valley of death) entre seed e Series A
- Timing: 4 minutos
-->

---

## ⚖️ Propriedade Intelectual em Startups

<div class="two-columns">

<div>

### PI como Ativo Estratégico

#### Funções da PI

1. **Proteção**
	- Barreira à entrada
	- Exclusividade temporária

2. **Sinalização**
	- Credibilidade técnica
	- Atração de investidores

3. **Monetização**
	- Licenciamento
	- Venda de ativos

4. **Negociação**
	- Moeda de troca em parcerias
	- Valorização em M&A

</div>

<div class="box-alerta">

### Armadilhas Comuns

❌ **Publicar antes de proteger**
- Perda de novidade
- Domínio público

❌ **Ignorar PI de terceiros**
- Freedom to Operate
- Risco de litígio

❌ **Co-criação sem acordo prévio**
- Titularidade indefinida
- Conflitos futuros

❌ **Não proteger software**
- Código-fonte exposto
- Engenharia reversa

</div>

</div>

<div class="box-info center" style="margin-top: 30px;">

**Boa Prática:** Fazer busca de anterioridade ANTES de iniciar desenvolvimento. Custo: R$ 500-2.000. Evita prejuízo de R$ 50.000+ em desenvolvimento de produto que infringe patente de terceiros.

</div>

<!-- 
NOTAS:
- Patente sinaliza qualidade técnica para investidores (efeito certificação)
- Startups com patentes captam 30-50% mais recursos (OCDE, 2021)
- Brasil: apenas 12% startups têm PI registrada (ABStartups, 2023)
- Cultura de "growth at all costs" vs. proteção adequada
- Timing: 4 minutos
-->

---

## 📊 Desafios e Oportunidades

<div class="two-columns">

<div class="box-alerta">

### ⚠️ Desafios

1. **Validação de mercado**
	- Distância cliente-desenvolvedor
	- Viés de confirmação

2. **Equipe inadequada**
	- Desequilíbrio técnico-negócio
	- Conflitos societários

3. **Recursos limitados**
	- Runway curto
	- Queima de caixa elevada

4. **Escala prematura**
	- Growth antes de product-market fit
	- Desperdício de capital

5. **Regulação**
	- Complexidade tributária
	- Barreiras setoriais

</div>

<div class="box-destaque">

### 💡 Oportunidades Brasil

1. **Mercado doméstico**
	- 215 milhões de habitantes
	- Classe média crescente

2. **Talento técnico**
	- 1 milhão formandos STEM/ano
	- Custo competitivo vs. EUA/Europa

3. **Problemas locais**
	- Fintech (inclusão financeira)
	- Agro 4.0
	- Saúde digital

4. **政府 Políticas**
	- Lei do Bem (incentivos fiscais)
	- Marco Legal Startups (LC 182/2021)

5. **Internacionalização**
	- Software-as-a-Service global
	- Nearshoring LATAM

</div>

</div>

<!-- 
NOTAS:
- LC 182/2021: Lei Complementar das Startups (facilitação tributária, investimento)
- Brasil: 4º maior mercado de startups do mundo (2024)
- Oportunidade setorial: Fintechs (64% das startups BR), Healthtechs, Agritechs
- Timing: 4 minutos
-->

---

## 🎓 Síntese Conceitual

<div class="center">

```mermaid
graph LR
    A[Oportunidade<br/>Tecnológica] --> B[P-Start<br/>Estruturado]
    B --> C[Lean Startup<br/>Validação]
    C --> D[Business Model<br/>Canvas]
    D --> E[Ecossistema<br/>Tríplice Hélice]
    E --> F[Financiamento<br/>Estágios]
    F --> G[Proteção PI<br/>+ Escala]
    
    style A fill:#003366,color:#fff
    style B fill:#0066CC,color:#fff
    style C fill:#00A859,color:#fff
    style D fill:#0066CC,color:#fff
    style E fill:#003366,color:#fff
    style F fill:#00A859,color:#fff
    style G fill:#FF8C00,color:#fff
```

</div>

### 🔑 Mensagens-Chave

1. **Empreendedorismo tecnológico** exige metodologias estruturadas (P-Start, Lean) para reduzir riscos
2. **Validação de mercado** precede desenvolvimento completo do produto (MVP)
3. **Business Model Canvas** sistematiza lógica de criação e captura de valor
4. **Ecossistemas robustos** (Tríplice Hélice) aceleram crescimento de startups
5. **PI** não é luxo, mas necessidade estratégica para proteção e financiamento

<!-- 
NOTAS:
- Reforçar importância de processo estruturado vs. "apenas executar"
- Empreendedorismo tecnológico como motor de desenvolvimento regional
- Timing: 3 minutos
-->

---

<!-- _class: lead -->

# 💬 Questões para Reflexão

<div style="font-size: 36px; text-align: left; max-width: 900px; margin: auto;">

1. **Como universidades brasileiras podem fortalecer a cultura empreendedora sem comprometer excelência acadêmica?**

2. **Quais os principais gargalos para acesso a financiamento de startups tecnológicas no Nordeste?**

3. **De que forma a proteção de PI pode ser equilibrada com a necessidade de abertura e colaboração em ecossistemas de inovação?**

4. **Como o modelo de Tríplice Hélice pode ser adaptado para contextos de economia solidária e desenvolvimento territorial?**

</div>

---

<!-- _class: lead -->

# 📚 Referências Principais

<div style="font-size: 24px; text-align: left; max-width: 1000px; margin: auto; line-height: 1.8;">

**BAILETTI, T.** (2012). Technology Entrepreneurship: Overview, Definition, and Distinctive Aspects. Technology Innovation Management Review.

**BLANK, S.** (2013). The Four Steps to the Epiphany: Successful Strategies for Products that Win. K&S Ranch.

**ETZKOWITZ, H.; LEYDESDORFF, L.** (2000). The Dynamics of Innovation: From National Systems and "Mode 2" to a Triple Helix. Research Policy, 29(2), 109-123.

**OSTERWALDER, A.; PIGNEUR, Y.** (2010). Business Model Generation. Wiley.

**RIES, E.** (2011). The Lean Startup: How Today's Entrepreneurs Use Continuous Innovation to Create Radically Successful Businesses. Crown Business.

**SOUZA, M.** (2022). Modelo P-Start para Startups Tecnológicas: Framework Integrado. Revista Brasileira de Inovação.

**TIDD, J.; BESSANT, J.** (2005). Managing Innovation: Integrating Technological, Market and Organizational Change. Wiley.

</div>

---

<!-- _class: lead -->

# Obrigado pela Atenção! 🎓

## Perguntas?

<div style="margin-top: 80px; font-size: 28px;">

**Prof. [Seu Nome]**  
📧 email@ufs.br  
🔗 lattes.cnpq.br/[seu-lattes]

**Universidade Federal de Sergipe**  
Concurso Público - Gestão da Inovação Tecnológica

</div>
