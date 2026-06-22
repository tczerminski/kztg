(function () {
  const RADIO_STREAM_URL = 'https://s3.free-shoutcast.com/stream/18132';
  const sermonAudio = document.getElementById('audioElement');

  if (!sermonAudio) return;

  const radioAudio = new Audio();
  radioAudio.preload = 'none';
  radioAudio.crossOrigin = 'anonymous';
  radioAudio.src = RADIO_STREAM_URL;

  const state = {
    mode: null,
    currentButton: null,
    currentSermonUrl: '',
    radioWanted: false,
    resumeTime: 0,
  };

  const sermonPositions = new Map();

  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let dataArray = null;
  let rafId = null;
  let lastDrawAt = 0;
  let smoothedPoints = [];
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let lastReconnectAt = 0;

  const MAX_RECONNECT_ATTEMPTS = 6;
  const MIN_RECONNECT_GAP_MS = 1500;

  function getRadioButtons() {
    return Array.from(document.querySelectorAll('[data-radio-toggle]'));
  }

  function getRadioVisualizers() {
    return Array.from(document.querySelectorAll('[data-radio-visualizer]'));
  }

  function getSermonPlayer(button) {
    return button ? button.closest('[data-sermon-player]') : null;
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? `0${s}` : s}`;
  }

  function setButtonPlaying(button, isPlaying, selectors) {
    if (!button) return;
    const playIcon = button.querySelector(selectors.play);
    const pauseIcon = button.querySelector(selectors.pause);

    playIcon?.classList.toggle('hidden', isPlaying);
    pauseIcon?.classList.toggle('hidden', !isPlaying);
    button.classList.toggle('is-playing', isPlaying);
  }

  function setRadioButtonsPlaying(isPlaying) {
    getRadioButtons().forEach((button) => {
      setButtonPlaying(button, isPlaying, {
        play: '[data-radio-play-icon]',
        pause: '[data-radio-pause-icon]',
      });
    });
  }

  function setSermonButtonPlaying(button, isPlaying) {
    if (!button) return;

    setButtonPlaying(button, isPlaying, {
      play: '[data-play-icon]',
      pause: '[data-pause-icon]',
    });

    const player = getSermonPlayer(button);
    player?.classList.toggle('is-playing', isPlaying);
  }

  function updateSermonPlayerUI(button, currentTime, duration) {
    const player = getSermonPlayer(button);
    if (!player) return;

    const progress = player.querySelector('[data-sermon-progress]');
    const currentEl = player.querySelector('[data-current-time]');
    const totalEl = player.querySelector('[data-total-time]');

    if (currentEl) currentEl.textContent = formatTime(currentTime);
    if (totalEl && Number.isFinite(duration) && duration > 0) {
      totalEl.textContent = formatTime(duration);
    }

    if (progress) {
      progress.value =
        Number.isFinite(duration) && duration > 0
          ? String(Math.min(100, (currentTime / duration) * 100))
          : '0';
    }
  }

  function rememberCurrentSermonPosition() {
    if (!state.currentSermonUrl) return;

    sermonPositions.set(state.currentSermonUrl, {
      currentTime: Number.isFinite(sermonAudio.currentTime) ? sermonAudio.currentTime : 0,
      duration: Number.isFinite(sermonAudio.duration) ? sermonAudio.duration : 0,
    });
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function resetRadioReconnect() {
    reconnectAttempts = 0;
    clearReconnectTimer();
  }

  function scheduleRadioReconnect(reason) {
    if (state.mode !== 'radio' || !state.radioWanted) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    if (!radioAudio.paused && !radioAudio.ended) return;
    if (!radioAudio.error && radioAudio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const now = Date.now();
    if (now - lastReconnectAt < MIN_RECONNECT_GAP_MS) return;
    lastReconnectAt = now;

    clearReconnectTimer();
    reconnectAttempts += 1;

    reconnectTimer = setTimeout(() => {
      if (state.mode !== 'radio' || !state.radioWanted) return;

      radioAudio.pause();
      radioAudio.src = `${RADIO_STREAM_URL}?t=${Date.now()}`;
      radioAudio.load();
      radioAudio.play().catch((err) => console.warn('Radio reconnect failed:', reason, err));
    }, Math.min(12000, 800 * Math.pow(2, reconnectAttempts - 1)));
  }

  function drawVisualizerIdle() {
    getRadioVisualizers().forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(canvas.clientWidth * dpr) || Math.floor(canvas.offsetWidth * dpr) || 200;
      const height = Math.floor(canvas.clientHeight * dpr) || Math.floor(canvas.offsetHeight * dpr) || 52;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const isMobile = canvas.closest('.radio-inline-player--mobile') !== null;
      const idleColor = isMobile ? 'rgba(63, 86, 143, 0.35)' : 'rgba(255, 255, 255, 0.35)';

      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.strokeStyle = idleColor;
      ctx.lineWidth = Math.max(1, 2 * dpr);
      ctx.stroke();
    });
  }

  function ensureVisualizer() {
    if (!getRadioVisualizers().length) return false;
    if (analyser) return true;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;

    try {
      audioCtx = new AudioContextCtor();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.93;
      dataArray = new Uint8Array(analyser.fftSize);

      sourceNode = audioCtx.createMediaElementSource(radioAudio);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);

      return true;
    } catch (err) {
      console.warn('Visualizer unavailable:', err);
      return false;
    }
  }

  function drawVisualizerFrame(now = 0) {
    if (!analyser || !dataArray) return;

    if (now - lastDrawAt < 33) {
      rafId = requestAnimationFrame(drawVisualizerFrame);
      return;
    }
    lastDrawAt = now;

    analyser.getByteTimeDomainData(dataArray);

    getRadioVisualizers().forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);

      if (!width || !height) return;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();

      const pointCount = 96;
      const visualGain = 6.2;
      const maxSwing = height * 0.44;

      if (smoothedPoints.length !== pointCount) {
        smoothedPoints = new Array(pointCount).fill(height / 2);
      }

      const step = width / (pointCount - 1 || 1);
      for (let i = 0; i < pointCount; i += 1) {
        const sampleIndex = Math.floor((i / (pointCount - 1 || 1)) * (dataArray.length - 1));
        const centered = (dataArray[sampleIndex] - 128) / 128;
        const boosted = Math.max(-1, Math.min(1, centered * visualGain));
        const rawY = height / 2 + boosted * maxSwing;
        smoothedPoints[i] += (rawY - smoothedPoints[i]) * 0.26;

        const x = i * step;
        const y = smoothedPoints[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const isMobile = canvas.closest('.radio-inline-player--mobile') !== null;
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      if (isMobile) {
        grad.addColorStop(0, 'rgba(63, 86, 143, 0.55)');
        grad.addColorStop(0.5, 'rgba(63, 86, 143, 1)');
        grad.addColorStop(1, 'rgba(63, 86, 143, 0.55)');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.55)');
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(1, 2 * dpr);
      ctx.stroke();
    });

    rafId = requestAnimationFrame(drawVisualizerFrame);
  }

  function startVisualizer() {
    if (!ensureVisualizer()) {
      drawVisualizerIdle();
      return;
    }

    if (audioCtx && audioCtx.state !== 'running') {
      audioCtx.resume().catch(() => {});
    }

    if (audioCtx && audioCtx.state !== 'running') {
      const checkState = () => {
        if (audioCtx.state === 'running') {
          if (rafId) cancelAnimationFrame(rafId);
          lastDrawAt = 0;
          smoothedPoints = [];
          drawVisualizerFrame();
        } else {
          setTimeout(checkState, 50);
        }
      };

      checkState();
      return;
    }

    if (rafId) cancelAnimationFrame(rafId);
    lastDrawAt = 0;
    smoothedPoints = [];
    drawVisualizerFrame();
  }

  function prepareVisualizerFromUserGesture() {
    if (!ensureVisualizer()) return;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function stopVisualizer() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    drawVisualizerIdle();
  }

  function pauseRadioPlayback() {
    state.radioWanted = false;
    resetRadioReconnect();
    radioAudio.pause();
  }

  function stopSermonPlayback(clearSelection) {
    rememberCurrentSermonPosition();
    sermonAudio.pause();

    if (clearSelection) {
      sermonAudio.removeAttribute('src');
      sermonAudio.load();

      if (state.currentButton) {
        setSermonButtonPlaying(state.currentButton, false);
      }

      state.currentButton = null;
      state.currentSermonUrl = '';
      state.resumeTime = 0;
      if (Number.isFinite(sermonAudio.duration) && sermonAudio.duration > 0) {
        sermonAudio.currentTime = 0;
      }
    }
  }

  window.setHero = function setHero(title, audioUrl, button) {
    if (!audioUrl || !button) return;

    state.mode = 'sermon';

    if (state.currentButton && state.currentButton !== button) {
      rememberCurrentSermonPosition();
      setSermonButtonPlaying(state.currentButton, false);
    }

    pauseRadioPlayback();

    const isSameSelection = state.currentButton === button && state.currentSermonUrl === audioUrl;
    state.currentButton = button;
    state.currentSermonUrl = audioUrl;

    button.setAttribute('aria-label', `Odtwórz lub zatrzymaj kazanie ${title || ''}`.trim());

    if (isSameSelection) {
      if (sermonAudio.paused) {
        sermonAudio.play().catch((err) => console.warn('Sermon play failed:', err));
      } else {
        sermonAudio.pause();
      }
      return;
    }

    const savedState = sermonPositions.get(audioUrl) || { currentTime: 0, duration: 0 };
    state.resumeTime = savedState.currentTime || 0;

    sermonAudio.src = audioUrl;
    sermonAudio.load();
    updateSermonPlayerUI(button, savedState.currentTime || 0, savedState.duration || 0);
    sermonAudio.play().catch((err) => console.warn('Sermon play failed:', err));
  };

  window.setRadio = function setRadio() {
    if (state.mode === 'radio' && !radioAudio.paused) {
      pauseRadioPlayback();
      return;
    }

    state.mode = 'radio';
    state.radioWanted = true;

    stopSermonPlayback(false);
    if (state.currentButton) {
      setSermonButtonPlaying(state.currentButton, false);
    }

    resetRadioReconnect();
    prepareVisualizerFromUserGesture();
    radioAudio.play().catch((err) => console.warn('Radio play failed:', err));
  };

  sermonAudio.addEventListener('timeupdate', () => {
    if (!state.currentButton) return;
    if (!Number.isFinite(sermonAudio.duration) || sermonAudio.duration <= 0) return;
    rememberCurrentSermonPosition();
    updateSermonPlayerUI(state.currentButton, sermonAudio.currentTime, sermonAudio.duration);
  });

  sermonAudio.addEventListener('loadedmetadata', () => {
    if (!state.currentButton) return;
    if (state.resumeTime > 0 && state.resumeTime < sermonAudio.duration) {
      sermonAudio.currentTime = state.resumeTime;
    }
    state.resumeTime = 0;
    rememberCurrentSermonPosition();
    updateSermonPlayerUI(state.currentButton, sermonAudio.currentTime, sermonAudio.duration);
  });

  sermonAudio.addEventListener('play', () => {
    if (!state.currentButton) return;
    setRadioButtonsPlaying(false);
    setSermonButtonPlaying(state.currentButton, true);
  });

  sermonAudio.addEventListener('pause', () => {
    if (!state.currentButton) return;
    setSermonButtonPlaying(state.currentButton, false);
  });

  sermonAudio.addEventListener('ended', () => {
    if (!state.currentButton) return;
    sermonAudio.currentTime = 0;
    rememberCurrentSermonPosition();
    updateSermonPlayerUI(state.currentButton, 0, sermonAudio.duration);
    setSermonButtonPlaying(state.currentButton, false);
  });

  radioAudio.addEventListener('play', () => {
    setRadioButtonsPlaying(true);
    startVisualizer();
    resetRadioReconnect();
  });

  radioAudio.addEventListener('pause', () => {
    setRadioButtonsPlaying(false);
    stopVisualizer();
  });

  radioAudio.addEventListener('error', () => {
    scheduleRadioReconnect('error');
  });

  radioAudio.addEventListener('ended', () => {
    scheduleRadioReconnect('ended');
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-sermon-progress]')) {
      return;
    }

    const player = target.closest('[data-sermon-player]');
    if (!player) return;

    const isActive = !!state.currentButton && getSermonPlayer(state.currentButton) === player;
    const audioDuration = isActive && Number.isFinite(sermonAudio.duration) && sermonAudio.duration > 0
      ? sermonAudio.duration
      : null;
    const duration = audioDuration ?? Number(target.dataset.duration) ?? 0;

    if (duration > 0) {
      const currentEl = player.querySelector('[data-current-time]');
      if (currentEl) currentEl.textContent = formatTime((Number(target.value) / 100) * duration);
    }

    if (isActive && audioDuration) {
      sermonAudio.currentTime = (Number(target.value) / 100) * audioDuration;
      rememberCurrentSermonPosition();
    }
  });

  document.addEventListener('sermons:before-render', () => {
    if (!state.currentButton) return;
    stopSermonPlayback(true);
  });

  drawVisualizerIdle();
  // Retry after layout is complete — mobile canvas may have zero size on first paint
  requestAnimationFrame(() => drawVisualizerIdle());
  setTimeout(() => drawVisualizerIdle(), 300);
})();
