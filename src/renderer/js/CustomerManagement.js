$(document).ready(function () {
    loadCustomerTable();
    setNextCustomerId();

    // --- පාලක ශ්‍රිත (Helper Functions) ---

    // 1. දුරකථන අංකය +94 රටාවට තිබේදැයි පරීක්ෂා කිරීම (Regex Validation)
    function isValidSriLankanPhone(phone) {
        // රටාව: +94 පසුව ඉලක්කම් 9ක් තිබිය යුතුය.
        const phoneRegex = /^\+94\d{9}$/;
        return phoneRegex.test(phone);
    }

    // 2. ඊළඟ Customer ID එක පෙන්වීම
    async function setNextCustomerId() {
        const nextId = await window.api.customer.getNextId();
        $('#txtDisplayCustomerId').val(nextId);
        $('#txtCustomerId').val(nextId);
    }

    // 3. Blacklist Switch එක Toggle වන විට
    $('#chkBlacklist').on('change', function() {
        if ($(this).is(':checked')) {
            $('#divBlacklistReason').removeClass('d-none').hide().fadeIn(300);
            $('#txtBlacklistReason').focus();
        } else {
            $('#divBlacklistReason').fadeOut(300, function() {
                $(this).addClass('d-none');
                $('#txtBlacklistReason').val('');
            });
        }
    });

    // 4. Table එක Load කිරීම
    async function loadCustomerTable() {
        const tbody = $('#tblCustomers');
        tbody.html('<tr><td colspan="7" class="text-center py-3"><div class="spinner-border spinner-border-sm text-info"></div></td></tr>');

        try {
            const customers = await window.api.customer.getAll();
            let rows = '';

            customers.forEach(cus => {
                const isBlocked = cus.IsBlacklisted === 1;
                const statusBadge = isBlocked 
                    ? '<span class="badge bg-danger"><i class="bi bi-shield-lock-fill"></i> BLOCKED</span>' 
                    : '<span class="badge bg-success">ACTIVE</span>';
                
                const rowClass = isBlocked ? 'table-danger' : '';

                rows += `
                    <tr class="customer-row ${rowClass}" style="cursor:pointer" 
                        data-id="${cus.CustomerID}" 
                        data-name="${cus.CustomerName}" 
                        data-nic="${cus.NIC}" 
                        data-phone="${cus.CustomerPhone}" 
                        data-address="${cus.CustomerAddress}"
                        data-blacklisted="${cus.IsBlacklisted}"
                        data-reason="${cus.BlacklistReason || ''}">
                        <td><span class="badge bg-info text-dark">${cus.CustomerID}</span></td>
                        <td class="${isBlocked ? 'fw-bold text-danger' : ''}">${cus.CustomerName}</td>
                        <td>${cus.NIC}</td>
                        <td class="fw-bold text-primary">${cus.CustomerPhone || 'N/A'}</td>
                        <td>${cus.CustomerAddress || 'N/A'}</td>
                        <td class="text-center">${statusBadge}</td>
                        <td class="text-danger small">${cus.BlacklistReason || '-'}</td>
                    </tr>`;
            });
            tbody.html(rows || '<tr><td colspan="7" class="text-center">No customers found.</td></tr>');
        } catch (err) {
            tbody.html('<tr><td colspan="7" class="text-center text-danger">Error loading data.</td></tr>');
        }
    }

    // 5. Row එකක් Click කළ විට Form එක පිරවීම
    $('#tblCustomers').on('click', '.customer-row', function () {
        $('.customer-row').removeClass('table-info shadow-sm');
        $(this).addClass('table-info shadow-sm');

        const isBlacklisted = $(this).data('blacklisted') == 1;

        $('#txtCustomerId').val($(this).data('id'));
        $('#txtDisplayCustomerId').val($(this).data('id'));
        $('#txtCustomerName').val($(this).data('name'));
        $('#txtCustomerNIC').val($(this).data('nic'));
        $('#txtCustomerPhone').val($(this).data('phone'));
        $('#txtCustomerAddress').val($(this).data('address'));
        
        $('#chkBlacklist').prop('checked', isBlacklisted);
        $('#txtBlacklistReason').val($(this).data('reason'));

        if (isBlacklisted) {
            $('#divBlacklistReason').removeClass('d-none').show();
        } else {
            $('#divBlacklistReason').addClass('d-none').hide();
        }

        $('#btnCustomerAdd').prop('disabled', true);
    });

    // 6. Customer එකතු කිරීම
    $('#btnCustomerAdd').on('click', async function () {
        const phone = $('#txtCustomerPhone').val().trim();
        const isBlacklisted = $('#chkBlacklist').is(':checked');
        const reason = $('#txtBlacklistReason').val().trim();

        const data = {
            CustomerName: $('#txtCustomerName').val().trim(),
            NIC: $('#txtCustomerNIC').val().trim(),
            CustomerPhone: phone,
            CustomerAddress: $('#txtCustomerAddress').val().trim(),
            IsBlacklisted: isBlacklisted,
            BlacklistReason: isBlacklisted ? reason : null
        };

        // --- Validations ---
        if (!data.CustomerName || !data.NIC) return notify.toast('Name and NIC required!', 'warning');
        
        // 🛑 Phone Number Validation (+94700000000)
        if (!isValidSriLankanPhone(data.CustomerPhone)) {
            return notify.toast('Invalid phone! Must be in +94700000000 format.', 'error');
        }

        if (isBlacklisted && !reason) return notify.toast('Blacklist reason is required!', 'warning');

        const res = await window.api.customer.add(data);
        if (res.success) {
            notify.toast(`Customer ${res.newId} added!`, 'success');
            clearCustomerForm();
        }
    });

    // 7. Customer යාවත්කාලීන කිරීම
    $('#btnCustomerUpdate').on('click', async function () {
        const phone = $('#txtCustomerPhone').val().trim();
        const isBlacklisted = $('#chkBlacklist').is(':checked');
        const reason = $('#txtBlacklistReason').val().trim();

        const data = {
            CustomerID: $('#txtCustomerId').val(),
            CustomerName: $('#txtCustomerName').val().trim(),
            NIC: $('#txtCustomerNIC').val().trim(),
            CustomerPhone: phone,
            CustomerAddress: $('#txtCustomerAddress').val().trim(),
            IsBlacklisted: isBlacklisted,
            BlacklistReason: isBlacklisted ? reason : null
        };

        if (!data.CustomerID) return notify.toast('Select a customer to update!', 'warning');
        
        // 🛑 Phone Number Validation (+94700000000)
        if (!isValidSriLankanPhone(data.CustomerPhone)) {
            return notify.toast('Invalid phone! Use +947XXXXXXXX format.', 'error');
        }

        if (isBlacklisted && !reason) return notify.toast('Blacklist reason is required!', 'warning');

        const res = await window.api.customer.update(data);
        if (res.success) {
            notify.toast('Customer updated successfully!', 'success');
            clearCustomerForm();
        }
    });

  // 8. Customer ඉවත් කිරීම
   $('#btnCustomerDelete').on('click', async function () {
        const id = $('#txtCustomerId').val();
        if(!id) return notify.toast('කරුණාකර පාරිභෝගිකයෙකු තෝරාගන්න!', 'warning');
        
        const confirmed = await notify.confirm(`පාරිභෝගිකයා (${id}) ඉවත් කිරීමට ඔබට විශ්වාසද? මෙහිදී ඔහුට අදාළ සියලුම ණය වාරික සහ ගෙවීම් දත්ත මැකී යනු ඇත.`);
        
        if (confirmed) {
            try {
                // API එකේ නම නිවැරදිද බලන්න (customer ද customers ද කියා)
                const result = await window.api.customer.delete(id); 
                
                if (result.success) {
                    notify.toast('පාරිභෝගිකයා සාර්ථකව ඉවත් කළා!', 'success');
                    clearCustomerForm();
                    // List එක refresh කරන function එකක් තියෙනවා නම් මෙතනට දාන්න
                    if (typeof loadCustomers === 'function') loadCustomers();
                } else {
                    notify.toast('වැරැද්දක් වුණා: ' + result.message, 'error');
                }
            } catch (err) {
                notify.toast('System error එකක් ආවා!', 'error');
                console.error(err);
            }
        }
   });

    $('#btnCustomerClear').on('click', clearCustomerForm);

    function clearCustomerForm() {
        $('#txtCustomerName, #txtCustomerNIC, #txtCustomerPhone, #txtCustomerAddress, #txtBlacklistReason').val('');
        $('#chkBlacklist').prop('checked', false);
        $('#divBlacklistReason').addClass('d-none').hide();
        $('#btnCustomerAdd').prop('disabled', false);
        $('.customer-row').removeClass('table-info shadow-sm');
        loadCustomerTable();
        setNextCustomerId();
    }
});