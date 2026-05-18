(function () {
  const contactForm = document.getElementById('contactForm');
  const contactSubmitBtn = document.getElementById('contactSubmitBtn');
  const contactFormSuccess = document.getElementById('contactFormSuccess');
  const contactFormError = document.getElementById('contactFormError');
  if (!contactForm || !contactSubmitBtn || !contactFormSuccess || !contactFormError) return;
  const contactSpinner = document.getElementById('contactSpinner');
  const contactSubmitLabel = document.getElementById('contactSubmitLabel');
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    contactFormSuccess.classList.add('hidden');
    contactFormError.classList.add('hidden');
    contactSubmitBtn.disabled = true;
    contactSubmitBtn.classList.add('opacity-80', 'cursor-not-allowed');
    if (contactSpinner) contactSpinner.classList.remove('hidden');
    if (contactSubmitLabel) contactSubmitLabel.textContent = 'Wysyłanie...';
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: new FormData(contactForm),
      });
      const json = await response.json();
      if (response.ok && json.success) {
        contactFormSuccess.classList.remove('hidden');
        contactForm.reset();
      } else {
        throw new Error(json.message || 'Błąd wysyłki');
      }
    } catch (err) {
      console.error('Form error:', err);
      contactFormError.classList.remove('hidden');
    } finally {
      contactSubmitBtn.disabled = false;
      contactSubmitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
      if (contactSpinner) contactSpinner.classList.add('hidden');
      if (contactSubmitLabel) contactSubmitLabel.textContent = 'Wyślij wiadomość';
    }
  });
})();
