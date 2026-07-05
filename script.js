(function() {
    'use strict';

    // ===== ESTADO =====
    let linhas = [];
    let nextId = 1;
    let sortKey = 'data';
    let sortAsc = true;
    let filtroAssunto = '';
    let filtroStatus = 'all';
    let currentMode = 'table';
    let currentChartType = 'bars';
    let darkMode = false;

    // ===== DOM =====
    const tbody = document.getElementById('corpo-tabela');
    const cardsContainer = document.getElementById('cardsContainer');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const totalSpan = document.getElementById('totalCount');
    const dominatedSpan = document.getElementById('dominatedCount');
    const revisionSpan = document.getElementById('revisionCount');
    const avgSpan = document.getElementById('avgAccuracy');
    const revisaoList = document.getElementById('revisaoList');
    const tableView = document.getElementById('tableView');
    const chartView = document.getElementById('chartView');
    const flashcardView = document.getElementById('flashcardView');
    const chartContainer = document.getElementById('chartContainer');
    const flashcardGrid = document.getElementById('flashcardGrid');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const themeToggle = document.getElementById('themeToggle');
    const backToTop = document.getElementById('backToTop');

    // ===== FUNÇÕES AUXILIARES =====
    function diffDias(d1, d2) {
        if (!d1 || !d2) return null;
        const a = new Date(d1), b = new Date(d2);
        return (a - b) / (1000*60*60*24);
    }

    function calcularStatus(dados) {
        const { meta, feitas, acertos, data } = dados;
        if (!data) return { status: 'PENDENTE', precisaRevisar: false };
        if (feitas === 0) return { status: 'HORA DE PRATICAR', precisaRevisar: false };
        if (feitas < meta) return { status: 'ABAIXO DA META', precisaRevisar: false };
        const perc = feitas > 0 ? acertos / feitas : 0;
        const hoje = new Date();
        const diff = (hoje - new Date(data)) / (1000*60*60*24);
        if (perc < 0.75) return { status: 'REVISAR (Erro alto)', precisaRevisar: true };
        if (diff > 15) return { status: 'REVISAR (15 dias)', precisaRevisar: true };
        return { status: 'DOMINADO', precisaRevisar: false };
    }

    function calcularDetalhes(dados, index, linhasArray) {
        const { status } = calcularStatus(dados);
        if (status === 'DOMINADO') return { texto: '🎉 Muito Bem!', classe: 'detalhe-bom' };
        if (index > 0) {
            const anterior = linhasArray[index - 1];
            const diff = diffDias(dados.data, anterior.data);
            if (diff !== null && diff > 7) return { texto: '⏳ Revisão Lenta', classe: 'detalhe-lento' };
        }
        const perc = dados.feitas > 0 ? dados.acertos / dados.feitas : 0;
        if (perc < 0.5 && dados.feitas > 0) return { texto: '🚨 Urgente!', classe: 'detalhe-urgencia' };
        return { texto: '📚 Mantenha o ritmo', classe: 'detalhe-normal' };
    }

    // ===== PERSISTÊNCIA =====
    function salvarDados() {
        const dadosParaSalvar = linhas.map(l => ({
            id: l.id,
            semana: l.semana,
            assunto: l.assunto,
            meta: l.meta,
            feitas: l.feitas,
            acertos: l.acertos,
            data: l.data
        }));
        localStorage.setItem('estudosData', JSON.stringify(dadosParaSalvar));
        localStorage.setItem('nextId', nextId.toString());
        localStorage.setItem('darkMode', darkMode ? 'dark' : 'light');
    }

    function carregarDados() {
        const saved = localStorage.getItem('estudosData');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                linhas = parsed.map(l => ({
                    id: l.id || 0,
                    semana: l.semana || '',
                    assunto: l.assunto || '',
                    meta: l.meta || 0,
                    feitas: l.feitas || 0,
                    acertos: l.acertos || 0,
                    data: l.data || ''
                }));
                const savedId = localStorage.getItem('nextId');
                nextId = savedId ? parseInt(savedId, 10) : (linhas.length > 0 ? Math.max(...linhas.map(l => l.id)) + 1 : 1);
                return true;
            } catch(e) { /* ignore */ }
        }
        return false;
    }

    function carregarTema() {
        const mode = localStorage.getItem('darkMode');
        if (mode === 'dark') {
            darkMode = true;
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.querySelector('.thumb').style.left = '25px';
            themeToggle.setAttribute('aria-checked', 'true');
        } else {
            darkMode = false;
            document.documentElement.removeAttribute('data-theme');
            themeToggle.querySelector('.thumb').style.left = '3px';
            themeToggle.setAttribute('aria-checked', 'false');
        }
    }

    // ===== DADOS FILTRADOS/ORDENADOS =====
    function getLinhasOrdenadasEFiltradas() {
        let filtradas = linhas.filter(linha => {
            if (filtroAssunto && !linha.assunto.toLowerCase().includes(filtroAssunto)) return false;
            const statusObj = calcularStatus(linha);
            if (filtroStatus !== 'all' && statusObj.status !== filtroStatus) return false;
            return true;
        });
        filtradas.sort((a, b) => {
            let valA = a[sortKey] || '';
            let valB = b[sortKey] || '';
            if (sortKey === 'data') {
                if (!valA) return 1;
                if (!valB) return -1;
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (['meta','feitas','acertos','semana'].includes(sortKey)) {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
                return sortAsc ? valA - valB : valB - valA;
            }
            if (sortKey === 'assunto') {
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return 0;
        });
        return filtradas;
    }

    // ===== RENDERIZAÇÃO COMPLETA =====
    function renderizarCompleto() {
        const filtradas = getLinhasOrdenadasEFiltradas();
        atualizarEstatisticas(filtradas);
        atualizarRevisaoList(filtradas);
        renderizarTabela(filtradas);
        renderizarCards(filtradas);
        renderizarGrafico(filtradas, currentChartType);
        renderizarFlashcards(filtradas);
        aplicarModo();
    }

    // ===== TABELA (Desktop) =====
    function renderizarTabela(filtradas) {
        tbody.innerHTML = '';
        filtradas.forEach((linha, idx) => {
            tbody.appendChild(criarLinhaElement(linha, idx, filtradas));
        });
    }

    function criarLinhaElement(linha, idx, filtradas) {
        const tr = document.createElement('tr');
        tr.dataset.id = linha.id;
        const statusObj = calcularStatus(linha);
        const statusText = statusObj.status;
        const erros = Math.max(0, linha.feitas - linha.acertos);
        const perc = linha.feitas > 0 ? (linha.acertos / linha.feitas) * 100 : 0;
        const progressFeitas = linha.meta > 0 ? Math.min(100, (linha.feitas / linha.meta) * 100) : 0;
        const detalhe = calcularDetalhes(linha, idx, filtradas);

        const badgeClass = {
            'PENDENTE': 'badge-pendente',
            'HORA DE PRATICAR': 'badge-praticar',
            'ABAIXO DA META': 'badge-abaixo',
            'REVISAR (Erro alto)': 'badge-revisar',
            'REVISAR (15 dias)': 'badge-tempo',
            'DOMINADO': 'badge-dominado'
        }[statusText] || 'badge-pendente';

        const statusHtml = `<span class="badge ${badgeClass}">${statusText}</span>`;
        const detalheCor = detalhe.classe.includes('bom') ? 'var(--success)' :
                           detalhe.classe.includes('lento') ? 'var(--warning)' :
                           detalhe.classe.includes('urgencia') ? 'var(--danger)' : 'var(--text-secondary)';

        tr.innerHTML = `
            <td><input type="number" value="${linha.semana}" data-field="semana" data-id="${linha.id}" min="1" inputmode="numeric"></td>
            <td><input type="text" value="${linha.assunto}" data-field="assunto" data-id="${linha.id}" placeholder="Assunto"></td>
            <td><input type="number" value="${linha.meta}" data-field="meta" data-id="${linha.id}" min="0" inputmode="numeric"></td>
            <td>
                <div class="progress-inline">
                    <span>${linha.feitas}</span>
                    <div class="bar"><div class="fill ${progressFeitas < 50 ? 'red' : progressFeitas < 75 ? 'orange' : 'green'}" style="width:${progressFeitas}%"></div></div>
                    <input type="number" value="${linha.feitas}" data-field="feitas" data-id="${linha.id}" min="0" inputmode="numeric" style="width:50px;">
                </div>
            </td>
            <td><input type="number" value="${linha.acertos}" data-field="acertos" data-id="${linha.id}" min="0" inputmode="numeric"></td>
            <td>${erros}</td>
            <td>
                <div class="progress-inline">
                    <span>${perc.toFixed(0)}%</span>
                    <div class="bar"><div class="fill ${perc < 50 ? 'red' : perc < 75 ? 'orange' : 'green'}" style="width:${Math.min(100, perc)}%"></div></div>
                </div>
            </td>
            <td><input type="date" value="${linha.data}" data-field="data" data-id="${linha.id}" inputmode="none"></td>
            <td>${statusHtml}</td>
            <td style="font-size:0.75rem; font-weight:500; color:${detalheCor}">${detalhe.texto}</td>
            <td><button class="delete-btn" data-id="${linha.id}" aria-label="Remover linha"><i class="fas fa-times" aria-hidden="true"></i></button></td>
        `;
        return tr;
    }

    // ===== CARDS (Mobile) =====
    function renderizarCards(filtradas) {
        cardsContainer.innerHTML = '';
        if (filtradas.length === 0) {
            cardsContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">Nenhum dado cadastrado.</div>';
            return;
        }
        filtradas.forEach((linha, idx) => {
            const card = criarCardElement(linha, idx, filtradas);
            cardsContainer.appendChild(card);
        });
    }

    function criarCardElement(linha, idx, filtradas) {
        const statusObj = calcularStatus(linha);
        const statusText = statusObj.status;
        const erros = Math.max(0, linha.feitas - linha.acertos);
        const perc = linha.feitas > 0 ? (linha.acertos / linha.feitas) * 100 : 0;
        const progressFeitas = linha.meta > 0 ? Math.min(100, (linha.feitas / linha.meta) * 100) : 0;
        const detalhe = calcularDetalhes(linha, idx, filtradas);

        const badgeClass = {
            'PENDENTE': 'badge-pendente',
            'HORA DE PRATICAR': 'badge-praticar',
            'ABAIXO DA META': 'badge-abaixo',
            'REVISAR (Erro alto)': 'badge-revisar',
            'REVISAR (15 dias)': 'badge-tempo',
            'DOMINADO': 'badge-dominado'
        }[statusText] || 'badge-pendente';

        const card = document.createElement('div');
        card.className = 'card-item';
        card.dataset.id = linha.id;

        card.innerHTML = `
            <div class="card-row">
                <span class="label">Semana</span>
                <span class="value">
                    <input type="number" value="${linha.semana}" data-field="semana" data-id="${linha.id}" min="1" inputmode="numeric">
                </span>
            </div>
            <div class="card-row">
                <span class="label">Assunto</span>
                <span class="value">
                    <input type="text" value="${linha.assunto || ''}" data-field="assunto" data-id="${linha.id}" placeholder="Assunto">
                </span>
            </div>
            <div class="card-row">
                <span class="label">Meta</span>
                <span class="value">
                    <input type="number" value="${linha.meta}" data-field="meta" data-id="${linha.id}" min="0" inputmode="numeric">
                </span>
            </div>
            <div class="card-row">
                <span class="label">Feitas</span>
                <span class="value">
                    <div class="input-group">
                        <input type="number" value="${linha.feitas}" data-field="feitas" data-id="${linha.id}" min="0" inputmode="numeric">
                        <span class="bar">
                            <span class="fill ${progressFeitas < 50 ? 'red' : progressFeitas < 75 ? 'orange' : 'green'}" style="width:${progressFeitas}%"></span>
                        </span>
                    </div>
                </span>
            </div>
            <div class="card-row">
                <span class="label">Acertos</span>
                <span class="value">
                    <input type="number" value="${linha.acertos}" data-field="acertos" data-id="${linha.id}" min="0" inputmode="numeric">
                </span>
            </div>
            <div class="card-row">
                <span class="label">Erros</span>
                <span class="value">${erros}</span>
            </div>
            <div class="card-row">
                <span class="label">% Acerto</span>
                <span class="value">
                    <div class="input-group">
                        <span>${perc.toFixed(0)}%</span>
                        <span class="bar">
                            <span class="fill ${perc < 50 ? 'red' : perc < 75 ? 'orange' : 'green'}" style="width:${Math.min(100, perc)}%"></span>
                        </span>
                    </div>
                </span>
            </div>
            <div class="card-row">
                <span class="label">Data</span>
                <span class="value">
                    <input type="date" value="${linha.data || ''}" data-field="data" data-id="${linha.id}">
                </span>
            </div>
            <div class="card-row">
                <span class="label">Status</span>
                <span class="value"><span class="badge ${badgeClass}">${statusText}</span></span>
            </div>
            <div class="card-row">
                <span class="label">Detalhes</span>
                <span class="value" style="font-size:0.8rem;color:${detalhe.classe.includes('bom') ? 'var(--success)' : detalhe.classe.includes('lento') ? 'var(--warning)' : detalhe.classe.includes('urgencia') ? 'var(--danger)' : 'var(--text-secondary)'}">${detalhe.texto}</span>
            </div>
            <div class="card-actions">
                <button class="delete-btn" data-id="${linha.id}" aria-label="Remover"><i class="fas fa-trash-alt" aria-hidden="true"></i> Remover</button>
            </div>
        `;
        return card;
    }

    // ===== ATUALIZAR CARD EXISTENTE (sem recriar) =====
    function atualizarCardExistente(id) {
        const linha = linhas.find(l => l.id === id);
        if (!linha) return;
        const card = cardsContainer.querySelector(`.card-item[data-id="${id}"]`);
        if (!card) return;

        const filtradas = getLinhasOrdenadasEFiltradas();
        const idx = filtradas.findIndex(l => l.id === id);
        if (idx === -1) { card.remove(); return; }

        const statusObj = calcularStatus(linha);
        const statusText = statusObj.status;
        const erros = Math.max(0, linha.feitas - linha.acertos);
        const perc = linha.feitas > 0 ? (linha.acertos / linha.feitas) * 100 : 0;
        const progressFeitas = linha.meta > 0 ? Math.min(100, (linha.feitas / linha.meta) * 100) : 0;
        const detalhe = calcularDetalhes(linha, idx, filtradas);

        const badgeClass = {
            'PENDENTE': 'badge-pendente',
            'HORA DE PRATICAR': 'badge-praticar',
            'ABAIXO DA META': 'badge-abaixo',
            'REVISAR (Erro alto)': 'badge-revisar',
            'REVISAR (15 dias)': 'badge-tempo',
            'DOMINADO': 'badge-dominado'
        }[statusText] || 'badge-pendente';

        // Atualiza campos específicos sem recriar o card
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (field) {
                let value = linha[field];
                if (value === undefined) return;
                if (field === 'data') value = value || '';
                input.value = value;
            }
        });

        // Atualiza erros
        const errosSpan = card.querySelector('.card-row:nth-child(6) .value');
        if (errosSpan) errosSpan.textContent = erros;

        // Atualiza % acerto
        const percContainer = card.querySelector('.card-row:nth-child(7) .value .input-group');
        if (percContainer) {
            const percSpan = percContainer.querySelector('span:first-child');
            const barFill = percContainer.querySelector('.bar .fill');
            if (percSpan) percSpan.textContent = perc.toFixed(0) + '%';
            if (barFill) {
                barFill.style.width = Math.min(100, perc) + '%';
                barFill.className = 'fill ' + (perc < 50 ? 'red' : perc < 75 ? 'orange' : 'green');
            }
        }

        // Atualiza barra de progresso em "Feitas"
        const feitasContainer = card.querySelector('.card-row:nth-child(4) .value .input-group');
        if (feitasContainer) {
            const barFill = feitasContainer.querySelector('.bar .fill');
            if (barFill) {
                const p = linha.meta > 0 ? Math.min(100, (linha.feitas / linha.meta) * 100) : 0;
                barFill.style.width = p + '%';
                barFill.className = 'fill ' + (p < 50 ? 'red' : p < 75 ? 'orange' : 'green');
            }
        }

        // Atualiza status
        const statusSpan = card.querySelector('.card-row:nth-child(9) .value .badge');
        if (statusSpan) {
            statusSpan.textContent = statusText;
            statusSpan.className = 'badge ' + badgeClass;
        }

        // Atualiza detalhes
        const detalheSpan = card.querySelector('.card-row:nth-child(10) .value');
        if (detalheSpan) {
            detalheSpan.textContent = detalhe.texto;
            const cor = detalhe.classe.includes('bom') ? 'var(--success)' :
                        detalhe.classe.includes('lento') ? 'var(--warning)' :
                        detalhe.classe.includes('urgencia') ? 'var(--danger)' : 'var(--text-secondary)';
            detalheSpan.style.color = cor;
        }
    }

    // ===== ATUALIZAR TABELA EXISTENTE =====
    function atualizarTabelaExistente(id) {
        const linha = linhas.find(l => l.id === id);
        if (!linha) return;
        const tr = tbody.querySelector(`tr[data-id="${id}"]`);
        if (!tr) return;

        const filtradas = getLinhasOrdenadasEFiltradas();
        const idx = filtradas.findIndex(l => l.id === id);
        if (idx === -1) { tr.remove(); return; }

        const statusObj = calcularStatus(linha);
        const statusText = statusObj.status;
        const erros = Math.max(0, linha.feitas - linha.acertos);
        const perc = linha.feitas > 0 ? (linha.acertos / linha.feitas) * 100 : 0;
        const progressFeitas = linha.meta > 0 ? Math.min(100, (linha.feitas / linha.meta) * 100) : 0;
        const detalhe = calcularDetalhes(linha, idx, filtradas);

        const badgeClass = {
            'PENDENTE': 'badge-pendente',
            'HORA DE PRATICAR': 'badge-praticar',
            'ABAIXO DA META': 'badge-abaixo',
            'REVISAR (Erro alto)': 'badge-revisar',
            'REVISAR (15 dias)': 'badge-tempo',
            'DOMINADO': 'badge-dominado'
        }[statusText] || 'badge-pendente';

        const statusHtml = `<span class="badge ${badgeClass}">${statusText}</span>`;
        const detalheCor = detalhe.classe.includes('bom') ? 'var(--success)' :
                           detalhe.classe.includes('lento') ? 'var(--warning)' :
                           detalhe.classe.includes('urgencia') ? 'var(--danger)' : 'var(--text-secondary)';

        const cells = tr.querySelectorAll('td');
        if (cells.length < 11) return;

        // Atualiza inputs
        const inputs = tr.querySelectorAll('input');
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (field) {
                let value = linha[field];
                if (value === undefined) return;
                if (field === 'data') value = value || '';
                input.value = value;
            }
        });

        // Erros
        cells[5].textContent = erros;

        // % Acerto
        const percContainer = cells[6];
        const spanPerc = percContainer.querySelector('span');
        const barraPerc = percContainer.querySelector('.bar .fill');
        if (spanPerc) spanPerc.textContent = perc.toFixed(0) + '%';
        if (barraPerc) {
            barraPerc.style.width = Math.min(100, perc) + '%';
            barraPerc.className = 'fill ' + (perc < 50 ? 'red' : perc < 75 ? 'orange' : 'green');
        }

        // Status
        cells[8].innerHTML = statusHtml;

        // Detalhes
        const detalheCell = cells[9];
        detalheCell.textContent = detalhe.texto;
        detalheCell.style.color = detalheCor;

        // Barra de progresso em Feitas
        const feitasCell = cells[3];
        const progressContainer = feitasCell.querySelector('.progress-inline');
        if (progressContainer) {
            const spanFeitas = progressContainer.querySelector('span:first-child');
            const barraFeitas = progressContainer.querySelector('.bar .fill');
            if (spanFeitas) spanFeitas.textContent = linha.feitas;
            if (barraFeitas) {
                const p = linha.meta > 0 ? Math.min(100, (linha.feitas / linha.meta) * 100) : 0;
                barraFeitas.style.width = p + '%';
                barraFeitas.className = 'fill ' + (p < 50 ? 'red' : p < 75 ? 'orange' : 'green');
            }
        }
    }

    // ===== ATUALIZAR LINHA (chamada pelos eventos) =====
    function atualizarLinhaDOM(id) {
        // Atualiza tabela e card sem recriar
        atualizarTabelaExistente(id);
        atualizarCardExistente(id);
    }

    // ===== GRÁFICOS =====
    function renderizarGrafico(filtradas, type) {
        if (type === 'bars') renderBars(filtradas);
        else if (type === 'line') renderLine(filtradas);
        else if (type === 'pie') renderPie(filtradas);
    }

    function renderBars(filtradas) {
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = '';
        if (filtradas.length === 0) {
            chartContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;"><i class="fas fa-chart-simple" style="font-size:2rem; display:block; margin-bottom:12px;"></i>Nenhum dado para exibir.</div>';
            return;
        }
        const unicos = new Map();
        filtradas.filter(l => l.feitas > 0).forEach(l => {
            const key = l.assunto || 'Sem assunto';
            if (!unicos.has(key) || (l.acertos/l.feitas) > (unicos.get(key).acertos/unicos.get(key).feitas)) {
                unicos.set(key, l);
            }
        });
        const sorted = Array.from(unicos.values()).sort((a,b) => (b.acertos/b.feitas) - (a.acertos/a.feitas));
        if (sorted.length === 0) {
            chartContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">Nenhum dado com exercícios feitos.</div>';
            return;
        }
        sorted.forEach((linha, i) => {
            const perc = (linha.acertos / linha.feitas) * 100;
            const cor = perc >= 75 ? 'green' : perc >= 50 ? 'orange' : 'red';
            const div = document.createElement('div');
            div.className = 'chart-item';
            div.style.animationDelay = (i * 0.05) + 's';
            div.innerHTML = `
                <span class="chart-label" title="${linha.assunto || 'Sem assunto'}">${linha.assunto || 'Sem assunto'}</span>
                <div class="chart-bar-wrapper">
                    <div class="chart-bar ${cor}" style="width: ${Math.min(100, perc)}%;">${perc >= 20 ? Math.round(perc)+'%' : ''}</div>
                </div>
                <span class="chart-percent">${Math.round(perc)}%</span>
            `;
            chartContainer.appendChild(div);
        });
    }

    function renderLine(filtradas) {
        chartContainer.className = 'chart-line-container';
        chartContainer.innerHTML = '';
        const dados = filtradas.filter(l => l.data && l.feitas > 0).sort((a,b) => a.data.localeCompare(b.data));
        if (dados.length < 2) {
            chartContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;"><i class="fas fa-chart-line" style="font-size:2rem; display:block; margin-bottom:12px;"></i>Precisa de pelo menos 2 semanas com dados.</div>';
            return;
        }
        const dataMap = new Map();
        dados.forEach(l => {
            if (!dataMap.has(l.data)) dataMap.set(l.data, l);
        });
        const unicos = Array.from(dataMap.values()).sort((a,b) => a.data.localeCompare(b.data));
        const pontos = unicos.map(l => ({
            label: l.assunto || 'Sem assunto',
            perc: (l.acertos / l.feitas) * 100,
            data: l.data
        }));
        const width = Math.max(350, pontos.length * 55);
        const height = 200;
        const padding = 30;
        const innerWidth = width - padding * 2;
        const innerHeight = height - padding * 2;
        const maxVal = 100;
        let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto;">`;
        svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="var(--border-color)" stroke-width="1.5"/>`;
        svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border-color)" stroke-width="1.5"/>`;
        for (let g = 0; g <= 100; g += 25) {
            const y = height - padding - (g / maxVal) * innerHeight;
            svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="var(--border-color)" stroke-width="0.8" stroke-dasharray="4,4"/>`;
            svg += `<text x="${padding - 6}" y="${y + 4}" font-size="8" fill="var(--text-muted)" text-anchor="end">${g}%</text>`;
        }
        const points = pontos.map((p, i) => {
            const x = padding + (i / (pontos.length - 1)) * innerWidth;
            const y = height - padding - (p.perc / maxVal) * innerHeight;
            return { x, y, label: p.label, perc: p.perc };
        });
        svg += `<polyline points="${points.map(p => p.x+','+p.y).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
        points.forEach((p, i) => {
            svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent)" stroke="var(--bg-main)" stroke-width="2"/>`;
            svg += `<text x="${p.x}" y="${height - padding + 14}" font-size="7" fill="var(--text-secondary)" text-anchor="middle" transform="rotate(-30, ${p.x}, ${height - padding + 14})">${p.label.length > 8 ? p.label.substr(0,6)+'…' : p.label}</text>`;
            svg += `<text x="${p.x}" y="${p.y - 8}" font-size="8" fill="var(--text-primary)" text-anchor="middle" font-weight="600">${Math.round(p.perc)}%</text>`;
        });
        svg += '</svg>';
        chartContainer.innerHTML = svg;
    }

    function renderPie(filtradas) {
        chartContainer.className = 'chart-pie-container';
        chartContainer.innerHTML = '';
        if (filtradas.length === 0) {
            chartContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">Nenhum dado para exibir.</div>';
            return;
        }
        const faixas = {
            'Alto (≥75%)': { count: 0, cor: 'var(--success)' },
            'Médio (50-74%)': { count: 0, cor: 'var(--warning)' },
            'Baixo (<50%)': { count: 0, cor: 'var(--danger)' }
        };
        const unicos = new Map();
        filtradas.forEach(l => {
            if (l.feitas === 0) return;
            const key = l.assunto || 'Sem assunto';
            if (!unicos.has(key) || (l.acertos/l.feitas) > (unicos.get(key).acertos/unicos.get(key).feitas)) {
                unicos.set(key, l);
            }
        });
        Array.from(unicos.values()).forEach(l => {
            const perc = (l.acertos / l.feitas) * 100;
            if (perc >= 75) faixas['Alto (≥75%)'].count++;
            else if (perc >= 50) faixas['Médio (50-74%)'].count++;
            else faixas['Baixo (<50%)'].count++;
        });
        const entries = Object.entries(faixas).filter(([k,v]) => v.count > 0);
        if (entries.length === 0) {
            chartContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">Nenhum dado com exercícios feitos.</div>';
            return;
        }
        const total = entries.reduce((sum, [k,v]) => sum + v.count, 0);
        const size = 200;
        const radius = 80;
        const cx = size/2, cy = size/2;
        let svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="max-width:200px; height:auto;">`;
        let startAngle = -90;
        entries.forEach(([faixa, { count, cor }]) => {
            const angle = (count / total) * 360;
            const endAngle = startAngle + angle;
            const rad1 = startAngle * Math.PI / 180;
            const rad2 = endAngle * Math.PI / 180;
            const x1 = cx + radius * Math.cos(rad1);
            const y1 = cy + radius * Math.sin(rad1);
            const x2 = cx + radius * Math.cos(rad2);
            const y2 = cy + radius * Math.sin(rad2);
            const large = angle > 180 ? 1 : 0;
            svg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z" fill="${cor}" stroke="var(--bg-main)" stroke-width="2"/>`;
            const midAngle = (startAngle + endAngle) / 2;
            const radMid = midAngle * Math.PI / 180;
            const labelR = radius * 0.65;
            const lx = cx + labelR * Math.cos(radMid);
            const ly = cy + labelR * Math.sin(radMid);
            svg += `<text x="${lx}" y="${ly + 4}" font-size="10" fill="white" text-anchor="middle" font-weight="600">${(count/total*100).toFixed(1)}%</text>`;
            startAngle = endAngle;
        });
        svg += '</svg>';
        let legend = '<div class="pie-legend">';
        entries.forEach(([faixa, { count, cor }]) => {
            legend += `<div class="legend-item"><span class="color-box" style="background:${cor}"></span> ${faixa} (${count})</div>`;
        });
        legend += '</div>';
        chartContainer.innerHTML = svg + legend;
    }

    // ===== FLASHCARDS =====
    function renderizarFlashcards(filtradas) {
        flashcardGrid.innerHTML = '';
        if (filtradas.length === 0) {
            flashcardGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:30px 0;"><i class="fas fa-brain" style="font-size:2rem; display:block; margin-bottom:12px;"></i>Adicione dados para ver a análise.</div>';
            return;
        }
        const comDados = filtradas.filter(l => l.feitas > 0);
        if (comDados.length === 0) {
            flashcardGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:30px 0;"><i class="fas fa-chart-simple" style="font-size:2rem; display:block; margin-bottom:12px;"></i>Nenhum dado com exercícios feitos.</div>';
            return;
        }
        const melhor = comDados.reduce((a, b) => (a.acertos/a.feitas) > (b.acertos/b.feitas) ? a : b);
        const pMelhor = ((melhor.acertos/melhor.feitas)*100).toFixed(1);
        const pior = comDados.reduce((a, b) => (a.acertos/a.feitas) < (b.acertos/b.feitas) ? a : b);
        const pPior = ((pior.acertos/pior.feitas)*100).toFixed(1);
        const somaPerc = comDados.reduce((s, l) => s + (l.acertos/l.feitas), 0);
        const mediaPerc = (somaPerc / comDados.length * 100).toFixed(1);
        const minAcertos = comDados.reduce((min, l) => Math.min(min, l.acertos), Infinity);
        const maxAcertos = comDados.reduce((max, l) => Math.max(max, l.acertos), -Infinity);
        const datas = filtradas.filter(l => l.data && l.feitas > 0).map(l => new Date(l.data)).sort((a,b) => a - b);
        let maiorStrike = 0;
        let currentStrike = 1;
        for (let i = 1; i < datas.length; i++) {
            const diff = (datas[i] - datas[i-1]) / (1000*60*60*24);
            if (diff === 1) currentStrike++;
            else {
                if (currentStrike > maiorStrike) maiorStrike = currentStrike;
                currentStrike = 1;
            }
        }
        if (currentStrike > maiorStrike) maiorStrike = currentStrike;
        if (datas.length === 1) maiorStrike = 1;
        const periodo = datas.length > 0 ? `${datas[0].toLocaleDateString('pt-BR')} – ${datas[datas.length-1].toLocaleDateString('pt-BR')}` : '—';

        const cards = [
            { icon: '🏆', label: 'Melhor assunto', value: melhor.assunto || '—', sub: `${pMelhor}% de acertos`, cls: 'best' },
            { icon: '📉', label: 'Pior assunto', value: pior.assunto || '—', sub: `${pPior}% de acertos`, cls: 'worst' },
            { icon: '📊', label: 'Média de acertos', value: `${mediaPerc}%`, sub: `em ${comDados.length} assuntos`, cls: '' },
            { icon: '⬇️', label: 'Menor acertos', value: minAcertos, sub: `em um único assunto`, cls: '' },
            { icon: '⬆️', label: 'Maior acertos', value: maxAcertos, sub: `em um único assunto`, cls: '' },
            { icon: '🔥', label: 'Maior strike', value: `${maiorStrike} dias`, sub: `período: ${periodo}`, cls: 'strike' },
        ];

        cards.forEach((card, i) => {
            const div = document.createElement('div');
            div.className = `flashcard ${card.cls} delay-${(i%6)+1}`;
            div.setAttribute('role', 'listitem');
            div.innerHTML = `
                <span class="icon">${card.icon}</span>
                <div class="label">${card.label}</div>
                <div class="value">${card.value}</div>
                <div class="sub">${card.sub}</div>
            `;
            flashcardGrid.appendChild(div);
        });
    }

    // ===== ESTATÍSTICAS E REVISÕES =====
    function atualizarEstatisticas(filtradas) {
        const total = filtradas.length;
        let dominados = 0, revisoes = 0, somaPerc = 0, countPerc = 0;
        filtradas.forEach(linha => {
            const statusObj = calcularStatus(linha);
            if (statusObj.status === 'DOMINADO') dominados++;
            if (statusObj.precisaRevisar) revisoes++;
            if (linha.feitas > 0) {
                somaPerc += (linha.acertos / linha.feitas) * 100;
                countPerc++;
            }
        });
        totalSpan.textContent = total;
        dominatedSpan.textContent = dominados;
        revisionSpan.textContent = revisoes;
        avgSpan.textContent = countPerc > 0 ? (somaPerc / countPerc).toFixed(0) + '%' : '0%';
    }

    function atualizarRevisaoList(filtradas) {
        const items = filtradas.filter(l => calcularStatus(l).precisaRevisar && l.assunto);
        revisaoList.innerHTML = '';
        if (items.length === 0) {
            revisaoList.innerHTML = '<li class="revisao-empty" role="listitem"><i class="fas fa-check-circle" aria-hidden="true"></i> Nenhum assunto a revisar</li>';
            return;
        }
        items.forEach(l => {
            const li = document.createElement('li');
            li.setAttribute('role', 'listitem');
            li.innerHTML = `<i class="fas fa-exclamation-circle" aria-hidden="true"></i> ${l.assunto}`;
            revisaoList.appendChild(li);
        });
    }

    // ===== MODOS =====
    function aplicarModo() {
        tableView.style.display = (currentMode === 'table') ? 'block' : 'none';
        chartView.style.display = (currentMode === 'chart') ? 'block' : 'none';
        chartView.classList.toggle('active', currentMode === 'chart');
        flashcardView.style.display = (currentMode === 'flashcard') ? 'block' : 'none';
        flashcardView.classList.toggle('active', currentMode === 'flashcard');

        document.querySelectorAll('.mode-toggle button').forEach(btn => {
            const isActive = btn.dataset.mode === currentMode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        menuToggle.classList.toggle('hidden', currentMode === 'chart' || currentMode === 'flashcard');
    }

    // ===== SIDEBAR (overlay) =====
    function toggleSidebar(force) {
        const shouldOpen = (typeof force === 'boolean') ? force : !sidebar.classList.contains('open');
        sidebar.classList.toggle('open', shouldOpen);
        overlay.classList.toggle('active', shouldOpen);
        menuToggle.classList.toggle('hidden', shouldOpen);
        document.body.style.overflow = shouldOpen ? 'hidden' : '';
    }

    // ===== MANIPULAÇÃO DE DADOS =====
    function adicionarLinha(dados = null) {
        if (dados) {
            if (!dados.id) dados.id = nextId++;
            linhas.push(dados);
        } else {
            const nova = {
                id: nextId++,
                semana: linhas.length + 1,
                assunto: '',
                meta: 0,
                feitas: 0,
                acertos: 0,
                data: ''
            };
            linhas.push(nova);
        }
        salvarDados();
        renderizarCompleto();
        if (window.innerWidth <= 768) {
            const lastCard = cardsContainer.lastElementChild;
            if (lastCard) lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function removerLinha(id) {
        linhas = linhas.filter(l => l.id !== id);
        salvarDados();
        renderizarCompleto();
    }

    function atualizarLinhaDados(id, field, value) {
        const linha = linhas.find(l => l.id === id);
        if (!linha) return;
        if (field === 'semana') linha.semana = Number(value);
        else if (field === 'assunto') linha.assunto = value;
        else if (field === 'meta') linha.meta = Number(value);
        else if (field === 'feitas') linha.feitas = Number(value);
        else if (field === 'acertos') linha.acertos = Number(value);
        else if (field === 'data') linha.data = value;
        salvarDados();
        // Atualiza apenas a linha no DOM (sem recriar)
        atualizarLinhaDOM(id);
        // Atualiza estatísticas e revisões
        const filtradas = getLinhasOrdenadasEFiltradas();
        atualizarEstatisticas(filtradas);
        atualizarRevisaoList(filtradas);
        // Atualiza gráfico se estiver ativo
        if (currentMode === 'chart') renderizarGrafico(filtradas, currentChartType);
        if (currentMode === 'flashcard') renderizarFlashcards(filtradas);
    }

    function limparTudo() {
        if (!confirm('Tem certeza que deseja apagar todos os dados?')) return;
        linhas = [];
        nextId = 1;
        localStorage.removeItem('estudosData');
        localStorage.removeItem('nextId');
        renderizarCompleto();
    }

    // ===== FILTROS E ORDENAÇÃO =====
    function ordenarPor(key) {
        if (sortKey === key) sortAsc = !sortAsc;
        else { sortKey = key; sortAsc = true; }
        renderizarCompleto();
        document.querySelectorAll('th[data-sort]').forEach(th => {
            const isActive = th.dataset.sort === sortKey;
            th.setAttribute('aria-sort', isActive ? (sortAsc ? 'ascending' : 'descending') : 'none');
        });
    }

    function aplicarFiltros() {
        filtroAssunto = searchInput.value.toLowerCase().trim();
        filtroStatus = statusFilter.value;
        renderizarCompleto();
    }

    // ===== EXPORT/IMPORT =====
    function exportarDados() {
        const data = linhas.map(l => ({ id: l.id, semana: l.semana, assunto: l.assunto, meta: l.meta, feitas: l.feitas, acertos: l.acertos, data: l.data }));
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'estudos_backup.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importarDados(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) throw new Error('Formato inválido');
                linhas = imported.map(l => ({
                    id: l.id || 0,
                    semana: l.semana || '',
                    assunto: l.assunto || '',
                    meta: l.meta || 0,
                    feitas: l.feitas || 0,
                    acertos: l.acertos || 0,
                    data: l.data || ''
                }));
                const maxId = linhas.reduce((max, l) => Math.max(max, l.id || 0), 0);
                nextId = maxId + 1;
                salvarDados();
                renderizarCompleto();
                alert('Dados importados com sucesso!');
            } catch(err) {
                alert('Erro ao importar: arquivo inválido.');
            }
        };
        reader.readAsText(file);
    }

    // ===== TEMA =====
    function toggleTheme() {
        darkMode = !darkMode;
        if (darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.querySelector('.thumb').style.left = '25px';
            themeToggle.setAttribute('aria-checked', 'true');
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeToggle.querySelector('.thumb').style.left = '3px';
            themeToggle.setAttribute('aria-checked', 'false');
        }
        localStorage.setItem('darkMode', darkMode ? 'dark' : 'light');
    }

    // ===== BACK TO TOP =====
    function handleScroll() {
        if (window.scrollY > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    }

    // ===== EVENTOS =====
    function setupEventListeners() {
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => { ordenarPor(th.dataset.sort); });
        });

        // Inputs na tabela
        tbody.addEventListener('input', (e) => {
            const input = e.target;
            if (input.tagName !== 'INPUT') return;
            const id = parseInt(input.dataset.id, 10);
            if (isNaN(id)) return;
            const field = input.dataset.field;
            if (!field) return;
            let value = input.value;
            if (['semana','meta','feitas','acertos'].includes(field)) value = parseFloat(value) || 0;
            atualizarLinhaDados(id, field, value);
        });

        // Inputs nos cards (mobile) – agora sem recriar o card
        cardsContainer.addEventListener('input', (e) => {
            const input = e.target;
            if (input.tagName !== 'INPUT') return;
            const id = parseInt(input.dataset.id, 10);
            if (isNaN(id)) return;
            const field = input.dataset.field;
            if (!field) return;
            let value = input.value;
            if (['semana','meta','feitas','acertos'].includes(field)) value = parseFloat(value) || 0;
            atualizarLinhaDados(id, field, value);
        });

        // Rolagem suave para inputs em cards (mobile)
        cardsContainer.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                setTimeout(() => {
                    e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 300);
            }
        });

        // Delete buttons
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.delete-btn');
            if (btn) removerLinha(parseInt(btn.dataset.id, 10));
        });
        cardsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.delete-btn');
            if (btn) removerLinha(parseInt(btn.dataset.id, 10));
        });

        document.getElementById('addBtn').addEventListener('click', () => adicionarLinha());
        searchInput.addEventListener('input', aplicarFiltros);
        statusFilter.addEventListener('change', aplicarFiltros);

        document.getElementById('exportBtn').addEventListener('click', exportarDados);
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) { importarDados(e.target.files[0]); e.target.value = ''; }
        });
        document.getElementById('clearBtn').addEventListener('click', limparTudo);

        document.querySelectorAll('.mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                currentMode = btn.dataset.mode;
                aplicarModo();
                if (currentMode === 'chart') {
                    const filtradas = getLinhasOrdenadasEFiltradas();
                    renderizarGrafico(filtradas, currentChartType);
                }
                if (currentMode === 'flashcard') {
                    const filtradas = getLinhasOrdenadasEFiltradas();
                    renderizarFlashcards(filtradas);
                }
            });
        });

        document.querySelectorAll('#chartTypeGroup button').forEach(btn => {
            btn.addEventListener('click', () => {
                currentChartType = btn.dataset.chart;
                document.querySelectorAll('#chartTypeGroup button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (currentMode === 'chart') {
                    const filtradas = getLinhasOrdenadasEFiltradas();
                    renderizarGrafico(filtradas, currentChartType);
                }
            });
        });

        menuToggle.addEventListener('click', () => toggleSidebar(true));
        overlay.addEventListener('click', () => toggleSidebar(false));
        closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
        themeToggle.addEventListener('click', toggleTheme);
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        window.addEventListener('scroll', handleScroll);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) {
                toggleSidebar(false);
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 769 && sidebar.classList.contains('open')) {
                toggleSidebar(false);
            }
        });
    }

    // ===== INICIALIZAÇÃO =====
    function init() {
        carregarDados();
        carregarTema();
        renderizarCompleto();
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            menuToggle.classList.remove('hidden');
        } else {
            sidebar.classList.add('open');
            overlay.classList.remove('active');
            menuToggle.classList.add('hidden');
        }
        setupEventListeners();
        document.querySelectorAll('th[data-sort]').forEach(th => {
            if (th.dataset.sort === sortKey) {
                th.setAttribute('aria-sort', sortAsc ? 'ascending' : 'descending');
            }
        });
    }

    init();

})();