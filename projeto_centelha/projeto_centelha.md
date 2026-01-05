---
title: "Avalia+Tec (AVALIA+) - Submissão Fase 1 (Ideias Inovadoras) | Programa Centelha 3 Bahia"
author: "Diego (Idealizador e Gestor)"
date: "04 jan 2026"
lang: pt-BR
geometry: margin=2.5cm
fontsize: 12pt
---

# 1. Identificação da proposta

O projeto denomina-se Avalia+Tec (AVALIA+) e consiste em uma plataforma SaaS para inscrição, avaliação multicritério e consolidação auditável de resultados em processos seletivos. A proposta é orientada por princípios de segurança da informação e proteção de dados, com foco em integridade, rastreabilidade e conformidade com requisitos de privacidade ao longo de todo o ciclo do edital, de modo que o candidato tenha mais previsibilidade e acesso às evidências do próprio processo, enquanto a comunidade e as instituições possam sustentar transparência com base em registros verificáveis. O desenho parte de uma perspectiva de governança de dados em processos públicos e institucionais, na qual cada decisão relevante deve ser passível de demonstração e auditoria sem ampliar exposição indevida de dados pessoais. O título e a nomenclatura são mantidos estáveis conforme exigência do edital. O proponente é Diego, idealizador e gestor responsável pela governança do produto, definição e validação de requisitos com usuários, estratégia de implantação, condução de pilotos e estruturação da execução técnica.

Para fins de enquadramento do edital, a temática tecnológica principal é Segurança, Privacidade e Dados. Quanto ao setor econômico de aplicação, a inovação tem maior impacto nos setores de Educação, Administração Pública e Tecnologia da Informação e Telecomunicações.

# 2. Resumo executivo

Avalia+Tec organiza, em um fluxo único, as etapas críticas de um processo seletivo com banca, que abrangem inscrição, administração, avaliação por múltiplos avaliadores, consolidação por comissão, ranking e comunicação de resultados. A ideia central é reduzir risco operacional e risco de conformidade por meio de mecanismos verificáveis de integridade e trilhas de auditoria, de modo que decisões e resultados possam ser demonstrados e sustentados com evidências, ao mesmo tempo em que o candidato dispõe de comprovação verificável do que foi submetido e de comunicação padronizada por etapa.

A solução já conta com componentes implementados para registro de inscrição com geração de protocolo e hash verificável impresso no PDF, bloqueio de duplicidade por CPF via HMAC (evitando armazenamento do identificador em claro), validação de CPF, mecanismo de “blind review” para reduzir a exposição de dados identificadores nos campos do projeto e exportação em CSV para auditoria. O backend (Express) oferece painel administrativo protegido, autenticação, logs estruturados e trilhas de auditoria com identificador de requisição e histórico de alterações nos registros, com armazenamento em JSON e possibilidade de uso de PostgreSQL por configuração. O sistema opera com calendário por edital, com controle de prazos por fase e bloqueio de ações fora de janela, incluindo inscrição, avaliação, recursos e etapas opcionais. Há envio de e-mails transacionais (confirmações, resultados por etapa e decisões de recursos), o que padroniza a comunicação e reduz assimetrias de informação.

No âmbito do Centelha, o objetivo é evoluir o núcleo já funcional para um produto replicável e escalável com foco em Segurança, Privacidade e Dados, com configuração por edital, reforço de controles e evidências auditáveis, relatórios e melhoria de experiência de uso.

# 3. Problema

Nos processos seletivos educacionais e institucionais que dependem de banca avaliadora, a operação costuma se apoiar em planilhas, trocas de e-mail e consolidação manual de notas e documentos. Para organizações que executam editais com alta carga de trabalho em janelas curtas, isso se torna um gargalo recorrente, porque a conferência sucessiva e a reconciliação de versões consomem tempo, ampliam o risco de inconsistências por digitação e tornam frágil o vínculo entre a informação originalmente submetida e o resultado publicado. No ponto de vista do candidato, o mesmo arranjo reduz previsibilidade e aumenta assimetria de informação, já que comprovantes, prazos, decisões intermediárias e justificativas tendem a ficar distribuídos em mensagens, anexos e planilhas, o que eleva dúvidas, solicitações de suporte e disputas sobre o que foi efetivamente registrado.

