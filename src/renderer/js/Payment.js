let selectedLoanForPayment = null;

async function voidPayment(paymentId) {
    const confirmVoid = await notify.confirm("මෙම ගෙවීම අවලංගු කිරීමට ස්ථිරද? ණය ශේෂය සහ දිනයන් නැවත පරණ තත්වයට පත්වනු ඇත.");
    if (!confirmVoid) return;

    try {
        const result = await window.api.payment.voidPayment(paymentId);
        if (result.success) {
            notify.toast("ගෙවීම සාර්ථකව අවලංගු කරන ලදී.", "success");
            
            // UI එක Refresh කරන්න
            if (selectedLoanForPayment) {
                // ණය ලැයිස්තුව සහ ඉතිහාසය නැවත Load කරන්න
                loadCustomerActiveLoans($('#paymentCustomerId').text());
                loadPaymentHistory(selectedLoanForPayment.LoanID);
                $('#paymentDetailsSection').addClass('d-none'); // Details hide කරන්න
            }
        } else {
            notify.toast("දෝෂයකි: " + result.error, "error");
        }
    } catch (err) {
        console.error(err);
        notify.toast("අවලංගු කිරීම අසාර්ථකයි.", "error");
    }
}

$(document).ready(function () {
    // 1. පාරිභෝගිකයා සෙවීම
  $('#btnSearchPaymentCustomer').click(async function () {
        const query = $('#txtSearchPaymentCustomer').val().trim();
        if (!query) return notify.toast("කරුණාකර පාරිභෝගික ID එක ඇතුළත් කරන්න.", "warning");

        try {
            const results = await window.api.customer.search(query);
            if (results && results.length > 0) {
                const customer = results[0];

                // 🛑 පාරිභෝගිකයා Blacklisted දැයි පරීක්ෂා කිරීම
                if (customer.IsBlacklisted === 1) {
                    
                    // දැඩි අනතුරු ඇඟවීමේ පණිවිඩය පෙන්වීම
                    await notify.confirm(
                        `මෙම පාරිභෝගිකයා (${customer.CustomerName}) Blacklisted කර ඇත. මොහුට කිසිදු ගෙවීමක් හෝ ගනුදෙනුවක් කිරීමට අවසර නොමැත.`,
                        'පාරිභෝගිකයා අවහිර කර ඇත',
                        {
                            confirmText: 'හරි (OK)',
                            showCancelButton: false, // Cancel බොත්තම ඉවත් කරයි
                            confirmColor: '#ef4444'
                        }
                    );

                    // පෝරමය Reset කර සෙවුම් කොටුව හිස් කිරීම
                    $('#txtSearchPaymentCustomer').val('');
                    resetPaymentUI();
                    return;
                }
                
                // ✅ Blacklisted නොවේ නම් පමණක් විස්තර පෙන්වීම
                $('#paymentCustomerName').text(customer.CustomerName);
                $('#paymentCustomerId').text(customer.CustomerID);
                $('#paymentCustomerNic').text(customer.NIC || '---');
                $('#paymentCustomerPhone').text(customer.CustomerPhone || '---');
                
                $('#customerPaymentInfoSection').removeClass('d-none');
                
                // ණය ලැයිස්තුව ලබා ගැනීම
                loadCustomerActiveLoans(customer.CustomerID);

            } else {
                notify.toast("පාරිභෝගිකයා සොයාගත නොහැක.", "error");
                resetPaymentUI();
            }
        } catch (error) {
            console.error(error);
            notify.toast("දත්ත සෙවීමේදී දෝෂයක් සිදුවිය.", "error");
        }
    });

    // 2. ණය ලැයිස්තුවෙන් එකක් තෝරා ගැනීම
   $(document).on('click', '.loan-item-card', function () {
    $('.loan-item-card').removeClass('active-loan-selection border-primary shadow-sm bg-light');
    $(this).addClass('active-loan-selection border-primary shadow-sm bg-light');

    selectedLoanForPayment = $(this).data('loan');
    
    // Section එක පෙන්වන්න
    $('#paymentDetailsSection').removeClass('d-none');
    
    calculateAndDisplayPayment(selectedLoanForPayment);
    loadPaymentHistory(selectedLoanForPayment.LoanID)
});

    // 3. පරීක්ෂණ දිනය (Testing Date) වෙනස් කරන විට නැවත ගණනය කිරීම
    $('#testCurrentDate').on('change', function() {
        if (selectedLoanForPayment) {
            calculateAndDisplayPayment(selectedLoanForPayment);
                loadPaymentHistory(selectedLoanForPayment.LoanID)

        }
    });
// Payment.js ඇතුළත

$('#btnProcessPayment').click(async function () {
    // 1. ණයක් තෝරා ඇත්දැයි බැලීම
    if (!selectedLoanForPayment) {
        return notify.toast("කරුණාකර ණයක් තෝරා සිටින්න.", "warning");
    }

    // 2. ගෙවන මුදල ලබා ගැනීම
    const paidAmount = parseFloat($('#txtPaymentAmount').val());
    if (isNaN(paidAmount) || paidAmount <= 0) {
        return notify.toast("කරුණාකර වලංගු ගෙවීම් මුදලක් ඇතුළත් කරන්න.", "warning");
    }

    // 3. ගෙවන දිනය ලබා ගැනීම (Test date හෝ අද දිනය)
    const paymentDate = $('#testCurrentDate').val() || new Date().toISOString().split('T')[0];

   const interest = selectedLoanForPayment.totalInterestDue || 0;
    const penalty = selectedLoanForPayment.totalPenaltyDue || 0;
    const months = selectedLoanForPayment.calculatedMonths || 1;

    console.log("SENDING DATA:", { LoanID: selectedLoanForPayment.LoanID, paidAmount, interest, penalty, months });
    // පරීක්ෂා කිරීම සඳහා Console එකේ පෙන්වීම
    console.log("Processing Payment With Data:", {
        LoanID: selectedLoanForPayment.LoanID,
        PaidAmount: paidAmount,
        InterestAmount: interest,
        PenaltyAmount: penalty,
        Months: months
    });

    // 5. තහවුරු කිරීමේ පණිවිඩය
    const confirmPay = await notify.confirm(`රු. ${paidAmount.toLocaleString()} ක මුළු ගෙවීම ස්ථිරද?`);
    if (!confirmPay) return;

    try {
        // 6. Backend එකට දත්ත යැවීම
        const result = await window.api.payment.process({
            LoanID: selectedLoanForPayment.LoanID,
            PaidAmount: paidAmount,
            InterestAmount: interest,
            PenaltyAmount: penalty,
            PaymentDate: paymentDate,
            MonthsPaid: months
        });

       if (result.success) {
    notify.toast(`ගෙවීම සාර්ථකයි! නව ණය ශේෂය: රු. ${result.newCapital.toLocaleString()}`, "success");
    
    // 1. තෝරාගත් loan එක reset කරන්න (නැතිනම් පරණ දත්ත මත ගණනය වේවි)
    selectedLoanForPayment = null; 
    
    // 2. UI එකේ පෙන්වන විස්තර ටික සඟවන්න (Details sections hide කරන්න)
    $('#paymentDetailsSection').addClass('d-none');
    
    // 3. පාරිභෝගිකයාගේ ණය ලැයිස්තුව නැවත Load කරන්න
    // මෙයින් අලුත් NextDueDate එක සහිතව ණය ලැයිස්තුව ලැබේ
    const currentCustId = $('#paymentCustomerId').text();
    if (currentCustId) {
        loadCustomerActiveLoans(currentCustId);
    }

    // 4. (විකල්ප) රිසිට් එක පින්ට් කිරීම මෙතැනදී කළ හැක
}
    } catch (error) {
        console.error("Payment Error:", error);
        notify.toast("පද්ධති දෝෂයකි. කරුණාකර නැවත උත්සාහ කරන්න.", "error");
    }
});
});

