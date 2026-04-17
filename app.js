// ==================== 加密数据加载 ====================
const _MANIFEST = {"dimensionMeta.enc":1054,"questions.enc":8582,"specialQuestions.enc":521,"typeLibrary_meta.enc":1946,"typeLibrary_desc.enc":7872,"typeImages.enc":728,"normalTypes.enc":1213,"dimExplanations.enc":3149,"manifest.enc":216};
const _KEY_MATERIAL = 'sbti2024_crypto_key_v1';
const _SALT = 'c2J0aV9zYWx0XzIwMjQ=';
const _BASE_URL = './texts';

let _aesKey = null;

async function _deriveKey() {
    if (_aesKey) return _aesKey;
    const password = _KEY_MATERIAL;
    const salt = Uint8Array.from(atob(_SALT), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password),
        { name: 'PBKDF2' }, false, ['deriveKey']
    );
    _aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    return _aesKey;
}

async function _decrypt(payload, key) {
    const [nonceB64, ctB64] = payload.split(':');
    const nonce = Uint8Array.from(atob(nonceB64), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct);
    return new TextDecoder().decode(pt);
}

async function _loadEncryptedFile(filename) {
    const key = await _deriveKey();
    const resp = await fetch(_BASE_URL + '/' + filename);
    if (!resp.ok) throw new Error('Failed to load ' + filename);
    const payload = await resp.text();
    const jsonStr = await _decrypt(payload, key);
    return JSON.parse(jsonStr);
}

async function _loadAllData() {
    const [dm, q, sq, tlm, tld, ti, nt, de] = await Promise.all([
        _loadEncryptedFile('dimensionMeta.enc'),
        _loadEncryptedFile('questions.enc'),
        _loadEncryptedFile('specialQuestions.enc'),
        _loadEncryptedFile('typeLibrary_meta.enc'),
        _loadEncryptedFile('typeLibrary_desc.enc'),
        _loadEncryptedFile('typeImages.enc'),
        _loadEncryptedFile('normalTypes.enc'),
        _loadEncryptedFile('dimExplanations.enc'),
    ]);
    // 合并 TYPE_LIBRARY
    const TYPE_LIBRARY = {};
    const allCodes = [...new Set([...Object.keys(tlm), ...Object.keys(tld)])];
    allCodes.forEach(code => {
        TYPE_LIBRARY[code] = { ...(tlm[code] || {}), ...(tld[code] || {}) };
    });
    return {
        dimensionMeta: dm.dimensionMeta,
        dimensionOrder: dm.dimensionOrder,
        DRUNK_TRIGGER_QUESTION_ID: dm.DRUNK_TRIGGER_QUESTION_ID,
        questions: q.questions,
        specialQuestions: sq.specialQuestions,
        TYPE_LIBRARY,
        TYPE_IMAGES: ti,
        NORMAL_TYPES: nt,
        DIM_EXPLANATIONS: de,
    };
}

// ==================== 应用状态 ====================
const app = {
    data: null,
    shuffledQuestions: [],
    answers: {},
    previewMode: false
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app.data = await _loadAllData();
    } catch(e) {
        console.error('数据加载失败:', e);
        alert('数据加载失败，请刷新重试');
        return;
    }
    bindEvents();
});

// ==================== 事件绑定 ====================
function bindEvents() {
    document.getElementById('startBtn').addEventListener('click', () => startTest(false));
    document.getElementById('backIntroBtn').addEventListener('click', () => showScreen('intro'));
    document.getElementById('submitBtn').addEventListener('click', renderResult);
    document.getElementById('restartBtn').addEventListener('click', () => startTest(false));
}

