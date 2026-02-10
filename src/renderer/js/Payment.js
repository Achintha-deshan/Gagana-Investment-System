let selectedLoanForPayment = null;
async function loadPaymentHistory(loanId) {
    try {
        const history = await window.api.payment.getHistory(loanId);
        const tbody = $('#paymentHistoryTableBody');
        tbody.empty();

        if (history && history.length > 0) {
            $('#paymentHistorySection').removeClass('d-none');
            history.forEach(pay => {
                const voidClass = pay.IsVoided ? 'table-secondary opacity-50' : '';
                
                // දත්ත නිවැරදිව Parse කරගැනීම (ඔයාගේ Schema එකේ නම් වලට අනුව)
                const paidAmt = parseFloat(pay.PaidAmount || 0);
                const arrearsPaid = parseFloat(pay.ArrearsAmount || 0); // Schema එකේ තියෙන නම
                const penaltyPaid = parseFloat(pay.PenaltyPaid || 0);
                const interestPaid = parseFloat(pay.InterestPaid || 0);
                const capitalPaid = parseFloat(pay.CapitalPaid || 0);

                tbody.append(`
                    <tr class="${voidClass}">
                        <td>#${pay.PaymentID}</td>
                        <td>${formatCustomDateTime(pay.PaymentDate)}</td>
                        <td class="fw-bold text-primary">රු. ${paidAmt.toLocaleString()}</td>
                        <td class="text-warning fw-bold">රු. ${arrearsPaid.toLocaleString()}</td>
                        <td><small>දඩ: ${penaltyPaid} | පොලී: ${interestPaid}</small></td>
                        <td class="text-success fw-bold">රු. ${capitalPaid.toLocaleString()}</td>
                        <td class="text-center">
                            ${!pay.IsVoided ? `
                                <button class="btn btn-outline-danger btn-sm rounded-pill" onclick="voidPayment(${pay.PaymentID})">
                                    <i class="bi bi-arrow-counterclockwise"></i> Void
                                </button>
                            ` : '<span class="badge bg-secondary">අවලංගුයි</span>'}
                        </td>
                    </tr>
                `);
            });
        } else {
            $('#paymentHistorySection').addClass('d-none');
        }
    } catch (err) {
        console.error("History Loading Error:", err);
    }
}


async function voidPayment(paymentId) {
    const confirmVoid = await notify.confirm("මෙම ගෙවීම අවලංගු කිරීමට ස්ථිරද? ණය ශේෂය සහ දිනයන් නැවත පරණ තත්වයට පත්වනු ඇත.");
    if (!confirmVoid) return;

    try {
        const result = await window.api.payment.voidPayment(paymentId);
        if (result.success) {
            notify.toast("ගෙවීම සාර්ථකව අවලංගු කරන ලදී.", "success");
            const currentCustId = $('#paymentCustomerId').text();
            if (currentCustId) {
                loadCustomerActiveLoans(currentCustId);
                if (selectedLoanForPayment) loadPaymentHistory(selectedLoanForPayment.LoanID);
            }
            $('#paymentDetailsSection').addClass('d-none'); 
        } else {
            notify.toast("දෝෂයකි: " + result.error, "error");
        }
    } catch (err) {
        notify.toast("අවලංගු කිරීම අසාර්ථකයි.", "error");
    }
}


async function loadCustomerActiveLoans(customerId) {
    try {
        const loans = await window.api.payment.getActiveLoans(customerId);
        const container = $('#activeLoansList');
        container.empty();
        if (!loans || loans.length === 0) {
            $('#noLoansMessage').removeClass('d-none');
            $('#loansListSection, #paymentDetailsSection').addClass('d-none');
            return;
        }
        $('#noLoansMessage').addClass('d-none');
        $('#loansListSection').removeClass('d-none');
        loans.forEach(loan => {
            const loanCard = `<div class="card mb-2 loan-item-card border-2" style="cursor:pointer;" id="loan-${loan.LoanID}">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><span class="badge bg-primary mb-1">${loan.LoanID}</span><h6 class="mb-0 fw-bold">${loan.LoanType} LOAN</h6><small class="text-muted">අංකය: ${loan.VehicleNumber || 'General'}</small></div>
                        <div class="text-end"><div class="fw-bold text-success">ණය: රු. ${parseFloat(loan.LoanAmount).toLocaleString()}</div><small class="text-danger fw-bold">ගෙවිය යුතු: ${formatCustomDateTime(loan.NextDueDate)}</small></div>
                    </div>
                </div>
            </div>`;
            const $el = $(loanCard).data('loan', loan);
            container.append($el);
        });
    } catch (err) { console.error(err); }
}

