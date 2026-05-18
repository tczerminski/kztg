(function () {
  const RADIO_STREAM_URL = 'https://s3.free-shoutcast.com/stream/18132';

  const el = {
    player: document.getElementById('audioPlayer'),
    sermonAudio: document.getElementById('audioElement'),
    title: document.getElementById('playerTitle'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    playIcon: document.getElementById('playIcon'),
    pauseIcon: document.getElementById('pauseIcon'),
    progressWrap: document.getElementById('playerProgress'),
    progressControls: document.getElementById('progressControls'),
    progress: document.getElementById('progressBar'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    radioPlayIcon: document.getElementById('radioPlayIcon'),
    radioPauseIcon: document.getElementById('radioPauseIcon'),
    radioButtonText: document.getElementById('radioButtonText'),
    visualizer: document.getElementById('audioVisualizer'),
  };

  if (!el.player || !el.sermonAudio) return;

  const radioAudio = new Audio();
  radioAudio.preload = 'none';
  radioAudio.crossOrigin = 'anonymous';
  radioAudio.src = RADIO_STREAM_URL;

  const state = {
    mode: 'sermon',
    currentButton: null,
    currentSermonUrl: '',
  };

  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let dataArray = null;
  let rafId = null;
  let lastDrawAt = 0;
  let smoothedPoints = [];

  function activeAudio() {
    return state.mode === 'radio' ? radioAudio : el.sermonAudio;
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? `0${s}` : s}`;
  }

  function setTitle(text) {
    if (!el.title) return;
    el.title.textContent = text;
    el.title.classList.remove('animate-marquee');
    void el.title.offsetWidth;
    el.title.classList.add('animate-marquee');
  }

  function setProgressVisible(isSermonMode) {
    if (!el.progressWrap) return;
    el.progressWrap.classList.remove('hidden');
    el.progressControls?.classList.toggle('hidden', !isSermonMode);
    el.visualizer?.classList.toggle('hidden', isSermonMode);
  }

  function setMainPlaying(isPlaying) {
    if (!el.playIcon || !el.pauseIcon) return;
    el.playIcon.classList.toggle('hidden', isPlaying);
    el.pauseIcon.classList.toggle('hidden', !isPlaying);
  }

  function rememberButtonHTML(btn) {
    if (btn && !btn.dataset.originalHTML) btn.dataset.originalHTML = btn.innerHTML;
  }

  function restoreSermonButton() {
    const btn = state.currentButton;
    if (!btn || !btn.dataset.originalHTML) return;
    btn.innerHTML = btn.dataset.originalHTML;
  }

  function setSermonButtonPlaying(isPlaying) {
    const btn = state.currentButton;
    if (!btn) return;
    rememberButtonHTML(btn);
    if (isPlaying) {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#6f85b8" stroke-width="2">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
        Zatrzymaj
      `;
    } else {
      restoreSermonButton();
    }
  }

  function setRadioButtonPlaying(isPlaying) {
    if (!el.radioPlayIcon || !el.radioPauseIcon || !el.radioButtonText) return;
    el.radioPlayIcon.classList.toggle('hidden', isPlaying);
    el.radioPauseIcon.classList.toggle('hidden', !isPlaying);
    el.radioButtonText.textContent = isPlaying ? 'Zatrzymaj' : 'Słuchaj teraz';
  }

  function drawVisualizerIdle() {
    if (!el.visualizer) return;
    const ctx = el.visualizer.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(el.visualizer.clientWidth * dpr);
    const height = Math.floor(el.visualizer.clientHeight * dpr);
    if (el.visualizer.width !== width || el.visualizer.height !== height) {
      el.visualizer.width = width;
      el.visualizer.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.strokeStyle = 'rgba(111, 133, 184, 0.35)';
    ctx.lineWidth = Math.max(1, 2 * dpr);
    ctx.stroke();
  }

  function ensureVisualizer() {
    if (!el.visualizer) return false;
    if (analyser) return true;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;

    try {
      audioCtx = new AudioContextCtor();
      sourceNode = audioCtx.createMediaElementSource(radioAudio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.93;
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.fftSize);
      return true;
    } catch (err) {
      console.warn('Visualizer unavailable:', err);
      return false;
    }
  }

  function drawVisualizerFrame(now = 0) {
    if (!analyser || !el.visualizer || !dataArray) return;
    const ctx = el.visualizer.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(el.visualizer.clientWidth * dpr);
    const height = Math.floor(el.visualizer.clientHeight * dpr);
    if (el.visualizer.width !== width || el.visualizer.height !== height) {
      el.visualizer.width = width;
      el.visualizer.height = height;
    }

    if (now - lastDrawAt < 33) {
      rafId = requestAnimationFrame(drawVisualizerFrame);
      return;
    }
    lastDrawAt = now;

    analyser.getByteTimeDomainData(dataArray);

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
      const rawY = (height / 2) + (boosted * maxSwing);
      smoothedPoints[i] += (rawY - smoothedPoints[i]) * 0.26;

      const x = i * step;
      const y = smoothedPoints[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(111, 133, 184, 0.55)');
    grad.addColorStop(0.5, 'rgba(111, 133, 184, 1)');
    grad.addColorStop(1, 'rgba(111, 133, 184, 0.55)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1, 2 * dpr);
    ctx.stroke();

    rafId = requestAnimationFrame(drawVisualizerFrame);
  }

  function startVisualizer() {
    if (!ensureVisualizer()) {
      drawVisualizerIdle();
      return;
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    if (rafId) cancelAnimationFrame(rafId);
    lastDrawAt = 0;
    smoothedPoints = [];
    drawVisualizerFrame();
  }

  function stopVisualizer() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    drawVisualizerIdle();
  }

  function setSermonSource(url) {
    el.sermonAudio.pause();
    el.sermonAudio.removeAttribute('crossorigin');
    el.sermonAudio.src = url;
    el.sermonAudio.load();
  }

  window.setHero = function setHero(title, audioUrl, button) {
    if (!audioUrl) return;

    state.mode = 'sermon';
    el.player.setAttribute('data-mode', 'sermon');
    setProgressVisible(true);

    const preacher = button?.dataset?.preacher || '';
    setTitle(preacher ? `${preacher} — ${title}` : title);
    el.player.classList.add('show');

    radioAudio.pause();
    setRadioButtonPlaying(false);
    stopVisualizer();

    if (state.currentSermonUrl === audioUrl) {
      if (el.sermonAudio.paused) el.sermonAudio.play();
      else el.sermonAudio.pause();
      return;
    }

    restoreSermonButton();
    state.currentSermonUrl = audioUrl;
    state.currentButton = button || null;
    rememberButtonHTML(state.currentButton);
    setSermonButtonPlaying(true);

    setSermonSource(audioUrl);
    el.sermonAudio.play().catch((err) => console.warn('Autoplay blocked:', err));
  };

  window.setRadio = function setRadio() {
    state.mode = 'radio';
    el.player.setAttribute('data-mode', 'radio');
    setProgressVisible(false);
    setTitle('Transmisja radia Kościoła Zmartwychwstałego w Tarnowskich Górach');
    el.player.classList.add('show');

    el.sermonAudio.pause();
    setSermonButtonPlaying(false);
    state.currentButton = null;

    if (!radioAudio.paused) {
      radioAudio.pause();
      return;
    }

    radioAudio.play().catch((err) => console.warn('Radio play failed:', err));
  };

  el.sermonAudio.addEventListener('timeupdate', () => {
    if (state.mode !== 'sermon') return;
    if (!el.progress || !el.currentTime) return;
    if (!Number.isFinite(el.sermonAudio.duration) || el.sermonAudio.duration <= 0) return;

    el.progress.value = (el.sermonAudio.currentTime / el.sermonAudio.duration) * 100;
    el.currentTime.textContent = formatTime(el.sermonAudio.currentTime);
  });

  el.sermonAudio.addEventListener('loadedmetadata', () => {
    if (state.mode !== 'sermon') return;
    if (!el.totalTime) return;
    el.totalTime.textContent = formatTime(el.sermonAudio.duration);
  });

  el.sermonAudio.addEventListener('play', () => {
    if (state.mode !== 'sermon') return;
    setMainPlaying(true);
    setSermonButtonPlaying(true);
  });

  el.sermonAudio.addEventListener('pause', () => {
    if (state.mode !== 'sermon') return;
    setMainPlaying(false);
    setSermonButtonPlaying(false);
  });

  radioAudio.addEventListener('play', () => {
    if (state.mode !== 'radio') return;
    setMainPlaying(true);
    setRadioButtonPlaying(true);
    startVisualizer();
  });

  radioAudio.addEventListener('pause', () => {
    if (state.mode !== 'radio') return;
    setMainPlaying(false);
    setRadioButtonPlaying(false);
    stopVisualizer();
  });

  if (el.progress) {
    el.progress.addEventListener('input', () => {
      if (state.mode !== 'sermon') return;
      if (!el.sermonAudio.duration) return;
      el.sermonAudio.currentTime = (el.progress.value / 100) * el.sermonAudio.duration;
    });
  }

  if (el.playPauseBtn) {
    el.playPauseBtn.addEventListener('click', () => {
      const audio = activeAudio();
      if (audio.paused) audio.play();
      else audio.pause();
    });
  }

  setProgressVisible(true);
  drawVisualizerIdle();
})();

