'use strict';

const STORAGE_KEY = 'anzan-settings-v1';
const DEFAULT_SHORTCUTS = Object.freeze({
  startConfirm: 'Enter',
  newTraining: 'KeyN',
  repeatTraining: 'KeyR',
  openConfig: 'KeyC',
  testSound: 'KeyB',
  cancelTraining: 'Escape'
});

const screens = {
  config: document.getElementById('configScreen'),
  training: document.getElementById('trainingScreen'),
  answer: document.getElementById('answerScreen'),
  result: document.getElementById('resultScreen')
};

const els = {
  configForm: document.getElementById('configForm'),
  operationMode: document.getElementById('operationMode'),
  numberCount: document.getElementById('numberCount'),
  displaySeconds: document.getElementById('displaySeconds'),
  displaySecondsOutput: document.getElementById('displaySecondsOutput'),
  digitCount: document.getElementById('digitCount'),
  fontSize: document.getElementById('fontSize'),
  fontSizeOutput: document.getElementById('fontSizeOutput'),
  autoStartSeconds: document.getElementById('autoStartSeconds'),
  showProgress: document.getElementById('showProgress'),
  soundEnabled: document.getElementById('soundEnabled'),
  soundTestBtn: document.getElementById('soundTestBtn'),
  modeBadge: document.getElementById('modeBadge'),
  progressText: document.getElementById('progressText'),
  currentNumber: document.getElementById('currentNumber'),
  answerForm: document.getElementById('answerForm'),
  answerInput: document.getElementById('answerInput'),
  resultCard: document.getElementById('resultCard'),
  resultIcon: document.getElementById('resultIcon'),
  resultLabel: document.getElementById('resultLabel'),
  resultTitle: document.getElementById('resultTitle'),
  resultComparison: document.getElementById('resultComparison'),
  sequenceList: document.getElementById('sequenceList'),
  configBtn: document.getElementById('configBtn'),
  repeatBtn: document.getElementById('repeatBtn'),
  newBtn: document.getElementById('newBtn'),
  autoStartMessage: document.getElementById('autoStartMessage'),
  resetShortcutsBtn: document.getElementById('resetShortcutsBtn'),
  shortcutStatus: document.getElementById('shortcutStatus'),
  shortcutButtons: [...document.querySelectorAll('.shortcut-capture')],
  startShortcutKbd: document.getElementById('startShortcutKbd'),
  confirmShortcutKbd: document.getElementById('confirmShortcutKbd'),
  cancelShortcutKbd: document.getElementById('cancelShortcutKbd'),
  configShortcutKbd: document.getElementById('configShortcutKbd'),
  repeatShortcutKbd: document.getElementById('repeatShortcutKbd'),
  newShortcutKbd: document.getElementById('newShortcutKbd')
};

let currentScreen = 'config';
let sequence = [];
let sequenceIndex = 0;
let correctResult = 0;
let displayTimer = null;
let autoStartTimer = null;
let autoStartTick = null;
let trainingRunId = 0;
let audioContext = null;
let shortcuts = { ...DEFAULT_SHORTCUTS };
let capturingShortcutAction = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapHalfSecond(value) {
  return Math.round(value * 2) / 2;
}

function getSettings() {
  return {
    operationMode: els.operationMode.value === 'mixed' ? 'mixed' : 'addition',
    numberCount: clamp(Number.parseInt(els.numberCount.value, 10) || 10, 2, 500),
    displaySeconds: clamp(snapHalfSecond(Number.parseFloat(els.displaySeconds.value) || 1), 0.5, 10),
    digitCount: clamp(Number.parseInt(els.digitCount.value, 10) || 1, 1, 5),
    fontSize: clamp(Number.parseInt(els.fontSize.value, 10) || 160, 64, 260),
    autoStartSeconds: clamp(Number.parseInt(els.autoStartSeconds.value, 10) || 0, 0, 3600),
    showProgress: els.showProgress.checked,
    soundEnabled: els.soundEnabled.checked,
    shortcuts: { ...shortcuts }
  };
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSettings()));
  } catch (error) {
    console.warn('Não foi possível salvar as configurações.', error);
  }
}

