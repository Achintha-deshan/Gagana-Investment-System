// =======================
// Vehicle Loan Renderer JS
// =======================

$(document).ready(async function () {
    await initVehicleLoanPage();
});

async function initVehicleLoanPage() {
    try {
        await setNextVehicleLoanId();
        await loadVehicleLoans();
        setupEventListeners();

        $('#btnAddVehicle').prop('disabled', true);
        $('#btnUpdateVehicle, #btnDeleteVehicle').prop('disabled', true);
        console.log("✅ Vehicle Loan page initialized");
    } catch (error) {
        console.error(error);
    }
}

// ------------------------
// Generate & Set Next Vehicle Loan ID
// ------------------------
async function setNextVehicleLoanId() {
    try {
        const nextId = await window.api.vehicleLoan.getNextId();
        $('#txtVehicleLoanId').val(nextId);
        $('#txtDisplayVehicleLoanId').val(nextId);
    } catch (error) {
        console.error("Failed to generate Loan ID:", error);
    }
}

// ------------------------
// Load Vehicle Loans Table
// ------------------------
async function loadVehicleLoans() {
    try {
        const loans = await window.api.vehicleLoan.getAll();
        const tbody = $('#tblVehicleLoans');
        tbody.empty();

        if (!loans || loans.length === 0) {
            tbody.html('<tr><td colspan="10" class="text-center py-4 text-muted">වාහන ණය තොරතුරු නොමැත</td></tr>');
            return;
        }

        loans.forEach(loan => {
            // Backend එකෙන් එන දත්ත වලට අනුව (JOIN query එක නිසා loan object එකේම මේවා තිබේ)
            const beneficiaries = loan.BeneficiaryNames || '-';
            
            tbody.append(`
                <tr data-id="${loan.LoanID}" style="cursor:pointer;">
                    <td>${loan.LoanID}</td>
                    <td>${loan.OwnerName || 'N/A'}</td>
                    <td>${loan.VehicleNumber || 'N/A'}</td>
                    <td>${loan.VehicleType || 'N/A'}</td>
                    <td class="text-end">${parseFloat(loan.LoanAmount || 0).toLocaleString()}</td>
                    <td class="text-center">${loan.InterestRate}%</td>
                    <td class="small">${beneficiaries}</td>
                    <td class="text-center">
                        <span class="badge ${loan.Status === 'ACTIVE' ? 'bg-success' : 'bg-secondary'}">${loan.Status || 'ACTIVE'}</span>
                    </td>
                </tr>
            `);
        });
    } catch (err) {
        console.error("Failed to load loans:", err);
    }
}

