# Apresentação Tema 5 - Gestão de Projetos de Inovação com Foco em PI

## 📊 Visão Geral

Apresentação completa sobre **Gestão de Projetos de Inovação com Foco em Propriedade Intelectual**, desenvolvida em Quarto Revealjs seguindo o estilo do projeto [emitanaka/talks](https://github.com/emitanaka/talks).

## 📁 Estrutura de Arquivos

```
Tema 05 - Gestao de Projetos inovacao/
├── tema05_apresentacao.qmd      # Arquivo fonte Quarto
├── tema05_apresentacao.html     # Apresentação renderizada
├── assets/
│   ├── ufs.scss                 # Estilos SCSS (cores UFS)
│   └── custom.css               # Estilos customizados
├── Figuras/                     # Imagens PNG
│   ├── capacidade_absortiva.png
│   ├── dynamic_capabilities.png
│   ├── technology_readiness_levels.png
│   ├── stage_gate_*.png
│   └── ...
└── Fluxogramas/                 # Diagramas Mermaid
    ├── gestao_pi_56005.mmd
    ├── stage_gate_process_complet.mmd
    ├── capacidade_absortiva.mmd
    ├── capacidade_dinamica.mmd
    ├── graph patent desenvolvement.mmd
    └── timeline.mmd
```

## 🎨 Características

### Visuais
- ✅ Identidade visual UFS (verde #00703C)
- ✅ Layout responsivo 1280x720
- ✅ Transições suaves (slide/fade)
- ✅ Numeração de slides
- ✅ Controles de navegação

### Conteúdo
- ✅ **65+ slides** organizados em 12 seções
- ✅ **10 diagramas Mermaid** integrados
- ✅ **10 figuras PNG** de alta qualidade
- ✅ **Animações progressivas** com fragments
- ✅ **Layouts em colunas** para comparações
- ✅ **Boxes informativos** para destaque

## 📑 Estrutura da Apresentação

### 1. Introdução
- Visão geral e objetivos
- Contexto da PI na economia do conhecimento

### 2. Evolução Histórica
- Timeline dos modelos de inovação (1940-presente)
- Modelos lineares → interativos → abertos → padronizados

### 3. ISO 56005
- Estrutura completa (3 níveis)
- Elementos de gestão, estratégia e processos
- Integração com Manual de Oslo

### 4. Manual de Oslo
- 7 categorias de atividades de inovação
- Verificações de PI por categoria
- Alinhamento ISO + OCDE

### 5. Technology Readiness Level (TRL)
- Sincronização TRL-PI (níveis 1-9)
- Estratégias de proteção por estágio
- Figuras ilustrativas

### 6. Modelo Stage-Gate
- Processo completo com gates decisórios
- Integração Stage-Gate + TRL + Patentes
- Harmonização com ISO 56005

### 7. Indicadores de Desempenho
- Framework completo (Input/Processo/Output/Impacto)
- Alinhamento TRL + Stage-Gate + Indicadores
- Mensuração e decisão estratégica

### 8. Capacidades Organizacionais
- Capacidade Absortiva (Cohen & Levinthal)
- Capacidades Dinâmicas (Teece)
- Cultura de PI

### 9. Colaboração e PI
- Gestão em projetos colaborativos
- Instrumentos contratuais
- Cooperação (478 ocorrências no Manual)

### 10. Obstáculos à Inovação
- 4 dimensões (Manual de Oslo)
- Estratégias de mitigação
- Resiliência do SGPI

### 11. Marco Regulatório
- Ferramentas analíticas
- Legislação brasileira aplicável
- Rastreabilidade e transparência

### 12. Conclusão
- Síntese da integração PI-Inovação
- Transformação estratégica
- Referências completas

## 🔧 Como Usar

### Visualizar
1. Abra `tema05_apresentacao.html` em qualquer navegador
2. Use as setas do teclado para navegar (← →)
3. Pressione `ESC` para visão geral (overview)
4. Pressione `S` para modo apresentador (speaker notes)

### Editar e Renderizar
```bash
# Edite o arquivo .qmd
code tema05_apresentacao.qmd

# Renderize para HTML
quarto render tema05_apresentacao.qmd

# Ou use preview em tempo real
quarto preview tema05_apresentacao.qmd
```

## 🎯 Diagramas Integrados

### Diagramas Mermaid Utilizados
1. **Timeline** - Evolução dos modelos de inovação (1940-presente)
2. **Flowchart** - Estrutura completa ISO 56005 (3 níveis)
3. **Graph** - Stage-Gate com gates decisórios (Go/Kill/Hold)
4. **Flowchart** - Stage-Gate + TRL + Desenvolvimento de Patentes
5. **Flowchart** - Framework de indicadores integrado
6. **Flowchart** - Modelo de Capacidade Absortiva
7. **Flowchart** - Modelo de Capacidades Dinâmicas
8. **Graph** - 4 dimensões de obstáculos
9. **Graph** - Ciclo estratégico de PI
10. **Flowchart** - Integração processo de inovação

### Figuras PNG
- Capacidade absortiva (diagrama)
- Dynamic capabilities (diagrama)
- Technology Readiness Levels (TRL 1-9)
- Stage-Gate process (várias fases)
- Innovation project management
- Patent development flow

## 🎨 Customização de Estilos

### Cores UFS
- **Verde principal**: #00703C
- **Verde claro**: #4CAF50
- **Azul**: #0066CC, #2196F3
- **Laranja**: #FF9800, #FF8C00
- **Roxo**: #9C27B0

### Classes CSS Disponíveis
- `.box` - Caixa com borda verde
- `.info-box` - Caixa informativa com fundo verde claro
- `.highlight-box` - Destaque amarelo
- `.circle` - Números circulares
- `.section-header` - Cabeçalho de seção
- `.smaller-text` - Texto reduzido (0.8em)

## 📚 Referências

Baseado na redação do Tema 5 que inclui:
- OCDE/Eurostat - Manual de Oslo (3ª ed., 2005)
- ABNT NBR ISO 56005:2023
- Cooper (1990, 2008) - Stage-Gate
- Chesbrough (2003) - Inovação Aberta
- Cohen & Levinthal (1990) - Capacidade Absortiva
- Teece (2007) - Capacidades Dinâmicas
- Mankins (1995) - TRL
- Legislação brasileira (Leis 9.279/96, 10.973/04)

## 🔗 Links

- **Projeto de referência**: [emitanaka/talks](https://github.com/emitanaka/talks)
- **Quarto Revealjs**: [https://quarto.org/docs/presentations/revealjs/](https://quarto.org/docs/presentations/revealjs/)
- **Mermaid Diagrams**: [https://mermaid.js.org/](https://mermaid.js.org/)

## 📝 Notas

- Todos os diagramas Mermaid foram otimizados para visualização em slides
- As cores seguem a identidade visual da UFS
- Os fragmentos permitem revelação progressiva do conteúdo
- A apresentação é totalmente navegável por teclado
- Compatível com modo apresentador (duas telas)

---

**Desenvolvido para**: Concurso UFS - Tema 5  
**Data**: Novembro 2025  
**Formato**: Quarto Revealjs HTML