function sanitizeShortcuts(savedShortcuts) {
  const result = { ...DEFAULT_SHORTCUTS };
  const usedCodes = new Set();

  Object.keys(DEFAULT_SHORTCUTS).forEach((action) => {
    const candidate = typeof savedShortcuts?.[action] === 'string'
      ? savedShortcuts[action]
      : DEFAULT_SHORTCUTS[action];
    const fallback = DEFAULT_SHORTCUTS[action];
    const code = candidate && !usedCodes.has(candidate) ? candidate : fallback;

    if (!usedCodes.has(code)) {
      result[action] = code;
      usedCodes.add(code);
      return;
    }

    const availableDefault = Object.values(DEFAULT_SHORTCUTS).find((item) => !usedCodes.has(item));
    result[action] = availableDefault || fallback;
    usedCodes.add(result[action]);
  });

  return result;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (saved.operationMode) els.operationMode.value = saved.operationMode;
    if (saved.numberCount != null) els.numberCount.value = saved.numberCount;
    if (saved.displaySeconds != null) {
      els.displaySeconds.value = clamp(snapHalfSecond(Number(saved.displaySeconds) || 1), 0.5, 10);
    }
    if (saved.digitCount != null) els.digitCount.value = saved.digitCount;
    if (saved.fontSize != null) els.fontSize.value = saved.fontSize;
    if (saved.autoStartSeconds != null) els.autoStartSeconds.value = saved.autoStartSeconds;
    if (saved.showProgress != null) els.showProgress.checked = Boolean(saved.showProgress);
    if (saved.soundEnabled != null) els.soundEnabled.checked = Boolean(saved.soundEnabled);
    shortcuts = sanitizeShortcuts(saved.shortcuts);
  } catch (error) {
    console.warn('Configurações salvas inválidas; usando os valores padrão.', error);
  }
}

function formatSeconds(value) {
  return `${Number(value).toFixed(2).replace('.', ',')} s`;
}

function updateDisplaySecondsPreview() {
  const value = clamp(snapHalfSecond(Number(els.displaySeconds.value) || 1), 0.5, 10);
  els.displaySeconds.value = String(value);
  els.displaySecondsOutput.value = formatSeconds(value);
}

function updateFontSizePreview() {
  els.fontSizeOutput.value = `${els.fontSize.value} px`;
}

function humanizeKeyCode(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;

  const names = {
    Enter: 'Enter',
    Escape: 'Esc',
    Space: 'Espaço',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Tab: 'Tab'
  };

  return names[code] || code;
}

function updateShortcutUI() {
  els.shortcutButtons.forEach((button) => {
    const action = button.dataset.shortcutAction;
    const keyElement = button.querySelector('kbd');
    keyElement.textContent = humanizeKeyCode(shortcuts[action]);
    button.classList.toggle('capturing', capturingShortcutAction === action);
  });

  const startLabel = humanizeKeyCode(shortcuts.startConfirm);
  const cancelLabel = humanizeKeyCode(shortcuts.cancelTraining);
  els.startShortcutKbd.textContent = startLabel;
  els.confirmShortcutKbd.textContent = startLabel;
  els.cancelShortcutKbd.textContent = cancelLabel;
  els.configShortcutKbd.textContent = humanizeKeyCode(shortcuts.openConfig);
  els.repeatShortcutKbd.textContent = humanizeKeyCode(shortcuts.repeatTraining);
  els.newShortcutKbd.textContent = humanizeKeyCode(shortcuts.newTraining);
  els.soundTestBtn.title = `Testar som (${humanizeKeyCode(shortcuts.testSound)})`;
}

function beginShortcutCapture(action) {
  capturingShortcutAction = action;
  els.shortcutStatus.textContent = 'Pressione agora a tecla que deseja usar.';
  updateShortcutUI();
}

function finishShortcutCapture(action, newCode) {
  const previousCode = shortcuts[action];
  const conflictingAction = Object.keys(shortcuts).find(
    (candidate) => candidate !== action && shortcuts[candidate] === newCode
  );

  if (conflictingAction) {
    shortcuts[conflictingAction] = previousCode;
    els.shortcutStatus.textContent = 'Atalho alterado. As teclas conflitantes foram trocadas automaticamente.';
  } else {
    els.shortcutStatus.textContent = `Atalho alterado para ${humanizeKeyCode(newCode)}.`;
  }

  shortcuts[action] = newCode;
  capturingShortcutAction = null;
  updateShortcutUI();
  saveSettings();
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle('active', key === name);
  });
  currentScreen = name;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSequence(settings) {
  const minValue = settings.digitCount === 1 ? 1 : 10 ** (settings.digitCount - 1);
  const maxValue = 10 ** settings.digitCount - 1;
  const values = [];
  let runningTotal = 0;

  for (let i = 0; i < settings.numberCount; i += 1) {
    let value;

    if (settings.operationMode === 'addition' || i === 0 || runningTotal <= 1) {
      value = randomInt(minValue, maxValue);
    } else {
      const useSubtraction = Math.random() < 0.42;

      if (useSubtraction) {
        const subtractionMax = Math.min(maxValue, runningTotal);
        if (subtractionMax >= 1) {
          const subtractionMin = Math.min(minValue, subtractionMax);
          value = -randomInt(subtractionMin, subtractionMax);
        } else {
          value = randomInt(minValue, maxValue);
        }
      } else {
        value = randomInt(minValue, maxValue);
      }
    }

    runningTotal += value;
    values.push(value);
  }

  return values;
}

