$(document).ready(function () {
    // App එක Load වෙද්දීම Table එක සහ Next ID එක load කරන්න
    loadUserTable();
    updateNextIdDisplay();

    // ==========================================
    // 1. DATA LOAD කිරීම සහ TABLE එක සැකසීම
    // ==========================================
    async function loadUserTable() {
        const tbody = $('#tblUsers');
        tbody.html('<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>');

        try {
            const response = await window.api.user.getAll();
            if (response.success) {
                let rows = '';
                response.data.forEach(user => {
                    rows += `
                        <tr class="user-row" style="cursor:pointer" 
                            data-id="${user.UserID}" 
                            data-name="${user.Username}" 
                            data-phone="${user.Phone || ''}" 
                            data-role="${user.Role}">
                            <td><span class="badge bg-light text-dark border">${user.UserID}</span></td>
                            <td class="fw-bold">${user.Username}</td>
                            <td>${user.Phone || 'N/A'}</td>
                            <td><span class="badge ${getRoleColor(user.Role)}">${user.Role}</span></td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-outline-primary"><i class="fas fa-eye"></i></button>
                            </td>
                        </tr>`;
                });
                tbody.html(rows || '<tr><td colspan="5" class="text-center">No users found.</td></tr>');
            }
        } catch (error) {
            tbody.html('<tr><td colspan="5" class="text-center text-danger">Failed to load users.</td></tr>');
        }
    }

    // Table Row එකක් click කළ විට fields fill කිරීම
    $('#tblUsers').on('click', '.user-row', function () {
        const id = $(this).data('id');
        const name = $(this).data('name');
        const phone = $(this).data('phone');
        const role = $(this).data('role');

        $('#txtUserId').val(id);
        $('#txtUsername').val(name);
        $('#txtPassword').val(''); 
        $('#txtPhone').val(phone);
        $('#cmbRole').val(role);

        $('#btnAdd').prop('disabled', true); // Edit මෝඩ් එකේදී Add disable කරයි
        $('.user-row').removeClass('table-primary');
        $(this).addClass('table-primary'); // Click කළ row එක highlight කරයි
        
        notify.toast(`User ${id} selected`, 'info');
    });

    // ඊළඟට ලැබෙන ID එක පෙන්වීමට (පොඩි logic එකක්)
    async function updateNextIdDisplay() {
        // මේ සඳහා Backend එකේ අපි කලින් හැදූ generateNextUserId පාවිච්චි කළ හැක
        // දැනට පවතින Table එකේ අන්තිම row එකෙන් වුවද අනුමාන කළ හැක
        // වඩාත් නිවැරදි ක්‍රමය Backend එකෙන් අලුත් ID එක ඉල්ලීමයි
    }

    // ==========================================
    // 2. ADD USER
    // ==========================================
    $('#btnAdd').on('click', async function () {
        const userData = {
            Username: $('#txtUsername').val().trim(),
            Password: $('#txtPassword').val(),
            Phone: $('#txtPhone').val().trim(),
            Role: $('#cmbRole').val()
        };

        if (!userData.Username || !userData.Password) {
            notify.toast('Please fill required fields!', 'warning');
            return;
        }

        const res = await window.api.user.add(userData);
        if (res.success) {
            notify.toast(`User ${res.newId} created!`, 'success');
            clearForm();
            loadUserTable();
        } else {
            notify.toast('Error: ' + res.error, 'error');
        }
    });

    // ==========================================
    // 3. UPDATE USER
    // ==========================================
    $('#btnUpdate').on('click', async function () {
        const userId = $('#txtUserId').val();
        if (!userId) {
            notify.toast('Please select a user first!', 'warning');
            return;
        }

        const userData = {
            UserID: userId,
            Username: $('#txtUsername').val().trim(),
            Password: $('#txtPassword').val(), 
            Phone: $('#txtPhone').val().trim(),
            Role: $('#cmbRole').val()
        };

        const res = await window.api.user.update(userData);
        if (res.success) {
            notify.toast('User updated successfully!', 'success');
            clearForm();
            loadUserTable();
        }
    });

    // ==========================================
    // 4. DELETE USER
    // ==========================================
    $('#btnDelete').on('click', async function () {
        const userId = $('#txtUserId').val();
        if (!userId) return notify.toast('Select a user!', 'warning');

        const confirmed = await notify.confirm(`Delete user ${userId}?`, 'Warning');
        if (confirmed) {
            const res = await window.api.user.delete(userId);
            if (res.success) {
                notify.toast('User removed', 'info');
                clearForm();
                loadUserTable();
            }
        }
    });

    // ==========================================
    // 5. CLEAR FORM
    // ==========================================
    $('#btnClear').on('click', clearForm);

    function clearForm() {
        $('#txtUserId').val('');
        $('#txtUsername').val('');
        $('#txtPassword').val('');
        $('#txtPhone').val('');
        $('#cmbRole').val('Employee');
        $('#btnAdd').prop('disabled', false);
        $('.user-row').removeClass('table-primary');
    }

    function getRoleColor(role) {
        switch (role.toLowerCase()) {
            case 'admin': return 'bg-danger';
            case 'manager': return 'bg-warning text-dark';
            default: return 'bg-success';
        }
    }
});