function calculateAndDisplayPayment(loan) {
    if (!loan) return;
    const manualDateVal = $('#txtPaymentManualDate').val();
    const calculationDate = manualDateVal ? new Date(manualDateVal) : new Date();
    calculationDate.setHours(0, 0, 0, 0);

    let currentDueDate = new Date(loan.NextDueDate); 
    currentDueDate.setHours(0, 0, 0, 0);

    const loanAmount = parseFloat(loan.LoanAmount) || 0;
    const currentArrears = parseFloat(loan.ArrearsAmount) || 0;
    const interestRate = parseFloat(loan.InterestRate) || 0;
    const penaltyRate = parseFloat(loan.PenaltyRateOnInterest) || 0;
    
    const monthlyInterest = loanAmount * (interestRate / 100);
    const dailyPenaltyRate = (monthlyInterest * (penaltyRate / 100)) / 30;

    let totalInterest = 0, totalPenalty = 0, monthsPaidCount = 0, totalDaysOverdue = 0;
    let tempDate = new Date(currentDueDate);

    // අද දිනට අදාළ පොලිය සහ දඩය ගණනය කිරීම
    if (calculationDate >= currentDueDate) {
        // සම්පූර්ණ දින ප්‍රමාදය ගණනය කිරීම
        totalDaysOverdue = Math.floor((calculationDate - currentDueDate) / (1000 * 60 * 60 * 24));

        while (tempDate <= calculationDate) {
            monthsPaidCount++;
            totalInterest += monthlyInterest;
            
            const diffInDays = Math.floor((calculationDate - tempDate) / (1000 * 60 * 60 * 24));
            if (diffInDays > 2) {
                totalPenalty += dailyPenaltyRate * diffInDays;
            }
            tempDate.setMonth(tempDate.getMonth() + 1);
        }
    }

    // UI එකට දත්ත පෙන්වීම (සහ වරහන් ඇතුළේ විස්තර)
    $('#summaryArrears').text(`රු. ${currentArrears.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    
    // දඩය පෙන්වන තැනට ප්‍රමාද දින ගණන එකතු කළා
    $('#summaryPenalty').text(`රු. ${totalPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})} (${totalDaysOverdue} Days)`);
    
    // පොලිය පෙන්වන තැනට මාස ගණන එකතු කළා
    $('#summaryInterest').text(`රු. ${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})} (${monthsPaidCount} Months)`);
    
    const totalPayable = currentArrears + totalInterest + totalPenalty;
    $('#summaryTotal').text(`රු. ${totalPayable.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#txtPaymentAmount').val(totalPayable.toFixed(2));

    // Backend එකට යැවීමට object එක update කිරීම
    selectedLoanForPayment.totalInterestDue = totalInterest;
    selectedLoanForPayment.totalPenaltyDue = totalPenalty;
    selectedLoanForPayment.calculatedMonths = monthsPaidCount;
}

function resetPaymentUI() {
    $('#customerPaymentInfoSection, #loansListSection, #paymentDetailsSection, #paymentHistorySection').addClass('d-none');
    $('#noLoansMessage').addClass('d-none');
}

function formatCustomDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

$(document).ready(function () {
    $('#txtPaymentManualDate').val(new Date().toISOString().slice(0, 10));

    $('#txtPaymentManualDate').on('change', function() {
        if (selectedLoanForPayment) calculateAndDisplayPayment(selectedLoanForPayment);
    });

    $('#btnSearchPaymentCustomer').click(async function () {
        const query = $('#txtSearchPaymentCustomer').val().trim();
        if (!query) return notify.toast("කරුණාකර පාරිභෝගික ID එක ඇතුළත් කරන්න.", "warning");
        try {
            const results = await window.api.customer.search(query);
            if (results && results.length > 0) {
                const customer = results[0];
                $('#paymentCustomerName').text(customer.CustomerName);
                $('#paymentCustomerId').text(customer.CustomerID);
                $('#paymentCustomerNic').text(customer.NIC || '---');
                $('#paymentCustomerPhone').text(customer.CustomerPhone || '---');
                $('#customerPaymentInfoSection').removeClass('d-none');
                loadCustomerActiveLoans(customer.CustomerID);
            } else {
                notify.toast("පාරිභෝගිකයා සොයාගත නොහැක.", "error");
                resetPaymentUI();
            }
        } catch (error) { console.error(error); }
    });

    $(document).on('click', '.loan-item-card', function () {
        $('.loan-item-card').removeClass('active-loan-selection border-primary shadow-sm bg-light');
        $(this).addClass('active-loan-selection border-primary shadow-sm bg-light');
        selectedLoanForPayment = $(this).data('loan');
        $('#paymentDetailsSection').removeClass('d-none');
        calculateAndDisplayPayment(selectedLoanForPayment);
        loadPaymentHistory(selectedLoanForPayment.LoanID);
    });

    $('#btnProcessPayment').click(async function () {
        if (!selectedLoanForPayment) return notify.toast("කරුණාකර ණයක් තෝරා සිටින්න.", "warning");
        const paidAmount = parseFloat($('#txtPaymentAmount').val());
        const selectedDate = $('#txtPaymentManualDate').val();
        if (isNaN(paidAmount) || paidAmount <= 0) return notify.toast("වලංගු මුදලක් ඇතුළත් කරන්න.", "warning");

        const confirmPay = await notify.confirm(`රු. ${paidAmount.toLocaleString()} ක ගෙවීම ස්ථිරද?`);
        if (!confirmPay) return;

        try {
            const result = await window.api.payment.process({
                LoanID: selectedLoanForPayment.LoanID,
                PaidAmount: paidAmount,
                InterestAmount: selectedLoanForPayment.totalInterestDue || 0,
                PenaltyAmount: selectedLoanForPayment.totalPenaltyDue || 0,
                PaymentDate: selectedDate,
                MonthsPaid: selectedLoanForPayment.calculatedMonths || 1
            });
            if (result.success) {
                notify.toast(`ගෙවීම සාර්ථකයි!`, "success");
                const currentCustId = $('#paymentCustomerId').text();
                selectedLoanForPayment = null;
                $('#paymentDetailsSection').addClass('d-none');
                if (currentCustId) loadCustomerActiveLoans(currentCustId);
            } else { notify.toast("දෝෂයකි: " + result.error, "error"); }
        } catch (error) { console.error(error); }
    });
});