function updateCounter(element, maxLimit) {
    const currentLength = element.value.length;
    const remaining = maxLimit - currentLength;
    const counterId = element.id + '-counter';
    const counterElement = document.getElementById(counterId);
    
    if (counterElement) {
        counterElement.textContent = remaining;
        if (remaining < 0) {
            counterElement.style.color = 'red';
        } else {
            counterElement.style.color = '#003366';
        }
    }
}

function generateRegistrationNumber() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `2025-AVALIA-${timestamp}-${random}`;
}

function formatCPF(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 9);
    const p4 = digits.slice(9, 11);
    let out = p1;
    if (p2) out += `.${p2}`;
    if (p3) out += `.${p3}`;
    if (p4) out += `-${p4}`;
    return out;
}

function isValidCPF(raw) {
    const cpf = String(raw || '').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // 000... 111... etc.
    if (cpf === '01234567890' || cpf === '12345678909') return false;

    const digits = cpf.split('').map(Number);
    const calcDV = (baseLen) => {
        let sum = 0;
        for (let i = 0; i < baseLen; i++) {
            sum += digits[i] * ((baseLen + 1) - i);
        }
        const mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
    };

    const dv1 = calcDV(9);
    const dv2 = calcDV(10);
    return dv1 === digits[9] && dv2 === digits[10];
}

function setFeedback(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('error', Boolean(message));
}

function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function ensureFieldFeedbackElement(inputEl) {
    if (!inputEl || !inputEl.id) return null;
    const feedbackId = inputEl.id + '-feedback';
    let fb = document.getElementById(feedbackId);
    if (fb) return fb;

    fb = document.createElement('div');
    fb.id = feedbackId;
    fb.className = 'field-feedback';
    fb.setAttribute('aria-live', 'polite');
    fb.dataset.generated = '1';

    // Insere logo após o input/select/textarea
    inputEl.insertAdjacentElement('afterend', fb);
    return fb;
}

function clearGeneratedFeedback(scopeEl) {
    const scope = scopeEl || document;
    const els = scope.querySelectorAll('.field-feedback[data-generated="1"]');
    els.forEach((el) => {
        el.textContent = '';
        el.classList.remove('error');
    });
}

function setFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.setAttribute('aria-invalid', 'true');
    const fb = ensureFieldFeedbackElement(inputEl);
    if (fb) {
        fb.textContent = message || '';
        fb.classList.toggle('error', Boolean(message));
    }
}

function clearFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.removeAttribute('aria-invalid');
    const fbId = inputEl.id ? (inputEl.id + '-feedback') : '';
    const fb = fbId ? document.getElementById(fbId) : null;
    if (fb && fb.dataset.generated === '1') {
        fb.textContent = '';
        fb.classList.remove('error');
    }
}

function focusAndScroll(inputEl) {
    try {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
        // ignore
    }
}

function setFormErrorSummary(messages, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let box = document.getElementById('form-error-summary');
    if (!box) {
        box = document.createElement('div');
        box.id = 'form-error-summary';
        box.setAttribute('role', 'alert');
        box.style.margin = '10px 0';
        box.style.padding = '10px';
        box.style.border = '1px solid #b71c1c';
        box.style.backgroundColor = '#FFEBEE';
        box.style.color = '#b71c1c';
        container.insertBefore(box, container.firstChild);
    }

    if (!messages || messages.length === 0) {
        box.textContent = '';
        box.style.display = 'none';
        return;
    }

    box.style.display = 'block';
    box.innerHTML = '<strong>Verifique os campos obrigatórios:</strong><br>' + messages.map(m => escapeHtml(m)).join('<br>');
}

function validateInscricaoFormHuman() {
    const container = document.getElementById('form-content');
    if (!container) return true;

    clearGeneratedFeedback(container);
    setFormErrorSummary([], 'form-content');

    const errors = [];
    const firstError = { el: null };

    const requireText = (id, message) => {
        const el = document.getElementById(id);
        if (!el) return;
        clearFieldError(el);
        const v = String(el.value || '').trim();
        if (!v) {
            const msg = message || 'Campo obrigatório.';
            setFieldError(el, msg);
            errors.push(msg);
            if (!firstError.el) firstError.el = el;
        }
    };

    // Campos obrigatórios (inscrição)
    requireText('nome', 'Informe seu nome completo.');
    requireText('data_nascimento', 'Informe sua data de nascimento.');
    requireText('cpf', 'Informe seu CPF.');
    requireText('rg', 'Informe seu RG.');
    requireText('orgao_expedidor', 'Informe o órgão expedidor do RG.');
    requireText('data_expedicao', 'Informe a data de expedição do RG.');
    requireText('endereco', 'Informe seu endereço completo.');
    requireText('cidade_estado', 'Informe cidade/estado.');
    requireText('cep', 'Informe o CEP.');
    requireText('celular', 'Informe um celular com DDD.');
    requireText('email', 'Informe seu e-mail.');
    requireText('curso_graduacao', 'Informe seu curso de graduação.');
    requireText('instituicao', 'Informe sua instituição.');
    requireText('ano_conclusao', 'Informe o ano de conclusão (4 dígitos).');

    // Projeto (mínimo essencial)
    requireText('titulo_pt', 'Informe o título do projeto.');

    // Validações de formato
    const cpfEl = document.getElementById('cpf');
    if (cpfEl && String(cpfEl.value || '').trim()) {
        if (!isValidCPF(cpfEl.value)) {
            setFeedback('cpf-feedback', 'CPF inválido.');
            errors.push('CPF inválido.');
            if (!firstError.el) firstError.el = cpfEl;
        } else {
            setFeedback('cpf-feedback', '');
        }
    }

    const cepEl = document.getElementById('cep');
    if (cepEl && String(cepEl.value || '').trim()) {
        const digits = normalizeDigits(cepEl.value);
        if (digits.length !== 8) {
            const msg = 'CEP inválido (digite 8 números).';
            setFieldError(cepEl, msg);
            errors.push(msg);
            if (!firstError.el) firstError.el = cepEl;
        }
    }

    const celEl = document.getElementById('celular');
    if (celEl && String(celEl.value || '').trim()) {
        const digits = normalizeDigits(celEl.value);
        if (!(digits.length === 10 || digits.length === 11)) {
            const msg = 'Celular inválido (use DDD + número).';
            setFieldError(celEl, msg);
            errors.push(msg);
            if (!firstError.el) firstError.el = celEl;
        }
    }

    const emailEl = document.getElementById('email');
    if (emailEl && String(emailEl.value || '').trim()) {
        if (typeof emailEl.checkValidity === 'function' && !emailEl.checkValidity()) {
            const msg = 'E-mail inválido.';
            setFieldError(emailEl, msg);
            errors.push(msg);
            if (!firstError.el) firstError.el = emailEl;
        }
    }

    const anoEl = document.getElementById('ano_conclusao');
    if (anoEl && String(anoEl.value || '').trim()) {
        const v = String(anoEl.value || '').trim();
        if (!/^\d{4}$/.test(v)) {
            const msg = 'Ano de conclusão inválido (use 4 dígitos).';
            setFieldError(anoEl, msg);
            errors.push(msg);
            if (!firstError.el) firstError.el = anoEl;
        }
    }

    // Área / linha de pesquisa
    const areaSel = document.getElementById('area');
    if (!areaSel || !String(areaSel.value || '').trim()) {
        updateAreaFeedback();
        errors.push('Selecione uma linha de pesquisa.');
        if (!firstError.el && areaSel) firstError.el = areaSel;
    } else {
        updateAreaFeedback();
    }

    // Termo
    const termo = document.getElementById('termo_compromisso');
    if (!termo?.checked) {
        updateTermoFeedback();
        errors.push('Marque a declaração de compromisso.');
        if (!firstError.el && termo) firstError.el = termo;
    } else {
        updateTermoFeedback();
    }

    if (errors.length > 0) {
        setFormErrorSummary(errors.slice(0, 8), 'form-content');
        if (firstError.el) focusAndScroll(firstError.el);
        return false;
    }

    setFormErrorSummary([], 'form-content');
    return true;
}

async function askAppealConfirmation(data) {
    const box = document.getElementById('appeal-review-box');
    const btnCancel = document.getElementById('appeal-review-cancel');
    const btnConfirm = document.getElementById('appeal-review-confirm');

    if (!box || !btnCancel || !btnConfirm) {
        const lines = [
            `Protocolo: ${String(data?.protocolo_inscricao || '').trim()}`,
            `Nome: ${String(data?.nome || '').trim()}`,
            `CPF: ${String(data?.cpf || '').trim()}`,
            `E-mail: ${String(data?.email || '').trim()}`,
            `Etapa: ${String(data?.etapa_processo || '').trim()}`,
        ].join('\n');
        return confirm('Revisão final do recurso:\n\n' + lines + '\n\nConfirmar envio?');
    }

    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v || '');
    };

    set('appeal-review-protocolo', data?.protocolo_inscricao);
    set('appeal-review-nome', data?.nome);
    set('appeal-review-cpf', data?.cpf);
    set('appeal-review-email', data?.email);
    set('appeal-review-titulo', data?.titulo_projeto);
    set('appeal-review-etapa', data?.etapa_processo);

    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return new Promise((resolve) => {
        // Clean up previous listeners by cloning
        const newCancel = btnCancel.cloneNode(true);
        const newConfirm = btnConfirm.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

        newCancel.addEventListener('click', (e) => {
            e.preventDefault();
            box.style.display = 'none';
            resolve(false);
        });

        newConfirm.addEventListener('click', (e) => {
            e.preventDefault();
            box.style.display = 'none';
            resolve(true);
        });
    });
}

