---
theme: slidev-theme-excali-slide
layout: intro
class: text-center
highlighter: shiki
lineNumbers: false
info: |
  ## Avalia+Tec
  Pitch Deck para submissão na Fase 1 de Ideias Inovadoras do Programa Centelha 3 Bahia
drawings:
  persist: false
transition: view-transition
css: ./style.css
title: Avalia+Tec
themeConfig:
  primary-highlight: "#2e7d32"
  secondary-highlight: "#003366"
author: Equipe Avalia+
favicon: './img/logo_avalia_quadrado.png'
titleTemplate: '%s'
---

<div class="flex justify-center items-center mb-4">
  <img src="/img/logo_avalia_horizontal.png" class="h-24" alt="Avalia+Tec Logo" />
</div>

Pitch Deck para submissão na Fase 1 de Ideias Inovadoras do Programa Centelha 3 Bahia

<div class="opacity-50 text-sm mt-4">
  jan 2026 | Equipe Avalia+
</div>

<!-- Background Video -->
<div class="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden">
  <video 
    autoplay 
    loop 
    muted 
    playsinline
    class="w-full h-full object-cover blur-sm opacity-80"
  >
    <source src="/img/video_curto.mp4" type="video/mp4" />
  </video>
</div>

<!--
Este é o slide de título.
-->

---
layout: default
---

# A Solução Definitiva para Governança em Seleções

<div class="flex justify-center my-8">
  <img src="/img/logo_avalia_horizontal.png" style="width: 60%;" />
</div>

**Transformamos processos seletivos vulneráveis em fluxos auditáveis, seguros e 100% digitais.**

Plataforma SaaS para **[inscrição](../inscricao.html)**, **[avaliação](../selecao.html)** e **[consolidação](../selecao.html)** com integridade jurídica.

---

# O Problema: O Caos da Gestão Manual

Processos seletivos geridos por e-mail e planilhas são uma **bomba-relógio jurídica e operacional**.

- **Risco Jurídico Imediato:** Falta de rastreabilidade abre margem para recursos e anulação de editais.
- **Ineficiência Operacional:** Horas perdidas consolidando versões conflitantes de planilhas.
- **Vulnerabilidade LGPD:** Dados sensíveis de candidatos circulando sem controle em caixas de e-mail.

---

# A Solução: Centralização com Rastreabilidade

Um ambiente único que garante **governança** do início ao fim.

- **Fluxo End-to-End:** [Inscrição](../inscricao.html) → [Avaliação](../selecao.html) → Consolidação → Resultado.
- **Transparência Total:** O candidato acompanha cada etapa, reduzindo a desconfiança e a judicialização.
- **Eficiência:** Eliminação de retrabalho manual e erros de consolidação.

<div class="flex justify-center mt-4">
  <video controls class="w-3/5 rounded-lg shadow-lg">
    <source src="/video/tela_processo_seletivo.mp4" type="video/mp4" />
  </video>
</div>

---

# Diferencial: Blindagem Jurídica (Tecnologia)

Não é apenas software, é **segurança jurídica** via tecnologia.

- **Prova de Integridade (Hash SHA-256):** Cada documento recebe um selo criptográfico imutável. Garantia matemática de que o avaliado é o submetido.
- **Auditoria Instantânea:** Em caso de recurso, a prova técnica está pronta em segundos.
- **Fim das Disputas:** Elimina dúvidas sobre "qual versão vale".

<div class="flex justify-center mt-4">
  <img src="/prints/manual/fig-17-pdf-protocolo-hash.png" style="width: 60%; border-radius: 8px;" />
</div>

---

# Privacidade e Compliance (LGPD)

Proteção de dados como **vantagem competitiva**, não apenas obrigação.

- **Blind Review Real:** Avaliadores focam no mérito, sem acesso a dados pessoais (viés reduzido).
- **Anonimização Segura (HMAC):** Validação de unicidade (CPF) sem expor o dado real.
- **Segurança por Design:** Minimização de dados desde a arquitetura.

