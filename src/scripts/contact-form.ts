export function initContactForm(): void {
  const contactForm = document.getElementById("contactForm") as HTMLFormElement | null;
  const contactSubmitBtn = document.getElementById("contactSubmitBtn") as HTMLButtonElement | null;
  const contactFormSuccess = document.getElementById("contactFormSuccess");
  const contactFormError = document.getElementById("contactFormError");
  if (!contactForm || !contactSubmitBtn || !contactFormSuccess || !contactFormError) return;

  const contactSpinner = document.getElementById("contactSpinner");
  const contactSubmitLabel = document.getElementById("contactSubmitLabel");

  const labelSubmit = contactForm.dataset.labelSubmit || "Wyślij wiadomość";
  const labelSending = contactForm.dataset.labelSending || "Wysyłanie...";
  const labelSendError = contactForm.dataset.labelSendError || "Błąd wysyłki";

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    contactFormSuccess.classList.add("hidden");
    contactFormError.classList.add("hidden");
    contactSubmitBtn.disabled = true;
    contactSubmitBtn.classList.add("opacity-80", "cursor-not-allowed");
    contactSpinner?.classList.remove("hidden");
    if (contactSubmitLabel) contactSubmitLabel.textContent = labelSending;

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: new FormData(contactForm),
      });
      const json = await response.json();
      if (response.ok && json.success) {
        contactFormSuccess.classList.remove("hidden");
        contactForm.reset();
      } else {
        throw new Error(json.message || labelSendError);
      }
    } catch (err) {
      console.error("Form error:", err);
      contactFormError.classList.remove("hidden");
    } finally {
      contactSubmitBtn.disabled = false;
      contactSubmitBtn.classList.remove("opacity-80", "cursor-not-allowed");
      contactSpinner?.classList.add("hidden");
      if (contactSubmitLabel) contactSubmitLabel.textContent = labelSubmit;
    }
  });
}
