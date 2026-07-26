// StudyMate-AI front-end logic
// Handles: mode switching, calling /api/generate, rendering summary/flashcards/quiz

const state = {
  mode: 'summary',
  flashcards: [],
  currentCard: 0,
  quiz: [],
};

const el = {
  notesInput: document.getElementById('notesInput'),
  modeTabs: document.querySelectorAll('.mode-tab'),
  countControl: document.getElementById('countControl'),
  difficultyControl: document.getElementById('difficultyControl'),
  countSelect: document.getElementById('countSelect'),
  difficultySelect: document.getElementById('difficultySelect'),
  generateBtn: document.getElementById('generateBtn'),
  generateBtnText: document.getElementById('generateBtnText'),
  errorMsg: document.getElementById('errorMsg'),

  outputEmpty: document.getElementById('outputEmpty'),
  outputLoading: document.getElementById('outputLoading'),
  loadingText: document.getElementById('loadingText'),

  summaryOutput: document.getElementById('summaryOutput'),

  flashcardsOutput: document.getElementById('flashcardsOutput'),
  flashcardStage: document.getElementById('flashcardStage'),
  cardCounter: document.getElementById('cardCounter'),
  prevCardBtn: document.getElementById('prevCardBtn'),
  nextCardBtn: document.getElementById('nextCardBtn'),

  quizOutput: document.getElementById('quizOutput'),
  quizList: document.getElementById('quizList'),
  quizScoreBar: document.getElementById('quizScoreBar'),
  quizScoreText: document.getElementById('quizScoreText'),
  checkQuizBtn: document.getElementById('checkQuizBtn'),
};

// ---------------- Mode switching ----------------

el.modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    el.modeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.mode = tab.dataset.mode;

    el.difficultyControl.style.display = state.mode === 'quiz' ? 'flex' : 'none';
    el.countControl.style.display = state.mode === 'summary' ? 'none' : 'flex';

    const labels = {
      summary: 'Generate summary',
      flashcards: 'Generate flashcards',
      quiz: 'Generate quiz',
    };
    el.generateBtnText.textContent = labels[state.mode];
    el.errorMsg.textContent = '';
  });
});

// ---------------- Generate button ----------------

el.generateBtn.addEventListener('click', async () => {
  const text = el.notesInput.value.trim();
  el.errorMsg.textContent = '';

  if (!text) {
    el.errorMsg.textContent = 'Please paste some notes or text first.';
    return;
  }

  showLoading(state.mode);
  el.generateBtn.disabled = true;

  try {
    const payload = {
      mode: state.mode,
      text,
      count: parseInt(el.countSelect.value, 10),
      difficulty: el.difficultySelect.value,
    };

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    if (state.mode === 'summary') {
      renderSummary(data.summary);
    } else if (state.mode === 'flashcards') {
      renderFlashcards(data.flashcards);
    } else if (state.mode === 'quiz') {
      renderQuiz(data.quiz);
    }
  } catch (err) {
    hideAllOutputs();
    el.outputEmpty.classList.remove('hidden');
    el.errorMsg.textContent = err.message;
  } finally {
    el.generateBtn.disabled = false;
  }
});

// ---------------- Loading / empty state helpers ----------------

function hideAllOutputs() {
  el.outputEmpty.classList.add('hidden');
  el.outputLoading.classList.add('hidden');
  el.summaryOutput.classList.add('hidden');
  el.flashcardsOutput.classList.add('hidden');
  el.quizOutput.classList.add('hidden');
}

function showLoading(mode) {
  hideAllOutputs();
  el.outputLoading.classList.remove('hidden');
  const messages = {
    summary: 'Reading through your notes...',
    flashcards: 'Turning key facts into flashcards...',
    quiz: 'Writing practice questions...',
  };
  el.loadingText.textContent = messages[mode];
}

// ---------------- Summary rendering ----------------

function renderSummary(markdown) {
  hideAllOutputs();
  el.summaryOutput.innerHTML = simpleMarkdownToHtml(markdown);
  el.summaryOutput.classList.remove('hidden');
}

function simpleMarkdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;

  for (let rawLine of lines) {
    let line = rawLine.trim();

    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);

    if (h3 || h2 || h1) {
      if (inList) { html += '</ul>'; inList = false; }
      const content = inlineFormat((h3 || h2 || h1)[1]);
      const tag = h3 ? 'h3' : h2 ? 'h2' : 'h1';
      html += `<${tag}>${content}</${tag}>`;
      continue;
    }

    // Bullet list
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inlineFormat(bullet[1])}</li>`;
      continue;
    }

    if (inList) { html += '</ul>'; inList = false; }
    html += `<p>${inlineFormat(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

function inlineFormat(text) {
  // escape basic HTML first
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return text;
}

// ---------------- Flashcards rendering ----------------

function renderFlashcards(cards) {
  hideAllOutputs();
  state.flashcards = cards;
  state.currentCard = 0;
  el.flashcardsOutput.classList.remove('hidden');
  renderCurrentCard();
}

function renderCurrentCard() {
  const total = state.flashcards.length;
  if (total === 0) {
    el.flashcardStage.innerHTML = '<p>No flashcards were generated. Try again with more text.</p>';
    return;
  }
  const card = state.flashcards[state.currentCard];
  el.cardCounter.textContent = `Card ${state.currentCard + 1} / ${total}`;
  el.prevCardBtn.disabled = state.currentCard === 0;
  el.nextCardBtn.disabled = state.currentCard === total - 1;

  el.flashcardStage.innerHTML = `
    <div class="flashcard" id="activeFlashcard">
      <div class="flashcard-inner">
        <div class="flashcard-face front">${escapeHtml(card.question)}</div>
        <div class="flashcard-face back">${escapeHtml(card.answer)}</div>
      </div>
    </div>
  `;

  document.getElementById('activeFlashcard').addEventListener('click', function () {
    this.classList.toggle('flipped');
  });
}

el.prevCardBtn.addEventListener('click', () => {
  if (state.currentCard > 0) {
    state.currentCard -= 1;
    renderCurrentCard();
  }
});

el.nextCardBtn.addEventListener('click', () => {
  if (state.currentCard < state.flashcards.length - 1) {
    state.currentCard += 1;
    renderCurrentCard();
  }
});

// ---------------- Quiz rendering ----------------

function renderQuiz(questions) {
  hideAllOutputs();
  state.quiz = questions.map(q => ({ ...q, selected: null }));
  el.quizOutput.classList.remove('hidden');
  el.quizScoreBar.classList.add('hidden');
  el.checkQuizBtn.disabled = false;
  el.checkQuizBtn.textContent = 'Check answers';

  el.quizList.innerHTML = state.quiz.map((q, qi) => `
    <div class="quiz-item" data-qindex="${qi}">
      <div class="quiz-question">${qi + 1}. ${escapeHtml(q.question)}</div>
      ${q.options.map((opt, oi) => `
        <label class="quiz-option" data-oindex="${oi}">
          <input type="radio" name="q${qi}" value="${oi}">
          <span>${escapeHtml(opt)}</span>
        </label>
      `).join('')}
      <div class="quiz-explanation" id="explanation-${qi}">${escapeHtml(q.explanation || '')}</div>
    </div>
  `).join('');

  // wire up selection
  el.quizList.querySelectorAll('.quiz-item').forEach(itemEl => {
    const qi = parseInt(itemEl.dataset.qindex, 10);
    itemEl.querySelectorAll('.quiz-option').forEach(optEl => {
      optEl.addEventListener('click', () => {
        const oi = parseInt(optEl.dataset.oindex, 10);
        state.quiz[qi].selected = oi;
        itemEl.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
        optEl.classList.add('selected');
        itemEl.querySelector(`input[value="${oi}"]`).checked = true;
      });
    });
  });
}

el.checkQuizBtn.addEventListener('click', () => {
  let correctCount = 0;

  state.quiz.forEach((q, qi) => {
    const itemEl = el.quizList.querySelector(`.quiz-item[data-qindex="${qi}"]`);
    const optionEls = itemEl.querySelectorAll('.quiz-option');

    optionEls.forEach((optEl, oi) => {
      optEl.style.pointerEvents = 'none';
      if (oi === q.correct_index) {
        optEl.classList.add('correct-answer');
      } else if (oi === q.selected && q.selected !== q.correct_index) {
        optEl.classList.add('wrong-answer');
      }
    });

    document.getElementById(`explanation-${qi}`).classList.add('visible');

    if (q.selected === q.correct_index) correctCount += 1;
  });

  el.quizScoreBar.classList.remove('hidden');
  el.quizScoreText.textContent = `You scored ${correctCount} / ${state.quiz.length}`;
  el.checkQuizBtn.disabled = true;
  el.checkQuizBtn.textContent = 'Answers checked';
});

// ---------------- Utils ----------------

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
