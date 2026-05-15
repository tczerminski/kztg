/* Audio player synchronization for sermon cards + global bottom player
   Supports custom bottom player controls, timers, marquee title, and prev/next navigation.
*/
(function () {
  const RADIO_STREAM_URL = 'https://s3.free-shoutcast.com/stream/18120';
  const audioPlayer = document.getElementById('audioPlayer');
  const audioElement = document.getElementById('audioElement');
  const playerTitle = document.getElementById('playerTitle');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playerProgress = document.getElementById('playerProgress');
  const progressBar = document.getElementById('progressBar');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const radioPlayIcon = document.getElementById('radioPlayIcon');
  const radioPauseIcon = document.getElementById('radioPauseIcon');
  const radioButtonText = document.getElementById('radioButtonText');

  let currentButton = null;
  let currentAudioUrl = '';
  let currentIndex = -1;
  let isRadioPlaying = false;

  const sermons = Array.from(document.querySelectorAll('.sermon-play-btn')).map((btn, index) => ({
    title: btn.dataset.title,
    preacher: btn.dataset.preacher,
    audioUrl: btn.dataset.audio,
    button: btn,
    index
  }));

  // --- Helper: show player with slide animation ---
  function showPlayer() {
    audioPlayer.classList.add('show');
  }

  // --- Helper: hide player with slide animation ---
  function hidePlayer() {
    audioPlayer.classList.remove('show');
  }

  // --- Helper: toggle play/pause icons ---
  function toggleIcons(isPlaying) {
    if (!playIcon || !pauseIcon) return;
    playIcon.classList.toggle('hidden', isPlaying);
    pauseIcon.classList.toggle('hidden', !isPlaying);
  }

  // --- Helper: restore sermon button ---
  function restoreButtonHTML(btn) {
    if (!btn) return;
    if (btn.dataset.originalHTML) {
      btn.innerHTML = btn.dataset.originalHTML;
    }
  }

  // --- Helper: format seconds as m:ss ---
  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' + s : s}`;
  }

  // --- Helper: show/hide slider row based on playback mode ---
  function setProgressVisible(visible) {
    if (!playerProgress) return;
    playerProgress.classList.toggle('hidden', !visible);
  }

  // --- Helper: show/hide prev-next controls by playback mode ---
  function setNavigationVisible(visible) {
    [prevBtn, nextBtn].forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle('hidden', !visible);
      btn.disabled = !visible;
    });
  }

  // --- Helper: update sermon button icon/label ---
  function updateSermonButton(isPlaying) {
    if (!currentButton) return;
    if (!currentButton.dataset.originalHTML) {
      currentButton.dataset.originalHTML = currentButton.innerHTML;
    }
    if (isPlaying) {
      currentButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#6f85b8" stroke-width="2">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
        Zatrzymaj
      `;
    } else {
      currentButton.innerHTML = currentButton.dataset.originalHTML;
    }
  }

  // --- Helper: set audio source with explicit type ---
  function setAudioSource(url, type) {
    if (!audioElement) return;
    audioElement.pause();
    audioElement.removeAttribute('src');
    while (audioElement.firstChild) {
      audioElement.removeChild(audioElement.firstChild);
    }
    const source = document.createElement('source');
    source.src = url;
    if (type) source.type = type;
    audioElement.appendChild(source);
    audioElement.load();
  }

  // --- Main: set and play sermon ---
  window.setHero = function (title, audioUrl, button) {
    const previousMode = audioPlayer.getAttribute('data-mode');
    audioPlayer.setAttribute('data-mode', 'sermon');
    setProgressVisible(true);
    setNavigationVisible(true);
    const sermon = sermons.find(s => s.audioUrl === audioUrl);
    currentIndex = sermon ? sermon.index : -1;
    const preacher = sermon?.preacher || '';
    const displayTitle = preacher ? `${preacher} — ${title}` : title;

    playerTitle.textContent = displayTitle;

    // Restart marquee animation
    playerTitle.classList.remove('animate-marquee');
    void playerTitle.offsetWidth; // trigger reflow
    playerTitle.classList.add('animate-marquee');

    // Show player
    showPlayer();

    // If same sermon toggled
    if (currentAudioUrl === audioUrl) {
      if (audioElement.paused) {
        audioElement.play();
      } else {
        audioElement.pause();
      }
      return;
    }

    // Reset radio button if switching from radio
    if (isRadioPlaying || previousMode === 'radio') {
      isRadioPlaying = false;
      updateRadioButton(false);
    }

    // Switch to new audio
    restoreButtonHTML(currentButton);
    currentAudioUrl = audioUrl;
    currentButton = button;
    if (button && !button.dataset.originalHTML) {
      button.dataset.originalHTML = button.innerHTML;
    }

    // Set pause icon/label for the new button
    updateSermonButton(true);
    setAudioSource(audioUrl, 'audio/mpeg');
    audioElement.play().catch(err => console.warn('Autoplay blocked:', err));
  };

  // --- Set Radio stream ---
  window.setRadio = function () {
    audioPlayer.setAttribute('data-mode', 'radio');
    setProgressVisible(false);
    setNavigationVisible(false);
    playerTitle.textContent = 'Transmisja radia Kościoła Zmartwychwstałego na żywo';
    playerTitle.classList.remove('animate-marquee');
    void playerTitle.offsetWidth;
    playerTitle.classList.add('animate-marquee');
    showPlayer();
    restoreButtonHTML(currentButton);
    currentAudioUrl = RADIO_STREAM_URL;
    currentButton = null;
    
    // If already playing radio, toggle pause
    if (isRadioPlaying) {
      audioElement.pause();
      return;
    }
    
    // Play radio
    isRadioPlaying = true;
    setAudioSource(currentAudioUrl, 'audio/mpeg');
    audioElement.play().catch(function(err) { console.warn('Radio play failed:', err); });
  };

  // --- Helper: update radio button icon/label ---
  function updateRadioButton(isPlaying) {
    if (!radioPlayIcon || !radioPauseIcon || !radioButtonText) return;
    radioPlayIcon.classList.toggle('hidden', isPlaying);
    radioPauseIcon.classList.toggle('hidden', !isPlaying);
    radioButtonText.textContent = isPlaying ? 'Zatrzymaj' : 'Słuchaj teraz';
  }

  // --- Audio events ---
  audioElement.addEventListener('play', () => {
    toggleIcons(true);
    const mode = audioPlayer.getAttribute('data-mode');
    if (mode === 'radio') {
      isRadioPlaying = true;
      updateRadioButton(true);
    } else {
      updateSermonButton(true);
    }
  });
  audioElement.addEventListener('pause', () => {
    toggleIcons(false);
    const mode = audioPlayer.getAttribute('data-mode');
    if (mode === 'radio') {
      isRadioPlaying = false;
      updateRadioButton(false);
    } else {
      updateSermonButton(false);
    }
  });
  audioElement.addEventListener('ended', () => {
    const mode = audioPlayer.getAttribute('data-mode');
    if (mode === 'radio') {
      isRadioPlaying = false;
      updateRadioButton(false);
    } else {
      restoreButtonHTML(currentButton);
      toggleIcons(false);
      nextSermon(); // auto advance
    }
  });

  audioElement.addEventListener('timeupdate', () => {
    if (!Number.isFinite(audioElement.duration) || audioElement.duration <= 0) return;
    progressBar.value = (audioElement.currentTime / audioElement.duration) * 100;
    currentTimeEl.textContent = formatTime(audioElement.currentTime);
  });

  audioElement.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = formatTime(audioElement.duration);
  });

  // --- Seek bar interaction ---
  progressBar.addEventListener('input', () => {
    if (audioElement.duration) {
      audioElement.currentTime = (progressBar.value / 100) * audioElement.duration;
    }
  });

  // --- Play/Pause button ---
  playPauseBtn.addEventListener('click', () => {
    if (audioElement.paused) audioElement.play();
    else audioElement.pause();
  });

  // --- Prev / Next buttons ---
  function nextSermon() {
    if (currentIndex < sermons.length - 1) {
      const next = sermons[currentIndex + 1];
      setHero(next.title, next.audioUrl, next.button);
    } else {
      hidePlayer();
    }
  }

  function prevSermon() {
    if (currentIndex > 0) {
      const prev = sermons[currentIndex - 1];
      setHero(prev.title, prev.audioUrl, prev.button);
    }
  }

  nextBtn.addEventListener('click', nextSermon);
  prevBtn.addEventListener('click', prevSermon);
})();
