$(document).ready(function () {
    loadCustomerTable();
    setNextCustomerId();

    // 1. Next ID එක පෙන්වීම
    async function setNextCustomerId() {
        const nextId = await window.api.customer.getNextId();
        $('#txtDisplayCustomerId').val(nextId);
        $('#txtCustomerId').val(nextId);
    }

    // 2. Table Load කිරීම (Blocked නම් රතු පැහැයෙන් පෙන්වයි)
    async function loadCustomerTable() {
        const tbody = $('#tblCustomers');
        tbody.html('<tr><td colspan="6" class="text-center py-3"><div class="spinner-border spinner-border-sm text-info"></div></td></tr>');

        const customers = await window.api.customer.getAll();
        let rows = '';

        customers.forEach(cus => {
            const isBlocked = cus.IsBlacklisted === 1;
            const statusBadge = isBlocked 
                ? '<span class="badge bg-danger"><i class="bi bi-shield-lock-fill"></i> BLOCKED</span>' 
                : '<span class="badge bg-success">ACTIVE</span>';
            
            const rowClass = isBlocked ? 'table-danger' : ''; // Bootstrap class for light red row

            rows += `
                <tr class="customer-row ${rowClass}" style="cursor:pointer" 
                    data-id="${cus.CustomerID}" 
                    data-name="${cus.CustomerName}" 
                    data-nic="${cus.NIC}" 
                    data-phone="${cus.CustomerPhone}" 
                    data-address="${cus.CustomerAddress}"
                    data-blacklisted="${cus.IsBlacklisted}">
                    <td><span class="badge bg-info text-dark">${cus.CustomerID}</span></td>
                    <td class="${isBlocked ? 'fw-bold text-danger' : ''}">${cus.CustomerName}</td>
                    <td>${cus.NIC}</td>
                    <td>${cus.CustomerPhone || 'N/A'}</td>
                    <td>${cus.CustomerAddress || 'N/A'}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>`;
        });
        tbody.html(rows || '<tr><td colspan="6" class="text-center">No customers found.</td></tr>');
    }

    // 3. Row Click - Fill Form
    $('#tblCustomers').on('click', '.customer-row', function () {
        $('.customer-row').removeClass('table-info');
        $(this).addClass('table-info');

        $('#txtCustomerId').val($(this).data('id'));
        $('#txtDisplayCustomerId').val($(this).data('id'));
        $('#txtCustomerName').val($(this).data('name'));
        $('#txtCustomerNIC').val($(this).data('nic'));
        $('#txtCustomerPhone').val($(this).data('phone'));
        $('#txtCustomerAddress').val($(this).data('address'));
        
        // Checkbox එකට අගය ලබා දීම
        $('#chkBlacklist').prop('checked', $(this).data('blacklisted') == 1);

        $('#btnCustomerAdd').prop('disabled', true);
    });

    // 4. Add Customer
    $('#btnCustomerAdd').on('click', async function () {
        const data = {
            CustomerName: $('#txtCustomerName').val().trim(),
            NIC: $('#txtCustomerNIC').val().trim(),
            CustomerPhone: $('#txtCustomerPhone').val().trim(),
            CustomerAddress: $('#txtCustomerAddress').val().trim(),
            IsBlacklisted: $('#chkBlacklist').is(':checked')
        };

        if (!data.CustomerName || !data.NIC) return notify.toast('Name and NIC required!', 'warning');

        const res = await window.api.customer.add(data);
        if (res.success) {
            notify.toast(`Customer ${res.newId} added!`, 'success');
            clearCustomerForm();
        }
    });

    // 5. Update Customer
    $('#btnCustomerUpdate').on('click', async function () {
        const data = {
            CustomerID: $('#txtCustomerId').val(),
            CustomerName: $('#txtCustomerName').val().trim(),
            NIC: $('#txtCustomerNIC').val().trim(),
            CustomerPhone: $('#txtCustomerPhone').val().trim(),
            CustomerAddress: $('#txtCustomerAddress').val().trim(),
            IsBlacklisted: $('#chkBlacklist').is(':checked')
        };

        if (!data.CustomerID) return notify.toast('Select a customer to update!', 'warning');

        const res = await window.api.customer.update(data);
        if (res.success) {
            notify.toast('Customer updated successfully!', 'success');
            clearCustomerForm();
        }
    });

    // 6. Delete Customer
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
        $('#txtCustomerName').val('');
        $('#txtCustomerNIC').val('');
        $('#txtCustomerPhone').val('');
        $('#txtCustomerAddress').val('');
        $('#chkBlacklist').prop('checked', false);
        $('#btnCustomerAdd').prop('disabled', false);
        $('.customer-row').removeClass('table-info');
        loadCustomerTable();
        setNextCustomerId();
    }
});