// ණය ලැයිස්තුව පෙන්වීම
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
            const loanCard = `
                <div class="card mb-2 loan-item-card border-2" style="cursor:pointer;" id="loan-${loan.LoanID}">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge bg-primary mb-1">${loan.LoanID}</span>
                                <h6 class="mb-0 fw-bold">${loan.LoanType} LOAN</h6>
                                <small class="text-muted">විස්තර: ${loan.VehicleNumber || 'General'}</small>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold text-success">ණය: රු. ${parseFloat(loan.LoanAmount).toLocaleString()}</div>
                                <small class="text-danger fw-bold">ගෙවිය යුතු: ${loan.NextDueDate}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const $el = $(loanCard);
            $el.data('loan', loan);
            container.append($el);
        });
    } catch (err) {
        console.error(err);
    }
}

function calculateAndDisplayPayment(loan) {
    if (!loan) return;

    const testDateVal = $('#testCurrentDate').val();
    const today = testDateVal ? new Date(testDateVal) : new Date();
    today.setHours(0, 0, 0, 0);

    let currentDueDate = new Date(loan.NextDueDate); 
    currentDueDate.setHours(0, 0, 0, 0);

    // වැදගත්: අද දිනය Due Date එකට වඩා අඩු නම් (කල් තියා ගෙවනවා නම්) 
    // පොලිය 0 ලෙස හෝ අවම 1 මාසයක් ලෙස පෙන්වීමට මෙතැනදී තීරණය කළ හැක.
    if (today < currentDueDate) {
        $('#summaryInterest').text("රු. 0.00 (කල්තියා ගෙවීමක්)");
        $('#summaryPenalty').text("රු. 0.00");
        $('#summaryTotal').text(`රු. 0.00`);
        $('#txtPaymentAmount').val("0.00");
        
        selectedLoanForPayment.totalInterestDue = 0;
        selectedLoanForPayment.totalPenaltyDue = 0;
        selectedLoanForPayment.calculatedMonths = 0; // මාස එකතු නොවේ
        return;
    }

    const loanAmount = parseFloat(loan.LoanAmount) || 0;
    const interestRate = parseFloat(loan.InterestRate) || 0;
    const penaltyRate = parseFloat(loan.PenaltyRateOnInterest) || 0;
    
    const monthlyInterest = loanAmount * (interestRate / 100);
    const dailyPenaltyRate = (monthlyInterest * (penaltyRate / 100)) / 30;

    let totalInterest = 0;
    let totalPenalty = 0;
    let monthsPaidCount = 0;
    let totalOverdueDays = 0;

    let tempDate = new Date(currentDueDate);

    // Loop එක: තෝරාගත් දිනය පසු කරන තෙක් පමණක් ක්‍රියාත්මක වේ
    while (tempDate <= today) {
        monthsPaidCount++;
        totalInterest += monthlyInterest;

        const diffInMs = today.getTime() - tempDate.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInDays > 2) {
            const monthlyPenaltyForThisDue = dailyPenaltyRate * diffInDays;
            totalPenalty += monthlyPenaltyForThisDue;
            totalOverdueDays += diffInDays;
        }

        tempDate.setMonth(tempDate.getMonth() + 1);
        // මීළඟ මාසයේ දිනය අද දිනයට වඩා වැඩි නම් නතර කරන්න
        if (tempDate > today) break;
    }

    // --- UI Update කිරීම ---
    selectedLoanForPayment.totalInterestDue = totalInterest;
    selectedLoanForPayment.totalPenaltyDue = totalPenalty;
    selectedLoanForPayment.calculatedMonths = monthsPaidCount;

    $('#summaryInterest').text(`රු. ${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})} (මාස ${monthsPaidCount})`);
    $('#summaryPenalty').text(`රු. ${totalPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})} (දින ${totalOverdueDays} කට)`);
    
    const totalPayable = totalInterest + totalPenalty;
    $('#summaryTotal').text(`රු. ${totalPayable.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#txtPaymentAmount').val(totalPayable.toFixed(2));
}

