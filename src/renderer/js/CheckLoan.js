// =======================
// Check Loan Renderer JS
// =======================

$(document).ready(async function () {
    await initCheckLoanPage();
});

async function initCheckLoanPage() {
    try {
        await setNextCheckLoanId();
        await loadCheckLoans();
        setupCheckLoanEventListeners();

        // මුලින් බොත්තම් පාලනය
        $('#btnAddCheck').prop('disabled', true);
        $('#btnUpdateCheck, #btnDeleteCheck').prop('disabled', true);
        
        console.log("✅ Check Loan page initialized");
    } catch (error) {
        console.error("Initialization Error:", error);
    }
}

// 1. මීළඟ ID එක ලබා ගැනීම
async function setNextCheckLoanId() {
    try {
        const nextId = await window.api.checkLoan.getNextId();
        $('#txtCheckLoanId').val(nextId);
        $('#txtDisplayCheckLoanId').val(nextId);
    } catch (error) {
        console.error("Failed to generate Check Loan ID:", error);
    }
}

// 2. වගුව පිරවීම
async function loadCheckLoans() {
    try {
        const loans = await window.api.checkLoan.getAll();
        const tbody = $('#tblCheckLoans');
        tbody.empty();

        if (!loans || loans.length === 0) {
            tbody.html('<tr><td colspan="7" class="text-center py-4 text-muted">Check ණය තොරතුරු නොමැත</td></tr>');
            return;
        }

        loans.forEach(loan => {
            const beneficiaries = loan.BeneficiaryNames || '-';
            tbody.append(`
                <tr data-id="${loan.LoanID}" style="cursor:pointer;">
                    <td>${loan.LoanID}</td>
                    <td>${loan.CheckNumber}</td>
                    <td>${parseFloat(loan.LoanAmount).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>${loan.OwnerName || '-'}</td>
                    <td>${loan.InterestRate}%</td>
                    <td>${beneficiaries}</td>
                    <td><button class="btn btn-sm btn-info btnSendTableSms"><i class="bi bi-chat-dots"></i></button></td>
                </tr>
            `);
        });
    } catch (err) {
        console.error("Failed to load Check loans:", err);
    }
}

