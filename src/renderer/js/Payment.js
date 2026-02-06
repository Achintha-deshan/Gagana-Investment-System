let selectedLoanForPayment = null;

/**
 * 1. ගෙවීමක් අවලංගු කිරීම (Void Payment)
 */
async function voidPayment(paymentId) {
    const confirmVoid = await notify.confirm("මෙම ගෙවීම අවලංගු කිරීමට ස්ථිරද? ණය ශේෂය සහ දිනයන් නැවත පරණ තත්වයට පත්වනු ඇත.");
    if (!confirmVoid) return;

    try {
        const result = await window.api.payment.voidPayment(paymentId);
        if (result.success) {
            notify.toast("ගෙවීම සාර්ථකව අවලංගු කරන ලදී.", "success");
            
            // UI එක Refresh කිරීම
            const currentCustId = $('#paymentCustomerId').text();
            if (currentCustId) {
                loadCustomerActiveLoans(currentCustId);
                // තෝරාගෙන තිබූ ණයට අදාළ ඉතිහාසය නැවත Load කිරීම
                if (selectedLoanForPayment) {
                    loadPaymentHistory(selectedLoanForPayment.LoanID);
                }
            }
            $('#paymentDetailsSection').addClass('d-none'); 
        } else {
            notify.toast("දෝෂයකි: " + result.error, "error");
        }
    } catch (err) {
        console.error(err);
        notify.toast("අවලංගු කිරීම අසාර්ථකයි.", "error");
    }
}

$(document).ready(function () {

    /**
     * 2. පාරිභෝගිකයා සෙවීම
     */
    $('#btnSearchPaymentCustomer').click(async function () {
        const query = $('#txtSearchPaymentCustomer').val().trim();
        if (!query) return notify.toast("කරුණාකර පාරිභෝගික ID එක ඇතුළත් කරන්න.", "warning");

        try {
            const results = await window.api.customer.search(query);
            if (results && results.length > 0) {
                const customer = results[0];

                // Blacklisted පරීක්ෂාව
                if (customer.IsBlacklisted === 1) {
                    await notify.confirm(
                        `මෙම පාරිභෝගිකයා (${customer.CustomerName}) Blacklisted කර ඇත. මොහුට ගනුදෙනු කිරීමට අවසර නොමැත.`,
                        'පාරිභෝගිකයා අවහිර කර ඇත',
                        { confirmText: 'හරි (OK)', showCancelButton: false, confirmColor: '#ef4444' }
                    );
                    $('#txtSearchPaymentCustomer').val('');
                    resetPaymentUI();
                    return;
                }
                
                // විස්තර පෙන්වීම
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
        } catch (error) {
            console.error(error);
            notify.toast("දත්ත සෙවීමේදී දෝෂයක් සිදුවිය.", "error");
        }
    });

    /**
     * 3. ණය ලැයිස්තුවෙන් එකක් තෝරා ගැනීම
     */
    $(document).on('click', '.loan-item-card', function () {
        $('.loan-item-card').removeClass('active-loan-selection border-primary shadow-sm bg-light');
        $(this).addClass('active-loan-selection border-primary shadow-sm bg-light');

        selectedLoanForPayment = $(this).data('loan');
        
        $('#paymentDetailsSection').removeClass('d-none');
        calculateAndDisplayPayment(selectedLoanForPayment);
        loadPaymentHistory(selectedLoanForPayment.LoanID);
    });

    /**
     * 4. ගෙවීම සිදු කිරීම (Process Payment)
     */
    $('#btnProcessPayment').click(async function () {
        if (!selectedLoanForPayment) {
            return notify.toast("කරුණාකර ණයක් තෝරා සිටින්න.", "warning");
        }

        const paidAmount = parseFloat($('#txtPaymentAmount').val());
        if (isNaN(paidAmount) || paidAmount <= 0) {
            return notify.toast("කරුණාකර වලංගු ගෙවීම් මුදලක් ඇතුළත් කරන්න.", "warning");
        }

        // වත්මන් දිනය ලබා ගැනීම
        const paymentDate = new Date().toLocaleString('sv-SE').replace(' ', 'T');        
        const interest = selectedLoanForPayment.totalInterestDue || 0;
        const penalty = selectedLoanForPayment.totalPenaltyDue || 0;
        const months = selectedLoanForPayment.calculatedMonths || 1;

        const confirmPay = await notify.confirm(`රු. ${paidAmount.toLocaleString()} ක මුළු ගෙවීම ස්ථිරද?`);
        if (!confirmPay) return;

        try {
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
                
                const currentCustId = $('#paymentCustomerId').text();
                selectedLoanForPayment = null; 
                $('#paymentDetailsSection').addClass('d-none');
                
                if (currentCustId) {
                    loadCustomerActiveLoans(currentCustId);
                }
            } else {
                notify.toast("දෝෂයකි: " + result.error, "error");
            }
        } catch (error) {
            console.error("Payment Error:", error);
            notify.toast("පද්ධති දෝෂයකි. කරුණාකර නැවත උත්සාහ කරන්න.", "error");
        }
    });
});