function resetPaymentUI() {
    $('#customerPaymentInfoSection, #loansListSection, #paymentDetailsSection').addClass('d-none');
    $('#noLoansMessage').addClass('d-none');
}

// ගෙවීම් ඉතිහාසය ලබාගෙන Table එකට පිරවීම
async function loadPaymentHistory(loanId) {
    try {
        const history = await window.api.payment.getHistory(loanId);
        const tbody = $('#paymentHistoryTableBody');
        tbody.empty();

        if (history && history.length > 0) {
            $('#paymentHistorySection').removeClass('d-none');
            history.forEach(pay => {
                tbody.append(`
                    <tr class="${pay.IsVoided ? 'table-secondary opacity-50' : ''}">
                        <td>#${pay.PaymentID}</td>
                        <td>${pay.PaymentDate}</td>
                        <td class="fw-bold">රු. ${parseFloat(pay.PaidAmount).toLocaleString()}</td>
                        <td><small>දඩ: ${pay.PenaltyPaid} | පොලී: ${pay.InterestPaid}</small></td>
                        <td class="text-success fw-bold">${pay.CapitalPaid}</td>
                        <td class="text-center">
                            <button class="btn btn-outline-danger btn-sm rounded-pill" 
                                    onclick="voidPayment(${pay.PaymentID})">
                                <i class="bi bi-arrow-counterclockwise"></i> Void
                            </button>
                        </td>
                    </tr>
                `);
            });
        } else {
            // ගෙවීම් කිසිවක් කර නොමැති නම් Section එක සඟවන්න
            $('#paymentHistorySection').addClass('d-none');
        }
    } catch (err) {
        console.error("History Loading Error:", err);
    }
}