function validateAppealFormHuman(data) {
    // Limpa feedbacks gerados na página inteira
    clearGeneratedFeedback(document);

    const required = [
        ['protocolo_inscricao', 'Informe o protocolo de inscrição.'],
        ['nome', 'Informe seu nome completo.'],
        ['cpf', 'Informe seu CPF.'],
        ['email', 'Informe seu e-mail.'],
        ['titulo_projeto', 'Informe o título do projeto.'],
        ['linha_pesquisa', 'Selecione a linha de pesquisa.'],
        ['etapa_processo', 'Selecione a etapa do processo.'],
        ['decisao_contestacao', 'Descreva a decisão/objeto da contestação.'],
        ['argumentacao', 'Informe sua argumentação.'],
    ];

    let first = null;
    const msgs = [];

    required.forEach(([id, msg]) => {
        const el = document.getElementById(id);
        if (!el) return;
        clearFieldError(el);
        const v = String(el.value || '').trim();
        if (!v) {
            setFieldError(el, msg);
            msgs.push(msg);
            if (!first) first = el;
        }
    });

    const cpfEl = document.getElementById('cpf');
    if (cpfEl && String(cpfEl.value || '').trim() && !isValidCPF(cpfEl.value)) {
        const msg = 'CPF inválido.';
        setFieldError(cpfEl, msg);
        msgs.push(msg);
        if (!first) first = cpfEl;
    }

    const emailEl = document.getElementById('email');
    if (emailEl && String(emailEl.value || '').trim()) {
        if (typeof emailEl.checkValidity === 'function' && !emailEl.checkValidity()) {
            const msg = 'E-mail inválido.';
            setFieldError(emailEl, msg);
            msgs.push(msg);
            if (!first) first = emailEl;
        }
    }

    if (msgs.length > 0) {
        if (first) focusAndScroll(first);
        return false;
    }

    return true;
}

function updateCpfFeedback() {
    const cpfInput = document.getElementById('cpf');
    if (!cpfInput) return;
    const digits = cpfInput.value.replace(/\D/g, '');

    if (!digits) {
        setFeedback('cpf-feedback', '');
        return;
    }

    if (digits.length < 11) {
        setFeedback('cpf-feedback', 'CPF incompleto (digite 11 dígitos).');
        return;
    }

    if (!isValidCPF(cpfInput.value)) {
        setFeedback('cpf-feedback', 'CPF inválido.');
        return;
    }

    setFeedback('cpf-feedback', '');
}

function updateTermoFeedback() {
    const termo = document.getElementById('termo_compromisso');
    if (!termo) return;
    setFeedback('termo-feedback', termo.checked ? '' : 'Obrigatório marcar a declaração para gerar o PDF.');
}

const FORM_VERSION = '2025-12-15';

// Máscaras e validações auxiliares
function formatCEP(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
    const p1 = digits.slice(0, 5);
    const p2 = digits.slice(5, 8);
    return p2 ? `${p1}-${p2}` : p1;
}

function formatPhoneBR(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    const ddd = digits.slice(0, 2);
    const p1 = digits.length > 10 ? digits.slice(2, 7) : digits.slice(2, 6);
    const p2 = digits.length > 10 ? digits.slice(7, 11) : digits.slice(6, 10);
    if (p1 && p2) return `(${ddd}) ${p1}-${p2}`;
    if (ddd && p1) return `(${ddd}) ${p1}`;
    return ddd;
}

function updateAreaFeedback() {
    const area = document.getElementById('area');
    if (!area) return;
    const val = String(area.value || '').trim();
    setFeedback('area-feedback', val ? '' : 'Selecione uma linha de pesquisa.');
}

function updateVagaReservadaAviso() {
    const aviso = document.getElementById('vaga-reservada-aviso');
    if (!aviso) return;

    const itensEl = document.getElementById('vaga-reservada-aviso-itens');

    const vagaReservada = document.querySelector('input[name="vaga_reservada"]:checked')?.value || '';
    const algumaCotaMarcada = document.querySelectorAll('input[name="cotas"]:checked').length > 0;

    const show = (vagaReservada === 'Sim') || algumaCotaMarcada;
    aviso.style.display = show ? 'block' : 'none';

    if (!itensEl) return;
    if (!show) {
        itensEl.innerHTML = '';
        return;
    }

    const vinculo = document.querySelector('input[name="vinculo_empregaticio"]:checked')?.value || '';
    const isChecked = (id) => Boolean(document.getElementById(id)?.checked);

    const anexos = [];

    // Anexo IV: usuário pediu para lembrar no fluxo de vaga reservada
    anexos.push('ANEXO IV – ANTEPROJETO DE TRABALHO DE CONCLUSÃO DE CURSO (TCC) SEM IDENTIFICAÇÃO');

    // Anexo III: quando houver vínculo empregatício
    if (vinculo === 'Sim') {
        anexos.push('ANEXO III – DECLARAÇÃO DE LIBERAÇÃO PELO EMPREGADOR');
    }

    // Cotas específicas
    if (isChecked('cotas_negro')) {
        anexos.push('ANEXO V – AUTODECLARAÇÃO PARA HETEREOIDENTIFICAÇÃO');
        anexos.push('ANEXO VI – AUTODECLARAÇÃO DE PERTENCIMENTO SOCIAL');
    }
    if (isChecked('cotas_indigena')) {
        anexos.push('ANEXO VII – DOCUMENTO COMPROBATÓRIO DE PERTENCIMENTO A INDÍGENA');
    }
    if (isChecked('cotas_quilombola')) {
        anexos.push('ANEXO VIII – DOCUMENTO COMPROBATÓRIO DE PERTENCIMENTO À COMUNIDADE QUILOMBOLA');
    }
    if (isChecked('cotas_cigano')) {
        anexos.push('ANEXO IX – DOCUMENTO COMPROBATÓRIO DE PERTENCIMENTO A COMUNIDADE CIGANA');
    }
    if (isChecked('cotas_trans')) {
        anexos.push('ANEXO X – AUTODECLARAÇÃO DE IDENTIDADE TRANS: TRAVESTI, TRANSEXUAL OU TRANSGÊNERO');
        anexos.push('ANEXO XI – DECLARAÇÃO DE ANUÊNCIA EXPEDIDA POR CONSELHO ESTADUAL DOS DIREITOS DA POPULAÇÃO LGBT');
    }
    if (isChecked('cotas_pcd')) {
        anexos.push('ANEXO XII – LAUDO CARACTERIZADOR DE DEFICIÊNCIA');
    }

    // Remove duplicados e renderiza
    const unique = Array.from(new Set(anexos));
    itensEl.innerHTML = '<ul style="margin:0; padding-left:18px;">' + unique.map(a => `<li>${escapeHtml(a)}</li>`).join('') + '</ul>';
}

function getAnexosCondicionantesFromDom() {
    const vinculo = document.querySelector('input[name="vinculo_empregaticio"]:checked')?.value || '';
    const isChecked = (id) => Boolean(document.getElementById(id)?.checked);

    const anexos = [];

    // Anexo IV: anteprojeto sem identificação (sempre exigido)
    anexos.push('ANEXO IV – ANTEPROJETO DE TRABALHO DE CONCLUSÃO DE CURSO (TCC) SEM IDENTIFICAÇÃO');

    // Anexo III: quando houver vínculo empregatício
    if (vinculo === 'Sim') {
        anexos.push('ANEXO III – DECLARAÇÃO DE LIBERAÇÃO PELO EMPREGADOR');
    }

    // Cotas específicas
    if (isChecked('cotas_negro')) {
        anexos.push('ANEXO V – AUTODECLARAÇÃO PARA HETEREOIDENTIFICAÇÃO');
        anexos.push('ANEXO VI – AUTODECLARAÇÃO DE PERTENCIMENTO SOCIAL');
    }
    if (isChecked('cotas_indigena')) {
        anexos.push('ANEXO VII – DOCUMENTO COMPROBATÓRIO DE PERTENCIMENTO A INDÍGENA');
    }
    if (isChecked('cotas_quilombola')) {
        anexos.push('ANEXO VIII – DOCUMENTO COMPROBATÓRIO DE PERTENCIMENTO À COMUNIDADE QUILOMBOLA');
    }
    if (isChecked('cotas_cigano')) {
        anexos.push('ANEXO IX – DOCUMENTO COMPROBATÓRIO DE PERTENCIMENTO A COMUNIDADE CIGANA');
    }
    if (isChecked('cotas_trans')) {
        anexos.push('ANEXO X – AUTODECLARAÇÃO DE IDENTIDADE TRANS: TRAVESTI, TRANSEXUAL OU TRANSGÊNERO');
        anexos.push('ANEXO XI – DECLARAÇÃO DE ANUÊNCIA EXPEDIDA POR CONSELHO ESTADUAL DOS DIREITOS DA POPULAÇÃO LGBT');
    }
    if (isChecked('cotas_pcd')) {
        anexos.push('ANEXO XII – LAUDO CARACTERIZADOR DE DEFICIÊNCIA');
    }

    return Array.from(new Set(anexos));
}

