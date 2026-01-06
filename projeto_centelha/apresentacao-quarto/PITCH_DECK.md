
![Logotipo do Avalia+Tec](../img/logo_avalia_horizontal.png)

# Avalia+Tec (AVALIA+) 

Pitch Deck para submissão na Fase 1 de Ideias Inovadoras do Programa Centelha 3 Bahia, elaborado em 04 jan 2026.

# Visão geral

Avalia+Tec, identificado como AVALIA+, consiste em uma plataforma SaaS para inscrição, avaliação multicritério e consolidação auditável de resultados em processos seletivos com banca. O desenho assume segurança da informação e proteção de dados como eixo de produto, de modo que a previsibilidade para o candidato e a capacidade de prestação de contas institucional sejam sustentadas por evidências verificáveis ao longo de todo o ciclo do edital.

# Problema

Em seleções educacionais e institucionais conduzidas por banca, a operação frequentemente depende de planilhas, trocas por e-mail e consolidação manual de notas, documentos e versões. Em janelas curtas, o volume de conferência sucessiva e reconciliação de arquivos amplia risco de inconsistências por digitação e fragiliza o vínculo entre o que foi originalmente submetido e o resultado publicado. Sob a ótica do candidato, o arranjo fragmentado tende a reduzir previsibilidade, porque comprovantes, prazos e decisões intermediárias se dispersam em anexos e mensagens, elevando dúvidas, solicitações de suporte e disputas sobre o que foi efetivamente registrado.

A criticidade aumenta quando se considera governança de dados e segurança da informação em processos públicos e institucionais, pois documentos, dados pessoais e registros decisórios circulam por múltiplos canais com controles heterogêneos e baixa capacidade de auditoria. Essa dispersão dificulta sustentar integridade, autenticidade e não repúdio, além de tornar mais complexa a resposta a recursos e contestações com base em evidências verificáveis, enquanto a exposição de informações que deveriam ser minimizadas tende a crescer.

# Solução

Avalia+Tec unifica, em um fluxo único, inscrição, administração, avaliação por múltiplos avaliadores, consolidação por comissão, ranking e comunicação por etapa. A proposta combina transparência verificável para o participante com governança do processo para a organização executora, preservando privacidade e reduzindo exposição indevida de dados pessoais.

# Como funciona na prática

O portal do candidato organiza a submissão com validações e gera um PDF com protocolo e hash SHA-256 verificável, reduzindo disputa por versões e aumentando a capacidade de comprovação do que foi submetido. O painel administrativo acompanha inscrições, aplica calendário por edital com prazos por fase e bloqueio de ações fora de janela, além de conduzir recursos e etapas opcionais. O módulo de avaliação registra avaliações multicritério por avaliador e consolida resultados e rankings, favorecendo rastreabilidade do percurso decisório.

![Exemplo de protocolo e hash SHA-256 no PDF](../prints/manual/fig-17-pdf-protocolo-hash.png)

# Diferenciais em segurança, privacidade e dados

A solução sustenta trilha auditável por meio de logs estruturados, identificador de requisição e histórico de alterações, o que favorece auditoria e prestação de contas com base em evidências. A minimização de dados sensíveis é aplicada ao bloqueio de duplicidade por CPF via HMAC, o que evita armazenamento do identificador em claro, e ao mecanismo de blind review, que reduz exposição de dados identificadores durante a avaliação.

![Exemplo de aviso de blind review e minimização de dados](../prints/manual/fig-11-blind-review-alerta-dados-pessoais.png)

# Produto e viabilidade técnica

Já existe um núcleo funcional implementado em Node.js com Express e frontend, com fluxos de inscrição, avaliação e recursos em operação, geração de PDF com protocolo e hash, envio de e-mails transacionais e exportação em CSV para auditoria. O armazenamento opera em JSON e há possibilidade de uso de PostgreSQL por configuração, preservando o mesmo fluxo de negócio.

![Visão do painel administrativo com rastreabilidade por protocolo](../prints/manual/fig-24-admin-dashboard-tabela-protocolo.png)

# Mercado e clientes

O mercado-alvo inclui universidades, institutos federais, fundações de amparo, incubadoras e programas de inovação, além de órgãos e unidades da Administração Pública que conduzem chamadas públicas, seleções e processos avaliativos com necessidade de prestação de contas. A oportunidade se ancora na recorrência de editais, na restrição de equipe operacional e na exigência de transparência, rastreabilidade e conformidade, especialmente em Educação e Administração Pública.

# Alternativas e concorrência