// ==================== 屏幕切换 ====================
function showScreen(name) {
    document.getElementById('intro').classList.toggle('active', name === 'intro');
    document.getElementById('test').classList.toggle('active', name === 'test');
    document.getElementById('result').classList.toggle('active', name === 'result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== 开始测试 ====================
function startTest(preview = false) {
    app.previewMode = preview;
    app.answers = {};
    const { questions, specialQuestions } = app.data;
    app.shuffledQuestions = prepareTest(questions, specialQuestions);
    renderQuestions();
    showScreen('test');
}

// ==================== 渲染题目 ====================
function renderQuestions() {
    const visibleQuestions = getVisibleQuestions();
    const questionList = document.getElementById('questionList');
    questionList.innerHTML = '';
    const { dimensionMeta } = app.data;

    visibleQuestions.forEach((q, index) => {
        const card = document.createElement('article');
        card.className = 'question';
        const isSpecial = q.special === true;
        const metaLabel = isSpecial ? '补充题' : (app.previewMode ? dimensionMeta[q.dim].name : '维度已隐藏');

        card.innerHTML = `
            <div class="question-meta">
                <span class="question-badge">第 ${index + 1} 题</span>
                <span class="question-type">${metaLabel}</span>
            </div>
            <div class="question-title">${q.text}</div>
            <div class="options">
                ${q.options.map((opt, i) => {
                    const code = ['A', 'B', 'C', 'D'][i];
                    const checked = app.answers[q.id] === opt.value ? 'checked' : '';
                    const selected = app.answers[q.id] === opt.value ? 'selected' : '';
                    return `
                        <label class="option ${selected}">
                            <input type="radio" name="${q.id}" value="${opt.value}" ${checked} />
                            <div class="option-code">${code}</div>
                            <div class="option-text">${opt.label}</div>
                        </label>
                    `;
                }).join('')}
            </div>
        `;
        questionList.appendChild(card);
    });

    questionList.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const { name, value } = e.target;
            app.answers[name] = Number(value);
            // 立即更新选中态视觉反馈
            e.target.closest('.option').classList.add('selected');
            e.target.closest('.option').parentElement.querySelectorAll('.option').forEach(opt => {
                if (opt !== e.target.closest('.option')) opt.classList.remove('selected');
            });
            if (name === 'drink_gate_q1') {
                if (Number(value) !== 3) {
                    delete app.answers['drink_gate_q2'];
                }
                renderQuestions();
                return;
            }
            updateProgress();
        });
    });

    updateProgress();
}

// ==================== 更新进度 ====================
function updateProgress() {
    const visibleQuestions = getVisibleQuestions();
    const total = visibleQuestions.length;
    const done = visibleQuestions.filter(q => app.answers[q.id] !== undefined).length;
    const percent = total ? (done / total) * 100 : 0;

    document.getElementById('progressBar').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = `${done} / ${total}`;

    const complete = done === total && total > 0;
    document.getElementById('submitBtn').disabled = !complete;
    document.getElementById('testHint').textContent = complete
        ? '都做完了。现在可以把你的电子魂魄交给结果页审判。'
        : '全选完才会放行。世界已经够乱了，起码把题做完整。';
}

// ==================== 渲染结果 ====================
function renderResult() {
    const result = computeResult(app.answers, app.data);
    const type = result.finalType;

    document.getElementById('resultModeKicker').textContent = result.modeKicker;
    document.getElementById('resultTypeName').textContent = `${type.code}（${type.cn}）`;
    document.getElementById('matchBadge').textContent = result.badge;
    document.getElementById('posterCaption').textContent = type.intro;
    document.getElementById('resultDesc').textContent = type.desc;

    const posterBox = document.getElementById('posterBox');
    const posterImage = document.getElementById('posterImage');
    const imageSrc = app.data.TYPE_IMAGES[type.code];
    if (imageSrc) {
        posterImage.src = imageSrc;
        posterImage.alt = `${type.code}（${type.cn}）`;
        posterBox.classList.remove('no-image');
    } else {
        posterImage.removeAttribute('src');
        posterBox.classList.add('no-image');
    }

    document.getElementById('funNote').textContent = result.special
        ? '本测试仅供娱乐。隐藏人格和傻乐兜底都属于作者故意埋的损招，请勿把它当成医学、心理学、相学、命理学或灵异学依据。'
        : '本测试仅供娱乐，别拿它当诊断、面试、相亲、分手、招魂、算命或人生判决书。你可以笑，但别太当真。';

    const { dimensionMeta, dimensionOrder, DIM_EXPLANATIONS } = app.data;
    const dimList = document.getElementById('dimList');
    dimList.innerHTML = dimensionOrder.map(dim => {
        const level = result.levels[dim];
        const explanation = DIM_EXPLANATIONS[dim][level];
        return `
            <div class="dim-item">
                <div class="dim-item-top">
                    <div class="dim-item-name">${dimensionMeta[dim].name}</div>
                    <div class="dim-item-score">${level} / ${result.rawScores[dim]}分</div>
                </div>
                <p>${explanation}</p>
            </div>
        `;
    }).join('');

    showScreen('result');
}
