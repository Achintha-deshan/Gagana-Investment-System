// =======================
// Land Loan Renderer JS
// =======================

$(document).ready(async function () {
    await initLandLoanPage();
});

async function initLandLoanPage() {
    try {
        await setNextLandLoanId();
        await loadLandLoans();
        setupLandLoanEventListeners();

        $('#btnAddLan').prop('disabled', true);
        console.log("✅ Land Loan page initialized");
    } catch (error) {
        console.error(error);
    }
}

// ------------------------
// 1. මීළඟ ඉඩම් ණය ID එක ලබා ගැනීම
// ------------------------
async function setNextLandLoanId() {
    try {
        const nextId = await window.api.lanLoan.getNextId();
        $('#txtLanLoanId').val(nextId);
        $('#txtDisplayLanLoanId').val(nextId);
    } catch (error) {
        console.error("Failed to generate Land Loan ID:", error);
    }
}

// ------------------------
// 2. ඉඩම් ණය වගුව (Table) පූරණය කිරීම
// ------------------------
async function loadLandLoans() {
    try {
        const loans = await window.api.lanLoan.getAll();
        const tbody = $('#tblLanLoans');
        tbody.empty();

        if (!loans || loans.length === 0) {
            tbody.html('<tr><td colspan="8" class="text-center py-4 text-muted">ඉඩම් ණය තොරතුරු නොමැත</td></tr>');
            return;
        }

        loans.forEach(loan => {
            const beneficiaries = loan.BeneficiaryNames || '-';
            tbody.append(`
                <tr data-id="${loan.LoanID}">
                    <td>${loan.LoanID}</td>
                    <td>${loan.LanNumber}</td>
                    <td>${loan.Location}</td>
                    <td>${loan.Size}</td>
                    <td>${parseFloat(loan.LoanAmount).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>${loan.InterestRate}%</td>
                    <td>${beneficiaries}</td>
                    <td><button class="btn btn-sm btn-outline-info">View</button></td>
                </tr>
            `);
        });
    } catch (err) {
        console.error("Failed to load land loans:", err);
    }
}

