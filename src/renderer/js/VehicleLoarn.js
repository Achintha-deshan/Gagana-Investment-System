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
            tbody.html('<tr><td colspan="8" class="text-center py-4 text-muted">වාහන ණය තොරතුරු නොමැත</td></tr>');
            return;
        }

        loans.forEach(loan => {
            const beneficiaries = loan.BeneficiaryNames || '-';
            tbody.append(`
                <tr data-id="${loan.LoanID}">
                    <td>${loan.LoanID}</td>
                    <td>${loan.OwnerName}</td>
                    <td>${loan.VehicleNumber}</td>
                    <td>${loan.VehicleType}</td>
                    <td>${loan.LoanAmount}</td>
                    <td>${loan.InterestRate}</td>
                    <td>${beneficiaries}</td>
                    <td>${loan.SmsMessage || '-'}</td>
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

 // 1. පාරිභෝගිකයා සෙවීම (Customer Search)
// 1. පාරිභෝගිකයා සෙවීම (Customer Search)
$('#txtSearchCustomer').on('input', async function () {
    const query = $(this).val().trim();
    if (query.length >= 2) {
        try {
            const results = await window.api.customer.search(query);
            
            if (results && results.length > 0) {
                const customer = results[0];
                
                // Debugging: Console එකේ බලන්න දත්ත එන හැටි
                console.log("Customer Found:", customer);

                // 🛑 පාරිභෝගිකයා Blacklisted දැයි පරීක්ෂා කිරීම (1 හෝ true)
                if (customer.IsBlacklisted == 1 || customer.IsBlacklisted == true) {
                    
                    // Database එකෙන් ලැබෙන Column name එක Capital ද Small ද කියා පරීක්ෂා කර අගය ගනී
                    const reason = customer.BlacklistReason || customer.blacklistreason || "හේතුවක් සඳහන් කර නොමැත.";

                    // පාරිභෝගිකයා සම්පූර්ණයෙන්ම අවහිර කිරීම (හේතුව සමඟ)
                    await notify.confirm(
                        `මෙම පාරිභෝගිකයා (${customer.CustomerName}) කළු ලැයිස්තුවට (Blacklist) ඇතුළත් කර ඇත.\n\n` +
                        `🚫 හේතුව: ${reason}\n\n` +
                        `මොහුට නව ණය ලබා දීම පද්ධතිය මගින් අවහිර කර ඇත.`,
                        'පාරිභෝගිකයා අවහිර කර ඇත (Blocked)',
                        {
                            confirmText: 'හරි (OK)',
                            showCancelButton: false, 
                            confirmColor: '#ef4444'   // රතු පැහැය
                        }
                    );

                    // Alert එකේ OK කළ පසු සෙවුම් කොටුව හිස් කර Display එක අයින් කරයි
                    $(this).val('');
                    clearCustomerDisplay();
                    return;
                }
                
                // Blacklisted නොවේ නම් විස්තර පෙන්වීම
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

    // 2. ඇපකරුවන් එකතු කිරීම (Add Beneficiary)
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

        const index = $('#vehicleBeneficiaryList .beneficiary-item').length;
        $('#vehicleBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2" data-index="${index}">
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

    // 3. ඇපකරු මකා දැමීම (Delete Beneficiary)
    $(document).on('click', '.btnDeleteBeneficiary', function () {
        $(this).closest('.beneficiary-item').remove();
        checkAddButtonState();
    });

    // 4. වාහන ණය ඇතුළත් කිරීම (Add Vehicle Loan)
    $('#btnAddVehicle').click(async function () {
        // Customer ID එක නිවැරදිව ලබා ගැනීම
        const customerId = $('#displayCustomerId').data('id');
        
        if (!customerId) {
            return notify.toast("කරුණාකර පාරිභෝගිකයෙකු තෝරා සිටින්න.", "warning");
        }

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
            InterestRate: parseFloat($('#txtVehicleInterestRate').val()) || 0,
            RegistrationDate: new Date().toISOString().slice(0, 10),
            Beneficiaries: beneficiaries
        };

        if (!data.OwnerName || !data.VehicleNumber || beneficiaries.length === 0) {
            return notify.toast("අවශ්‍ය සියලුම තොරතුරු සහ අවම වශයෙන් එක් ඇපකරුවෙකු ඇතුළත් කරන්න.", "warning");
        }

        const result = await window.api.vehicleLoan.add(data);
        if (result.success) {
            notify.toast("වාහන ණය සාර්ථකව ඇතුළත් කරන ලදි.", "success");
            clearForm();
            await setNextVehicleLoanId();
            await loadVehicleLoans();
        } else {
            notify.toast("ඇතුළත් කිරීමේදී දෝෂයක්: " + result.error, "error");
        }
    });
    // 6. Table Row එකක් Click කළ විට දත්ත Form එකට ගැනීම
    $('#tblVehicleLoans').on('click', 'tr', async function () {
        const loanId = $(this).data('id');
        if (!loanId) return;

        const loan = await window.api.vehicleLoan.getById(loanId);
        
        // Row එක Highlight කිරීම
        $('#tblVehicleLoans tr').removeClass('table-primary');
        $(this).addClass('table-primary');

        try {
            // Backend එකෙන් අදාළ Loan එකේ සියලුම විස්තර (Beneficiaries ඇතුළුව) ලබා ගැනීම
            const loan = await window.api.vehicleLoan.getById(loanId);
            
            if (loan) {
                // Form එකට දත්ත පිරවීම
                $('#txtVehicleLoanId').val(loan.LoanID);
                $('#txtDisplayVehicleLoanId').val(loan.LoanID);
                $('#txtVehicleOwnerName').val(loan.OwnerName);
                $('#txtVehicleNumber').val(loan.VehicleNumber);
                $('#txtVehicleType').val(loan.VehicleType);
                $('#txtVehicleCurrentValue').val(loan.CurrentValue);
                $('#txtVehicleLoanLimit').val(loan.LoanLimit);
                $('#txtVehicleLoanAmount').val(loan.LoanAmount);
                $('#txtVehicleGivenAmount').val(loan.GivenAmount);
                $('#txtVehicleLoanDate').val(loan.LoanDate);
                $('#txtVehicleInterestRate').val(loan.InterestRate);

                // Customer තොරතුරු පෙන්වීම
                $('#displayCustomerName').text(loan.CustomerName);
                $('#displayCustomerId').text(loan.CustomerID).data('id', loan.CustomerID);
                $('#displayCustomerNic').text(loan.NIC);
                $('#displayCustomerPhone').text(loan.CustomerPhone);
                $('.info-display').fadeIn();

                // ඇපකරුවන් ලැයිස්තුව පිරවීම
                $('#vehicleBeneficiaryList').empty();
                if (loan.Beneficiaries && loan.Beneficiaries.length > 0) {
                    loan.Beneficiaries.forEach((ben, index) => {
                        $('#vehicleBeneficiaryList').append(`
                            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2" data-index="${index}">
                                <span><strong>${ben.Name}</strong> - ${ben.Phone}</span>
                                <button type="button" class="btn btn-sm btn-danger btnDeleteBeneficiary">මකන්න</button>
                                <input type="hidden" class="ben-name" value="${ben.Name}">
                                <input type="hidden" class="ben-phone" value="${ben.Phone}">
                                <input type="hidden" class="ben-address" value="${ben.Address}">
                            </div>
                        `);
                    });
                }

                // Buttons හසුරුවීම
                $('#btnAddVehicle').prop('disabled', true);
                $('#btnUpdateVehicle, #btnDeleteVehicle').prop('disabled', false);
            }
        } catch (error) {
            console.error("Error fetching loan details:", error);
            notify.toast("දත්ත ලබා ගැනීමේදී දෝෂයක් සිදුවිය.", "error");
        }
    });

    // 7. Update Button Click Logic
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

  // 8. Delete Button Click Logic (With Custom Notification System)
$('#btnDeleteVehicle').click(async function () {
    const loanId = $('#txtVehicleLoanId').val();
    
    if (!loanId) {
        return notify.toast("කරුණාකර මකා දැමීමට අදාළ ණය ගිණුම තෝරන්න.", "warning");
    }

    // 🔹 පද්ධතියේ ඇති Confirm Dialog එක භාවිතා කිරීම
    const isConfirmed = await notify.confirm(
        `ඔබ ස්ථිරවම ${loanId} ණය ගිණුම සහ ඒ හා සම්බන්ධ සියලුම දත්ත මකා දමනවාද? මෙය ආපසු හැරවිය නොහැකි ක්‍රියාවකි.`,
        'ණය ගිණුම මකා දැමීම',
        {
            confirmText: 'ඔව්, මකන්න',
            confirmColor: '#ef4444', // මකා දැමීම නිසා රතු පැහැය භාවිතා කිරීම වඩාත් සුදුසුයි
            cancelText: 'එපා, අයින් වන්න'
        }
    );

    // පරිශීලකයා 'ඔව්' කිව්වොත් පමණක් Delete එක සිදු කරයි
    if (isConfirmed) {
        try {
            const result = await window.api.vehicleLoan.delete(loanId);
            
            if (result.success) {
                // සාර්ථක වූ විට Toast එකක් පෙන්වීම
                notify.toast(`${loanId} ණය ගිණුම සාර්ථකව මකා දමන ලදි.`, "success");
                
                // Form එක Clear කර Table එක Refresh කිරීම
                clearForm();
                await loadVehicleLoans();
                await setNextVehicleLoanId(); // මීළඟට එන අංකය නැවත සකස් කිරීම
            } else {
                // Backend එකෙන් දෝෂයක් ආවොත්
                notify.toast("මකා දැමීමේදී දෝෂයක්: " + result.error, "error");
            }
        } catch (error) {
            // පද්ධතියේ වෙනත් දෝෂයක් ආවොත්
            notify.toast("මකා දැමීම අසාර්ථක විය. කරුණාකර නැවත උත්සාහ කරන්න.", "error");
            console.error("Delete Error:", error);
        }
    }
});

    // 9. Clear Button Click Logic
    $('#btnClearVehicle').click(function () {
        clearForm();
    });

    // 5. Input වෙනස් වන විට බොත්තම පරීක්ෂා කිරීම
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
    // සියලුම input fields හිස් කිරීම
    $('#txtVehicleOwnerName, #txtVehicleNumber, #txtVehicleType, #txtVehicleCurrentValue,#txtVehicleLoanLimit, #txtVehicleLoanAmount, #txtVehicleLoanDate,#txtVehicleGivenAmount, #txtVehicleInterestRate').val('');
    
    // Beneficiary list එක හිස් කිරීම
    $('#vehicleBeneficiaryList').empty();
    
    // Customer තොරතුරු පෙන්වන ස්ථානය හිස් කිරීම
    clearCustomerDisplay();
    
    // Table එකේ select වී ඇති row එක අයින් කිරීම
    $('#tblVehicleLoans tr').removeClass('table-primary');
    
    // මීළඟට එන Loan ID එක නැවත සැකසීම
    setNextVehicleLoanId();
    
    // බොත්තම් වල තත්ත්වය මාරු කිරීම
    $('#btnAddVehicle').prop('disabled', true);
    $('#btnUpdateVehicle, #btnDeleteVehicle').prop('disabled', true);
    $('#txtSearchCustomer').val('');
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