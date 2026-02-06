console.log("Backup Renderer Script Loaded");
document.addEventListener('DOMContentLoaded', () => {
    const btnRunBackup = document.getElementById('btnRunBackup');
    const selYear = document.getElementById('selBackupYear');
    const selMonth = document.getElementById('selBackupMonth');
    const statusArea = document.getElementById('backupStatusArea');

    if (btnRunBackup) {
        btnRunBackup.addEventListener('click', async () => {
            const year = selYear.value;
            const month = selMonth.value;

            // 1. පරිශීලකයාගෙන් තහවුරු කිරීමක් ලබා ගැනීම
            const isConfirmed = await notify.confirm(
                `${year} - ${month} මාසය සඳහා පද්ධතියේ සම්පූර්ණ බැකප් එකක් (Full Backup) ලබා ගැනීමට අවශ්‍යද?`,
                "බැකප් තහවුරු කිරීම"
            );

            if (!isConfirmed) return;

            // 2. UI එක Loading State එකට පත් කිරීම
            btnRunBackup.disabled = true;
            btnRunBackup.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2"></span>
                බැකප් වෙමින් පවතී...
            `;
            if (statusArea) statusArea.classList.remove('d-none');

            try {
                // 3. Preload API හරහා Backend (Main Process) එකට දත්ත යැවීම
                // මෙහිදී { year, month } ලෙස Object එකක් ලෙස යැවිය යුතුය (Controller එකේ බලාපොරොත්තු වන පරිදි)
                const result = await window.api.system.runBackup(year, month);

                if (result.success) {
                    // සාර්ථක පණිවිඩය
                    await notify.confirm(
                        `බැකප් එක සාර්ථකව අවසන් විය!\nස්ථානය: ${result.path}`,
                        "සාර්ථකයි",
                        { showCancelButton: false, confirmText: 'හරි', confirmColor: '#28a745' }
                    );
                } else {
                    // දෝෂයක් ඇති වූ විට
                    notify.toast("බැකප් කිරීම අසාර්ථක විය: " + result.error, "error");
                }
            } catch (err) {
                console.error("Renderer Backup Error:", err);
                notify.toast("පද්ධති දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න.", "error");
            } finally {
                // 4. UI එක නැවත සාමාන්‍ය තත්ත්වයට පත් කිරීම
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