function calculateSequence(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

function initAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
}

function beep(force = false) {
  const settings = getSettings();
  if (!force && !settings.soundEnabled) return;

  initAudio();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.105);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.12);
}

function clearTimers() {
  if (displayTimer) window.clearTimeout(displayTimer);
  if (autoStartTimer) window.clearTimeout(autoStartTimer);
  if (autoStartTick) window.clearInterval(autoStartTick);
  displayTimer = null;
  autoStartTimer = null;
  autoStartTick = null;
}

function startTraining({ repeat = false } = {}) {
  clearTimers();
  trainingRunId += 1;
  const runId = trainingRunId;
  saveSettings();
  const settings = getSettings();

  if (!repeat || sequence.length === 0) {
    sequence = generateSequence(settings);
  }

  correctResult = calculateSequence(sequence);
  sequenceIndex = 0;
  els.modeBadge.textContent = settings.operationMode === 'mixed' ? 'Soma + subtração' : 'Apenas soma';
  els.progressText.hidden = !settings.showProgress;
  els.currentNumber.style.fontSize = `${settings.fontSize}px`;
  els.currentNumber.textContent = '';
  els.currentNumber.classList.remove('negative');
  els.progressText.textContent = `0 / ${sequence.length}`;
  showScreen('training');
  initAudio();
  displayTimer = window.setTimeout(() => {
    if (runId === trainingRunId && currentScreen === 'training') displayNextNumber(runId);
  }, settings.displaySeconds * 1000);
}

function displayNextNumber(runId) {
  if (runId !== trainingRunId || currentScreen !== 'training') return;
  const settings = getSettings();
  const value = sequence[sequenceIndex];

  els.currentNumber.textContent = value > 0 && settings.operationMode === 'mixed' ? `+${value}` : String(value);
  els.currentNumber.classList.toggle('negative', value < 0);
  els.currentNumber.style.animation = 'none';
  void els.currentNumber.offsetWidth;
  els.currentNumber.style.animation = '';
  els.progressText.textContent = `${sequenceIndex + 1} / ${sequence.length}`;
  beep();

  sequenceIndex += 1;
  const nextAction = sequenceIndex >= sequence.length ? showAnswerScreen : () => displayNextNumber(runId);
  displayTimer = window.setTimeout(() => {
    if (runId === trainingRunId && currentScreen === 'training') nextAction();
  }, settings.displaySeconds * 1000);
}

function showAnswerScreen() {
  clearTimers();
  els.answerInput.value = '';
  showScreen('answer');
  window.setTimeout(() => {
    els.answerInput.focus();
    els.answerInput.select();
  }, 0);
}

function renderSequence() {
  els.sequenceList.replaceChildren();
  sequence.forEach((value) => {
    const chip = document.createElement('span');
    chip.textContent = value > 0 ? `+${value}` : String(value);
    chip.classList.toggle('negative', value < 0);
    els.sequenceList.appendChild(chip);
  });
}

function showResult(userAnswer) {
  clearTimers();
  const isCorrect = userAnswer === correctResult;
  els.resultCard.classList.toggle('wrong', !isCorrect);
  els.resultIcon.textContent = isCorrect ? '✓' : '×';
  els.resultLabel.textContent = isCorrect ? 'RESPOSTA CORRETA' : 'RESPOSTA INCORRETA';
  els.resultTitle.textContent = isCorrect ? 'Você acertou!' : 'Quase! Tente novamente.';
  els.resultComparison.innerHTML = isCorrect
    ? `Resultado final: <strong>${correctResult}</strong>`
    : `Você respondeu <strong>${userAnswer}</strong>. O resultado correto era <strong>${correctResult}</strong>.`;

  renderSequence();
  showScreen('result');
  scheduleAutoStart();
}

function scheduleAutoStart() {
  const seconds = getSettings().autoStartSeconds;
  if (seconds <= 0) {
    els.autoStartMessage.textContent = 'Início automático desativado.';
    return;
  }

  let remaining = seconds;
  const updateMessage = () => {
    els.autoStartMessage.textContent = `Novo treino começará automaticamente em ${remaining}s.`;
  };
  updateMessage();

  autoStartTick = window.setInterval(() => {
    remaining -= 1;
    if (remaining > 0) updateMessage();
  }, 1000);

  autoStartTimer = window.setTimeout(() => {
    clearTimers();
    startTraining({ repeat: false });
  }, seconds * 1000);
}

