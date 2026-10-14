/**
 * FocusFlow Pomodoro Timer Application Logic
 * - 25m Focus / 5m Break Auto-Cycling Engine
 * - Circular SVG Progress Ring with Smooth Transitions
 * - Real-time Browser Tab Title Synchronization
 * - State Persistence in LocalStorage (Auto-Save & Retrieval)
 * - Micro-Interactions, Audio Controls & Keyboard Shortcuts
 */

(() => {
  'use strict';

  // Constants
  const WORK_TIME = 25 * 60; // 25 minutes = 1500 seconds
  const BREAK_TIME = 5 * 60;  // 5 minutes = 300 seconds
  const CIRCLE_RADIUS = 135;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~848.23
  const STORAGE_KEY = 'focusflow_pomodoro_state_v1';

  // DOM Elements
  const body = document.body;
  const timerDisplay = document.getElementById('timer-display');
  const timerSubStatus = document.getElementById('timer-sub-status');
  const timerTargetLabel = document.getElementById('timer-target-label');
  const modeBadge = document.getElementById('mode-badge');
  const modeText = document.getElementById('mode-text');
  const progressCircle = document.getElementById('progress-circle');

  // Controls
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');

  // Session Counter
  const sessionTracker = document.getElementById('session-tracker');
  const sessionCountEl = document.getElementById('session-count');
  const btnResetSessions = document.getElementById('btn-reset-sessions');

  // Ambient Sound & Volume Elements
  const soundChips = document.querySelectorAll('.chip');
  const activeSoundLabel = document.getElementById('active-sound-name');
  const volumeSlider = document.getElementById('volume-slider');
  const sliderFill = document.getElementById('slider-fill');
  const volumeText = document.getElementById('volume-text');
  const btnMute = document.getElementById('btn-mute');
  const iconVolHigh = document.getElementById('icon-volume-high');
  const iconVolLow = document.getElementById('icon-volume-low');
  const iconVolMuted = document.getElementById('icon-volume-muted');

  // Application State
  const state = {
    mode: 'work', // 'work' | 'break'
    timeLeft: WORK_TIME,
    totalTime: WORK_TIME,
    status: 'idle', // 'idle' | 'running' | 'paused'
    targetEndTime: null,
    intervalId: null,
    sessionsCompleted: 0,
    activeSound: 'none',
    volume: 0.6,
    isMuted: false
  };

  /**
   * Initialize SVG Progress Ring attributes
   */
  function initProgressRing() {
    progressCircle.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE}`;
    progressCircle.style.strokeDashoffset = '0';
  }

  /**
   * Format Seconds to MM:SS string
   */
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Update Circular Progress Ring SVG
   */
  function updateProgressRing() {
    const fraction = state.timeLeft / state.totalTime;
    // Clockwise depletion: 0 when full, circumference when 0
    const offset = CIRCLE_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
    progressCircle.style.strokeDashoffset = `${offset}`;
  }

  /**
   * Update Browser Tab Title
   */
  function updateTabTitle() {
    const timeFormatted = formatTime(state.timeLeft);

    if (state.status === 'running') {
      const modeLabel = state.mode === 'work' ? '🎯 집중 중' : '☕ 휴식 중';
      document.title = `(${timeFormatted}) ${modeLabel} | FocusFlow`;
    } else if (state.status === 'paused') {
      document.title = `(${timeFormatted}) ⏸️ 일시정지 | FocusFlow`;
    } else {
      document.title = `FocusFlow | 포모도로 타이머`;
    }
  }

  /**
   * Update Theme & Visual Elements according to current state
   */
  function updateUI() {
    const isWork = state.mode === 'work';

    // 1. Dynamic Background Theme
    body.classList.toggle('work-mode', isWork);
    body.classList.toggle('break-mode', !isWork);

    // 2. Mode Badges and Text
    if (isWork) {
      modeText.textContent = '집중 시간';
      timerTargetLabel.textContent = '목표: 25분 집중';
    } else {
      modeText.textContent = '휴식 시간';
      timerTargetLabel.textContent = '목표: 5분 휴식';
    }

    // 3. Sub-status label
    if (state.status === 'running') {
      timerSubStatus.textContent = isWork ? '집중 진행 중' : '휴식 진행 중';
    } else if (state.status === 'paused') {
      timerSubStatus.textContent = '일시 정지됨';
    } else {
      timerSubStatus.textContent = '준비 완료';
    }

    // 4. Digital Timer Readout
    timerDisplay.textContent = formatTime(state.timeLeft);

    // 5. Circular Ring Progress
    updateProgressRing();

    // 6. Buttons State
    if (state.status === 'running') {
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnReset.disabled = false;
    } else if (state.status === 'paused') {
      btnStart.disabled = false;
      btnPause.disabled = true;
      btnReset.disabled = false;
    } else { // idle
      btnStart.disabled = false;
      btnPause.disabled = true;
      btnReset.disabled = false;
    }

    // 7. Session Counter Display
    sessionCountEl.textContent = state.sessionsCompleted;

    // 8. Tab Title
    updateTabTitle();
  }

  /**
   * LocalStorage: Save Current State
   */
  function saveState() {
    const payload = {
      mode: state.mode,
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      status: state.status,
      targetEndTime: state.targetEndTime,
      sessionsCompleted: state.sessionsCompleted,
      activeSound: state.activeSound,
      volume: state.volume,
      isMuted: state.isMuted,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  /**
   * LocalStorage: Load & Restore Previous State
   */
  function loadState() {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      if (!dataStr) return;

      const saved = JSON.parse(dataStr);
      if (!saved) return;

      // Restore sessions count
      if (typeof saved.sessionsCompleted === 'number') {
        state.sessionsCompleted = Math.max(0, saved.sessionsCompleted);
      }

      // Restore mode & total time
      if (saved.mode === 'work' || saved.mode === 'break') {
        state.mode = saved.mode;
        state.totalTime = saved.totalTime || (saved.mode === 'work' ? WORK_TIME : BREAK_TIME);
      }

      // Restore audio preferences
      if (typeof saved.volume === 'number') {
        state.volume = saved.volume;
      }
      if (typeof saved.isMuted === 'boolean') {
        state.isMuted = saved.isMuted;
      }
      if (saved.activeSound && ['none', 'waves', 'rain', 'birds'].includes(saved.activeSound)) {
        state.activeSound = saved.activeSound;
      }

      // Restore timer remaining time
      if (saved.status === 'running' && saved.targetEndTime) {
        const remaining = Math.round((saved.targetEndTime - Date.now()) / 1000);
        if (remaining > 0) {
          state.timeLeft = remaining;
          state.status = 'paused'; // Safe resumption in paused state so user can resume when ready
        } else {
          // If session ended while away, reset to completed mode's counterpart
          if (state.mode === 'work') {
            state.sessionsCompleted++;
            state.mode = 'break';
            state.timeLeft = BREAK_TIME;
            state.totalTime = BREAK_TIME;
          } else {
            state.mode = 'work';
            state.timeLeft = WORK_TIME;
            state.totalTime = WORK_TIME;
          }
          state.status = 'idle';
        }
      } else if (typeof saved.timeLeft === 'number') {
        state.timeLeft = Math.max(0, Math.min(state.totalTime, saved.timeLeft));
        state.status = (saved.status === 'paused') ? 'paused' : 'idle';
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
  }

  /**
   * Timer Tick Handler (Runs every 250ms for smooth accuracy)
   */
  function onTick() {
    if (state.status !== 'running') return;

    const now = Date.now();
    const remaining = Math.round((state.targetEndTime - now) / 1000);

    if (remaining <= 0) {
      state.timeLeft = 0;
      updateUI();
      handleSessionComplete();
      return;
    }

    if (remaining !== state.timeLeft) {
      state.timeLeft = remaining;
      updateUI();
      saveState();
    }
  }

  /**
   * Handle Session Completion (25m Focus or 5m Break ends)
   */
  function handleSessionComplete() {
    clearInterval(state.intervalId);
    state.intervalId = null;

    const previousMode = state.mode;

    // 1. Play Harmonious Chime Alarm
    if (window.soundEngine) {
      window.soundEngine.playAlarm(previousMode);
    }

    // 2. State Transition
    if (previousMode === 'work') {
      // Focus Completed!
      state.sessionsCompleted++;
      state.mode = 'break';
      state.timeLeft = BREAK_TIME;
      state.totalTime = BREAK_TIME;

      // Celebrate Animation
      sessionTracker.classList.remove('celebrate');
      void sessionTracker.offsetWidth; // Reflow
      sessionTracker.classList.add('celebrate');
    } else {
      // Break Completed!
      state.mode = 'work';
      state.timeLeft = WORK_TIME;
      state.totalTime = WORK_TIME;
    }

    // Requirement 1: 25분 집중, 5분 휴식을 한 세트로 자동 전환되어야 함
    // Automatically transition and start next session
    state.status = 'running';
    state.targetEndTime = Date.now() + state.timeLeft * 1000;
    state.intervalId = setInterval(onTick, 250);

    updateUI();
    saveState();
  }

  /**
   * Start Timer
   */
  function startTimer() {
    if (state.status === 'running') return;

    if (window.soundEngine) {
      window.soundEngine.init();
    }

    state.status = 'running';
    state.targetEndTime = Date.now() + state.timeLeft * 1000;

    clearInterval(state.intervalId);
    state.intervalId = setInterval(onTick, 250);

    updateUI();
    saveState();
  }

  /**
   * Pause Timer
   */
  function pauseTimer() {
    if (state.status !== 'running') return;

    clearInterval(state.intervalId);
    state.intervalId = null;
    state.status = 'paused';

    if (state.targetEndTime) {
      state.timeLeft = Math.max(0, Math.round((state.targetEndTime - Date.now()) / 1000));
    }

    updateUI();
    saveState();
  }

  /**
   * Reset Timer
   */
  function resetTimer() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.status = 'idle';

    state.timeLeft = (state.mode === 'work') ? WORK_TIME : BREAK_TIME;
    state.totalTime = state.timeLeft;
    state.targetEndTime = null;

    updateUI();
    saveState();
  }

  /**
   * Reset Session Counter
   */
  function resetSessionCounter() {
    if (confirm('완료한 세션 카운트를 초기화하시겠습니까?')) {
      state.sessionsCompleted = 0;
      updateUI();
      saveState();
    }
  }

  /**
   * Sound & Volume UI Synchronization
   */
  function updateVolumeUI() {
    const volPercent = Math.round(state.volume * 100);
    volumeSlider.value = state.isMuted ? 0 : volPercent;
    sliderFill.style.width = `${state.isMuted ? 0 : volPercent}%`;
    volumeText.textContent = state.isMuted ? '0%' : `${volPercent}%`;

    // Dynamic Volume Icons
    if (state.isMuted || state.volume === 0) {
      iconVolMuted.classList.remove('hide');
      iconVolHigh.classList.add('hide');
      iconVolLow.classList.add('hide');
    } else if (state.volume < 0.4) {
      iconVolLow.classList.remove('hide');
      iconVolHigh.classList.add('hide');
      iconVolMuted.classList.add('hide');
    } else {
      iconVolHigh.classList.remove('hide');
      iconVolLow.classList.add('hide');
      iconVolMuted.classList.add('hide');
    }
  }

  function applySoundChipUI(soundType) {
    soundChips.forEach(chip => {
      const match = chip.dataset.sound === soundType;
      chip.classList.toggle('active', match);
      chip.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    const labels = {
      none: '꺼짐',
      waves: '🌊 파도',
      rain: '🌧️ 빗소리',
      birds: '🐦 새소리'
    };
    activeSoundLabel.textContent = labels[soundType] || '꺼짐';
  }

  function handleSoundSelect(soundType) {
    state.activeSound = soundType;
    applySoundChipUI(soundType);

    if (window.soundEngine) {
      window.soundEngine.setAmbientSound(soundType);
    }
    saveState();
  }

  function handleVolumeChange(val) {
    const numericVal = parseFloat(val) / 100;
    state.volume = numericVal;
    state.isMuted = numericVal === 0;

    if (window.soundEngine) {
      window.soundEngine.setVolume(numericVal);
    }
    updateVolumeUI();
    saveState();
  }

  function handleMuteToggle() {
    if (window.soundEngine) {
      const isMuted = window.soundEngine.toggleMute();
      state.isMuted = isMuted;
      state.volume = window.soundEngine.volume;
    } else {
      state.isMuted = !state.isMuted;
    }
    updateVolumeUI();
    saveState();
  }

  /**
   * Bind Event Listeners
   */
  function bindEvents() {
    // Buttons
    btnStart.addEventListener('click', startTimer);
    btnPause.addEventListener('click', pauseTimer);
    btnReset.addEventListener('click', resetTimer);
    btnResetSessions.addEventListener('click', resetSessionCounter);

    // Sound Chips
    soundChips.forEach(chip => {
      chip.addEventListener('click', () => {
        handleSoundSelect(chip.dataset.sound);
      });
    });

    // Volume Slider & Mute
    volumeSlider.addEventListener('input', (e) => {
      handleVolumeChange(e.target.value);
    });

    btnMute.addEventListener('click', handleMuteToggle);

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore if user is inside an input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (state.status === 'running') {
          pauseTimer();
        } else {
          startTimer();
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        resetTimer();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleMuteToggle();
      }
    });

    // Page Unload / Visibility Change Save
    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveState();
      } else {
        // When user returns to tab, recalculate if running
        if (state.status === 'running' && state.targetEndTime) {
          const remaining = Math.round((state.targetEndTime - Date.now()) / 1000);
          if (remaining > 0) {
            state.timeLeft = remaining;
          } else {
            handleSessionComplete();
          }
          updateUI();
        }
      }
    });
  }

  /**
   * Main Initialization
   */
  function init() {
    initProgressRing();
    loadState();

    // Sync Audio Engine with restored preferences
    if (window.soundEngine) {
      window.soundEngine.volume = state.volume;
      window.soundEngine.isMuted = state.isMuted;
    }

    applySoundChipUI(state.activeSound);
    updateVolumeUI();
    updateUI();
    bindEvents();
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