// ------------------------
// 3. Event Listeners සැකසීම
// ------------------------
function setupLandLoanEventListeners() {

    // පාරිභෝගිකයා සෙවීම (Customer Search)
    // සටහන: මෙය Vehicle Loan එකේ ඇති සෙවුම් කොටසම භාවිතා කරන්නේ නම් එම IDs පාවිච්චි කරන්න
  // 1. පාරිභෝගිකයා සෙවීම (Customer Search)
    $('#txtSearchCustomer').on('input', async function () {
        const query = $(this).val().trim();
        if (query.length >= 2) {
            const results = await window.api.customer.search(query);
            if (results && results.length > 0) {
                const customer = results[0];

                // 🛑 පාරිභෝගිකයා Blacklisted දැයි පරීක්ෂා කිරීම
                if (customer.IsBlacklisted === 1) {
                    
                    // පාරිභෝගිකයා සම්පූර්ණයෙන්ම අවහිර කිරීම (Only OK Button)
                    await notify.confirm(
                        `මෙම පාරිභෝගිකයා (${customer.CustomerName}) Blacklisted කර ඇත. මොහුට නව ණය ලබා දීම පද්ධතිය මගින් අවහිර කර ඇත.`,
                        'පාරිභෝගිකයා අවහිර කර ඇත (Blocked)',
                        {
                            confirmText: 'හරි (OK)',
                            showCancelButton: false, // Cancel බොත්තම පෙන්වන්නේ නැත
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
        } else {
            clearCustomerDisplay();
        }
        checkAddButtonState();
    });

    // ඇපකරුවන් එකතු කිරීම (Add Beneficiary)
    $('#btnAddLanBeneficiary').click(async function (e) {
        e.preventDefault();
        const name = $('#txtLanBeneficiaryName').val().trim();
        const phone = $('#txtLanBeneficiaryPhone').val().trim();
        const address = $('#txtLanBeneficiaryAddress').val().trim();

        if (!name || !phone) {
            return notify.toast("ඇපකරුගේ නම සහ දුරකථනය ඇතුළත් කරන්න.", "warning");
        }

        // පද්ධතියේ දැනටමත් සක්‍රීය ණයක සිටීදැයි බැලීම
        const isActive = await window.api.lanLoan.checkBeneficiaryActive(name, phone);
        if (isActive) {
            return notify.toast("මෙම ඇපකරු දැනටමත් සක්‍රීය ණයක සිටී!", "error");
        }

        const index = $('#lanBeneficiaryList .beneficiary-item').length;
        $('#lanBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2" data-index="${index}">
                <span><strong>${name}</strong> - ${phone}</span>
                <button type="button" class="btn btn-sm btn-danger btnDeleteLanBeneficiary">මකන්න</button>
                <input type="hidden" class="ben-name" value="${name}">
                <input type="hidden" class="ben-phone" value="${phone}">
                <input type="hidden" class="ben-address" value="${address}">
            </div>
        `);

        $('#txtLanBeneficiaryName, #txtLanBeneficiaryPhone, #txtLanBeneficiaryAddress').val('');
        checkLandAddButtonState();
    });

    // ඇපකරු මකා දැමීම
    $(document).on('click', '.btnDeleteLanBeneficiary', function () {
        $(this).closest('.beneficiary-item').remove();
        checkLandAddButtonState();
    });

    // ණය ඇතුළත් කිරීම (Save Land Loan)
    $('#btnAddLan').click(async function () {
        const customerId = $('#displayCustomerId').data('id');
        
        if (!customerId) {
            return notify.toast("පාරිභෝගිකයෙකු තෝරා සිටින්න.", "warning");
        }

        const beneficiaries = [];
        $('#lanBeneficiaryList .beneficiary-item').each(function () {
            beneficiaries.push({
                Name: $(this).find('.ben-name').val(),
                Phone: $(this).find('.ben-phone').val(),
                Address: $(this).find('.ben-address').val()
            });
        });

        const data = {
            CustomerID: customerId,
            LanNumber: $('#txtLanNumber').val().trim(),
            Location: $('#txtLanLocation').val().trim(),
            Size: $('#txtLanSize').val().trim(),
            CurrentValue: parseFloat($('#txtLanCurrentValue').val()) || 0,
            LoanLimit: parseFloat($('#txtLanLoanLimit').val()) || 0,
            LoanAmount: parseFloat($('#txtLanLoanAmount').val()) || 0,
            GivenAmount: parseFloat($('#txtLanGivenAmount').val()) || 0,
            LoanDate: $('#txtLanLoanDate').val(),
            InterestRate: parseFloat($('#txtLanInterestRate').val()) || 5,
            Beneficiaries: beneficiaries
        };

        if (!data.LanNumber || !data.Location || beneficiaries.length === 0) {
            return notify.toast("අවශ්‍ය තොරතුරු සහ ඇපකරුවෙකු ඇතුළත් කරන්න.", "warning");
        }

        const result = await window.api.lanLoan.add(data);
        if (result.success) {
            notify.toast("ඉඩම් ණය සාර්ථකව ඇතුළත් කරන ලදි.", "success");
            clearLandForm();
            await setNextLandLoanId();
            await loadLandLoans();
        } else {
            notify.toast("දෝෂයකි: " + result.error, "error");
        }
    });

    // ------------------------
// 6. Table Row එකක් Click කළ විට දත්ත Form එකට ගැනීම
// ------------------------
$('#tblLanLoans').on('click', 'tr', async function () {
    const loanId = $(this).data('id');
    if (!loanId) return;

    // Row එක Highlight කිරීම
    $('#tblLanLoans tr').removeClass('table-primary');
    $(this).addClass('table-primary');

    try {
        // Backend එකෙන් දත්ත ලබා ගැනීම (Note: window.api.lanLoan.getById පවතින බවට තහවුරු කරගන්න)
        const loan = await window.api.lanLoan.getById(loanId);
        
        if (loan) {
            // Form එක පිරවීම
            $('#txtLanLoanId').val(loan.LoanID);
            $('#txtDisplayLanLoanId').val(loan.LoanID);
            $('#txtLanNumber').val(loan.LanNumber);
            $('#txtLanLocation').val(loan.Location);
            $('#txtLanSize').val(loan.Size);
            $('#txtLanCurrentValue').val(loan.CurrentValue);
            $('#txtLanLoanLimit').val(loan.LoanLimit);
            $('#txtLanLoanAmount').val(loan.LoanAmount);
            $('#txtLanGivenAmount').val(loan.GivenAmount);
            $('#txtLanInterestRate').val(loan.InterestRate);
            
            if(loan.LoanDate) {
                $('#txtLanLoanDate').val(new Date(loan.LoanDate).toISOString().split('T')[0]);
            }

            // පාරිභෝගික විස්තර
            $('#displayCustomerName').text(loan.CustomerName || '---');
            $('#displayCustomerId').text(loan.CustomerID || '---').data('id', loan.CustomerID);
            $('.info-display').fadeIn();

            // ඇපකරුවන් පිරවීම
            $('#lanBeneficiaryList').empty();
            if (loan.Beneficiaries) {
                loan.Beneficiaries.forEach(ben => {
                    $('#lanBeneficiaryList').append(`
                        <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2 bg-white mb-1 rounded">
                            <span><strong>${ben.Name}</strong> - ${ben.Phone}</span>
                            <button type="button" class="btn btn-sm btn-danger btnDeleteLanBeneficiary">මකන්න</button>
                            <input type="hidden" class="ben-name" value="${ben.Name}">
                            <input type="hidden" class="ben-phone" value="${ben.Phone}">
                            <input type="hidden" class="ben-address" value="${ben.Address}">
                        </div>
                    `);
                });
            }

            // බොත්තම් පාලනය
            $('#btnAddLan').prop('disabled', true);
            $('#btnUpdateLan, #btnDeleteLan').prop('disabled', false);
        }
    } catch (error) {
        console.error("Error fetching land loan:", error);
        notify.toast("දත්ත පූරණය අසාර්ථකයි.", "error");
    }
});

// ------------------------
// 7. Update Button Logic
// ------------------------
$('#btnUpdateLan').click(async function () {
    const loanId = $('#txtLanLoanId').val();
    if (!loanId) return;

    const beneficiaries = [];
    $('#lanBeneficiaryList .beneficiary-item').each(function () {
        beneficiaries.push({
            Name: $(this).find('.ben-name').val(),
            Phone: $(this).find('.ben-phone').val(),
            Address: $(this).find('.ben-address').val()
        });
    });

    const data = {
        LoanID: loanId,
        LanNumber: $('#txtLanNumber').val().trim(),
        Location: $('#txtLanLocation').val().trim(),
        Size: $('#txtLanSize').val().trim(),
        CurrentValue: parseFloat($('#txtLanCurrentValue').val()) || 0,
        LoanLimit: parseFloat($('#txtLanLoanLimit').val()) || 0,
        LoanAmount: parseFloat($('#txtLanLoanAmount').val()) || 0,
        GivenAmount: parseFloat($('#txtLanGivenAmount').val()) || 0,
        LoanDate: $('#txtLanLoanDate').val(),
        InterestRate: parseFloat($('#txtLanInterestRate').val()) || 5,
        Beneficiaries: beneficiaries
    };

    const result = await window.api.lanLoan.update(data);
    if (result.success) {
        notify.toast("ඉඩම් ණය විස්තර සාර්ථකව යාවත්කාලීන කළා.", "success");
        clearLandForm();
        await loadLandLoans();
    } else {
        notify.toast("දෝෂයකි: " + result.error, "error");
    }
});

// ------------------------
// 8. Delete Button Logic
// ------------------------
$('#btnDeleteLan').click(async function () {
    const loanId = $('#txtLanLoanId').val();
    if (!loanId) return;

    const isConfirmed = await notify.confirm(`${loanId} ණය ගිණුම ස්ථිරවම මකා දමනවාද?`);
    if (isConfirmed) {
const result = await window.api.lanLoan.delete(loanId);
        if (result.success) {
            notify.toast("ගිණුම සාර්ථකව මකා දැමුවා.", "success");
            clearLandForm();
            await loadLandLoans();
        } else {
            notify.toast("මකා දැමීම අසාර්ථකයි.", "error");
        }
    }
});

// ------------------------


$('#btnClearLan').click(function() {
    clearLandForm();
});

    $('#txtLanNumber, #txtLanLocation, #txtLanLoanAmount').on('input', checkLandAddButtonState);
}

// ------------------------
// 4. බොත්තම සක්‍රීය/අක්‍රීය කිරීමේ Logic
// ------------------------
function checkLandAddButtonState() {
    const customerId = $('#displayCustomerId').data('id');
    const lanNo = $('#txtLanNumber').val().trim();
    const location = $('#txtLanLocation').val().trim();
    const amount = $('#txtLanLoanAmount').val();
    const benCount = $('#lanBeneficiaryList .beneficiary-item').length;

    const canAdd = (customerId && lanNo && location && amount > 0 && benCount > 0);
    $('#btnAddLan').prop('disabled', !canAdd);
}

// 9. Form එක Clear කිරීම (Update කළ එක)
// ------------------------
function clearLandForm() {
    $('#txtLanLoanId, #txtDisplayLanLoanId, #txtLanNumber, #txtLanLocation, #txtLanSize, #txtLanCurrentValue, #txtLanLoanLimit, #txtLanLoanAmount, #txtLanLoanDate, #txtLanGivenAmount').val('');
    $('#lanBeneficiaryList').empty();
    $('#txtLanInterestRate').val('5');
    $('#tblLanLoans tr').removeClass('table-primary');
        $('#txtSearchCustomer').val('');

    
    // බොත්තම් පාලනය
    $('#btnAddLan').prop('disabled', true);
    $('#btnUpdateLan, #btnDeleteLan').prop('disabled', true);

    clearCustomerDisplay();
    setNextLandLoanId();
}
function clearCustomerDisplay() {
    $('#displayCustomerName, #displayCustomerId').text('---');
    $('#displayCustomerId').removeData('id');
    $('.info-display').fadeOut();
    checkLandAddButtonState();
}