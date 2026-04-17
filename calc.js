// ==================== 计算引擎 ====================

function _shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function _getVisibleQuestions(shuffledQuestions, answers) {
    const visible = [...shuffledQuestions];
    const gateIndex = visible.findIndex(q => q.id === 'drink_gate_q1');
    if (gateIndex !== -1 && answers['drink_gate_q1'] === 3) {
        visible.splice(gateIndex + 1, 0, { id: 'drink_gate_q2', special: true, kind: 'drink_trigger', text: '您对饮酒的态度是？', options: [{ label: '小酌怡情，喝不了太多。', value: 1 }, { label: '我习惯将白酒灌在保温杯，当白开水喝，酒精令我信服。', value: 2 }] });
    }
    return visible;
}

function _sumToLevel(score) {
    if (score <= 3) return 'L';
    if (score === 4) return 'M';
    return 'H';
}

function _levelNum(level) {
    return { L: 1, M: 2, H: 3 }[level];
}

function _parsePattern(pattern) {
    return pattern.replace(/-/g, '').split('');
}

// 核心计算函数（暴露给 app.js）
function computeResult(answers, data) {
    const { questions, specialQuestions, TYPE_LIBRARY, NORMAL_TYPES, dimensionMeta, dimensionOrder } = data;

    const rawScores = {};
    const levels = {};
    Object.keys(dimensionMeta).forEach(dim => { rawScores[dim] = 0; });

    questions.forEach(q => {
        rawScores[q.dim] += Number(answers[q.id] || 0);
    });

    Object.entries(rawScores).forEach(([dim, score]) => {
        levels[dim] = _sumToLevel(score);
    });

    const userVector = dimensionOrder.map(dim => _levelNum(levels[dim]));
    const ranked = NORMAL_TYPES.map(type => {
        const vector = _parsePattern(type.pattern).map(_levelNum);
        let distance = 0;
        let exact = 0;
        for (let i = 0; i < vector.length; i++) {
            const diff = Math.abs(userVector[i] - vector[i]);
            distance += diff;
            if (diff === 0) exact += 1;
        }
        const similarity = Math.max(0, Math.round((1 - distance / 30) * 100));
        return { ...type, ...TYPE_LIBRARY[type.code], distance, exact, similarity };
    }).sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (b.exact !== a.exact) return b.exact - a.exact;
        return b.similarity - a.similarity;
    });

    const bestNormal = ranked[0];
    const drunkTriggered = answers['drink_gate_q2'] === 2;

    let finalType;
    let modeKicker = '你的主类型';
    let badge = `匹配度 ${bestNormal.similarity}% · 精准命中 ${bestNormal.exact}/15 维`;
    let sub = '维度命中度较高，当前结果可视为你的第一人格画像。';
    let special = false;

    if (drunkTriggered) {
        finalType = TYPE_LIBRARY.DRUNK;
        modeKicker = '隐藏人格已激活';
        badge = '匹配度 100% · 酒精异常因子已接管';
        sub = '乙醇亲和性过强，系统已直接跳过常规人格审判。';
        special = true;
    } else if (bestNormal.similarity < 60) {
        finalType = TYPE_LIBRARY.HHHH;
        modeKicker = '系统强制兜底';
        badge = `标准人格库最高匹配仅 ${bestNormal.similarity}%`;
        sub = '标准人格库对你的脑回路集体罢工了，于是系统把你强制分配给了 HHHH。';
        special = true;
    } else {
        finalType = bestNormal;
    }

    return {
        rawScores,
        levels,
        ranked,
        bestNormal,
        finalType,
        modeKicker,
        badge,
        sub,
        special
    };
}

// 准备测试（返回乱序题目）
function prepareTest(questions, specialQuestions) {
    const shuffledRegular = _shuffle(questions);
    const insertIndex = Math.floor(Math.random() * shuffledRegular.length) + 1;
    return [
        ...shuffledRegular.slice(0, insertIndex),
        specialQuestions[0],
        ...shuffledRegular.slice(insertIndex)
    ];
}

// 暴露给 app.js 的可见题目计算（依赖 app.answers）
function getVisibleQuestions() {
    const visible = [...app.shuffledQuestions];
    const gateIndex = visible.findIndex(q => q.id === 'drink_gate_q1');
    if (gateIndex !== -1 && app.answers['drink_gate_q1'] === 3) {
        visible.splice(gateIndex + 1, 0, app.data.specialQuestions[1]);
    }
    return visible;
}