O problema é agravado quando se observa segurança da informação e governança de dados em processos públicos e institucionais. Ativos sensíveis, incluindo dados pessoais, documentos e registros decisórios, acabam dispersos em múltiplos canais, com controles de acesso heterogêneos e baixa capacidade de auditoria. Esse cenário dificulta sustentar integridade, autenticidade e não repúdio dos registros e torna mais complexo atender exigências de proteção de dados, inclusive quando há necessidade de responder recursos e contestações com base em evidências verificáveis. Quando a trilha decisória não é plenamente rastreável, aumenta o risco de atrasos, retrabalho e desgaste institucional, além de ampliar a exposição de informações que deveriam ser minimizadas.

Observa-se oportunidade de mercado para um produto que trate a seleção como processo de governança e segurança de dados, e não como coleção de arquivos, especialmente em Educação e Administração Pública, nas quais transparência, rastreabilidade e conformidade são requisitos recorrentes e frequentemente sujeitos a escrutínio público. A lacuna não está apenas em digitalizar formulários, mas em sustentar coerência ao longo de todo o ciclo do edital, do envio à consolidação do ranking, com recursos e comunicação formal, preservando privacidade e reduzindo exposição indevida de dados pessoais. Ao reduzir retrabalho e minimizar erros de consolidação, a solução também contribui em dimensões socioambientais ao diminuir consumo de papel e deslocamentos associados a trâmites físicos.

# 3.1 Problema resumo

Processos seletivos com banca em instituições de ensino e órgãos públicos ainda dependem de planilhas, e-mails e consolidações manuais. Em janelas curtas, a conferência de versões, o somatório de notas e a aplicação de critérios aumentam o risco de erro, atrasos e contestações. Para o candidato, a falta de um registro único reduz previsibilidade, dificulta acompanhar prazos e torna opaca a justificativa de decisões intermediárias e de recursos. Do ponto de vista de segurança da informação e governança de dados públicos, documentos, dados pessoais e registros decisórios circulam por múltiplos canais, com controle de acesso heterogêneo e baixa capacidade de auditoria, o que amplia exposição indevida e fragiliza integridade, autenticidade e rastreabilidade. Há oportunidade para uma solução que una transparência verificável e minimização de dados, reduza retrabalho, padronize comunicação e diminua papel e deslocamentos associados a trâmites físicos e reforce a prestação de contas públicas.



# 4. Descrição do Produto/Solução
Avalia+Tec é uma plataforma SaaS para gestão completa de processos seletivos com banca. O Portal do Candidato reúne formulário web com validações e gera PDF com protocolo e hash (SHA-256) verificável, enquanto o Painel Administrativo acompanha inscrições, controla calendário por edital (prazos por fase) e gerencia recursos, e o Módulo de Avaliação registra avaliações multicritério por avaliador e consolida resultados e rankings. A proposta prioriza transparência ao participante por meio de comprovantes verificáveis e comunicação padronizada por etapa, ao mesmo tempo em que sustenta governança do processo para a organização executora.

A viabilidade técnica é suportada por evidências concretas, pois já existe um núcleo funcional (Node.js/Express + frontend) com fluxos implementados de inscrição, avaliação e recursos, geração de PDF com protocolo/hash, envio de e-mails transacionais e exportações para auditoria. O armazenamento já opera em JSON e pode evoluir para PostgreSQL conforme necessidade de volume e operação, preservando o mesmo fluxo de negócio.

Os diferenciais competitivos estão ancorados em Segurança, Privacidade e Dados, com trilha auditável apoiada por logs e histórico de alterações, minimização de dados sensíveis (HMAC para bloquear duplicidade por CPF sem armazenar o CPF em claro) e blind review para reduzir exposição de identificadores durante avaliação. No mercado, o foco são instituições de ensino e órgãos públicos com seleções recorrentes, e as alternativas mais comuns hoje são planilhas e formulários genéricos, que não oferecem, por padrão, integridade verificável e rastreabilidade de decisões.

# 4.1 Descrição resumida

