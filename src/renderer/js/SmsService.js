/**
 * Gagana Investment - SMS Management Controller
 */

let isSmsCheckedToday = false; 

$(document).ready(async () => {
    console.log("🚀 SMS System Initializing...");
    await loadSmsLogs();
    startDashboardObserver();
    initializeSmsButtons();
});

// 1. Dashboard එක පෙනෙනවාදැයි පරීක්ෂාව
function startDashboardObserver() {
    const targetNode = document.getElementById('appSection');
    if (!targetNode) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && !targetNode.classList.contains('d-none') && !isSmsCheckedToday) {
                isSmsCheckedToday = true;
                setTimeout(() => runDailySmsCheck(true), 2000);
            }
        });
    });
    observer.observe(targetNode, { attributes: true });
}

async function runDailySmsCheck(isManual = false) {
    const btn = $("#btnRunManualSms");
    try {
        if (!navigator.onLine) {
            notify.alert("අන්තර්ජාලය නොමැත. කරුණාකර Connection එක පරීක්ෂා කරන්න.", "Offline", "error");
            return;
        }

        if (isManual) {
            const isConfirm = await notify.confirm("හෙට වාරික ඇති අයට SMS යැවීම ආරම්භ කරන්නද?", "SMS පද්ධතිය");
            if (!isConfirm) return;
        }

        // Loading State
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> පරීක්ෂා කරමින්...');
        
        // Backend එක හරහා SMS යැවීම
        const result = await window.api.sms.runAutoCheck();

        // 1. සාර්ථකව අවසන් වූ අවස්ථාව
        if (result && result.success) {
            await loadSmsLogs(); 
            if (result.sentCount > 0) {
                notify.alert(`සාර්ථකයි! පාරිභෝගිකයින් ${result.sentCount} දෙනෙකුට පණිවිඩ යවන ලදී.`, "සාර්ථකයි", "success");
            } else {
                notify.alert("අද දිනට අලුතින් SMS යැවීමට පාරිභෝගිකයින් නැත.", "දැනුම්දීමයි", "info");
            }
        } 
        // 2. Backend එකෙන් error එකක් ආවොත් (උදා: Balance ඉවර වීම)
        else {
            const errorMsg = (result.message || "").toLowerCase();
            const statusCode = result.statusCode;

            // Balance හෝ Credit සම්බන්ධ දෝෂයක්දැයි බැලීම
            if (statusCode === 402 || errorMsg.includes("balance") || errorMsg.includes("credit") || errorMsg.includes("limit")) {
                await notify.alert(
                    "ඔබගේ SMS ගිණුමේ ශේෂය (Balance) අවසන් වී ඇත. කරුණාකර රීචාර්ජ් කර නැවත උත්සාහ කරන්න.",
                    "ශේෂය අවසන් වී ඇත",
                    "warning"
                );
            } else {
                // වෙනත් සාමාන්‍ය දෝෂයක්
                await notify.alert(result.message || "පණිවිඩ යැවීමට නොහැකි විය. පසුව උත්සාහ කරන්න.", "දෝෂයකි", "error");
            }
        }
    } catch (err) {
        console.error("SMS Error:", err);
        notify.alert("පද්ධති දෝෂයකි: " + err.message, "Error", "error");
    } finally {
        btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i>නව පණිවිඩ යවන්න');
    }
}

// 3. වාර්තා පූරණය කිරීම (Status සහිතව)
async function loadSmsLogs(targetDate = null) {
    try {
        const tbody = $("#tblSmsLog");
        const today = new Date().toISOString().split('T')[0];
        const dateToLoad = targetDate || today;

        $("#smsLogDate").val(dateToLoad);
        tbody.html('<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> දත්ත ලබා ගනිමින්...</td></tr>');

        const logs = await window.api.sms.getLogsByDate(dateToLoad);
        tbody.empty();

        if (logs && logs.length > 0) {
            $("#smsTotalCount").text(logs.length);
            $("#smsEmptyState").addClass('d-none');
            
            logs.forEach(log => {
                // Status අනුව වෙනස්වන Badge එක
                const statusBadge = log.isSent 
                    ? '<span class="badge bg-success-subtle text-success border border-success px-3"><i class="fas fa-check-circle me-1"></i> Sent</span>'
                    : '<span class="badge bg-danger-subtle text-danger border border-danger px-3"><i class="fas fa-clock me-1"></i> Not Sent</span>';

                tbody.append(`
                    <tr class="animate__animated animate__fadeIn">
                        <td class="ps-4"><span class="badge bg-secondary opacity-75">${log.customerId}</span></td>
                        <td class="fw-bold text-dark">${log.customerName}</td>
                        <td class="text-muted small">${log.phone}</td>
                        <td>${new Date(log.dueDate).toLocaleDateString('si-LK')}</td>
                        <td class="text-center">${statusBadge}</td>
                        <td class="text-end pe-4 text-muted small">${log.isSent ? log.sentTime : '--:--'}</td>
                    </tr>
                `);
            });
        } else {
            $("#smsTotalCount").text(0);
            $("#smsEmptyState").removeClass('d-none');
            tbody.html('<tr><td colspan="6" class="text-center py-5 text-muted small">කිසිදු දත්තයක් හමු නොවීය.</td></tr>');
        }
    } catch (err) {
        console.error("Load Error:", err);
    }
}

// 4. බොත්තම් ක්‍රියාත්මක කිරීම
function initializeSmsButtons() {
    const manualBtn = document.getElementById('btnRunManualSms');
    const refreshBtn = document.getElementById('btnRefreshSmsLog');
    const filterBtn = document.getElementById('btnFilterSms');

    if (manualBtn) {
        manualBtn.onclick = async (e) => {
            e.preventDefault();
            await runDailySmsCheck(true);
        };
    }

    if (refreshBtn) {
        refreshBtn.onclick = async (e) => {
            e.preventDefault();
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            await loadSmsLogs();
            setTimeout(() => icon.classList.remove('fa-spin'), 800);
        };
    }

    if (filterBtn) {
        filterBtn.onclick = (e) => {
            e.preventDefault();
            const dateVal = document.getElementById('smsLogDate').value;
            loadSmsLogs(dateVal);
        };
    }
}