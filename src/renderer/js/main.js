$(document).ready(function () {

    // 1. Sidebar එකේ menu item එකක් click කළ විට
    $('.menu-item').on('click', function (e) {
        e.preventDefault();

        // Sidebar එකේ active class එක පාලනය (පැහැය වෙනස් කිරීමට)
        $('.menu-item').removeClass('active');
        $(this).addClass('active');

        // Click කළ button එකේ data-section අගය ලබා ගැනීම (උදා: userManagementSection)
        const targetSection = $(this).data('section');

        // පද්ධතියේ ඇති සියලුම ප්‍රධාන sections හංගන්න
        // (dashboard-content class එක ඇති සියලුම tags hide කරයි)
        $('.dashboard-content, section[id$="Section"], #appSection > section').addClass('d-none');

        // අපට අවශ්‍ය section එකේ ID එක තිබේ නම් එය පමණක් පෙන්වන්න
        if (targetSection) {
            $(`#${targetSection}`).removeClass('d-none').hide().fadeIn(300);
            
            // Top Navbar එකේ තියෙන Page Title එක මාරු කිරීම (Dashboard/User Management ආදී ලෙස)
            const sectionName = $(this).find('span').text();
            $('#pageTitle').text(sectionName);
        }

        // පිටුව ඉහළටම ස්ක්‍රෝල් කිරීම (Scrolling issue එක විසඳීමට ප්‍රධානම පියවර)
        window.scrollTo(0, 0);
    });

    // 2. Logout Button එක සඳහා (Login එකට යාමට)
    $('#btnLogout').on('click', function() {
        $('#appSection').addClass('d-none');
        $('#loginSection').removeClass('d-none');
    });

});