<div class="flex justify-center mt-4">
  <video controls class="w-3/5 rounded-lg shadow-lg">
    <source src="/video/tela_avaliacao.mp4" type="video/mp4" />
  </video>
</div>

---

# Mercado: Busca por Conformidade

Um oceano azul em meio a ferramentas genéricas de eventos.

- **TAM (Mercado Total):** **R$ 14,6 Bilhões** (Orçamento MCTI 2024 para Ciência e Tecnologia).
- **SAM (Nosso Foco):** **+100 Fundações de Apoio** (CONFIES) e **110 Instituições Federais** (69 Univ. + 41 IFs) que gerem esses recursos.
- **SOM (Meta 2 anos):** Validar em 5 Fundações (Bahia/Nordeste) e expandir para 50 instituições.

---

# Por que o Avalia+Tec? (Concorrência)

Ferramentas de **eventos** não entregam **segurança jurídica**.

| Característica | Even3 / Doity | Google Forms | **Avalia+Tec** |
| :--- | :---: | :---: | :---: |
| **Foco Principal** | Congressos/Eventos | Pesquisas | **Seleções/Editais** |
| **Gestão de Banca** | Foco Acadêmico | Manual | **Auditável** |
| **Integridade** | Nenhuma | Nenhuma | **Hash SHA-256** |
| **Risco Jurídico** | Médio | Alto | **Blindado** |

---

# Modelo de Negócio

SaaS B2B flexível para a realidade dos editais.

- **Licença por Edital:** Para demandas pontuais (Ticket médio: R$ Xk).
- **Assinatura Anual:** Para instituições com fluxo recorrente (Ticket médio: R$ Yk/ano).
- **Setup + Suporte:** Consultoria na configuração do certame.

---

# Estágio Atual e Tração

**MVP Funcional e Validado.**

- Módulos de [Inscrição](../inscricao.html) e [Avaliação](../selecao.html) operacionais.
- Sistema de Recursos e Resultados implementado.
- Arquitetura escalável (Node.js + JSON/PostgreSQL).
- Próximo passo: Validação comercial com pilotos pagos.

<div class="flex justify-center mt-4">
  <video controls class="w-3/5 rounded-lg">
    <source src="/video/tela_avaliacao.mp4" type="video/mp4" />
  </video>
</div>

---

# Roadmap e Uso do Recurso (Centelha)

**Objetivo:** Transformar o MVP em Produto de Mercado.

- **Meta (6 meses):** Finalizar módulo de relatórios gerenciais e executar **3 pilotos pagos**.
- **Investimento (R$ 60k):**
    - 50% Desenvolvimento (Finalização de features).
    - 30% Marketing e Vendas (Aquisição de pilotos).
    - 20% Infraestrutura e Jurídico.

---

# A Equipe

<div class="team-grid">
  <div class="team-card">
    <img class="team-avatar" src="/img/team/diego.jpeg" alt="Diego" loading="lazy" />
    <div class="team-name">Diego</div>
    <div class="team-role">Produto, validação com usuários, implantação e pilotos</div>
  </div>

  <div class="team-card">
    <img class="team-avatar" src="/img/team/catuxe.jpeg" alt="Catuxe Varjão" loading="lazy" />
    <div class="team-name">Catuxe Varjão</div>
    <div class="team-role">Engenharia, qualidade (MPS.BR) e controles (HMAC)</div>
  </div>

  <div class="team-card">
    <img class="team-avatar" src="/img/team/paloma.jpeg" alt="Dulce Paloma" loading="lazy" />
    <div class="team-name">Dulce Paloma</div>
    <div class="team-role">Jurídico/Compliance, LGPD e aderência legal</div>
  </div>

  <div class="team-card">
    <img class="team-avatar" src="/img/team/everaldo.jpeg" alt="Everaldo Fontes" loading="lazy" />
    <div class="team-name">Everaldo Fontes</div>
    <div class="team-role">Programação e validação com usuários</div>
  </div>
</div>

<!--
- Troque os placeholders em `projeto_centelha/img/team/` pelos retratos reais.
-->
