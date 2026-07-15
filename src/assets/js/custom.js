
// Custom JS
document.addEventListener('DOMContentLoaded', () => {
  const donationForm = document.getElementById('donation-form');
  const donationMessage = document.getElementById('donation-message');

  if (donationForm) {
    donationForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(donationForm);
      const payload = Object.fromEntries(formData.entries());
      payload.amount = Number(payload.amount);

      donationMessage.textContent = 'İşleniyor...';
      donationMessage.className = 'small text-muted';

      try {
        const response = await fetch('/api/donations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Bağış kaydedilemedi.');
        }

        donationForm.reset();
        donationMessage.textContent = data.message || 'Bağışınız başarıyla alındı.';
        donationMessage.className = 'small text-success';
      } catch (error) {
        donationMessage.textContent = error.message || 'Bağış sırasında bir hata oluştu.';
        donationMessage.className = 'small text-danger';
      }
    });

    document.querySelectorAll('.amount-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const amountInput = donationForm.querySelector('input[name="amount"]');
        if (amountInput) {
          amountInput.value = button.dataset.amount;
        }
      });
    });
  }
});
