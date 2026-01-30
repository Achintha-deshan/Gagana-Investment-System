let isSystemLocked = false;

/**
 * පද්ධතියේ සෞඛ්‍යය පරීක්ෂා කිරීම (Internet + Database)
 */
async function checkSystemHealth() {
    const isOnline = navigator.onLine;
    let dbStatus = { success: false, status: 'offline' };

    // 1. අන්තර්ජාලය තිබේ නම් පමණක් DB එක පරීක්ෂා කරන්න
    if (isOnline) {
        try {
            dbStatus = await window.api.system.checkStatus();
        } catch (err) {
            dbStatus = { success: false, status: 'offline' };
        }
    }

    // --- පද්ධතිය LOCK කිරීමේ ලොජික් එක ---
    if (!isOnline || !dbStatus.success) {
        
        // Sidebar එකේ status එක update කිරීම
        updateStatusUI(dbStatus.status === 'repair' ? 'repair' : 'offline', 
                       !isOnline ? 'OFFLINE' : (dbStatus.status === 'repair' ? 'REPAIR' : 'DB ERROR'), 
                       !isOnline ? 'No Internet Connection' : 'Database Link Broken');

        // පද්ධතිය දැනටමත් Lock නැත්නම් පමණක් Lock කරන්න
        if (!isSystemLocked) {
            isSystemLocked = true;
            const errorMsg = !isOnline 
                ? "ඔබගේ අන්තර්ජාල සම්බන්ධතාවය බිඳී ඇත. පද්ධතිය භාවිතා කිරීමට කරුණාකර අන්තර්ජාලය සක්‍රීය කරන්න." 
                : "පද්ධතියේ දත්ත ගබඩාව (Remote Database) සමඟ සම්බන්ධ විය නොහැක. මෙය නඩත්තු කටයුත්තක් විය හැක.";
            
            notify.showBlockingAlert(errorMsg);
        }
    } 
    // --- පද්ධතිය UNLOCK කිරීමේ ලොජික් එක ---
    else {
        updateStatusUI('online', 'ONLINE', 'Database Connected');

        if (isSystemLocked) {
            isSystemLocked = false;
            notify.closeModal(); // Blocking Overlay එක ඉවත් කරයි
            overlayReset(); // Overlay styles reset කිරීම
            notify.toast("පද්ධතිය නැවත සක්‍රීයයි!", "success");
        }
    }
}

/**
 * Sidebar එකේ පෙනුම වෙනස් කිරීම
 */
function updateStatusUI(cssClass, text, detail) {
    const indicator = $('#dbStatusIndicator');
    if (indicator.length) {
        indicator.removeClass('online offline repair').addClass(cssClass);
        $('#statusText').text(text);
        $('#statusDetail').text(detail);
    }
}

/**
 * පද්ධතිය යථා තත්ත්වයට පත් වූ පසු Overlay එක මුල් තත්ත්වයට පත් කිරීම
 */
function overlayReset() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.backdropFilter = 'none';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        // පරණ confirm/alert click events නැවත සක්‍රීය කිරීමට notify class එකේ default එකට යයි
    }
}

// උඹ ඉල්ලපු විදිහට තත්පර 5න් 5ට චෙක් කිරීම
setInterval(checkSystemHealth, 5000);

// Page එක Load වූ සැනින් පරීක්ෂා කිරීම
$(document).ready(() => {
    checkSystemHealth();
});