function returnToConfig() {
  clearTimers();
  trainingRunId += 1;
  showScreen('config');
  els.numberCount.focus();
}

function submitAnswerFromShortcut() {
  const userAnswer = Number(els.answerInput.value);
  if (!Number.isFinite(userAnswer) || els.answerInput.value.trim() === '') {
    els.answerInput.focus();
    return;
  }
  showResult(userAnswer);
}

function actionForCode(code) {
  return Object.keys(shortcuts).find((action) => shortcuts[action] === code) || null;
}

els.configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  startTraining({ repeat: false });
});

els.answerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitAnswerFromShortcut();
});

els.configBtn.addEventListener('click', returnToConfig);
els.repeatBtn.addEventListener('click', () => startTraining({ repeat: true }));
els.newBtn.addEventListener('click', () => startTraining({ repeat: false }));
els.soundTestBtn.addEventListener('click', () => beep(true));

els.displaySeconds.addEventListener('input', () => {
  updateDisplaySecondsPreview();
  saveSettings();
});

els.fontSize.addEventListener('input', () => {
  updateFontSizePreview();
  saveSettings();
});

els.configForm.addEventListener('input', saveSettings);
els.configForm.addEventListener('change', saveSettings);

els.shortcutButtons.forEach((button) => {
  button.addEventListener('click', () => beginShortcutCapture(button.dataset.shortcutAction));
});

els.resetShortcutsBtn.addEventListener('click', () => {
  shortcuts = { ...DEFAULT_SHORTCUTS };
  capturingShortcutAction = null;
  els.shortcutStatus.textContent = 'Atalhos padrão restaurados.';
  updateShortcutUI();
  saveSettings();
});

document.addEventListener('keydown', (event) => {
  if (capturingShortcutAction) {
    if (event.code === 'ControlLeft' || event.code === 'ControlRight' ||
        event.code === 'ShiftLeft' || event.code === 'ShiftRight' ||
        event.code === 'AltLeft' || event.code === 'AltRight' ||
        event.code === 'MetaLeft' || event.code === 'MetaRight') {
      event.preventDefault();
      els.shortcutStatus.textContent = 'Escolha uma tecla principal, sem Ctrl, Shift, Alt ou Windows.';
      return;
    }

    if (capturingShortcutAction === 'startConfirm' &&
        (event.code.startsWith('Digit') || event.code.startsWith('Numpad'))) {
      event.preventDefault();
      els.shortcutStatus.textContent = 'Para iniciar/confirmar, escolha uma tecla que não seja número.';
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    finishShortcutCapture(capturingShortcutAction, event.code || event.key);
    return;
  }

  if (event.ctrlKey || event.altKey || event.metaKey) return;

  const action = actionForCode(event.code || event.key);
  const startCode = shortcuts.startConfirm;

  // Impede que Enter continue sendo um atalho oculto depois de ser substituído.
  if (event.code === 'Enter' && startCode !== 'Enter' &&
      (currentScreen === 'config' || currentScreen === 'answer')) {
    event.preventDefault();
  }

  if (!action) return;

  if (action === 'cancelTraining' && currentScreen !== 'config') {
    event.preventDefault();
    returnToConfig();
    return;
  }

  if (currentScreen === 'config') {
    if (action === 'startConfirm') {
      event.preventDefault();
      startTraining({ repeat: false });
    } else if (action === 'testSound') {
      event.preventDefault();
      beep(true);
    }
    return;
  }

  if (currentScreen === 'answer' && action === 'startConfirm') {
    event.preventDefault();
    submitAnswerFromShortcut();
    return;
  }

  if (currentScreen === 'training') {
    if (action === 'newTraining') {
      event.preventDefault();
      startTraining({ repeat: false });
    } else if (action === 'repeatTraining') {
      event.preventDefault();
      startTraining({ repeat: true });
    }
    return;
  }

  if (currentScreen === 'result') {
    if (action === 'newTraining') {
      event.preventDefault();
      startTraining({ repeat: false });
    } else if (action === 'repeatTraining') {
      event.preventDefault();
      startTraining({ repeat: true });
    } else if (action === 'openConfig') {
      event.preventDefault();
      returnToConfig();
    }
  }
});

loadSettings();
updateDisplaySecondsPreview();
updateFontSizePreview();
updateShortcutUI();
showScreen('config');
