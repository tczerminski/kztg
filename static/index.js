/* Audio player synchronization for sermon cards + global bottom player
   Supports custom bottom player controls, timers, marquee title, and prev/next navigation.
*/
(function () {
  const audioPlayer = document.getElementById('audioPlayer');
  const audioElement = document.getElementById('audioElement');
  const playerTitle = document.getElementById('playerTitle');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const progressBar = document.getElementById('progressBar');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');

  let currentButton = null;
  let currentAudioUrl = '';
  let currentIndex = -1;

  const sermons = Array.from(document.querySelectorAll('.sermon-play-btn')).map((btn, index) => ({
    title: btn.dataset.title,
    preacher: btn.dataset.preacher,
    audioUrl: btn.dataset.audio,
    button: btn,
    index
  }));

  for (let i = 0; i < sermons.length; i++) {
  console.log(sermons[i].title);
  console.log(sermons[i].preacher);
  console.log(sermons[i].audioUrl);
  }

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
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' + s : s}`;
  }

  // --- Helper: update sermon button icon/label ---
  function updateSermonButton(isPlaying) {
    if (!currentButton) return;
    if (!currentButton.dataset.originalHTML) {
      currentButton.dataset.originalHTML = currentButton.innerHTML;
    }
    if (isPlaying) {
      currentButton.innerHTML = '⏸ Zatrzymaj';
    } else {
      currentButton.innerHTML = currentButton.dataset.originalHTML;
    }
  }

  // --- Main: set and play sermon ---
  window.setHero = function (title, audioUrl, button) {
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

    // Switch to new audio
    restoreButtonHTML(currentButton);
    currentAudioUrl = audioUrl;
    currentButton = button;
    if (button && !button.dataset.originalHTML) {
      button.dataset.originalHTML = button.innerHTML;
    }

    // Set pause icon/label for the new button
    updateSermonButton(true);
    audioElement.src = audioUrl;
    audioElement.play().catch(err => console.warn('Autoplay blocked:', err));
  };

  // --- Audio events ---
  audioElement.addEventListener('play', () => {
    toggleIcons(true);
    updateSermonButton(true);
  });
  audioElement.addEventListener('pause', () => {
    toggleIcons(false);
    updateSermonButton(false);
  });
  audioElement.addEventListener('ended', () => {
    restoreButtonHTML(currentButton);
    toggleIcons(false);
    nextSermon(); // auto advance
  });

  audioElement.addEventListener('timeupdate', () => {
    if (!audioElement.duration) return;
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
