console.log("Backup Renderer Script Loaded");

document.addEventListener('DOMContentLoaded', () => {
    const btnRunBackup = document.getElementById('btnRunBackup');
    const selYear = document.getElementById('selBackupYear');
    const selMonth = document.getElementById('selBackupMonth');
    const statusArea = document.getElementById('backupStatusArea');

    // --- පියවර A: වසරවල් 2020 - 2040 ටික Generate කිරීම ---
    if (selYear) {
        const startYear = 2020;
        const endYear = 2040;
        const currentYear = new Date().getFullYear();

        let optionsHtml = '';
        for (let year = startYear; year <= endYear; year++) {
            const isSelected = (year === currentYear) ? 'selected' : '';
            optionsHtml += `<option value="${year}" ${isSelected}>${year}</option>`;
        }
        selYear.innerHTML = optionsHtml;
    }

    // --- පියවර B: Backup එක Run කිරීමේ Logic එක ---
    if (btnRunBackup) {
        btnRunBackup.addEventListener('click', async () => {
            const year = selYear.value;
            const month = selMonth.value;

            const isConfirmed = await notify.confirm(
                `${year} - ${month} මාසය සඳහා පද්ධතියේ සම්පූර්ණ බැකප් එකක් (Full Backup) ලබා ගැනීමට අවශ්‍යද?`,
                "බැකප් තහවුරු කිරීම"
            );

            if (!isConfirmed) return;

            btnRunBackup.disabled = true;
            btnRunBackup.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2"></span>
                බැකප් වෙමින් පවතී...
            `;
            if (statusArea) statusArea.classList.remove('d-none');

            try {
                // IPC Handler එක හරහා Backend එකට දැනුම් දීම
                const result = await window.api.system.runBackup(year, month);

                if (result.success) {
                    await notify.confirm(
                        `බැකප් එක සාර්ථකව අවසන් විය!\nස්ථානය: ${result.path}`,
                        "සාර්ථකයි",
                        { showCancelButton: false, confirmText: 'හරි', confirmColor: '#28a745' }
                    );
                } else {
                    notify.toast("බැකප් කිරීම අසාර්ථක විය: " + result.error, "error");
                }
            } catch (err) {
                console.error("Renderer Backup Error:", err);
                notify.toast("පද්ධති දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න.", "error");
            } finally {
                btnRunBackup.disabled = false;
                btnRunBackup.innerHTML = `
                    <i class="bi bi-shield-lock-fill me-2"></i> 
                    බැකප් එක ලබාගන්න (Start Backup)
                `;
                if (statusArea) statusArea.classList.add('d-none');
            }
        });
    }
});