/**
 * පාරිභෝගිකයාගේ සක්‍රීය ණය ලැයිස්තුව පෙන්වීම
 */
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
                                <small class="text-muted">අංකය: ${loan.VehicleNumber || 'General'}</small>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold text-success">ණය: රු. ${parseFloat(loan.LoanAmount).toLocaleString()}</div>
                                <small class="text-danger fw-bold">ගෙවිය යුතු: ${formatCustomDateTime(loan.NextDueDate)}</small>                                    </div>
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



/**
 * පොලිය සහ දඩය ගණනය කිරීම (අද දිනය පදනම්ව)
 */
function calculateAndDisplayPayment(loan) {
    if (!loan) return;

    // වත්මන් දිනය ලබා ගැනීම
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const loanStartDate = new Date(loan.LoanDate);
    loanStartDate.setHours(0, 0, 0, 0);

    const nextDueDate = new Date(loan.NextDueDate);
    nextDueDate.setHours(0, 0, 0, 0);

    const loanAmount = parseFloat(loan.LoanAmount) || 0;
    const interestRate = parseFloat(loan.InterestRate) || 0;
    const monthlyInterest = loanAmount * (interestRate / 100);

    // ණය දුන් දින සිට අදට දින ගණන
    const diffInMs = today.getTime() - loanStartDate.getTime();
    const daysSinceLoanStart = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    let totalInterest = 0;
    let statusMessage = "";
    let calculatedMonths = 1;

    // --- 1. පොලිය ගණනය කිරීම (Settlement Logic) ---
    if (daysSinceLoanStart <= 31) {
        if (daysSinceLoanStart <= 7) {
            totalInterest = monthlyInterest * 0.25;
            statusMessage = "දින 7කට අඩු (1/4 පොලිය)";
        } else if (daysSinceLoanStart <= 14) {
            totalInterest = monthlyInterest * 0.50;
            statusMessage = "දින 14කට අඩු (1/2 පොලිය)";
        } else if (daysSinceLoanStart <= 21) {
            totalInterest = monthlyInterest * 0.75;
            statusMessage = "දින 21කට අඩු (3/4 පොලිය)";
        } else {
            totalInterest = monthlyInterest;
            statusMessage = "දින 21 ඉක්මවා ඇත (සම්පූර්ණ පොලිය)";
        }
    } else {
        calculatedMonths = Math.max(1, Math.ceil(daysSinceLoanStart / 30));
        totalInterest = monthlyInterest * calculatedMonths;
        statusMessage = `මාස ${calculatedMonths} ක් සඳහා පොලිය`;
    }

    // --- 2. දඩ මුදල් සහ දින ගණන ගණනය කිරීම ---
    let totalPenalty = 0;
    let overdueDays = 0;

    if (today > nextDueDate) {
        overdueDays = Math.floor((today - nextDueDate) / (1000 * 60 * 60 * 24));
        
        // දින 2 සහන කාලය (Grace Period)
        if (overdueDays > 2) { 
            const penaltyRate = parseFloat(loan.PenaltyRateOnInterest) || 0;
            const dailyPenaltyRate = (monthlyInterest * (penaltyRate / 100)) / 30;
            totalPenalty = dailyPenaltyRate * overdueDays;
        }
    }

    // දත්ත ගබඩා කිරීම
    selectedLoanForPayment.totalInterestDue = totalInterest;
    selectedLoanForPayment.totalPenaltyDue = totalPenalty;
    selectedLoanForPayment.calculatedMonths = calculatedMonths;
    selectedLoanForPayment.overdueDays = overdueDays; // දින ගණන මෙහි තබා ගනිමු

    // --- 3. UI එකට දත්ත යැවීම ---
    
    // පොලිය පෙන්වීම
    $('#summaryInterest').html(`රු. ${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})} <br><small class="text-info">${statusMessage}</small>`);
    
    // දඩය සහ දින ගණන පෙන්වන වැදගත්ම පේළිය
    if (overdueDays > 0) {
        $('#summaryPenalty').html(`රු. ${totalPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})} <br><small class="text-danger">(${overdueDays} Days Overdue)</small>`);
    } else {
        $('#summaryPenalty').text(`රු. 0.00 (No Arrears)`);
    }
    
    // මුළු ගෙවිය යුතු මුදල (දඩය + පොලිය + මුල් ණය)
    // සටහන: මුළු මුදල ලෙස පෙන්වන්නේ අද දිනට ගෙවා ණය නිම කිරීමට අවශ්‍ය සම්පූර්ණ මුදලයි.
    const totalPayable = loanAmount + totalInterest + totalPenalty;
    $('#summaryTotal').text(`රු. ${totalPayable.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    
    // ගෙවීම් පෙට්ටියට මුදල ඇතුළත් කිරීම
    $('#txtPaymentAmount').val(totalPayable.toFixed(2));
}

function resetPaymentUI() {
    $('#customerPaymentInfoSection, #loansListSection, #paymentDetailsSection').addClass('d-none');
    $('#noLoansMessage').addClass('d-none');
}

function resetPaymentUI() {
    $('#customerPaymentInfoSection, #loansListSection, #paymentDetailsSection, #paymentHistorySection').addClass('d-none');
    $('#noLoansMessage').addClass('d-none');
}

/**
 * ගෙවීම් ඉතිහාසය ලබා ගැනීම
 */
async function loadPaymentHistory(loanId) {
    try {
        const history = await window.api.payment.getHistory(loanId);
        const tbody = $('#paymentHistoryTableBody');
        tbody.empty();

        if (history && history.length > 0) {
            $('#paymentHistorySection').removeClass('d-none');
            history.forEach(pay => {
                const voidClass = pay.IsVoided ? 'table-secondary opacity-50' : '';
                tbody.append(`
                    <tr class="${voidClass}">
                        <td>#${pay.PaymentID}</td>
                        <td>${formatCustomDateTime(pay.PaymentDate)}</td>
                        <td class="fw-bold">රු. ${parseFloat(pay.PaidAmount).toLocaleString()}</td>
                        <td><small>දඩ: ${pay.PenaltyPaid} | පොලී: ${pay.InterestPaid}</small></td>
                        <td class="text-success fw-bold">රු. ${parseFloat(pay.CapitalPaid).toLocaleString()}</td>
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
// function calculateAndDisplayPayment(loan) {
//     if (!loan) return;

//     const testDateVal = $('#testCurrentDate').val();
//     const today = testDateVal ? new Date(testDateVal) : new Date();
//     today.setHours(0, 0, 0, 0);

//     let currentDueDate = new Date(loan.NextDueDate); 
//     currentDueDate.setHours(0, 0, 0, 0);

//     // වැදගත්: අද දිනය Due Date එකට වඩා අඩු නම් (කල් තියා ගෙවනවා නම්) 
//     // පොලිය 0 ලෙස හෝ අවම 1 මාසයක් ලෙස පෙන්වීමට මෙතැනදී තීරණය කළ හැක.
//     if (today < currentDueDate) {
//         $('#summaryInterest').text("රු. 0.00 (කල්තියා ගෙවීමක්)");
//         $('#summaryPenalty').text("රු. 0.00");
//         $('#summaryTotal').text(`රු. 0.00`);
//         $('#txtPaymentAmount').val("0.00");
        
//         selectedLoanForPayment.totalInterestDue = 0;
//         selectedLoanForPayment.totalPenaltyDue = 0;
//         selectedLoanForPayment.calculatedMonths = 0; // මාස එකතු නොවේ
//         return;
//     }

//     const loanAmount = parseFloat(loan.LoanAmount) || 0;
//     const interestRate = parseFloat(loan.InterestRate) || 0;
//     const penaltyRate = parseFloat(loan.PenaltyRateOnInterest) || 0;
    
//     const monthlyInterest = loanAmount * (interestRate / 100);
//     const dailyPenaltyRate = (monthlyInterest * (penaltyRate / 100)) / 30;

//     let totalInterest = 0;
//     let totalPenalty = 0;
//     let monthsPaidCount = 0;
//     let totalOverdueDays = 0;

//     let tempDate = new Date(currentDueDate);

//     // Loop එක: තෝරාගත් දිනය පසු කරන තෙක් පමණක් ක්‍රියාත්මක වේ
//     while (tempDate <= today) {
//         monthsPaidCount++;
//         totalInterest += monthlyInterest;

//         const diffInMs = today.getTime() - tempDate.getTime();
//         const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

//         if (diffInDays > 2) {
//             const monthlyPenaltyForThisDue = dailyPenaltyRate * diffInDays;
//             totalPenalty += monthlyPenaltyForThisDue;
//             totalOverdueDays += diffInDays;
//         }

//         tempDate.setMonth(tempDate.getMonth() + 1);
//         // මීළඟ මාසයේ දිනය අද දිනයට වඩා වැඩි නම් නතර කරන්න
//         if (tempDate > today) break;
//     }

//     // --- UI Update කිරීම ---
//     selectedLoanForPayment.totalInterestDue = totalInterest;
//     selectedLoanForPayment.totalPenaltyDue = totalPenalty;
//     selectedLoanForPayment.calculatedMonths = monthsPaidCount;

//     $('#summaryInterest').text(`රු. ${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})} (මාස ${monthsPaidCount})`);
//     $('#summaryPenalty').text(`රු. ${totalPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})} (දින ${totalOverdueDays} කට)`);
    
//     const totalPayable = totalInterest + totalPenalty;
//     $('#summaryTotal').text(`රු. ${totalPayable.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
//     $('#txtPaymentAmount').val(totalPayable.toFixed(2));
// }
/**
 * දිනය සහ වෙලාව පෙන්වන ආකෘතිය: 2025.01.12 10.30 a.m
 */
function formatCustomDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m' : 'a.m';

    hours = hours % 12;
    hours = hours ? hours : 12; 

    return `${year}.${month}.${day} ${hours}.${minutes} ${ampm}`;
}