Avalia+Tec é uma plataforma SaaS para processos seletivos com banca que integra portal do candidato, painel administrativo e módulo de avaliação. O candidato submete a inscrição e recebe PDF com protocolo e hash SHA-256 verificável, enquanto a comissão acompanha prazos, registra avaliações multicritério, julga recursos e consolida rankings. Para governança de dados, aplica trilha auditável com logs, usa HMAC para bloquear duplicidade por CPF sem armazenar CPF em claro e suporta blind review. A viabilidade técnica é demonstrada por núcleo executável em Node.js e frontend, com geração de PDF, e-mails transacionais e scripts de verificação dos fluxos. O armazenamento opera em JSON e pode usar PostgreSQL. A escalabilidade é suportada pela separação entre interface e API e pela configuração por edital. O mercado-alvo inclui instituições de ensino, órgãos públicos e programas de inovação. Concorrentes típicos são planilhas, formulários genéricos e sistemas legados pouco auditáveis.

# 5. Grau de inovação e aderência ao edital

O diferencial técnico decorre da presença simultânea de mecanismos verificáveis de integridade (protocolo e hash), mitigação de exposição de identificadores sensíveis (HMAC para bloquear duplicidade sem CPF em claro), trilhas de auditoria e logs estruturados que permitem rastrear alterações e decisões, além de calendário por edital com bloqueio de prazos, o que reduz risco de não conformidade. A proposta é aderente ao Centelha por partir de um núcleo já implementado e direcionar o investimento para transformá-lo em produto replicável, com foco explícito em Segurança, Privacidade e Dados.

# 5.1 Diferenciais da Solução

A Avalia+Tec se diferencia de planilhas, formulários genéricos, e sistemas legados ao tratar seleção como processo de governança de dados, com integridade verificável e rastreabilidade desde a inscrição até o resultado. O candidato recebe PDF com protocolo e hash SHA-256 verificável, que reduz disputas sobre versões. A solução minimiza dados sensíveis ao bloquear duplicidade por CPF via HMAC sem armazenar CPF em claro e aplica blind review para reduzir exposição de identificadores. Para auditoria e prestação de contas, registra logs estruturados, identificador de requisição e histórico de alterações, além de controle de prazos por fase do edital. A pesquisa de similares indica plataformas de submissão e avaliação como Submittable e OpenWater, soluções de gestão de aplicações e revisão como SurveyMonkey Apply e sistemas acadêmicos de submissão e revisão como EasyChair. A validação esta ocorrendo na UEFS com piloto. Até o momento não há patente ou registro associado.

# 6. Mercado e clientes

O mercado-alvo inclui universidades, institutos federais, fundações de amparo, incubadoras e programas de inovação, bem como órgãos e unidades da Administração Pública que conduzem chamadas públicas, seleções e processos de avaliação com necessidade de prestação de contas. Essas organizações enfrentam recorrência de editais, restrição de equipe operacional e exigência de transparência, rastreabilidade e conformidade. A oportunidade está na oferta de um produto com implantação rápida, configuração por edital e suporte a auditoria e governança de dados.

# 7. Maturidade técnica e validação

O backend (Express), com repositórios em JSON e opção de PostgreSQL, já processa inscrições, avaliações e recursos. O portal do candidato gera PDF com protocolo e hash, bloqueia duplicidade por CPF e aplica validações de blind review. O painel administrativo utiliza segredo persistido e autenticação, com rate limit, logs de segurança e trilha de auditoria ativa. Esse conjunto reduz risco de execução, por demonstrar capacidade funcional anterior ao financiamento.

# 8. Plano de desenvolvimento com recursos do Centelha

O plano prioriza configuração completa por edital, incluindo definição de critérios, pesos, escalas e rubricas por fase. Em paralelo, será estruturada camada de multicliente (isolamento por organização) e consolidação do armazenamento em PostgreSQL quando aplicável, com práticas de segurança para dados em repouso. Serão ampliados relatórios gerenciais, exportações e evidências auditáveis, além de melhorias na trilha de auditoria (padrão de eventos e histórico). O endurecimento de segurança contemplará revisão LGPD (minimização, consentimento quando pertinente, controle de acesso e políticas de retenção), rotação de segredos e monitoramento. A experiência de uso será revisada para operação responsiva em desktop e mobile. Integrações de integridade poderão evoluir para processamento assíncrono e definição de limiares, conforme exigência do edital. Sempre que o documento citar um método cuja configuração não esteja descrita, inserir [ALERTA DE RESGATE] solicitando detalhamento.

# 9. Modelo de negócio e captação

O modelo prevê assinatura SaaS por edital (ciclo) ou assinatura anual para organizações com múltiplas seleções, com variação por volume de inscrições e número de avaliadores. A implantação inclui configuração do calendário e critérios do edital, orientação de uso e suporte durante o ciclo. A estratégia de captação prioriza instituições com recorrência de editais e demanda por rastreabilidade e transparência.

