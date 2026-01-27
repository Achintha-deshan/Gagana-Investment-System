$(document).ready(function () {
    loadCustomerTable();
    setNextCustomerId();

    // --- පාලක ශ්‍රිත (Helper Functions) ---

    // 1. ඊළඟ Customer ID එක පෙන්වීම
    async function setNextCustomerId() {
        const nextId = await window.api.customer.getNextId();
        $('#txtDisplayCustomerId').val(nextId);
        $('#txtCustomerId').val(nextId);
    }

    // 2. Blacklist Switch එක Toggle වන විට Input Field එක පාලනය
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

    // 3. Table එක Load කිරීම
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
                        <td>${cus.CustomerPhone || 'N/A'}</td>
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

    // 4. Row එකක් Click කළ විට Form එක පිරවීම
    $('#tblCustomers').on('click', '.customer-row', function () {
        $('.customer-row').removeClass('table-info');
        $(this).addClass('table-info');

        const isBlacklisted = $(this).data('blacklisted') == 1;

        $('#txtCustomerId').val($(this).data('id'));
        $('#txtDisplayCustomerId').val($(this).data('id'));
        $('#txtCustomerName').val($(this).data('name'));
        $('#txtCustomerNIC').val($(this).data('nic'));
        $('#txtCustomerPhone').val($(this).data('phone'));
        $('#txtCustomerAddress').val($(this).data('address'));
        
        // Blacklist Status සහ Reason සැකසීම
        $('#chkBlacklist').prop('checked', isBlacklisted);
        $('#txtBlacklistReason').val($(this).data('reason'));

        if (isBlacklisted) {
            $('#divBlacklistReason').removeClass('d-none').show();
        } else {
            $('#divBlacklistReason').addClass('d-none').hide();
        }

        $('#btnCustomerAdd').prop('disabled', true);
    });

    // 5. Customer එකතු කිරීම
    $('#btnCustomerAdd').on('click', async function () {
        const isBlacklisted = $('#chkBlacklist').is(':checked');
        const reason = $('#txtBlacklistReason').val().trim();

        const data = {
            CustomerName: $('#txtCustomerName').val().trim(),
            NIC: $('#txtCustomerNIC').val().trim(),
            CustomerPhone: $('#txtCustomerPhone').val().trim(),
            CustomerAddress: $('#txtCustomerAddress').val().trim(),
            IsBlacklisted: isBlacklisted,
            BlacklistReason: isBlacklisted ? reason : null
        };

        if (!data.CustomerName || !data.NIC) return notify.toast('Name and NIC required!', 'warning');
        if (isBlacklisted && !reason) return notify.toast('Blacklist reason is required!', 'warning');

        const res = await window.api.customer.add(data);
        if (res.success) {
            notify.toast(`Customer ${res.newId} added!`, 'success');
            clearCustomerForm();
        }
    });

    // 6. Customer යාවත්කාලීන කිරීම
    $('#btnCustomerUpdate').on('click', async function () {
        const isBlacklisted = $('#chkBlacklist').is(':checked');
        const reason = $('#txtBlacklistReason').val().trim();

        const data = {
            CustomerID: $('#txtCustomerId').val(),
            CustomerName: $('#txtCustomerName').val().trim(),
            NIC: $('#txtCustomerNIC').val().trim(),
            CustomerPhone: $('#txtCustomerPhone').val().trim(),
            CustomerAddress: $('#txtCustomerAddress').val().trim(),
            IsBlacklisted: isBlacklisted,
            BlacklistReason: isBlacklisted ? reason : null
        };

        if (!data.CustomerID) return notify.toast('Select a customer to update!', 'warning');
        if (isBlacklisted && !reason) return notify.toast('Please enter the blacklist reason!', 'warning');

        const res = await window.api.customer.update(data);
        if (res.success) {
            notify.toast('Customer updated successfully!', 'success');
            clearCustomerForm();
        }
    });

    // 7. Customer ඉවත් කිරීම
    $('#btnCustomerDelete').on('click', async function () {
        const id = $('#txtCustomerId').val();
        if(!id) return notify.toast('Select a customer first!', 'warning');
        
        const confirmed = await notify.confirm(`Are you sure you want to delete ${id}?`);
        if (confirmed) {
            await window.api.customer.delete(id);
            notify.toast('Customer deleted!', 'info');
            clearCustomerForm();
        }
    });

    $('#btnCustomerClear').on('click', clearCustomerForm);

    function clearCustomerForm() {
        $('#txtCustomerName, #txtCustomerNIC, #txtCustomerPhone, #txtCustomerAddress, #txtBlacklistReason').val('');
        $('#chkBlacklist').prop('checked', false);
        $('#divBlacklistReason').addClass('d-none').hide();
        $('#btnCustomerAdd').prop('disabled', false);
        $('.customer-row').removeClass('table-info');
        loadCustomerTable();
        setNextCustomerId();
    }
});