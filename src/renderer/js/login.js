$(document).ready(function () {
    // 1. කලින් Login වෙලා ඉන්නවද කියලා බලනවා (Session Persistence)
    const currentUser = sessionStorage.getItem('user');
    if (currentUser) {
        showDashboard(JSON.parse(currentUser));
    }

    // 2. Login Form එක Submit කරන විට
    $('#loginForm').on('submit', async function (e) {
        e.preventDefault();

        // UI එකෙන් දත්ත ලබා ගැනීම
        const username = $('#txtloginUsername').val().trim();
        const password = $('#txtinputPassworde').val().trim();
        const loginBtn = $('#txtsLogin');

        // Validation - හිස් දත්ත ඇත්නම් notification එකක් පෙන්වනවා
        if (!username || !password) {
            notify.toast('කරුණාකර Username සහ Password ඇතුළත් කරන්න!', 'warning');
            return;
        }

        // Button එක loading state එකකට පත් කරනවා
        loginBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i> Signing In...');

        try {
            // Backend (Main Process) එකට දත්ත යවනවා (Preload හරහා)
            const result = await window.api.auth.login({ username, password });

            if (result.success) {
                // Login සාර්ථකයි නම්
                notify.toast(`${result.user.Username} ලෙස සාර්ථකව ඇතුළු වුණා!`, 'success');
                
                // User ගේ විස්තර session එකේ තබා ගන්නවා
                sessionStorage.setItem('user', JSON.stringify(result.user));
                
                // තත්පරයකට පසු Dashboard එක පෙන්වනවා
                setTimeout(() => {
                    showDashboard(result.user);
                }, 800);
            } else {
                // Login අසාර්ථකයි නම් (වැරදි password හෝ user නැතිනම්)
                notify.toast(result.error || 'ඇතුළත් කළ දත්ත වැරදියි!', 'error');
            }
        } catch (error) {
            console.error('Login Error:', error);
            notify.toast('පද්ධතියේ දෝෂයක් පවතී. පසුව උත්සාහ කරන්න.', 'error');
        } finally {
            // Button එක සාමාන්‍ය තත්වයට පත් කරනවා
            loginBtn.prop('disabled', false).text('Sign In');
        }
    });

    // 3. UI එක Login සිට Dashboard එකට මාරු කරන Function එක
    function showDashboard(user) {
        // Login section එක හංගලා App section එක පෙන්වනවා
        $('#loginSection').fadeOut(300, function() {
            $(this).addClass('d-none');
            $('#appSection').removeClass('d-none').hide().fadeIn(400);
        });

        // Dashboard එකේ User ගේ නම සහ Role එක Update කරනවා
        // (UI එකේ තියෙන Sidebar එකේ නම පෙන්වන තැන් වලට මේ IDs දාගන්න)
        $('.user-info h6').text(user.Username);
        $('.user-info p').text(user.Role);

        // Role එක අනුව සමහර දේවල් සීමා කරන්න පුළුවන්
        if (user.Role !== 'Admin') {
            $('.admin-only').hide(); // Admin ට විතරක් පේන්න ඕන දේවල් හංගනවා
        }
    }

    // 4. Logout වීමේ Logic එක
    $('#btnLogout').on('click', async function () {
        const confirmLogout = await notify.confirm(
            'ඔබට පද්ධතියෙන් ඉවත් වීමට අවශ්‍යද?',
            'Logout Confirm',
            { confirmText: 'Logout', confirmColor: '#ef4444' }
        );

        if (confirmLogout) {
            sessionStorage.removeItem('user');
            location.reload(); // මුල සිටම පද්ධතිය පටන් ගන්නවා (Login පෙන්වයි)
        }
    });
});