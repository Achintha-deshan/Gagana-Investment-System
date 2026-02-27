$(document).ready(function () {
    const currentUser = sessionStorage.getItem('user');
    if (currentUser) {
        showDashboard(JSON.parse(currentUser));
    }

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

    // මෙතන තිබුණු '+' ලකුණ ඉවත් කරා
    function showDashboard(user) {
        $('#loginSection').fadeOut(300, function() {
            $(this).addClass('d-none');
            $('#appSection').removeClass('d-none').hide().fadeIn(400);
        });
        $('.user-info h6').text(user.Username);
        $('.user-info p').text(user.Role.charAt(0).toUpperCase() + user.Role.slice(1));

        if (user.Role.toLowerCase() !== 'admin') {
            $('[data-section="userManagementSection"]').addClass('d-none');
            $('.admin-only').hide(); 
        } else {
            $('[data-section="userManagementSection"]').removeClass('d-none');
            $('.admin-only').show();
        }

        switchSection('dashboardSection');
    }

    $('.menu-item').on('click', function (e) {
        e.preventDefault();
        const sectionId = $(this).data('section');
        if (sectionId) {
            switchSection(sectionId);
            $('.menu-item').removeClass('active');
            $(this).addClass('active');
        }
    });

function switchSection(sectionId) {
    // සියලුම කොටස් සඟවන්න
    $('.content-section, .dashboard-content').addClass('d-none'); 
    
    // තෝරාගත් කොටස පමණක් පෙන්වන්න
    $('#' + sectionId).removeClass('d-none');
    console.log("Switched to section:", sectionId);

    if (sectionId === 'loanManagementSection') {
        setTimeout(() => {
            // 🎯 අවධානය: ඔබේ අලුත් HTML ID එක මෙතනට දාන්න
            const searchInput = $('#txtSearchLornManagementCustomer'); 
            
            if (searchInput.length) {
                // Input එක සක්‍රීය කර focus කිරීම
                searchInput.prop('disabled', false).prop('readonly', false); 
                searchInput.focus(); 
                console.log("Search input focused: txtSearchLornManagementCustomer");
                
                // VehicleLoan.js හි ඇති styles සකසන function එක call කිරීම
                if (typeof window.initVehicleLoanSearch === 'function') {
                    window.initVehicleLoanSearch();
                }
            } else {
                console.error("Error: txtSearchLornManagementCustomer not found in HTML!");
            }
        }, 300); 
    }
}

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