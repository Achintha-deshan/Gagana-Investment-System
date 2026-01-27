// =======================
// Promissory Loan Renderer JS
// =======================

$(document).ready(async function () {
    await initPromissoryLoanPage();
});

async function initPromissoryLoanPage() {
    try {
        await setNextPromissoryLoanId();
        await loadPromissoryLoans();
        setupPromissoryLoanEventListeners();

        $('#btnAddPromissory').prop('disabled', true);
        console.log("✅ Promissory Loan page initialized");
    } catch (error) {
        console.error(error);
    }
}

// ------------------------
// 1. මීළඟ Promissory Loan ID එක ලබා ගැනීම
// ------------------------
async function setNextPromissoryLoanId() {
    try {
        const nextId = await window.api.promissoryLoan.getNextId();
        $('#txtPromissoryLoanId').val(nextId);
        $('#txtDisplayPromissoryLoanId').val(nextId);
    } catch (error) {
        console.error("Failed to generate Promissory Loan ID:", error);
    }
}

// ------------------------
// 2. Promissory ණය වගුව පූරණය කිරීම
// ------------------------
async function loadPromissoryLoans() {
    try {
        const loans = await window.api.promissoryLoan.getAll();
        const tbody = $('#tblPromissoryLoans');
        tbody.empty();

        if (!loans || loans.length === 0) {
            tbody.html('<tr><td colspan="7" class="text-center py-4 text-muted">Promissory ණය තොරතුරු නොමැත</td></tr>');
            return;
        }

        loans.forEach(loan => {
            const beneficiaries = loan.BeneficiaryNames || '-';
            tbody.append(`
                <tr data-id="${loan.LoanID}">
                    <td>${loan.LoanID}</td>
                    <td>${loan.PromissoryNumber}</td>
                    <td>${parseFloat(loan.LoanAmount).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>${new Date(loan.LoanDate).toLocaleDateString()}</td>
                    <td>${loan.InterestRate}%</td>
                    <td>${beneficiaries}</td>
                    <td><button class="btn btn-sm btn-outline-info">View SMS</button></td>
                </tr>
            `);
        });
    } catch (err) {
        console.error("Failed to load promissory loans:", err);
    }
}