As alternativas mais comuns observadas no contexto de execução de editais ainda se apoiam em planilhas e formulários genéricos, que tendem a não oferecer, como padrão, integridade verificável e rastreabilidade de decisões. A pesquisa de similares citada no material base menciona Submittable, OpenWater, SurveyMonkey Apply e EasyChair como referências de categorias de submissão e avaliação. 

[ALERTA DE RESGATE] Caso o edital exija evidências documentais dessa pesquisa, recomenda-se registrar o critério de comparação utilizado e a fonte consultada para cada similar, incluindo data de acesso e recortes funcionais que suportem o posicionamento.

# Tração e validação

A validação está ocorrendo na UEFS com piloto, suportando a hipótese de utilidade operacional em ambiente institucional. 

[ALERTA DE RESGATE] Não há, no material base, números de tração como quantidade de editais atendidos, volume de inscrições, número de avaliadores, tempo médio de processamento, taxa de suporte ou redução de retrabalho. Se houver esses dados, sua inclusão tende a elevar a força de evidência do Pitch Deck sem alterar a proposta.

# Estratégia de implantação e crescimento

A estratégia privilegia implantação rápida e configuração por edital, com suporte durante o ciclo e comunicação padronizada por etapa. A oferta tende a ser mais atrativa em organizações com recorrência de seleções e necessidade de auditoria, nas quais a centralização do fluxo e a trilha de evidências reduzem risco operacional e risco de conformidade.

# Modelo de negócio

O modelo prevê assinatura SaaS por edital, entendido como ciclo, ou assinatura anual para organizações com múltiplas seleções, com variação por volume de inscrições e número de avaliadores. A implantação inclui configuração de calendário e critérios do edital, orientação de uso e suporte durante o ciclo.

[ALERTA DE RESGATE] Se houver uma proposta de faixa de preço, estrutura de pacotes, premissas de custo e margem, ou cenário de adoção, recomenda-se incorporar esses parâmetros com clareza, pois não constam explicitamente no texto base.

# Roadmap com recursos do Centelha

A evolução planejada prioriza configuração completa por edital, abrangendo definição de critérios, pesos, escalas e rubricas por fase, enquanto a camada de multicliente e o isolamento por organização são estruturados para replicação. A consolidação do armazenamento em PostgreSQL, quando aplicável, deve ser acompanhada por práticas de segurança para dados em repouso. Relatórios gerenciais, evidências auditáveis e reforço da trilha de auditoria por padrão de eventos devem ampliar a sustentação das decisões, enquanto o endurecimento de segurança contempla revisão orientada à LGPD, rotação de segredos e monitoramento, com revisão de experiência de uso para operação responsiva em desktop e mobile.

# Time e governança

Diego atua como gestor de produto e responsável por validação com usuários e implantação, combinando governança do produto, definição e validação de requisitos, estratégia de implantação e condução de pilotos. O núcleo da equipe descrita inclui Catuxe Varjão de Santana Oliveira, Mestre em Ciência da Computação com especialização em Análise de Testes, que conduz práticas de engenharia e qualidade de software, com referência a MPS.BR e controles como HMAC e aderência a requisitos de LGPD, e Dulce Paloma Vidal Santos, advogada, que atua no eixo jurídico e de compliance, orientando adequação à LGPD e aderência dos processos seletivos à legislação. A trajetória profissional do proponente inclui 12 anos como Coordenador de Fiscalização no CREF-20, o que sustenta a ênfase em processos auditáveis, validação de requisitos e prestação de contas.

# Impacto esperado

A centralização do processo em um fluxo digital único tende a reduzir retrabalho, erros de consolidação e reenvios associados a planilhas, e-mails e trâmites físicos, o que pode contribuir para diminuição de consumo de papel e deslocamentos. A aplicação de minimização de dados, com HMAC para bloqueio de duplicidade sem CPF em claro e blind review durante a avaliação, aponta para redução de exposição indevida de dados pessoais e mitigação de risco de incidentes. A oferta de PDF com protocolo e hash SHA-256 verificável, combinada a comunicação padronizada por etapa, tende a aumentar previsibilidade para candidatos e a sustentar transparência institucional por meio de evidências.

# Pedido no contexto do Centelha

O objetivo no Centelha é transformar o núcleo já funcional em produto replicável e escalável, orientado por Segurança, Privacidade e Dados, com configuração por edital, reforço de controles e evidências auditáveis, relatórios e melhoria de experiência de uso, preservando o foco em integridade, rastreabilidade e conformidade ao longo do ciclo do edital.
