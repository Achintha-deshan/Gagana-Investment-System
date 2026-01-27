$(document).ready(function () {
    loadEmployeeTable();
    setNextEmployeeId();

    async function setNextEmployeeId() {
        const nextId = await window.api.employee.getNextId();
        $('#txtDisplayEmployeeId').val(nextId);
        $('#txtEmployeeId').val(nextId);
    }

    async function loadEmployeeTable() {
        const tbody = $('#tblEmployees');
        const employees = await window.api.employee.getAll();
        
        let rows = '';
        employees.forEach(emp => {
            rows += `
                <tr class="employee-row" style="cursor:pointer" 
                    data-id="${emp.EmployeeID}" data-name="${emp.EmployeeName}" 
                    data-phone="${emp.EmployeePhone}" data-pos="${emp.position}">
                    <td><span class="badge bg-purple-light text-purple">${emp.EmployeeID}</span></td>
                    <td>${emp.EmployeeName}</td>
                    <td>${emp.EmployeePhone || 'N/A'}</td>
                    <td>${emp.position}</td>
                </tr>`;
        });
        tbody.html(rows || '<tr><td colspan="4" class="text-center">No employees found.</td></tr>');
    }

    // Row Click to Fill Form
    $('#tblEmployees').on('click', '.employee-row', function () {
        $('.employee-row').removeClass('table-primary');
        $(this).addClass('table-primary');

        $('#txtEmployeeId').val($(this).data('id'));
        $('#txtDisplayEmployeeId').val($(this).data('id'));
        $('#txtEmployeeName').val($(this).data('name'));
        $('#txtEmployeePhone').val($(this).data('phone'));
        $('#txtEmployeePosition').val($(this).data('pos'));

        $('#btnAddEmployee').prop('disabled', true);
    });

    // Add
    $('#btnAddEmployee').on('click', async function () {
        const data = {
            EmployeeName: $('#txtEmployeeName').val().trim(),
            EmployeePhone: $('#txtEmployeePhone').val().trim(),
            position: $('#txtEmployeePosition').val().trim()
        };

        if (!data.EmployeeName || !data.position) {
            return notify.toast('Name and Position are required!', 'warning');
        }

        const res = await window.api.employee.add(data);
        if (res.success) {
            notify.toast('Employee Added Successfully!', 'success');
            clearEmployeeForm();
        }
    });

    // Update
    $('#btnUpdateEmployee').on('click', async function () {
        const data = {
            EmployeeID: $('#txtEmployeeId').val(),
            EmployeeName: $('#txtEmployeeName').val().trim(),
            EmployeePhone: $('#txtEmployeePhone').val().trim(),
            position: $('#txtEmployeePosition').val().trim()
        };

        const res = await window.api.employee.update(data);
        if (res.success) {
            notify.toast('Employee Updated!', 'success');
            clearEmployeeForm();
        }
    });

    // Delete
    $('#btnDeleteEmployee').on('click', async function () {
        const id = $('#txtEmployeeId').val();
        if (await notify.confirm(`Delete employee ${id}?`)) {
            await window.api.employee.delete(id);
            notify.toast('Employee Deleted!', 'info');
            clearEmployeeForm();
        }
    });

    $('#btnClearEmployee').on('click', clearEmployeeForm);

    function clearEmployeeForm() {
        $('#txtEmployeeName').val('');
        $('#txtEmployeePhone').val('');
        $('#txtEmployeePosition').val('');
        $('#btnAddEmployee').prop('disabled', false);
        $('.employee-row').removeClass('table-primary');
        loadEmployeeTable();
        setNextEmployeeId();
    }
});