// 3. Event Listeners
function setupCheckLoanEventListeners() {

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
                        `මෙම පාරිභෝගිකයා (${customer.CustomerName}) අසාදු ලේඛනගත (Blacklisted) කර ඇත. මොහුට නව ණය ලබා දීම පද්ධතිය මගින් අවහිර කර ඇත.`,
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

    // --- ඇපකරුවන් එකතු කිරීම ---
    $('#btnAddCheckBeneficiary').click(async function (e) {
        e.preventDefault();
        const name = $('#txtCheckBeneficiaryName').val().trim();
        const phone = $('#txtCheckBeneficiaryPhone').val().trim();
        const address = $('#txtCheckBeneficiaryAddress').val().trim();

        if (!name || !phone) return notify.toast("නම සහ දුරකථන අංකය ඇතුළත් කරන්න.", "warning");

        const isActive = await window.api.checkLoan.checkBeneficiaryActive(name, phone);
        if (isActive) return notify.toast("මෙම ඇපකරු දැනටමත් සක්‍රීය ණයක සිටී!", "error");

        $('#checkBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2 bg-white mb-1 rounded">
                <span><strong>${name}</strong> - ${phone}</span>
                <button type="button" class="btn btn-sm btn-danger btnDeleteCheckBen">මකන්න</button>
                <input type="hidden" class="ben-name" value="${name}">
                <input type="hidden" class="ben-phone" value="${phone}">
                <input type="hidden" class="ben-address" value="${address}">
            </div>
        `);
        $('#txtCheckBeneficiaryName, #txtCheckBeneficiaryPhone, #txtCheckBeneficiaryAddress').val('');
        checkCheckAddButtonState();
    });

    // --- ඇපකරු ලැයිස්තුවෙන් ඉවත් කිරීම ---
    $(document).on('click', '.btnDeleteCheckBen', function () {
        $(this).closest('.beneficiary-item').remove();
        checkCheckAddButtonState();
    });

    // --- වගුවේ පේළියක් Click කිරීම (Edit Mode) ---
    $('#tblCheckLoans').on('click', 'tr', async function () {
        const loanId = $(this).data('id');
        if (!loanId) return;

        $('#tblCheckLoans tr').removeClass('table-primary');
        $(this).addClass('table-primary');

        const loan = await window.api.checkLoan.getById(loanId);
        if (loan) {
            $('#txtCheckLoanId').val(loan.LoanID);
            $('#txtDisplayCheckLoanId').val(loan.LoanID);
            $('#txtCheckNumber').val(loan.CheckNumber);
            $('#txtCheckOwnerName').val(loan.OwnerName);
            $('#txtCheckDateNumber').val(loan.CheckDateNumber);
            $('#txtCheckBankAccount').val(loan.BankAccountDetails);
            $('#txtCheckLoanAmount').val(loan.LoanAmount);
            $('#txtCheckGivenAmount').val(loan.GivenAmount);
            $('#txtCheckInterestRate').val(loan.InterestRate);
            if(loan.LoanDate) $('#txtCheckLoanDate').val(new Date(loan.LoanDate).toISOString().split('T')[0]);

            $('#displayCustomerName').text(loan.CustomerName);
            $('#displayCustomerId').text(loan.CustomerID).data('id', loan.CustomerID);
            $('.info-display').fadeIn();

            $('#checkBeneficiaryList').empty();
            loan.Beneficiaries.forEach(ben => {
                $('#checkBeneficiaryList').append(`
                    <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2 bg-white mb-1">
                        <span><strong>${ben.Name}</strong> - ${ben.Phone}</span>
                        <button type="button" class="btn btn-sm btn-danger btnDeleteCheckBen">මකන්න</button>
                        <input type="hidden" class="ben-name" value="${ben.Name}">
                        <input type="hidden" class="ben-phone" value="${ben.Phone}">
                        <input type="hidden" class="ben-address" value="${ben.Address}">
                    </div>
                `);
            });

            $('#btnAddCheck').prop('disabled', true);
            $('#btnUpdateCheck, #btnDeleteCheck').prop('disabled', false);
        }
    });

    // --- ණය ඇතුළත් කිරීම (Save) ---
    $('#btnAddCheck').click(async function () {
        const data = getFormData();
        if (!data.CheckNumber || data.LoanAmount <= 0 || data.Beneficiaries.length === 0) {
            return notify.toast("අවශ්‍ය තොරතුරු සහ ඇපකරුවන් ඇතුළත් කරන්න.", "warning");
        }

        const result = await window.api.checkLoan.add(data);
        if (result.success) {
            notify.toast("සාර්ථකව ඇතුළත් කළා.", "success");
            clearCheckForm();
            await loadCheckLoans();
        } else {
            notify.toast("දෝෂයකි: " + result.error, "error");
        }
    });

    // --- ණය යාවත්කාලීන කිරීම (Update) ---
    $('#btnUpdateCheck').click(async function () {
        const data = getFormData();
        data.LoanID = $('#txtCheckLoanId').val();

        const result = await window.api.checkLoan.update(data);
        if (result.success) {
            notify.toast("සාර්ථකව යාවත්කාලීන කළා.", "success");
            clearCheckForm();
            await loadCheckLoans();
        } else {
            notify.toast("Update Error: " + result.error, "error");
        }
    });

    // --- ණය මකා දැමීම (Delete) ---
    $('#btnDeleteCheck').click(async function () {
        const loanId = $('#txtCheckLoanId').val();
        const isConfirmed = await notify.confirm(`${loanId} මකා දමනවාද?`);
        if (isConfirmed) {
            const result = await window.api.checkLoan.delete(loanId);
            if (result.success) {
                notify.toast("සාර්ථකව මකා දැමුවා.", "success");
                clearCheckForm();
                await loadCheckLoans();
            }
        }
    });

    $('#btnClearCheck').click(() => clearCheckForm());
    $('#txtCheckNumber, #txtCheckLoanAmount, #txtCheckOwnerName').on('input', checkCheckAddButtonState);
}

// Form එකේ දත්ත Object එකක් ලෙස ලබා ගැනීම
function getFormData() {
    const beneficiaries = [];
    $('#checkBeneficiaryList .beneficiary-item').each(function () {
        beneficiaries.push({
            Name: $(this).find('.ben-name').val(),
            Phone: $(this).find('.ben-phone').val(),
            Address: $(this).find('.ben-address').val()
        });
    });

    return {
        CustomerID: $('#displayCustomerId').data('id'),
        CheckNumber: $('#txtCheckNumber').val().trim(),
        LoanAmount: parseFloat($('#txtCheckLoanAmount').val()) || 0,
        GivenAmount: parseFloat($('#txtCheckGivenAmount').val()) || 0,
        LoanDate: $('#txtCheckLoanDate').val(),
        OwnerName: $('#txtCheckOwnerName').val().trim(),
        CheckDateNumber: $('#txtCheckDateNumber').val().trim(),
        BankAccountDetails: $('#txtCheckBankAccount').val().trim(),
        InterestRate: parseFloat($('#txtCheckInterestRate').val()) || 0,
        Beneficiaries: beneficiaries
    };
}

function checkCheckAddButtonState() {
    const data = getFormData();
    const isEditMode = $('#txtCheckLoanId').val() && !$('#txtCheckLoanId').val().startsWith('CHQ'); // සරල logic එකක්
    const canAdd = (data.CustomerID && data.CheckNumber && data.LoanAmount > 0 && data.Beneficiaries.length > 0);
    
    // Edit mode එකක නොවේ නම් පමණක් Add enable කරන්න
    if($('#btnUpdateCheck').is(':disabled')) {
        $('#btnAddCheck').prop('disabled', !canAdd);
    }
}

function clearCheckForm() {
    $('#txtCheckNumber, #txtCheckLoanAmount, #txtCheckGivenAmount, #txtCheckLoanDate, #txtCheckOwnerName, #txtCheckDateNumber, #txtCheckBankAccount').val('');
    $('#txtCheckInterestRate').val('5');
    $('#checkBeneficiaryList').empty();
    $('#tblCheckLoans tr').removeClass('table-primary');
    $('#btnUpdateCheck, #btnDeleteCheck').prop('disabled', true);
    clearCustomerDisplay();
    setNextCheckLoanId();
}

function clearCustomerDisplay() {
    $('#displayCustomerName, #displayCustomerId').text('---');
    $('#displayCustomerId').removeData('id');
    $('.info-display').fadeOut();
    checkCheckAddButtonState();
}