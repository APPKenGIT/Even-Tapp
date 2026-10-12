// Dodentocht Training Planner Client JS
document.addEventListener('DOMContentLoaded', function () {
    // Sluit meldingen automatisch na 6 seconden
    const alerts = document.querySelectorAll('.alert-dismissible');
    alerts.forEach(function (alert) {
        setTimeout(function () {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            if (bsAlert) {
                bsAlert.close();
            }
        }, 6000);
    });
});