// ------------------------
// Setup Event Listeners
// ------------------------
function setupEventListeners() {

    // පාරිභෝගිකයා සෙවීම
    $('#txtSearchCustomer').on('input', async function () {
        const query = $(this).val().trim();
        if (query.length >= 2) {
            try {
                const results = await window.api.customer.search(query);
                
                if (results && results.length > 0) {
                    const customer = results[0];

                    if (customer.IsBlacklisted == 1 || customer.IsBlacklisted == true) {
                        const reason = customer.BlacklistReason || "හේතුවක් සඳහන් කර නොමැත.";
                        await notify.confirm(
                            `මෙම පාරිභෝගිකයා (${customer.CustomerName}) Blacklist ඇතුළත් කර ඇත.\n\n` +
                            `🚫 හේතුව: ${reason}\n\n` +
                            `මොහුට නව ණය ලබා දීම පද්ධතිය මගින් අවහිර කර ඇත.`,
                            'පාරිභෝගිකයා අවහිර කර ඇත (Blocked)',
                            { confirmText: 'හරි (OK)', showCancelButton: false, confirmColor: '#ef4444' }
                        );
                        $(this).val('');
                        clearCustomerDisplay();
                        return;
                    }
                    
                    $('#displayCustomerName').text(customer.CustomerName || '---');
                    $('#displayCustomerId').text(customer.CustomerID || '---').data('id', customer.CustomerID);
                    $('#displayCustomerNic').text(customer.NIC || '---');
                    $('#displayCustomerPhone').text(customer.CustomerPhone || '---');
                    $('.info-display').fadeIn();

                } else {
                    clearCustomerDisplay();
                }
            } catch (error) {
                console.error("සෙවීමේදී දෝෂයක්:", error);
            }
        } else {
            clearCustomerDisplay();
        }
        checkAddButtonState();
    });

    // ඇපකරුවන් එකතු කිරීම
    $('#btnAddVehicleBeneficiary').click(async function (e) {
        e.preventDefault();
        const name = $('#txtVehicleBeneficiaryName').val().trim();
        const phone = $('#txtVehicleBeneficiaryPhone').val().trim();
        const address = $('#txtVehicleBeneficiaryAddress').val().trim();

        if (!name || !phone) {
            return notify.toast("අවම වශයෙන් නම සහ දුරකථන අංකය ඇතුළත් කරන්න.", "warning");
        }

        const isActive = await window.api.vehicleLoan.checkBeneficiaryActive(name, phone);
        if (isActive) {
            return notify.toast("මෙම ඇපකරු දැනටමත් සක්‍රීය වාහන ණයක සිටී!", "error");
        }

        $('#vehicleBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2 mb-1 bg-light rounded"">
                <span><strong>${name}</strong> - ${phone}</span>
                <button type="button" class="btn btn-sm btn-danger btnDeleteBeneficiary">මකන්න</button>
                <input type="hidden" class="ben-name" value="${name}">
                <input type="hidden" class="ben-phone" value="${phone}">
                <input type="hidden" class="ben-address" value="${address}">
            </div>
        `);

        $('#txtVehicleBeneficiaryName, #txtVehicleBeneficiaryPhone, #txtVehicleBeneficiaryAddress').val('');
        checkAddButtonState();
    });

    $(document).on('click', '.btnDeleteBeneficiary', function () {
        $(this).closest('.beneficiary-item').remove();
        checkAddButtonState();
    });

    // ණය ඇතුළත් කිරීම (ADD)
    $('#btnAddVehicle').click(async function () {
        const customerId = $('#displayCustomerId').data('id');
        
        if (!customerId) return notify.toast("කරුණාකර පාරිභෝගිකයෙකු තෝරා සිටින්න.", "warning");

        const beneficiaries = [];
        $('#vehicleBeneficiaryList .beneficiary-item').each(function () {
            beneficiaries.push({
                Name: $(this).find('.ben-name').val(),
                Phone: $(this).find('.ben-phone').val(),
                Address: $(this).find('.ben-address').val()
            });
        });

        const data = {
            CustomerID: customerId,
            OwnerName: $('#txtVehicleOwnerName').val().trim(),
            VehicleNumber: $('#txtVehicleNumber').val().trim(),
            VehicleType: $('#txtVehicleType').val(),
            CurrentValue: parseFloat($('#txtVehicleCurrentValue').val()) || 0,
            LoanLimit: parseFloat($('#txtVehicleLoanLimit').val()) || 0,
            LoanAmount: parseFloat($('#txtVehicleLoanAmount').val()) || 0,
            GivenAmount: parseFloat($('#txtVehicleGivenAmount').val()) || 0,
            LoanDate: $('#txtVehicleLoanDate').val(),
            RegDeadlineDate: $('#txtVehicleRegDeadlineDate').val(), // ලියාපදිංචි කළ යුතු දිනය
            InterestRate: parseFloat($('#txtVehicleInterestRate').val()) || 0,
            RegistrationDate: new Date().toISOString().slice(0, 10),
            Beneficiaries: beneficiaries
        };

        const result = await window.api.vehicleLoan.add(data);
        if (result.success) {
            notify.toast("වාහන ණය සාර්ථකව ඇතුළත් කරන ලදි.", "success");
            clearForm();
            await loadVehicleLoans();
        } else {
            notify.toast("දෝෂයක්: " + result.error, "error");
        }
    });

    // Row Click Logic (Form එක පිරවීම)
    $('#tblVehicleLoans').off('click', 'tr').on('click', 'tr', async function () {
        const loanId = $(this).data('id');
        if (!loanId) return;

        $('#tblVehicleLoans tr').removeClass('table-primary');
        $(this).addClass('table-primary');

        try {
            const loan = await window.api.vehicleLoan.getById(loanId);
            if (loan) {
                $('#txtVehicleLoanId, #txtDisplayVehicleLoanId').val(loan.LoanID);
                $('#txtVehicleOwnerName').val(loan.OwnerName);
                $('#txtVehicleNumber').val(loan.VehicleNumber);
                $('#txtVehicleType').val(loan.VehicleType);
                $('#txtVehicleCurrentValue').val(loan.CurrentValue);
                $('#txtVehicleLoanLimit').val(loan.LoanLimit);
                $('#txtVehicleLoanAmount').val(loan.LoanAmount);
                $('#txtVehicleGivenAmount').val(loan.GivenAmount);
                $('#txtVehicleInterestRate').val(loan.InterestRate);
                
                // දින සැකසීම
                if (loan.LoanDate) {
                    $('#txtVehicleLoanDate').val(new Date(loan.LoanDate).toISOString().split('T')[0]);
                }
                
                // ලියාපදිංචි කළ යුතු අවසාන දිනය (Backend එකේ Liyapadinchikalayuthudinaya)
                if (loan.Liyapadinchikalayuthudinaya) {
                    $('#txtVehicleRegDeadlineDate').val(new Date(loan.Liyapadinchikalayuthudinaya).toISOString().split('T')[0]);
                } else {
                    $('#txtVehicleRegDeadlineDate').val('');
                }

                $('#displayCustomerName').text(loan.CustomerName || 'N/A');
                $('#displayCustomerId').text(loan.CustomerID).data('id', loan.CustomerID);
                $('#displayCustomerNic').text(loan.NIC || 'N/A');
                $('#displayCustomerPhone').text(loan.CustomerPhone || 'N/A');
                $('.info-display').fadeIn();

                // ඇපකරුවන් ලැයිස්තුව
                $('#vehicleBeneficiaryList').empty();
                if (loan.Beneficiaries) {
                    loan.Beneficiaries.forEach(ben => {
                        $('#vehicleBeneficiaryList').append(`
                            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2 bg-white mb-1 shadow-sm rounded">
                                <span><strong>${ben.Name}</strong> - ${ben.Phone}</span>
                                <button type="button" class="btn btn-sm btn-danger btnDeleteBeneficiary">මකන්න</button>
                                <input type="hidden" class="ben-name" value="${ben.Name}">
                                <input type="hidden" class="ben-phone" value="${ben.Phone}">
                                <input type="hidden" class="ben-address" value="${ben.Address}">
                            </div>
                        `);
                    });
                }

                $('#btnAddVehicle').prop('disabled', true);
                $('#btnUpdateVehicle, #btnDeleteVehicle').prop('disabled', false);
            }
        } catch (error) {
            console.error("Row Click Error:", error);
        }
    });

    // ණය යාවත්කාලීන කිරීම (UPDATE)
    $('#btnUpdateVehicle').click(async function () {
        const loanId = $('#txtVehicleLoanId').val();
        
        const beneficiaries = [];
        $('#vehicleBeneficiaryList .beneficiary-item').each(function () {
            beneficiaries.push({
                Name: $(this).find('.ben-name').val(),
                Phone: $(this).find('.ben-phone').val(),
                Address: $(this).find('.ben-address').val()
            });
        });

        const data = {
            LoanID: loanId,
            OwnerName: $('#txtVehicleOwnerName').val().trim(),
            VehicleNumber: $('#txtVehicleNumber').val().trim(),
            VehicleType: $('#txtVehicleType').val(),
            CurrentValue: parseFloat($('#txtVehicleCurrentValue').val()) || 0,
            LoanLimit: parseFloat($('#txtVehicleLoanLimit').val()) || 0,
            LoanAmount: parseFloat($('#txtVehicleLoanAmount').val()) || 0,
            GivenAmount: parseFloat($('#txtVehicleGivenAmount').val()) || 0,
            LoanDate: $('#txtVehicleLoanDate').val(),
            RegDeadlineDate: $('#txtVehicleRegDeadlineDate').val(), // නව දිනය
            InterestRate: parseFloat($('#txtVehicleInterestRate').val()) || 0,
            Beneficiaries: beneficiaries
        };

        const result = await window.api.vehicleLoan.update(data);
        if (result.success) {
            notify.toast("වාහන ණය විස්තර සාර්ථකව යාවත්කාලීන කරන ලදි.", "success");
            clearForm();
            await loadVehicleLoans();
        } else {
            notify.toast("යාවත්කාලීන කිරීමේදී දෝෂයක්: " + result.error, "error");
        }
    });

    // ණය මකා දැමීම (DELETE)
    $('#btnDeleteVehicle').click(async function () {
        const loanId = $('#txtVehicleLoanId').val();
        if (!loanId) return;

        const isConfirmed = await notify.confirm(
            `ඔබ ස්ථිරවම ${loanId} ණය ගිණුම මකා දමනවාද? මෙය ආපසු හැරවිය නොහැක.`,
            'ණය ගිණුම මකා දැමීම',
            { confirmText: 'ඔව්, මකන්න', confirmColor: '#ef4444', cancelText: 'එපා' }
        );

        if (isConfirmed) {
            const result = await window.api.vehicleLoan.delete(loanId);
            if (result.success) {
                notify.toast(`${loanId} මකා දමන ලදි.`, "success");
                clearForm();
                await loadVehicleLoans();
            } else {
                notify.toast("දෝෂයක්: " + result.error, "error");
            }
        }
    });

    $('#btnClearVehicle').click(function () { clearForm(); });
    
    // වැදගත් input වෙනස් වන විට Add button state එක බැලීම
    $('#txtVehicleOwnerName, #txtVehicleNumber, #txtVehicleLoanAmount').on('input', checkAddButtonState);
}

// ------------------------
// Logic: Enable/Disable Add Button
// ------------------------
function checkAddButtonState() {
    const customerId = $('#displayCustomerId').data('id');
    const owner = $('#txtVehicleOwnerName').val().trim();
    const vehicleNo = $('#txtVehicleNumber').val().trim();
    const benCount = $('#vehicleBeneficiaryList .beneficiary-item').length;

    const canAdd = (customerId && owner && vehicleNo && benCount > 0);
    $('#btnAddVehicle').prop('disabled', !canAdd);
}

// ------------------------
// Clear Form
// ------------------------
function clearForm() {
    $('#txtVehicleOwnerName, #txtVehicleNumber, #txtVehicleType, #txtVehicleCurrentValue, #txtVehicleLoanLimit, #txtVehicleLoanAmount, #txtVehicleLoanDate, #txtVehicleGivenAmount, #txtVehicleInterestRate, #txtVehicleRegDeadlineDate, #txtSearchCustomer').val('');
    $('#vehicleBeneficiaryList').empty();
    clearCustomerDisplay();
    $('#tblVehicleLoans tr').removeClass('table-primary');
    setNextVehicleLoanId();
    $('#btnAddVehicle').prop('disabled', true);
    $('#btnUpdateVehicle, #btnDeleteVehicle').prop('disabled', true);
}

// ------------------------
// Clear Customer Display
// ------------------------
function clearCustomerDisplay() {
    $('#displayCustomerName, #displayCustomerId, #displayCustomerNic, #displayCustomerPhone').text('---');
    $('#displayCustomerId').removeData('id');
    $('.info-display').fadeOut();
    checkAddButtonState();
}