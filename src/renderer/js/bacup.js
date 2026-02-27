console.log("Backup Renderer Script Loaded");

document.addEventListener('DOMContentLoaded', () => {
    const btnRunBackup   = document.getElementById('btnRunBackup');
    const selYear        = document.getElementById('selBackupYear');
    const selMonth       = document.getElementById('selBackupMonth');
    const statusArea     = document.getElementById('backupStatusArea');

    // ── Year Dropdown populate ──────────────────────────────────────────
    if (selYear) {
        const currentYear = new Date().getFullYear();
        let html = '';
        for (let y = 2020; y <= 2040; y++) {
            html += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
        }
        selYear.innerHTML = html;
    }

    // ── Month Dropdown: current month pre-select ────────────────────────
    if (selMonth) {
        const currentMonth = new Date().getMonth() + 1; // 1-12
        selMonth.value = String(currentMonth).padStart(2, '0');
    }

    // ── Backup Button ───────────────────────────────────────────────────
    if (btnRunBackup) {
        btnRunBackup.addEventListener('click', async () => {

            // ✅ FIX: always parseInt - dropdown "01" → 1
            const year  = parseInt(selYear.value);
            const month = parseInt(selMonth.value);

            const monthNames = ["","ජනවාරි","පෙබරවාරි","මාර්තු","අප්‍රේල්","මැයි",
                                "ජූනි","ජූලි","අගෝස්තු","සැප්තැම්බර්","ඔක්තෝබර්",
                                "නොවැම්බර්","දෙසැම්බර්"];

            const isConfirmed = await notify.confirm(
                `${year} ${monthNames[month]} මාසය සඳහා සම්පූර්ණ PDF වාර්තාවක් ලබා ගැනීමට අවශ්‍යද?`,
                "📄 PDF Backup තහවුරු කිරීම"
            );
            if (!isConfirmed) return;

            // UI: loading state
            btnRunBackup.disabled = true;
            btnRunBackup.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2"></span>
                PDF සකස් කරමින්...
            `;
            if (statusArea) statusArea.classList.remove('d-none');

            try {
                const result = await window.api.system.runBackup(year, month);

                if (result.success) {
                    await notify.confirm(
                        `✅ PDF Backup සාර්ථකව සකස් විය!\n\n📁 ස්ථානය:\n${result.path}`,
                        "සාර්ථකයි",
                        { showCancelButton: false, confirmText: 'හරි', confirmColor: '#28a745' }
                    );
                } else {
                    notify.toast("PDF Backup අසාර්ථක: " + (result.error || 'නොදන්නා දෝෂයක්'), "error");
                }
            } catch (err) {
                console.error("Backup Error:", err);
                notify.toast("පද්ධති දෝෂයක් සිදු විය: " + err.message, "error");
            } finally {
                btnRunBackup.disabled = false;
                btnRunBackup.innerHTML = `<i class="bi bi-shield-lock-fill me-2"></i> බැකප් එක ලබාගන්න (Start Backup)`;
                if (statusArea) statusArea.classList.add('d-none');
            }
        });
    }
});