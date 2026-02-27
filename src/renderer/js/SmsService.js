/**
 * Gagana Investment - SMS Management Controller
 * පද්ධතියට පිවිසෙන විට සහ Manual ක්ලික් කරන විට අනුමැතිය විමසයි.
 */

let isSmsCheckedToday = false; 

$(document).ready(async () => {
    console.log("🚀 SMS System Initializing...");
    // මුලින්ම පවතින දත්ත සටහන් (Logs) පෙන්වන්න
    await loadSmsLogs();
    // ස්වයංක්‍රීයව පරීක්ෂා කිරීමේ නිරීක්ෂකයා ආරම්භ කරන්න
    startDashboardObserver();
    // බොත්තම් ක්‍රියාකාරීත්වය ආරම්භ කරන්න
    initializeSmsButtons();
});

/**
 * Dashboard එක Load වූ සැනින් SMS යැවීමට අවශ්‍යදැයි විමසයි
 */
function startDashboardObserver() {
    const targetNode = document.getElementById('appSection');
    if (!targetNode) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Dashboard එකේ class වෙනස් වන විට (එනම් පද්ධතිය load වූ විට)
            if (mutation.attributeName === 'class' && !targetNode.classList.contains('d-none') && !isSmsCheckedToday) {
                isSmsCheckedToday = true;
                // තත්පර 2කින් පසුව Confirm box එක පෙන්වයි
                setTimeout(() => runDailySmsCheck(true), 2000); 
            }
        });
    });
    observer.observe(targetNode, { attributes: true });
}

/**
 * SMS යැවීමේ ප්‍රධාන ශ්‍රිතය
 * @param {boolean} isManual - පරිශීලකයාගෙන් අනුමැතිය විමසිය යුතුද යන්න
 */
async function runDailySmsCheck(isManual = false) {
    const btn = $("#btnRunManualSms");
    try {
        // අන්තර්ජාලය පරීක්ෂාව
        if (!navigator.onLine) {
            notify.alert("අන්තර්ජාලය නොමැත. කරුණාකර Connection එක පරීක්ෂා කරන්න.", "Offline", "error");
            return;
        }

        // පරිශීලකයාගෙන් අනුමැතිය විමසීම
        if (isManual) {
            const isConfirm = await notify.confirm(
                "හෙට දිනට වාරික ගෙවිය යුතු සියලුම පාරිභෝගිකයින්ට SMS පණිවිඩ යැවීම ආරම්භ කරන්නද?", 
                "SMS පද්ධතිය"
            );
            if (!isConfirm) return; // 'No' එබුවහොත් නතර කරන්න
        }

        // බොත්තම disable කර loading පෙන්වන්න
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> පරීක්ෂා කරමින්...');
        
        // Backend එකට පණිවිඩ යැවීමට විධානය ලබා දීම
        const result = await window.api.sms.runAutoCheck();

        if (result && result.success) {
            await loadSmsLogs(); // Logs අලුත් කරන්න
            if (result.sentCount > 0) {
                notify.alert(`සාර්ථකයි! පණිවිඩ ${result.sentCount} ක් සාර්ථකව යවන ලදී.`, "සාර්ථකයි", "success");
            } else {
                notify.alert("අද දිනට අලුතින් SMS යැවීමට කිසිවෙකු නැත.", "දැනුම්දීමයි", "info");
            }
        } 
        else {
            const errorMsg = (result.message || "").toLowerCase();
            const statusCode = result.statusCode;

            // SMS Balance අවසන් ද යන්න පරීක්ෂාව
            if (statusCode === 402 || errorMsg.includes("balance") || errorMsg.includes("limit")) {
                await notify.alert(
                    "ඔබගේ SMS ගිණුමේ ශේෂය (Balance) අවසන් වී ඇත. කරුණාකර රීචාර්ජ් කරන්න.",
                    "ශේෂය අවසන්",
                    "warning"
                );
            } else {
                await notify.alert(result.message || "පණිවිඩ යැවීමට නොහැකි විය.", "දෝෂයකි", "error");
            }
        }
    } catch (err) {
        console.error("SMS Error:", err);
        notify.alert("පද්ධති දෝෂයකි: " + err.message, "Error", "error");
    } finally {
        // බොත්තම නැවත සක්‍රීය කරන්න
        btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i>නව පණිවිඩ යවන්න');
    }
}

/**
 * යැවූ සහ යැවීමට ඇති SMS ලැයිස්තුව වගුවට ලබා ගැනීම
 */
async function loadSmsLogs(targetDate = null) {
    try {
        const tbody = $("#tblSmsLog");
        const today = new Date().toISOString().split('T')[0];
        const dateToLoad = targetDate || today;

        $("#smsLogDate").val(dateToLoad);
        tbody.html('<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> දත්ත ලබා ගනිමින්...</td></tr>');

        // Backend එකෙන් දත්ත ලබා ගැනීම
        const logs = await window.api.sms.getLogsByDate(dateToLoad);
        tbody.empty();

        if (logs && logs.length > 0) {
            $("#smsTotalCount").text(logs.length);
            $("#smsEmptyState").addClass('d-none');
            
            logs.forEach(log => {
                const statusBadge = log.isSent 
                    ? '<span class="badge bg-success-subtle text-success border border-success px-3"><i class="fas fa-check-circle me-1"></i> Sent</span>'
                    : '<span class="badge bg-danger-subtle text-danger border border-danger px-3"><i class="fas fa-clock me-1"></i> Pending</span>';

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
            tbody.html('<tr><td colspan="6" class="text-center py-5 text-muted small">අදාළ දිනයට ගෙවිය යුතු වාරික හමු නොවීය.</td></tr>');
        }
    } catch (err) {
        console.error("Load Error:", err);
    }
}

/**
 * UI එකේ ඇති බොත්තම් වලට Event Listeners එකතු කිරීම
 */
function initializeSmsButtons() {
    // නව පණිවිඩ යවන්න බොත්තම
    $("#btnRunManualSms").off().on('click', async (e) => {
        e.preventDefault();
        await runDailySmsCheck(true);
    });

    // Refresh බොත්තම
    $("#btnRefreshSmsLog").off().on('click', async (e) => {
        e.preventDefault();
        const icon = $(e.currentTarget).find('i');
        icon.addClass('fa-spin');
        await loadSmsLogs();
        setTimeout(() => icon.removeClass('fa-spin'), 800);
    });

    // දිනය අනුව Filter කරන බොත්තම
    $("#btnFilterSms").off().on('click', (e) => {
        e.preventDefault();
        const dateVal = $('#smsLogDate').val();
        loadSmsLogs(dateVal);
    });
}