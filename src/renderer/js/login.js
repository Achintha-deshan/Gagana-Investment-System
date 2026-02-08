$(document).ready(function () {
    // 1. කලින් Login වෙලා ඉන්නවද කියලා බලනවා (Session Persistence)
    const currentUser = sessionStorage.getItem('user');
    if (currentUser) {
        showDashboard(JSON.parse(currentUser));
    }

    // 2. Login Form එක Submit කරන විට
    $('#loginForm').on('submit', async function (e) {
        e.preventDefault();

        const username = $('#txtloginUsername').val().trim();
        const password = $('#txtinputPassworde').val().trim();
        const loginBtn = $('#txtsLogin');

        if (!username || !password) {
            notify.toast('කරුණාකර Username සහ Password ඇතුළත් කරන්න!', 'warning');
            return;
        }

        loginBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i> Signing In...');

        try {
            const result = await window.api.auth.login({ username, password });

            if (result.success) {
                notify.toast(`${result.user.Username} ලෙස සාර්ථකව ඇතුළු වුණා!`, 'success');
                sessionStorage.setItem('user', JSON.stringify(result.user));
                
                setTimeout(() => {
                    showDashboard(result.user);
                }, 800);
            } else {
                notify.toast(result.error || 'ඇතුළත් කළ දත්ත වැරදියි!', 'error');
            }
        } catch (error) {
            console.error('Login Error:', error);
            notify.toast('පද්ධතියේ දෝෂයක් පවතී.', 'error');
        } finally {
            loginBtn.prop('disabled', false).text('Sign In');
        }
    });

    // 3. UI එක Dashboard එකට මාරු කරන සහ Permissions පාලනය කරන Function එක
    function showDashboard(user) {
        // Login section එක හංගලා App section එක පෙන්වනවා
        $('#loginSection').fadeOut(300, function() {
            $(this).addClass('d-none');
            $('#appSection').removeClass('d-none').hide().fadeIn(400);
        });

        // User තොරතුරු Sidebar එකේ Update කිරීම
        $('.user-info h6').text(user.Username);
        $('.user-info p').text(user.Role.charAt(0).toUpperCase() + user.Role.slice(1));

        /**
         * ROLE BASED ACCESS CONTROL
         * User 'admin' නෙවෙයි නම් User Management menu එක හංගන්න.
         * මෙහිදී db එකේ role එක simple letters වලින් ('admin') ඇති බව උපකල්පනය කෙරේ.
         */
        if (user.Role.toLowerCase() !== 'admin') {
            $('[data-section="userManagementSection"]').addClass('d-none');
            $('.admin-only').hide(); 
        } else {
            $('[data-section="userManagementSection"]').removeClass('d-none');
            $('.admin-only').show();
        }

        // මුලින්ම Dashboard section එක පෙන්වන්න
        switchSection('dashboardSection');
    }

    // 4. Sidebar Menu Navigation Logic
    // සෑම menu-item එකක්ම click කරන විට අදාළ section එක පෙන්වීම
    $('.menu-item').on('click', function (e) {
        e.preventDefault();
        
        const sectionId = $(this).data('section');
        if (sectionId) {
            switchSection(sectionId);
            
            // Active class එක මාරු කිරීම
            $('.menu-item').removeClass('active');
            $(this).addClass('active');
        }
    });

    // Section මාරු කිරීම සඳහා පොදු function එක
    function switchSection(sectionId) {
        // සියලුම content sections මුලින් හංගන්න
        // (ඔබේ HTML වල හැම section එකකටම 'content-section' class එක ලබා දී තිබිය යුතුය)
        $('.content-section').addClass('d-none');
        
        // අදාළ section එක පමණක් පෙන්වන්න
        $('#' + sectionId).removeClass('d-none');
        
        console.log("Switched to section:", sectionId);
    }

    // 5. Logout වීමේ Logic එක
    $('#btnLogout').on('click', async function () {
        const confirmLogout = await notify.confirm(
            'ඔබට පද්ධතියෙන් ඉවත් වීමට අවශ්‍යද?',
            'Logout Confirm',
            { confirmText: 'Logout', confirmColor: '#ef4444' }
        );

        if (confirmLogout) {
            sessionStorage.removeItem('user');
            location.reload(); 
        }
    });
});