function detectPersonalInfoInProject(text) {
    const t = String(text || '');
    if (!t.trim()) return false;
    const cpfLike = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
    const emailLike = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const phoneLike = /\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/;
    return cpfLike.test(t) || emailLike.test(t) || phoneLike.test(t);
}

async function registerSubmissionOnServer(payload) {
    const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            form_version: FORM_VERSION,
            website: document.getElementById('website')?.value || ''
        })
    });

    let body;
    try { body = await res.json(); } catch { body = null; }

    if (!res.ok) {
        const msg = body?.error ? String(body.error) : 'Falha ao registrar inscrição no servidor.';
        throw new Error(msg);
    }

    return body;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value ?? '');
}

function showSubmissionSuccess(serverReceipt, formData) {
    console.log('showSubmissionSuccess chamado:', { serverReceipt, formData });
    
    const formContent = document.getElementById('form-content');
    const actionsBar = document.querySelector('.actions-bar');
    const successContent = document.getElementById('success-content');

    if (!successContent) return;

    if (formContent) formContent.style.display = 'none';
    if (actionsBar) actionsBar.style.display = 'none';
    successContent.style.display = 'block';

    const protocol = serverReceipt?.protocol || '';
    const hash = serverReceipt?.hash || '';
    const createdAt = serverReceipt?.createdAt || formData?.data_registro || '';

    setText('success-protocol', protocol);
    setText('success-hash', hash);
    setText('success-created-at', createdAt ? new Date(createdAt).toLocaleString('pt-BR') : '');

    // Resumo do que foi enviado
    setText('success-summary-nome', formData?.nome || '');
    setText('success-summary-email', formData?.email || '');
    setText('success-summary-cpf', formData?.cpf || '');
    setText('success-summary-titulo', formData?.titulo_pt || '');
    setText('success-summary-area', formData?.area || '');

    // Aviso de anexos obrigatórios para validação (condicional)
    const anexosPanel = document.getElementById('success-anexos-panel');
    const anexosItens = document.getElementById('success-anexos-itens');

    if (anexosPanel && anexosItens) {
        const cotasStr = String(formData?.cotas || '').trim();
        const show = (String(formData?.vaga_reservada || '') === 'Sim') || (cotasStr.length > 0) || (String(formData?.vinculo_empregaticio || '') === 'Sim');

        if (!show) {
            anexosPanel.style.display = 'none';
            anexosItens.innerHTML = '';
        } else {
            const anexos = getAnexosCondicionantesFromDom();
            anexosPanel.style.display = anexos.length ? 'block' : 'none';
            anexosItens.innerHTML = anexos.length
                ? ('<ul style="margin:0; padding-left:18px;">' + anexos.map(a => `<li>${escapeHtml(a)}</li>`).join('') + '</ul>')
                : '';
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function generateDraft() {
    console.log("Gerando rascunho...");
    const MAX_RESUMO = 1800;
    const MAX_OBJETIVO_GERAL = 200;
    const limitText = (value, maxLen) => String(value || '').slice(0, maxLen);

    // Helper functions for form data
    const getRadio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
    const getCheckboxes = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value).join(', ');

    const registrationNumber = "RASCUNHO - SEM VALIDADE";
    const hashVerificacao = "RASCUNHO - NÃO ENVIADO";
    const dataRegistro = new Date().toISOString();

    // Coletar todos os dados do formulário
    const formData = {
        inscricao: registrationNumber,
        hash_verificacao: hashVerificacao,
        data_registro: dataRegistro,
        // Ficha de Inscrição
        nome: document.getElementById('nome').value || '[NOME]',
        nome_social: document.getElementById('nome_social').value,
        data_nascimento: document.getElementById('data_nascimento').value,
        cpf: document.getElementById('cpf').value || '000.000.000-00',
        rg: document.getElementById('rg').value,
        orgao_expedidor: document.getElementById('orgao_expedidor').value,
        data_expedicao: document.getElementById('data_expedicao').value,
        endereco: document.getElementById('endereco').value,
        cidade_estado: document.getElementById('cidade_estado').value,
        cep: document.getElementById('cep').value,
        celular: document.getElementById('celular').value,
        telefone_residencial: document.getElementById('telefone_residencial').value,
        email: document.getElementById('email').value,
        curso_graduacao: document.getElementById('curso_graduacao').value,
        instituicao: document.getElementById('instituicao').value,
        ano_conclusao: document.getElementById('ano_conclusao').value,
        vaga_institucional: getRadio('vaga_institucional'),
        vaga_cooperacao: getRadio('vaga_cooperacao'),
        vaga_reservada: getRadio('vaga_reservada'),
        cotas: getCheckboxes('cotas'),
        raca_cor: document.getElementById('raca_cor').value,
        lingua_estrangeira: getRadio('lingua_estrangeira'),
        vinculo_empregaticio: getRadio('vinculo_empregaticio'),
        carga_horaria: document.getElementById('carga_horaria').value,
        empresa_vinculo: document.getElementById('empresa_vinculo').value,

        // Projeto
        titulo_pt: document.getElementById('titulo_pt').value || '[TÍTULO]',
        titulo_en: document.getElementById('titulo_en').value,
        area: document.getElementById('area').value,
        palavras_pt: document.getElementById('palavras_pt').value,
        palavras_en: document.getElementById('palavras_en').value,
        resumo: limitText(document.getElementById('resumo').value, MAX_RESUMO),
        justificativa_enquadramento: document.getElementById('justificativa_enquadramento')?.value || '',
        introducao: document.getElementById('introducao')?.value || '',
        problema_pesquisa: document.getElementById('problema_pesquisa')?.value || '',
        justificativa_relevancia: document.getElementById('justificativa_relevancia')?.value || '',
        objetivo_geral: limitText(document.getElementById('objetivo_geral')?.value || '', MAX_OBJETIVO_GERAL),
        objetivos_especificos: document.getElementById('objetivos_especificos')?.value || '',
        revisao_literatura: document.getElementById('revisao_literatura')?.value || '',
        procedimentos_metodologicos: document.getElementById('procedimentos_metodologicos')?.value || '',
        cronograma: document.getElementById('cronograma')?.value || '',
        referencias: document.getElementById('referencias')?.value || ''
    };
    // Termo de Compromisso
    formData.termo_compromisso = document.getElementById('termo_compromisso')?.checked ? 'Concordo' : 'Não concordo';

    // Criar HTML para o PDF (Cópia simplificada do generatePDF)
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>RASCUNHO - AVALIA+</title>
            <link rel="stylesheet" href="/theme.css">
            <style>
                @page { size: A4; margin: 14mm; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body { width: 100%; margin: 0; padding: 0; }
                body {
                    font-family: Verdana, Arial, Helvetica, sans-serif;
                    font-size: 11px;
                    color: #000;
                    padding: 0;
                    line-height: 1.3;
                    background: #fff;
                    overflow-x: hidden;
                }
                .watermark {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 100px;
                    color: rgba(200, 0, 0, 0.2);
                    z-index: 9999;
                    pointer-events: none;
                    white-space: nowrap;
                    text-align: center;
                }
                .content { padding: 0 2mm; max-width: 100%; }
                .header-container {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    justify-content: space-between;
                    width: 100%;
                    max-width: 100%;
                    border-bottom: 2px solid #003366;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                    overflow: hidden;
                }
                .header-left { flex: 0 0 18%; max-width: 18%; }
                .header-left img { display: block; max-width: 100%; height: auto; max-height: 45px; }
                .header-center { flex: 1 1 auto; min-width: 0; text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; color: #003366; }
                .header-right { flex: 0 0 32%; max-width: 32%; min-width: 0; text-align: right; font-size: 10px; }
                
                /* Table Styles */
                table.ficha-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
                table.ficha-table td { border: 1px solid #003366; padding: 4px; vertical-align: top; word-wrap: break-word; background: #fff; }
                .label { display: block; font-weight: bold; margin-bottom: 3px; font-size: 10px; color: #003366; }
                .value { display: block; min-height: 15px; }

                /* Section Styles */
                .section { margin-bottom: 10px; border: 1px solid #86A3C2; padding: 10px; background-color: #F4F9FD; }
                .section-title { font-weight: bold; color: #003366; margin: -10px -10px 10px -10px; font-size: 11px; padding: 4px 10px; border-bottom: 1px solid #86A3C2; background: #d0e5f5; }
                .field { margin-bottom: 8px; }
                .field-label { font-weight: bold; color: #003366; font-size: 11px; margin-bottom: 2px; }
                .field-value { padding: 4px; background-color: #fff; border: 1px solid #7F9DB9; min-height: 18px; white-space: pre-wrap; word-wrap: break-word; font-size: 11px; }
                
                .page-break { display: block; height: 0; page-break-before: always; break-before: page; margin: 0; }
                @media print { 
                    .page-break { page-break-before: always; break-before: page; }
                    .section { break-inside: auto; }
                }
            </style>
        </head>
        <body>
            <div class="watermark">RASCUNHO<div>SEM VALIDADE</div></div>
            <div class="content">
            <!-- PÁGINA 1: FICHA DE INSCRIÇÃO -->
            <div class="page-1">
                <div class="header-container">
                    <div class="header-left"></div>
                    <div class="header-center">FICHA DE INSCRIÇÃO RASCUNHO (SEM VALIDADE)</div>
                    <div class="header-right">
                        <img src="/img/logo_avalia_quadrado.png" alt="AVALIA+ Logo" style="max-height:60px; margin-bottom:5px;">
                        <div><strong>Processo:</strong> ${registrationNumber}</div>
                        <div><strong>Registro:</strong> ${new Date(formData.data_registro).toLocaleString('pt-BR')}</div>
                        <div style="font-size:8px; word-break:break-all;"><strong>Hash:</strong> ${formData.hash_verificacao}</div>
                    </div>
                </div>

                <table class="ficha-table">
                    <tr><td colspan="4"><span class="label">Nome:</span><span class="value">${escapeHtml(formData.nome)}</span></td></tr>
                    <tr><td colspan="4"><span class="label">Nome Social:</span><span class="value">${escapeHtml(formData.nome_social)}</span></td></tr>
                    <tr>
                        <td colspan="2"><span class="label">Data de Nascimento:</span><span class="value">${escapeHtml(formData.data_nascimento)}</span></td>
                        <td colspan="2"><span class="label">CPF:</span><span class="value">${escapeHtml(formData.cpf)}</span></td>
                    </tr>
                    <tr>
                        <td><span class="label">RG:</span><span class="value">${escapeHtml(formData.rg)}</span></td>
                        <td><span class="label">Órgão:</span><span class="value">${escapeHtml(formData.orgao_expedidor)}</span></td>
                        <td colspan="2"><span class="label">Data Exp.:</span><span class="value">${escapeHtml(formData.data_expedicao)}</span></td>
                    </tr>
                    <tr><td colspan="4"><span class="label">Endereço:</span><span class="value">${escapeHtml(formData.endereco)}</span></td></tr>
                    <tr>
                        <td colspan="3"><span class="label">Cidade/Estado:</span><span class="value">${escapeHtml(formData.cidade_estado)}</span></td>
                        <td><span class="label">CEP:</span><span class="value">${escapeHtml(formData.cep)}</span></td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="label">Celular:</span><span class="value">${escapeHtml(formData.celular)}</span></td>
                        <td colspan="2"><span class="label">Residencial:</span><span class="value">${escapeHtml(formData.telefone_residencial)}</span></td>
                    </tr>
                    <tr><td colspan="4"><span class="label">E-mail:</span><span class="value">${escapeHtml(formData.email)}</span></td></tr>
                    <tr><td colspan="4"><span class="label">Curso:</span><span class="value">${escapeHtml(formData.curso_graduacao)}</span></td></tr>
                    <tr>
                        <td colspan="3"><span class="label">Instituição:</span><span class="value">${escapeHtml(formData.instituicao)}</span></td>
                        <td><span class="label">Ano:</span><span class="value">${escapeHtml(formData.ano_conclusao)}</span></td>
                    </tr>
                    <tr><td colspan="4"><span class="label">Título:</span><span class="value">${escapeHtml(formData.titulo_pt)}</span></td></tr>
                    <tr><td colspan="4"><span class="label">Linha:</span><span class="value">${escapeHtml(formData.area)}</span></td></tr>
                </table>
            </div>

            <div class="page-break"></div>

            <!-- PÁGINA 2: ANTEPROJETO -->
            <div class="page-2">
                <div class="header-container">
                    <div class="header-left"></div>
                    <div class="header-center">ANTEPROJETO (RASCUNHO)</div>
                    <div class="header-right">
                        <img src="/img/logo_avalia_quadrado.png" alt="AVALIA+ Logo" style="max-height:45px; margin-bottom:5px;">
                        <div><strong>Processo:</strong> ${registrationNumber}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Anteprojeto</div>
                    <div class="field"><div class="field-label">Título:</div><div class="field-value">${escapeHtml(formData.titulo_pt)}</div></div>
                    <div class="field"><div class="field-label">Linha:</div><div class="field-value">${escapeHtml(formData.area)}</div></div>
                </div>

                <div class="section"><div class="section-title">Resumo</div><div class="field"><div class="field-value">${escapeHtml(formData.resumo)}</div></div></div>
                <div class="section"><div class="section-title">1 – Introdução</div><div class="field"><div class="field-value">${escapeHtml(formData.introducao)}</div></div></div>
                <div class="section"><div class="section-title">2 – Problema</div><div class="field"><div class="field-value">${escapeHtml(formData.problema_pesquisa)}</div></div></div>
                <div class="section"><div class="section-title">3 – Justificativa</div><div class="field"><div class="field-value">${escapeHtml(formData.justificativa_relevancia)}</div></div></div>
                <div class="section">
                    <div class="section-title">4 – Objetivos</div>
                    <div class="field"><div class="field-label">Geral:</div><div class="field-value">${escapeHtml(formData.objetivo_geral)}</div></div>
                    <div class="field"><div class="field-label">Específicos:</div><div class="field-value">${escapeHtml(formData.objetivos_especificos)}</div></div>
                </div>
                <div class="section"><div class="section-title">5 – Revisão</div><div class="field"><div class="field-value">${escapeHtml(formData.revisao_literatura)}</div></div></div>
                <div class="section"><div class="section-title">6 – Metodologia</div><div class="field"><div class="field-value">${escapeHtml(formData.procedimentos_metodologicos)}</div></div></div>
                <div class="section"><div class="section-title">7 – Cronograma</div><div class="field"><div class="field-value">${escapeHtml(formData.cronograma)}</div></div></div>
                <div class="section"><div class="section-title">8 – Referências</div><div class="field"><div class="field-value">${escapeHtml(formData.referencias)}</div></div></div>
            </div>
        </body>
        </html>
    `;

    let printFrame = document.getElementById('print-frame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        alert("Rascunho gerado com sucesso!\n\nATENÇÃO: Este documento é apenas um rascunho e NÃO possui validade como inscrição.");
    }, 1000);
}

function askConfirmation() {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const btnCancel = document.getElementById('btn-modal-cancel');
        const btnConfirm = document.getElementById('btn-modal-confirm');
        const chk = document.getElementById('review-confirm-check');
        const chkFb = document.getElementById('review-confirm-feedback');
        const setReviewText = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = String(value || '');
        };
        
        if (!modal || !btnCancel || !btnConfirm) {
            // Fallback if modal elements are missing
            resolve(confirm("Tem certeza que deseja enviar sua inscrição?"));
            return;
        }

        // Preenche resumo (se existir no modal)
        setReviewText('review-nome', document.getElementById('nome')?.value || '');
        setReviewText('review-cpf', document.getElementById('cpf')?.value || '');
        setReviewText('review-email', document.getElementById('email')?.value || '');
        setReviewText('review-titulo', document.getElementById('titulo_pt')?.value || '');
        setReviewText('review-area', document.getElementById('area')?.value || '');

        // Reset checkbox
        if (chk) chk.checked = false;
        if (chkFb) chkFb.textContent = '';

        modal.style.display = 'flex';
        
        // Clean up previous listeners by cloning
        const newCancel = btnCancel.cloneNode(true);
        const newConfirm = btnConfirm.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

        // Mantém confirmação desabilitada até marcar revisão
        newConfirm.disabled = true;

        const refresh = () => {
            const ok = Boolean(chk && chk.checked);
            newConfirm.disabled = !ok;
            if (chkFb) {
                chkFb.textContent = ok ? '' : 'Marque a confirmação de revisão para habilitar o envio.';
                chkFb.classList.toggle('error', !ok);
            }
        };

        if (chk) {
            chk.addEventListener('change', refresh);
            refresh();
        } else {
            // Sem checkbox no modal, libera como antes
            newConfirm.disabled = false;
        }

        newCancel.addEventListener('click', () => {
            modal.style.display = 'none';
            resolve(false);
        });

        newConfirm.addEventListener('click', () => {
            modal.style.display = 'none';
            resolve(true);
        });
    });
}

async function generatePDF() {
    console.log("Iniciando geração do PDF...");

    const MAX_RESUMO = 1800;
    const MAX_OBJETIVO_GERAL = 200;
    const limitText = (value, maxLen) => String(value || '').slice(0, maxLen);

    // Validação humana + foco no primeiro erro
    if (!validateInscricaoFormHuman()) return;
    
    const cpfInput = document.getElementById('cpf');
    const cpf = cpfInput.value.replace(/\D/g, '');

    if (!isValidCPF(cpfInput.value)) {
        setFeedback('cpf-feedback', 'CPF inválido.');
        cpfInput.focus();
        cpfInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const termo = document.getElementById('termo_compromisso');
    if (!termo?.checked) {
        setFeedback('termo-feedback', 'Obrigatório marcar a declaração para gerar o PDF.');
        termo.focus();
        document.getElementById('termo_compromisso').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Validar área
    const areaSel = document.getElementById('area');
    if (!areaSel || !String(areaSel.value || '').trim()) {
        updateAreaFeedback();
        areaSel.focus();
        areaSel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Blind review: bloquear dados pessoais dentro do projeto
    const projectText = [
        document.getElementById('titulo_pt')?.value,
        document.getElementById('titulo_en')?.value,
        document.getElementById('palavras_pt')?.value,
        document.getElementById('palavras_en')?.value,
        limitText(document.getElementById('resumo')?.value, MAX_RESUMO),
        document.getElementById('justificativa_enquadramento')?.value,
        document.getElementById('introducao')?.value,
        document.getElementById('problema_pesquisa')?.value,
        document.getElementById('justificativa_relevancia')?.value,
        limitText(document.getElementById('objetivo_geral')?.value, MAX_OBJETIVO_GERAL),
        document.getElementById('objetivos_especificos')?.value,
        document.getElementById('revisao_literatura')?.value,
        document.getElementById('procedimentos_metodologicos')?.value,
        document.getElementById('cronograma')?.value,
        document.getElementById('referencias')?.value,
    ].join('\n');

    if (detectPersonalInfoInProject(projectText)) {
        alert('Atenção: foi detectado possível dado pessoal (CPF/e-mail/telefone) nos campos do projeto. Remova para manter a avaliação às cegas.');
        return;
    }

    // Confirmação de envio
    const confirmed = await askConfirmation();
    if (!confirmed) return;

    /*
    const submittedCPFs = JSON.parse(localStorage.getItem('avalia_submitted_cpfs') || '[]');
    if (submittedCPFs.includes(cpf)) {
        alert('Este CPF já possui uma inscrição gerada. Não é permitido gerar mais de uma inscrição.');
        return;
    }
    */
    const submittedCPFs = []; // Mock para evitar erro de referência abaixo

    // Helper functions for form data
    const getRadio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
    const getCheckboxes = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value).join(', ');

    const anexosCondicionantes = getAnexosCondicionantesFromDom();
    const algumaCotaMarcada = document.querySelectorAll('input[name="cotas"]:checked').length > 0;
    const showAnexosCondicionantes = (getRadio('vaga_reservada') === 'Sim') || algumaCotaMarcada || (getRadio('vinculo_empregaticio') === 'Sim');
    const anexosCondicionantesHtml = showAnexosCondicionantes
        ? (
            '<div class="qr-conditional">'
            + '<div class="qr-conditional-title">A validação desta inscrição está condicionada ao envio dos anexos (conforme seleção):</div>'
            + '<ul class="qr-conditional-list">'
            + anexosCondicionantes.map(a => `<li>${escapeHtml(a)}</li>`).join('')
            + '</ul>'
            + '</div>'
        )
        : '';

    // Feedback visual imediato
    const btn = document.getElementById('btn-generate-pdf');
    const originalText = btn ? btn.innerText : 'Enviar Inscrição e Gerar PDF';
    if (btn) { 
        btn.disabled = true; 
        btn.classList.add('btn-loading');
        btn.innerHTML = '<span class="spinner"></span> Registrando...'; 
    }

    let serverReceipt;
    try {
        serverReceipt = await registerSubmissionOnServer({
            // Ficha
            nome: document.getElementById('nome').value,
            nome_social: document.getElementById('nome_social').value,
            data_nascimento: document.getElementById('data_nascimento').value,
            cpf: document.getElementById('cpf').value,
            rg: document.getElementById('rg').value,
            orgao_expedidor: document.getElementById('orgao_expedidor').value,
            data_expedicao: document.getElementById('data_expedicao').value,
            endereco: document.getElementById('endereco').value,
            cidade_estado: document.getElementById('cidade_estado').value,
            cep: document.getElementById('cep').value,
            celular: document.getElementById('celular').value,
            telefone_residencial: document.getElementById('telefone_residencial').value,
            email: document.getElementById('email').value,
            curso_graduacao: document.getElementById('curso_graduacao').value,
            instituicao: document.getElementById('instituicao').value,
            ano_conclusao: document.getElementById('ano_conclusao').value,
            vaga_institucional: getRadio('vaga_institucional'),
            vaga_cooperacao: getRadio('vaga_cooperacao'),
            vaga_reservada: getRadio('vaga_reservada'),
            cotas: getCheckboxes('cotas'),
            raca_cor: document.getElementById('raca_cor').value,
            lingua_estrangeira: getRadio('lingua_estrangeira'),
            vinculo_empregaticio: getRadio('vinculo_empregaticio'),
            carga_horaria: document.getElementById('carga_horaria').value,
            empresa_vinculo: document.getElementById('empresa_vinculo').value,
            termo_compromisso: document.getElementById('termo_compromisso')?.checked ? 'Concordo' : 'Não concordo',

            // Projeto
            titulo_pt: document.getElementById('titulo_pt').value,
            titulo_en: document.getElementById('titulo_en').value,
            area: document.getElementById('area').value,
            palavras_pt: document.getElementById('palavras_pt').value,
            palavras_en: document.getElementById('palavras_en').value,
            resumo: limitText(document.getElementById('resumo').value, MAX_RESUMO),
            justificativa_enquadramento: document.getElementById('justificativa_enquadramento')?.value || '',
            introducao: document.getElementById('introducao')?.value || '',
            problema_pesquisa: document.getElementById('problema_pesquisa')?.value || '',
            justificativa_relevancia: document.getElementById('justificativa_relevancia')?.value || '',
            objetivo_geral: limitText(document.getElementById('objetivo_geral')?.value || '', MAX_OBJETIVO_GERAL),
            objetivos_especificos: document.getElementById('objetivos_especificos')?.value || '',
            revisao_literatura: document.getElementById('revisao_literatura')?.value || '',
            procedimentos_metodologicos: document.getElementById('procedimentos_metodologicos')?.value || '',
            cronograma: document.getElementById('cronograma')?.value || '',
            referencias: document.getElementById('referencias')?.value || ''
        });
    } catch (e) {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
        alert(`Não foi possível registrar a inscrição no servidor.\n\nDetalhe: ${e.message}`);
        return;
    }

    const registrationNumber = serverReceipt.protocol;
    const verifyLandingUrl = `${window.location.origin}/consulta.html?protocol=${encodeURIComponent(registrationNumber)}&auto=1`;
    const qrSrc = `/api/qrcode?data=${encodeURIComponent(verifyLandingUrl)}`;

    if (btn) btn.innerText = 'Gerando...';

    // Coletar todos os dados do formulário
    const formData = {
        inscricao: registrationNumber,
        hash_verificacao: serverReceipt.hash,
        data_registro: serverReceipt.createdAt,
        // Ficha de Inscrição
        nome: document.getElementById('nome').value,
        nome_social: document.getElementById('nome_social').value,
        data_nascimento: document.getElementById('data_nascimento').value,
        cpf: document.getElementById('cpf').value,
        rg: document.getElementById('rg').value,
        orgao_expedidor: document.getElementById('orgao_expedidor').value,
        data_expedicao: document.getElementById('data_expedicao').value,
        endereco: document.getElementById('endereco').value,
        cidade_estado: document.getElementById('cidade_estado').value,
        cep: document.getElementById('cep').value,
        celular: document.getElementById('celular').value,
        telefone_residencial: document.getElementById('telefone_residencial').value,
        email: document.getElementById('email').value,
        curso_graduacao: document.getElementById('curso_graduacao').value,
        instituicao: document.getElementById('instituicao').value,
        ano_conclusao: document.getElementById('ano_conclusao').value,
        vaga_institucional: getRadio('vaga_institucional'),
        vaga_cooperacao: getRadio('vaga_cooperacao'),
        vaga_reservada: getRadio('vaga_reservada'),
        cotas: getCheckboxes('cotas'),
        raca_cor: document.getElementById('raca_cor').value,
        lingua_estrangeira: getRadio('lingua_estrangeira'),
        vinculo_empregaticio: getRadio('vinculo_empregaticio'),
        carga_horaria: document.getElementById('carga_horaria').value,
        empresa_vinculo: document.getElementById('empresa_vinculo').value,

        // Projeto
        titulo_pt: document.getElementById('titulo_pt').value,
        titulo_en: document.getElementById('titulo_en').value,
        area: document.getElementById('area').value,
        palavras_pt: document.getElementById('palavras_pt').value,
        palavras_en: document.getElementById('palavras_en').value,
        resumo: limitText(document.getElementById('resumo').value, MAX_RESUMO),
        justificativa_enquadramento: document.getElementById('justificativa_enquadramento')?.value || '',
        introducao: document.getElementById('introducao')?.value || '',
        problema_pesquisa: document.getElementById('problema_pesquisa')?.value || '',
        justificativa_relevancia: document.getElementById('justificativa_relevancia')?.value || '',
        objetivo_geral: limitText(document.getElementById('objetivo_geral')?.value || '', MAX_OBJETIVO_GERAL),
        objetivos_especificos: document.getElementById('objetivos_especificos')?.value || '',
        revisao_literatura: document.getElementById('revisao_literatura')?.value || '',
        procedimentos_metodologicos: document.getElementById('procedimentos_metodologicos')?.value || '',
        cronograma: document.getElementById('cronograma')?.value || '',
        referencias: document.getElementById('referencias')?.value || ''
    };
    // Termo de Compromisso
    formData.termo_compromisso = document.getElementById('termo_compromisso')?.checked ? 'Concordo' : 'Não concordo';

    const auditFooterHtml = `
        <div class="audit-footer">
            Documento assinado digitalmente e auditado pelo sistema AVALIA+.<br>
            Gerado por: Sistema Automático | IP: ${serverReceipt.ip || 'N/A'} | Data: ${new Date(serverReceipt.createdAt).toLocaleString('pt-BR')}<br>
            Código de Verificação (Hash): ${serverReceipt.hash}
            Documento apenas com validade digital para o processo de seleção em curso.<br>
        </div>
    `;

    // Criar HTML para o PDF
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Projeto AVALIA+ - ${registrationNumber}</title>
            <link rel="stylesheet" href="/theme.css">
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
            <style>
                @page { size: A4; margin: 14mm; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body { width: 100%; margin: 0; padding: 0; }
                body {
                    font-family: Verdana, Arial, Helvetica, sans-serif;
                    font-size: 11px;
                    color: #000;
                    padding: 0;
                    line-height: 1.3;
                    background: #fff;
                    overflow-x: hidden;
                }
                /* Margem interna de segurança (ajuda quando o driver ignora parte do @page) */
                .content { padding: 0 2mm; max-width: 100%; }
                
                /* Header Styles (evita "estourar" a área imprimível) */
                .header-container {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    justify-content: space-between;
                    width: 100%;
                    max-width: 100%;
                    border-bottom: 2px solid #003366;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                    overflow: hidden;
                }
                .header-left {
                    flex: 0 0 18%;
                    max-width: 18%;
                }
                .header-left img {
                    display: block;
                    max-width: 100%;
                    height: auto;
                    max-height: 45px;
                }
                .header-center {
                    flex: 1 1 auto;
                    min-width: 0;
                    text-align: center;
                    font-size: 14px;
                    font-weight: bold;
                    text-transform: uppercase;
                    color: #003366;
                }
                .header-right {
                    flex: 0 0 32%;
                    max-width: 32%;
                    min-width: 0;
                    text-align: right;
                    font-size: 10px;
                }
                .barcode-container {
                    margin-top: 5px;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    overflow: hidden;
                    max-width: 100%;
                }
                .qr-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                .qr-wrap {
                    border: 1px solid #86A3C2;
                    border-radius: 8px;
                    padding: 6px;
                    background: #F4F9FD;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .qr-box img { width: 90px; height: 90px; background: #fff; border-radius: 4px; }
                .qr-caption { font-size: 9px; color: #003366; text-align: center; font-weight: bold; letter-spacing: 0.2px; }
                .qr-footer {
                    display: flex;
                    justify-content: flex-start;
                    align-items: flex-start;
                    gap: 10px;
                    margin-top: 6px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .qr-side-text {
                    font-size: 10px;
                    color: #003366;
                    font-weight: bold;
                    text-align: left;
                    line-height: 1.25;
                }
                .qr-conditional { margin-top: 6px; font-weight: normal; color: #000; }
                .qr-conditional-title { font-size: 10px; font-weight: bold; margin-bottom: 2px; }
                .qr-conditional-list { margin: 0; padding-left: 16px; font-size: 10px; line-height: 1.25; }
                svg { max-width: 100% !important; }
                #barcode, #barcode2 { height: 30px; width: 100% !important; max-width: 100% !important; }

                /* Table Styles for Ficha (Page 1) */
                table.ficha-table {
                    width: 100%;
                    max-width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    table-layout: fixed;
                    page-break-inside: auto;
                }
                table.ficha-table, table.ficha-table tr, table.ficha-table td {
                    box-sizing: border-box;
                }
                table.ficha-table tr {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                table.ficha-table td {
                    border: 1px solid #003366;
                    padding: 4px;
                    vertical-align: top;
                    word-wrap: break-word;
                    overflow-wrap: anywhere;
                    background: #fff;
                }
                table.ficha-table tr.declaration-row {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .declaration-block {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .label { display: block; font-weight: bold; margin-bottom: 3px; font-size: 10px; color: #003366; }
                .value { display: block; min-height: 15px; }

                /* Section Styles for Projeto (Page 2 - Old Style) */
                .section { margin-bottom: 10px; border: 1px solid #86A3C2; padding: 10px; background-color: #F4F9FD; }
                .section-title {
                    font-weight: bold;
                    color: #003366;
                    margin: -10px -10px 10px -10px;
                    font-size: 11px;
                    padding: 4px 10px;
                    border-bottom: 1px solid #86A3C2;
                    background: -webkit-linear-gradient(top, #e0eff9 0%, #d0e5f5 100%);
                    background: linear-gradient(to bottom, #e0eff9 0%, #d0e5f5 100%);
                }
                .field { margin-bottom: 8px; }
                .field {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .field-label { font-weight: bold; color: #003366; font-size: 11px; margin-bottom: 2px; }
                .field-value { padding: 4px; background-color: #fff; border: 1px solid #7F9DB9; min-height: 18px; white-space: pre-wrap; word-wrap: break-word; font-size: 11px; }

                .cut-line {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 10px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .cut-line::before,
                .cut-line::after {
                    content: "";
                    flex: 1;
                    border-top: 1px dashed #003366;
                }
                .cut-line span {
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                }
                
                .audit-footer {
                    margin-top: 20px;
                    border-top: 1px solid #ccc;
                    padding-top: 5px;
                    font-size: 8px;
                    text-align: center;
                    color: #555;
                    page-break-inside: avoid;
                }

                .page-break { 
                    display: block;
                    height: 0; 
                    page-break-before: always; 
                    break-before: page;
                    margin: 0;
                }
                
                @media print { 
                    body { padding: 0; } 
                    .page-break { page-break-before: always; break-before: page; }
                    .section { break-inside: auto; }
                    .section-title { page-break-after: avoid; break-after: avoid; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="content">
            <!-- PÁGINA 1: FICHA DE INSCRIÇÃO (TABELA) -->
            <div class="page-1">
                <div class="header-container">
                    <div class="header-left"></div>
                    <div class="header-center">FICHA DE INSCRIÇÃO</div>
                    <div class="header-right">
                        <img src="/img/logo_avalia_quadrado.png" alt="AVALIA+ Logo" style="max-height:45px; margin-bottom:5px;">
                        <div><strong>Processo:</strong> ${registrationNumber}</div>
                        <div><strong>Registro:</strong> ${new Date(formData.data_registro).toLocaleString('pt-BR')}</div>
                        <div style="font-size:8px; word-break:break-all;"><strong>Hash:</strong> ${formData.hash_verificacao}</div>
                        <div class="barcode-container"><svg id="barcode"></svg></div>
                    </div>
                </div>

                <table class="ficha-table">
                    <tr>
                        <td colspan="4">
                            <span class="label">Nome do/a candidato/a (civilmente registrado):</span>
                            <span class="value">${escapeHtml(formData.nome)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Nome Social:</span>
                            <span class="value">${escapeHtml(formData.nome_social)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="width: 50%">
                            <span class="label">Data de Nascimento:</span>
                            <span class="value">${escapeHtml(formData.data_nascimento)}</span>
                        </td>
                        <td colspan="2" style="width: 50%">
                            <span class="label">CPF:</span>
                            <span class="value">${escapeHtml(formData.cpf)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 25%">
                            <span class="label">Nº RG:</span>
                            <span class="value">${escapeHtml(formData.rg)}</span>
                        </td>
                        <td style="width: 25%">
                            <span class="label">Órgão Expedidor:</span>
                            <span class="value">${escapeHtml(formData.orgao_expedidor)}</span>
                        </td>
                        <td colspan="2" style="width: 50%">
                            <span class="label">Data Expedição:</span>
                            <span class="value">${escapeHtml(formData.data_expedicao)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Endereço completo:</span>
                            <span class="value">${escapeHtml(formData.endereco)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="width: 75%">
                            <span class="label">Cidade/Estado:</span>
                            <span class="value">${escapeHtml(formData.cidade_estado)}</span>
                        </td>
                        <td style="width: 25%">
                            <span class="label">CEP:</span>
                            <span class="value">${escapeHtml(formData.cep)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="width: 50%">
                            <span class="label">Celular:</span>
                            <span class="value">${escapeHtml(formData.celular)}</span>
                        </td>
                        <td colspan="2" style="width: 50%">
                            <span class="label">Telefone residencial:</span>
                            <span class="value">${escapeHtml(formData.telefone_residencial)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">E-mail:</span>
                            <span class="value">${escapeHtml(formData.email)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Curso de Graduação:</span>
                            <span class="value">${escapeHtml(formData.curso_graduacao)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="width: 75%">
                            <span class="label">Instituição:</span>
                            <span class="value">${escapeHtml(formData.instituicao)}</span>
                        </td>
                        <td style="width: 25%">
                            <span class="label">Ano de Conclusão:</span>
                            <span class="value">${escapeHtml(formData.ano_conclusao)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3">
                            <span class="label">Candidato a Vaga Institucional:</span>
                        </td>
                        <td>
                            <span class="value">${escapeHtml(formData.vaga_institucional)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3">
                            <span class="label">Candidato a Vaga pelo Termo de Cooperação N° 004/2024 (funcionário da SDR):</span>
                        </td>
                        <td>
                            <span class="value">${escapeHtml(formData.vaga_cooperacao)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="width: 50%">
                            <span class="label">Candidato à Vaga Reservada:</span>
                            <span class="value">${escapeHtml(formData.vaga_reservada)}</span>
                        </td>
                        <td colspan="2" style="width: 50%">
                            <span class="label">Cotas:</span>
                            <span class="value">${escapeHtml(formData.cotas)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Raça/Cor:</span>
                            <span class="value">${escapeHtml(formData.raca_cor)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Língua Estrangeira para realização da prova escrita:</span>
                            <span class="value">${escapeHtml(formData.lingua_estrangeira)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Possui vínculo empregatício:</span>
                            <span class="value">${escapeHtml(formData.vinculo_empregaticio)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Carga Horária:</span>
                            <span class="value">${escapeHtml(formData.carga_horaria)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Empresa/entidade ao qual está vinculado (se possuir vínculo empregatício):</span>
                            <span class="value">${escapeHtml(formData.empresa_vinculo)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Título do Anteprojeto:</span>
                            <span class="value">${escapeHtml(formData.titulo_pt)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <span class="label">Linha de Pesquisa:</span>
                            <span class="value">${escapeHtml(formData.area)}</span>
                        </td>
                    </tr>
                    <tr class="declaration-row">
                        <td colspan="4">
                            <div class="declaration-block" style="font-size:10px; line-height:1.4; text-align:justify;">
                                Declaro que, em sendo aprovado/a no processo seletivo, tenho disponibilidade para realizar, de forma presencial, todas as atividades do Programa.
                                <br><br>
                                <div style="display:flex; align-items:flex-start; gap:8px;">
                                    <span style="font-size:14px; line-height:1; margin-top:1px; color:${formData.termo_compromisso==='Concordo' ? '#003366' : '#000'};">${formData.termo_compromisso==='Concordo' ? '☑' : '☐'}</span>
                                    <span class="value">Declaro que concordo com o Termo de Compromisso acima.</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>

                <div class="qr-footer">
                    <div class="qr-box">
                        <div class="qr-wrap">
                            <img id="qr-verify" alt="QR Code de validação" src="${qrSrc}" />
                        </div>
                        <div class="qr-caption">VALIDAR INSCRIÇÃO</div>
                    </div>
                    <div class="qr-side-text">
                        Escaneie o QR Code ao lado para verificar a autenticidade desta inscrição.<br>
                        Inscrição registrada no sistema AVALIA+, mas condicionada à validação após o envio dos documentos à secretaria.<br>
                        Inscrição nº: <strong>${registrationNumber}</strong><br>
                        ${anexosCondicionantesHtml}
                    </div>
                </div>
                ${auditFooterHtml}
            </div>

            <div class="page-break"></div>

            <div class="cut-line"><span>PARA A COMISSÃO: ✂ ---- SEPARE AQUI ---- ✂</span></div>

            <!-- PÁGINA 2: ANTEPROJETO (BLIND REVIEW - ESTILO ANTIGO) -->
            <div class="page-2">
                <div class="header-container">
                    <div class="header-left"></div>
                    <div class="header-center">ANTEPROJETO</div>
                    <div class="header-right">
                        <img src="/img/logo_avalia_quadrado.png" alt="AVALIA+ Logo" style="max-height:45px; margin-bottom:5px;">
                        <div><strong>Processo:</strong> ${registrationNumber}</div>
                        <div><strong>Registro:</strong> ${new Date(formData.data_registro).toLocaleString('pt-BR')}</div>
                        <div style="font-size:8px; word-break:break-all;"><strong>Hash:</strong> ${formData.hash_verificacao}</div>
                        <div class="barcode-container"><svg id="barcode2"></svg></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">ANEXO IV - Anteprojeto (sem identificação)</div>
                    <div class="field"><div class="field-label">Título do anteprojeto:</div><div class="field-value">${escapeHtml(formData.titulo_pt)}</div></div>
                    <div class="field"><div class="field-label">Linha de pesquisa:</div><div class="field-value">${escapeHtml(formData.area)}</div></div>
                    <div class="field"><div class="field-label">Justificativa para enquadramento na linha de pesquisa:</div><div class="field-value">${escapeHtml(formData.justificativa_enquadramento)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">Resumo</div>
                    <div class="field"><div class="field-label">Resumo:</div><div class="field-value">${escapeHtml(formData.resumo)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">1 – Introdução / Contextualização</div>
                    <div class="field"><div class="field-value">${escapeHtml(formData.introducao)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">2 – Problema ou questão de pesquisa</div>
                    <div class="field"><div class="field-value">${escapeHtml(formData.problema_pesquisa)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">3 – Justificativa (relevância do tema proposto)</div>
                    <div class="field"><div class="field-value">${escapeHtml(formData.justificativa_relevancia)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">4 – Objetivos</div>
                    <div class="field"><div class="field-label">Objetivo geral:</div><div class="field-value">${escapeHtml(formData.objetivo_geral)}</div></div>
                    <div class="field"><div class="field-label">Objetivos específicos:</div><div class="field-value">${escapeHtml(formData.objetivos_especificos)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">5 – Revisão da literatura</div>
                    <div class="field"><div class="field-value">${escapeHtml(formData.revisao_literatura)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">6 – Procedimentos metodológicos</div>
                    <div class="field"><div class="field-value">${escapeHtml(formData.procedimentos_metodologicos)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">7 – Cronograma</div>
                    <div class="field"><div class="field-value">${escapeHtml(formData.cronograma)}</div></div>
                </div>

                <div class="section">
                    <div class="section-title">8 – Referências (ABNT)</div>
                    <div class="field"><div class="field-value">${escapeHtml(formData.referencias)}</div></div>
                </div>
                ${auditFooterHtml}
            </div>

            <script>
                try {
                    const config = { format: "CODE128", displayValue: true, fontSize: 10, height: 30, margin: 0, textMargin: 2 };
                    JsBarcode("#barcode", "${registrationNumber}", config);
                    JsBarcode("#barcode2", "${registrationNumber}", config);
                } catch (e) { console.error("Erro ao gerar barcode:", e); }

            <\/script>
        </body>
        </html>
    `;

    // Usar iframe para imprimir (evita bloqueio de popups)
    let printFrame = document.getElementById('print-frame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    let isPrinted = false;

    const finalizePrint = () => {
        if (isPrinted) return;
        isPrinted = true;
        
        try {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            
            // Salvar CPF após sucesso (ou tentativa)
            // submittedCPFs.push(cpf);
            // localStorage.setItem('avalia_submitted_cpfs', JSON.stringify(submittedCPFs));
            
            if(btn) { btn.disabled = false; btn.innerText = originalText; }
            showSubmissionSuccess(serverReceipt, formData);
        } catch (e) {
            console.error("Erro ao imprimir:", e);
            if(btn) { btn.disabled = false; btn.innerText = originalText; }
            alert("Erro ao tentar abrir a impressão. Verifique se não há bloqueadores.");
        }
    };

    // Aguardar QR carregar (evita "figura quebrada" no PDF)
    const startWait = Date.now();
    const waitForQr = () => {
        const doc = printFrame.contentWindow.document;
        const img = doc.getElementById('qr-verify');
        const ok = img && img.complete && img.naturalWidth > 0;

        if (ok) {
            // Pequeno delay para estabilizar layout antes do print
            setTimeout(finalizePrint, 150);
            return;
        }

        // Timeout: se não carregar, oculta para não aparecer quebrado
        if (Date.now() - startWait > 6000) {
            if (img) img.style.display = 'none';
            setTimeout(finalizePrint, 150);
            return;
        }

        setTimeout(waitForQr, 150);
    };

    // Mantém o comportamento atual do barcode (quando disponível) e garante QR antes de imprimir
    setTimeout(waitForQr, 250);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize counters on load (in case of browser auto-fill)
document.addEventListener('DOMContentLoaded', () => {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        const max = textarea.getAttribute('maxlength');
        if (max) {
            updateCounter(textarea, parseInt(max));
        }
    });

    // Paste handling to remove formatting
    document.querySelectorAll('textarea, input[type="text"]').forEach(el => {
        el.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            // Normaliza quebras de linha e remove caracteres estranhos se necessário
            const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            // Insert text at cursor position
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const value = el.value;
            el.value = value.substring(0, start) + cleanText + value.substring(end);
            
            // Move cursor to end of pasted text
            el.selectionStart = el.selectionEnd = start + cleanText.length;
            
            // Trigger input event for counters/validation
            el.dispatchEvent(new Event('input'));
        });
    });

    const cpfInput = document.getElementById('cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', () => {
            cpfInput.value = formatCPF(cpfInput.value);
            updateCpfFeedback();
        });
        cpfInput.addEventListener('blur', () => {
            cpfInput.value = formatCPF(cpfInput.value);
            updateCpfFeedback();
        });
    }

    const termo = document.getElementById('termo_compromisso');
    if (termo) {
        termo.addEventListener('change', () => {
            updateTermoFeedback();
        });
        updateTermoFeedback();
    }

    // CEP
    const cep = document.getElementById('cep');
    if (cep) {
        cep.addEventListener('input', () => { cep.value = formatCEP(cep.value); });
        cep.addEventListener('blur', () => { cep.value = formatCEP(cep.value); });
    }

    // Telefones
    const cel = document.getElementById('celular');
    const res = document.getElementById('telefone_residencial');
    if (cel) cel.addEventListener('input', () => { cel.value = formatPhoneBR(cel.value); });
    if (res) res.addEventListener('input', () => { res.value = formatPhoneBR(res.value); });

    // Área (feedback)
    const area = document.getElementById('area');
    if (area) { area.addEventListener('change', updateAreaFeedback); updateAreaFeedback(); }

    // Vaga reservada / cotas (aviso de anexos)
    document.querySelectorAll('input[name="vaga_reservada"]').forEach((el) => {
        el.addEventListener('change', updateVagaReservadaAviso);
    });
    document.querySelectorAll('input[name="cotas"]').forEach((el) => {
        el.addEventListener('change', updateVagaReservadaAviso);
    });
    document.querySelectorAll('input[name="vinculo_empregaticio"]').forEach((el) => {
        el.addEventListener('change', updateVagaReservadaAviso);
    });
    updateVagaReservadaAviso();

    // Botão Preencher Exemplo
    const btnFillExample = document.getElementById('btn-fill-example');
    if (btnFillExample) {
        btnFillExample.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Botão Preencher Exemplo clicado via listener');
            fillExample();
        });
    }

    // Botão Consultar Inscrição
    const btnConsultar = document.getElementById('btn-consultar');
    if (btnConsultar) {
        btnConsultar.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/consulta';
        });
    }

    // Botão Gerar Rascunho
    const btnGenerateDraft = document.getElementById('btn-generate-draft');
    if (btnGenerateDraft) {
        btnGenerateDraft.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Botão Gerar Rascunho clicado via listener');
            generateDraft();
        });
    }

    // Botão Enviar Inscrição e Gerar PDF
    const btnGeneratePDF = document.getElementById('btn-generate-pdf');
    if (btnGeneratePDF) {
        btnGeneratePDF.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Botão Enviar Inscrição clicado via listener');
            generatePDF();
        });
    }

    // Recurso: prefill do protocolo da inscrição via querystring (?protocol=...)
    if (document.getElementById('recurso-form')) {
        try {
            const inputProto = document.getElementById('protocolo_inscricao');
            if (inputProto) {
                const qs = new URLSearchParams(window.location.search);
                const protocol = (qs.get('protocol') || qs.get('protocolo') || qs.get('p') || '').trim();
                if (protocol) inputProto.value = protocol;
            }
        } catch (e) {
            console.warn('Falha ao ler querystring do recurso:', e);
        }
    }
});