# 10. Equipe e governança

Diego atua como gestor de produto e responsável por validação com usuários e implantação. A equipe a ser estruturada inclui desenvolvimento full-stack, apoio de DevOps para automação de deploy e monitoramento, UX para revisão responsiva e usabilidade, e consultoria jurídica para adequações de LGPD e conformidade com editais. A governança seguirá ciclos curtos de entrega com validação contínua e registros de decisão.

# 11. Impacto esperado

A solução contribui para o desafio socioambiental ao substituir a operação fragmentada de seleções, baseada em planilhas, e-mails e trâmites físicos, por um fluxo digital único com integridade verificável e rastreabilidade. Ao centralizar inscrição, avaliação multicritério, consolidação e recursos com controle de prazos por fase e comunicação padronizada, reduz retrabalho, erros de consolidação e reenvios, o que tende a diminuir consumo de papel e deslocamentos. A aplicação de minimização de dados, com HMAC para bloquear duplicidade sem manter CPF em claro e blind review durante a avaliação, reduz exposição indevida de dados pessoais e risco de incidentes. Beneficia candidatos, ao oferecer protocolo e hash SHA-256 verificável no PDF e maior previsibilidade, avaliadores e comissões, ao padronizar critérios e fornecer trilha de auditoria, e instituições executoras, ao reduzir risco operacional e fortalecer prestação de contas.

# 12. Por que você e sua equipe são as pessoas certas para o desenvolvimento do negócio?


# 12.1 Equipe resumo

Reunimos capacidade de gestão, rigor técnico e segurança jurídica para transformar o Avalia+Tec em um produto escalável e confiável para o mercado institucional. Luiz Diego Vidal Santos, proponente e Doutor em Propriedade Intelectual e Inovação, agrega visão de negócio e governança, apoiadas por 12 anos como Coordenador de Fiscalização no CREF-20, experiência que sustenta processos auditáveis, validação de requisitos e estratégia de comercialização. Catuxe Varjão de Santana Oliveira, Mestre em Ciência da Computação com especialização em Análise de Testes, conduz excelência de engenharia e qualidade de software, com práticas associadas ao MPS.BR e controles de segurança como HMAC e conformidade com LGPD, elevando rastreabilidade e confiabilidade. Dulce Paloma Vidal Santos, advogada, atua no eixo jurídico e de compliance, orientando adequação à LGPD e aderência dos processos seletivos à legislação, mitigando riscos e reforçando credibilidade perante clientes institucionais com validação.


Nossa equipe é a combinação ideal de Capacidade de Gestão, Rigor Técnico e Segurança Jurídica, elementos cruciais para transformar o Avalia+Tec em um produto escalável e confiável, especialmente para o mercado institucional.

1. Liderança e Visão de Negócio (Luiz Diego Vidal Santos): O proponente, Doutor em Propriedade Intelectual e Inovação, traz a capacidade de gestão e mercadológica exigida pelo edital. Sua experiência de 12 anos como Coordenador de Fiscalização no CREF-20 garante o rigor em processos auditáveis e a liderança necessária para a governança do produto, validação de requisitos e estratégia de comercialização.

2. Excelência Técnica e Qualidade de Software (Catuxe Varjão de Santana Oliveira): Com Mestrado em Ciência da Computação e especialização em Análise de Testes, Catuxe é a garantia da capacidade técnica do projeto. Sua expertise em Engenharia de Software, Qualidade (MPS.BR) e segurança (HMAC, LGPD) assegura que o Avalia+Tec será robusto, livre de falhas e capaz de entregar a rastreabilidade e a confiabilidade prometidas.

3. Segurança Jurídica e Compliance (Dulce Paloma Vidal Santos): A Advogada Dulce Paloma, especialista em Direito, é fundamental para a segurança jurídica do negócio. Ela garante a total adequação à LGPD e a conformidade dos processos seletivos com a legislação, mitigando riscos e fortalecendo a credibilidade da plataforma perante clientes institucionais que exigem alto rigor legal.

Em resumo, somos uma equipe multidisciplinar e complementar. Enquanto a liderança define a estratégia de mercado e garante a governança, a técnica constrói o produto com excelência e o jurídico blinda o negócio, formando um tripé sólido para o sucesso do Avalia+Tec.