// ------------------------
// 3. Event Listeners සැකසීම
// ------------------------
function setupPromissoryLoanEventListeners() {

    // 🔍 3.0 පාරිභෝගිකයා සෙවීම (Blacklist Check සමඟ)
    $('#txtSearchCustomer').on('input', async function () {
        const query = $(this).val().trim();
        if (query.length >= 2) {
            const results = await window.api.customer.search(query);
            if (results && results.length > 0) {
                const customer = results[0];

                // 🛑 පාරිභෝගිකයා Blacklisted දැයි පරීක්ෂා කිරීම
                if (customer.IsBlacklisted === 1) {
                    await notify.confirm(
                        `මෙම පාරිභෝගිකයා (${customer.CustomerName}) අසාදු ලේඛනගත Blacklisted කර ඇත. මොහුට නව ණය ලබා දීම පද්ධතිය මගින් අවහිර කර ඇත.`,
                        'පාරිභෝගිකයා අවහිර කර ඇත',
                        {
                            confirmText: 'හරි (OK)',
                            showCancelButton: false,
                            confirmColor: '#ef4444'
                        }
                    );
                    $(this).val('');
                    clearCustomerDisplay();
                    return;
                }
                
                // ✅ විස්තර UI එකට දැමීම
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
        checkPromissoryAddButtonState();
    });

    // ➕ 3.1 ඇපකරුවන් එකතු කිරීම
    $('#btnAddPromissoryBeneficiary').click(async function (e) {
        e.preventDefault();
        const name = $('#txtPromissoryBeneficiaryName').val().trim();
        const phone = $('#txtPromissoryBeneficiaryPhone').val().trim();
        const address = $('#txtPromissoryBeneficiaryAddress').val().trim();

        if (!name || !phone) {
            return notify.toast("ඇපකරුගේ නම සහ දුරකථනය ඇතුළත් කරන්න.", "warning");
        }

        const isActive = await window.api.promissoryLoan.checkBeneficiaryActive(name, phone);
        if (isActive) {
            return notify.toast("මෙම ඇපකරු දැනටමත් සක්‍රීය ණයක සිටී!", "error");
        }

        const index = $('#promissoryBeneficiaryList .beneficiary-item').length;
        $('#promissoryBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2 bg-white mb-1 rounded" data-index="${index}">
                <span><strong>${name}</strong> - ${phone}</span>
                <button type="button" class="btn btn-sm btn-danger btnDeletePromissoryBeneficiary">මකන්න</button>
                <input type="hidden" class="ben-name" value="${name}">
                <input type="hidden" class="ben-phone" value="${phone}">
                <input type="hidden" class="ben-address" value="${address}">
            </div>
        `);

        $('#txtPromissoryBeneficiaryName, #txtPromissoryBeneficiaryPhone, #txtPromissoryBeneficiaryAddress').val('');
        checkPromissoryAddButtonState();
    });

    // 🗑️ 3.2 ඇපකරු මකා දැමීම
    $(document).on('click', '.btnDeletePromissoryBeneficiary', function () {
        $(this).closest('.beneficiary-item').remove();
        checkPromissoryAddButtonState();
    });

    // 💾 3.3 ණය ඇතුළත් කිරීම (Save)
    $('#btnAddPromissory').click(async function () {
        const customerId = $('#displayCustomerId').data('id');
        if (!customerId) return notify.toast("පාරිභෝගිකයෙකු තෝරා සිටින්න.", "warning");

        const beneficiaries = [];
        $('#promissoryBeneficiaryList .beneficiary-item').each(function () {
            beneficiaries.push({
                Name: $(this).find('.ben-name').val(),
                Phone: $(this).find('.ben-phone').val(),
                Address: $(this).find('.ben-address').val()
            });
        });

        const data = {
            CustomerID: customerId,
            PromissoryNumber: $('#txtPromissoryNumber').val().trim(),
            LoanAmount: parseFloat($('#txtPromissoryLoanAmount').val()) || 0,
            GivenAmount: parseFloat($('#txtPromissoryGivenAmount').val()) || 0,
            LoanDate: $('#txtPromissoryLoanDate').val(),
            InterestRate: parseFloat($('#txtPromissoryInterestRate').val()) || 5,
            SmsDate: $('#txtPromissorySmsDate').val(),
            SmsMessage: $('#txtPromissorySmsMessage').val(),
            Beneficiaries: beneficiaries
        };

        if (!data.PromissoryNumber || data.LoanAmount <= 0 || beneficiaries.length === 0) {
            return notify.toast("පොරොන්දු නෝට්ටු අංකය, ණය මුදල සහ ඇපකරුවෙකු අනිවාර්ය වේ.", "warning");
        }

        const result = await window.api.promissoryLoan.add(data);
        if (result.success) {
            notify.toast("Promissory ණය සාර්ථකව ඇතුළත් කරන ලදි.", "success");
            clearPromissoryForm();
            await loadPromissoryLoans();
        } else {
            notify.toast("දෝෂයකි: " + result.error, "error");
        }
    });

    // 📋 3.4 Table Row Click
    $('#tblPromissoryLoans').on('click', 'tr', async function () {
        const loanId = $(this).data('id');
        if (!loanId) return;

        $('#tblPromissoryLoans tr').removeClass('table-primary');
        $(this).addClass('table-primary');

        try {
            const loan = await window.api.promissoryLoan.getById(loanId);
            if (loan) {
                $('#txtPromissoryLoanId').val(loan.LoanID);
                $('#txtDisplayPromissoryLoanId').val(loan.LoanID);
                $('#txtPromissoryNumber').val(loan.PromissoryNumber);
                $('#txtPromissoryLoanAmount').val(loan.LoanAmount);
                $('#txtPromissoryGivenAmount').val(loan.GivenAmount);
                $('#txtPromissoryInterestRate').val(loan.InterestRate);
                $('#txtPromissoryLoanDate').val(formatDateForInput(loan.LoanDate));
                $('#txtPromissorySmsDate').val(formatDateForInput(loan.SmsDate));
                $('#txtPromissorySmsMessage').val(loan.SmsMessage);

                $('#displayCustomerName').text(loan.CustomerName);
                $('#displayCustomerId').text(loan.CustomerID).data('id', loan.CustomerID);
                $('#displayCustomerNic').text(loan.NIC);
                $('#displayCustomerPhone').text(loan.CustomerPhone);
                $('.info-display').fadeIn();

                $('#promissoryBeneficiaryList').empty();
                if (loan.Beneficiaries) {
                    loan.Beneficiaries.forEach(ben => {
                        $('#promissoryBeneficiaryList').append(`
                            <div class="beneficiary-item d-flex justify-content-between align-items-center border-bottom p-2 bg-white mb-1 rounded">
                                <span><strong>${ben.Name}</strong> - ${ben.Phone}</span>
                                <button type="button" class="btn btn-sm btn-danger btnDeletePromissoryBeneficiary">මකන්න</button>
                                <input type="hidden" class="ben-name" value="${ben.Name}">
                                <input type="hidden" class="ben-phone" value="${ben.Phone}">
                                <input type="hidden" class="ben-address" value="${ben.Address}">
                            </div>
                        `);
                    });
                }
                $('#btnAddPromissory').prop('disabled', true);
                $('#btnUpdatePromissory, #btnDeletePromissory').prop('disabled', false);
            }
        } catch (error) {
            notify.toast("දත්ත ලබා ගැනීමේදී දෝෂයක් සිදුවිය.", "error");
        }
    });

    // 🔄 3.5 Update Logic
    $('#btnUpdatePromissory').click(async function () {
        const beneficiaries = [];
        $('#promissoryBeneficiaryList .beneficiary-item').each(function () {
            beneficiaries.push({
                Name: $(this).find('.ben-name').val(),
                Phone: $(this).find('.ben-phone').val(),
                Address: $(this).find('.ben-address').val()
            });
        });

        const data = {
            LoanID: $('#txtPromissoryLoanId').val(),
            CustomerID: $('#displayCustomerId').data('id'),
            PromissoryNumber: $('#txtPromissoryNumber').val().trim(),
            LoanAmount: parseFloat($('#txtPromissoryLoanAmount').val()) || 0,
            GivenAmount: parseFloat($('#txtPromissoryGivenAmount').val()) || 0,
            LoanDate: $('#txtPromissoryLoanDate').val(),
            InterestRate: parseFloat($('#txtPromissoryInterestRate').val()) || 5,
            SmsDate: $('#txtPromissorySmsDate').val(),
            SmsMessage: $('#txtPromissorySmsMessage').val(),
            Beneficiaries: beneficiaries
        };

        const result = await window.api.promissoryLoan.update(data);
        if (result.success) {
            notify.toast("ණය විස්තර සාර්ථකව යාවත්කාලීන කරන ලදි.", "success");
            clearPromissoryForm();
            await loadPromissoryLoans();
        } else {
            notify.toast("යාවත්කාලීන කිරීමේදී දෝෂයක්: " + result.error, "error");
        }
    });

    // 🗑️ 3.6 Delete Logic
    $('#btnDeletePromissory').click(async function () {
        const loanId = $('#txtPromissoryLoanId').val();
        if (!loanId) return;

        const isConfirmed = await notify.confirm(
            `ඔබ ස්ථිරවම ${loanId} ණය ගිණුම මකා දමනවාද?`,
            'ප්‍රොමිසරි ණය මකා දැමීම',
            { confirmText: 'ඔව්, මකන්න', confirmColor: '#ef4444' }
        );

        if (isConfirmed) {
            const result = await window.api.promissoryLoan.delete(loanId);
            if (result.success) {
                notify.toast("සාර්ථකව මකා දමන ලදි.", "success");
                clearPromissoryForm();
                await loadPromissoryLoans();
            }
        }
    });

    $('#btnClearPromissory').click(function () {
        clearPromissoryForm();
    });

    $('#txtPromissoryNumber, #txtPromissoryLoanAmount').on('input', checkPromissoryAddButtonState);
}

// ------------------------
// 4. Helper Functions
// ------------------------

function checkPromissoryAddButtonState() {
    const customerId = $('#displayCustomerId').data('id');
    const prmNo = $('#txtPromissoryNumber').val().trim();
    const amount = parseFloat($('#txtPromissoryLoanAmount').val());
    const benCount = $('#promissoryBeneficiaryList .beneficiary-item').length;

    const canAdd = (customerId && prmNo && amount > 0 && benCount > 0);
    $('#btnAddPromissory').prop('disabled', !canAdd);
}

function clearPromissoryForm() {
    $('#txtPromissoryNumber, #txtPromissoryLoanAmount, #txtPromissoryGivenAmount, #txtPromissoryLoanDate, #txtPromissorySmsDate, #txtPromissorySmsMessage').val('');
    $('#promissoryBeneficiaryList').empty();
    $('#txtPromissoryInterestRate').val('5');
    $('#tblPromissoryLoans tr').removeClass('table-primary');
    setNextPromissoryLoanId();
    clearCustomerDisplay();
    $('#btnAddPromissory').prop('disabled', true);
    $('#btnUpdatePromissory, #btnDeletePromissory').prop('disabled', true);
        $('#txtSearchCustomer').val('');

}

function clearCustomerDisplay() {
    $('#displayCustomerName, #displayCustomerId, #displayCustomerNic, #displayCustomerPhone').text('---');
        $('#txtSearchCustomer').val('');

    $('#displayCustomerId').removeData('id');
    $('.info-display').fadeOut();
    checkPromissoryAddButtonState();
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}