function fillExample() {
    console.log('fillExample chamado!');
    try {
        const setVal = (id, val) => { 
            const el = document.getElementById(id); 
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input')); // Atualiza contadores
                el.dispatchEvent(new Event('change')); // Atualiza validações
            } else {
                console.warn('Elemento não encontrado para preencher:', id);
            }
        };
        const checkRadio = (name, val) => { 
            const el = document.querySelector(`input[name="${name}"][value="${val}"]`); 
            if (el) el.checked = true; 
            else console.warn('Radio não encontrado:', name, val);
        };
        const checkBoxes = (name, values) => { 
            values.forEach(v => { 
                const el = document.querySelector(`input[name="${name}"][value="${v}"]`); 
                if (el) el.checked = true; 
                else console.warn('Checkbox não encontrado:', name, v);
            }); 
        };

        // Detectar se é página de recurso
        if (document.getElementById('recurso-form')) {
            console.log('Preenchendo formulário de recurso...');
            setVal('protocolo_inscricao', 'AVALIA-2025-AB12');
            setVal('nome', 'Maria da Silva');
            setVal('cpf', '390.533.447-05');
            setVal('email', 'maria.silva@example.com');
            setVal('titulo_projeto', 'Desenvolvimento de Sistema AVALIA+ para Gestão de Projetos');
            setVal('linha_pesquisa', 'Linha de Pesquisa 2 – Políticas públicas, Planejamento Territorial e Participação Social');
            setVal('etapa_processo', 'Avaliação do Projeto');
            setVal('decisao_contestacao', 'A nota atribuída ao critério de metodologia não condiz com o detalhamento apresentado na seção 4 do projeto.');
            setVal('argumentacao', 'Prezados avaliadores, solicito revisão da nota pois a metodologia foi descrita detalhadamente, incluindo as etapas de levantamento de requisitos, desenvolvimento incremental e validação com usuários. Acredito que houve um equívoco na interpretação dos prazos apresentados no cronograma.');
            
            if (typeof updateCounter === 'function') {
                const arg = document.getElementById('argumentacao');
                if (arg) updateCounter(arg, 2500);
            }
            alert('Exemplo de Recurso preenchido!');
            return;
        }

        console.log('Preenchendo formulário de inscrição...');
        // Ficha de Inscrição
        setVal('nome', 'Maria da Silva');
        setVal('nome_social', 'Maria Silva');
        setVal('data_nascimento', '1990-05-10');
        setVal('cpf', '390.533.447-05');
        setVal('rg', '1234567');
        setVal('orgao_expedidor', 'SSP-BA');
        setVal('data_expedicao', '2010-08-15');
        setVal('endereco', 'Rua das Flores, 123, Bairro Centro');
        setVal('cidade_estado', 'Feira de Santana - BA');
        setVal('cep', '44000-000');
        setVal('celular', '(75) 99999-0000');
        setVal('telefone_residencial', '(75) 3333-4444');
        setVal('email', 'maria.silva@example.com');
        setVal('curso_graduacao', 'Engenharia Agronômica');
        setVal('instituicao', 'Instituição Exemplo');
        setVal('ano_conclusao', '2015');
        checkRadio('vaga_institucional', 'Sim');
        checkRadio('vaga_cooperacao', 'Não');
        checkRadio('vaga_reservada', 'Não');
        checkBoxes('cotas', ['Negro']);
        setVal('raca_cor', 'Parda');
        checkRadio('lingua_estrangeira', 'Inglês');
        checkRadio('vinculo_empregaticio', 'Não');
        setVal('carga_horaria', '40h');
        setVal('empresa_vinculo', '');
        const termo = document.getElementById('termo_compromisso');
        if (termo) termo.checked = true;

        // Atualizar avisos na tela após autopreenchimento
        if (typeof updateCpfFeedback === 'function') updateCpfFeedback();
        if (typeof updateTermoFeedback === 'function') updateTermoFeedback();

        // Projeto
        setVal('titulo_pt', 'Desenvolvimento de Sistema AVALIA+ para Gestão de Projetos');
        setVal('titulo_en', 'AVALIA+ System Development for Project Management');
        setVal('area', 'Linha de Pesquisa 2 – Políticas públicas, Planejamento Territorial e Participação Social');
        setVal('palavras_pt', 'gestão; projeto; inovação');
        setVal('palavras_en', 'management; project; innovation');
        setVal('resumo', 'Este anteprojeto propõe o desenvolvimento de um sistema para apoiar a gestão de projetos acadêmicos, com foco em processos seletivos e avaliação cega.');
        setVal('justificativa_enquadramento', 'O tema se enquadra na linha escolhida por tratar de processos e práticas de planejamento territorial apoiados por tecnologia e participação social.');
        setVal('introducao', 'Contextualização do problema e do cenário institucional em que se insere o anteprojeto.');
        setVal('problema_pesquisa', 'Como padronizar e dar rastreabilidade ao processo de submissão e avaliação às cegas de anteprojetos?');
        setVal('justificativa_relevancia', 'A relevância está na melhoria da transparência, eficiência e integridade do processo seletivo, reduzindo falhas operacionais.');
        setVal('objetivo_geral', 'Propor um fluxo digital de submissão e verificação do anteprojeto, com geração de protocolo e hash.');
        setVal('objetivos_especificos', '(i) validar dados; (ii) gerar protocolo e hash; (iii) exportar relatórios; (iv) imprimir em PDF.');
        setVal('revisao_literatura', 'Síntese de conceitos sobre avaliação às cegas, gestão de processos e documentação digital.');
        setVal('procedimentos_metodologicos', 'Desenvolvimento incremental do protótipo (HTML/CSS/JS + Node/Express), testes com usuários e ajustes de layout/validações.');
        setVal('cronograma', 'Mês 1-2: levantamento e desenho do fluxo\nMês 3-4: implementação e testes\nMês 5-6: validação e refinamentos\nMês 7-24: evolução e documentação');
        setVal('referencias', 'SOBRENOME, Nome. Título. Local: Editora, ano.\nASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 6023.');

        if (typeof updateAreaFeedback === 'function') updateAreaFeedback();
        
        alert('Exemplo preenchido com sucesso!');
    } catch (err) {
        console.error(err);
        alert('Erro ao preencher exemplo: ' + err.message);
    }
}

// Controle de janela de inscrições
async function initRegistrationWindowStatus() {
    try {
        const res = await fetch('/api/registration-window', { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        const open = Boolean(data && data.open);
        const startISO = data?.registrationWindow?.startISO || null;
        const endISO = data?.registrationWindow?.endISO || null;

        const container = document.getElementById('form-content');
        if (container) {
            const banner = document.createElement('div');
            banner.style.margin = '10px 0';
            banner.style.padding = '10px';
            banner.style.border = '1px solid';
            banner.style.borderColor = open ? '#2e7d32' : '#b71c1c';
            banner.style.backgroundColor = open ? '#E8F5E9' : '#FFEBEE';
            banner.style.color = open ? '#2e7d32' : '#b71c1c';
            const startStr = startISO ? new Date(startISO).toLocaleDateString('pt-BR') : '—';
            const endStr = endISO ? new Date(endISO).toLocaleDateString('pt-BR') : '—';
            banner.textContent = `Inscrições ${open ? 'ABERTAS' : 'FECHADAS'} | Início: ${startStr} | Fim: ${endStr}`;
            container.insertBefore(banner, container.firstChild);
        }

        const submitBtn = document.getElementById('btn-generate-pdf');
        if (submitBtn) {
            submitBtn.disabled = !open;
            if (!open) submitBtn.title = 'Inscrições fechadas';
        }
    } catch (e) {
        // Silenciosamente não bloqueia caso falhe; mantém comportamento atual
    }
}

document.addEventListener('DOMContentLoaded', initRegistrationWindowStatus);