let selectedLoanForSettlement = null;
let currentInterestToPay = 0;

$(document).ready(function () {
    /**
     * 1. පියවීමට අවශ්‍ය ණය සෙවීම
     */
    $('#btnSearchSettleLoan').click(async function () {
        const query = $('#txtSettleSearchLoan').val().trim();
        if (!query) return notify.toast("කරුණාකර පාරිභෝගික ID/නම/NIC ඇතුළත් කරන්න.", "warning");

        try {
            $('#loanCardsContainer').empty().removeClass('d-none');
            $('#settleDetailsWrapper').addClass('d-none');
            $('#noSettleLoanMessage').addClass('d-none');
            selectedLoanForSettlement = null;

            const results = await window.api.payment.searchSettlement(query);

            if (results && results.length > 0) {
                results.forEach(loan => {
                    const loanData = encodeURIComponent(JSON.stringify(loan));
                    const card = `
                        <div class="col-md-4">
                            <div class="card h-100 border-0 shadow-sm loan-card border-start border-danger border-4" 
                                 onclick="loadSelectedLoanForSettle('${loanData}')" 
                                 style="cursor:pointer; border-radius: 12px;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between mb-2">
                                        <span class="badge bg-danger-subtle text-danger">ID: ${loan.LoanID}</span>
                                        <small class="text-muted fw-bold">${loan.LoanType}</small>
                                    </div>
                                    <h6 class="mb-1 fw-bold">${loan.CustomerName}</h6>
                                    <p class="mb-0 text-muted small">මුල් ණය: රු. ${parseFloat(loan.LoanAmount).toLocaleString()}</p>
                                    <p class="mb-0 text-muted small text-primary">දිනය: ${new Date(loan.LoanDate).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>`;
                    $('#loanCardsContainer').append(card);
                });
            } else {
                $('#noSettleLoanMessage').removeClass('d-none');
            }
        } catch (error) {
            console.error(error);
            notify.toast("දත්ත සෙවීමේදී දෝෂයක් සිදුවිය.", "error");
        }
    });

    /**
     * 2. ගිණුම පියවීම ස්ථිර කිරීම (Void Feature එක සමග)
     */
    $('#btnConfirmSettlement').click(async function () {
        if (!selectedLoanForSettlement) return notify.toast("කරුණාකර ණයක් තෝරා සිටින්න.", "warning");

        const capital = parseFloat(selectedLoanForSettlement.CapitalBalance || selectedLoanForSettlement.LoanAmount) || 0;
        const penalty = parseFloat($('#txtSettlePenalty').val()) || 0;
        const discount = parseFloat($('#txtSettleDiscount').val()) || 0;
        const finalTotal = (capital + currentInterestToPay + penalty) - discount;

        const confirmSettle = await notify.confirm(`රු. ${finalTotal.toLocaleString(undefined, {minimumFractionDigits:2})} ක් ගෙවා මෙම ණය ගිණුම සම්පූර්ණයෙන්ම වසා දැමීමට ස්ථිරද?`);
        if (!confirmSettle) return;

        try {
            const result = await window.api.payment.processSettlement({
                LoanID: selectedLoanForSettlement.LoanID,
                TotalPaid: finalTotal,
                CapitalPaid: capital,
                InterestPaid: currentInterestToPay,
                PenaltyPaid: penalty,
                PaymentDate: new Date().toISOString().slice(0, 10)
            });

            if (result.success) {
                // සාර්ථක පණිවිඩය සමඟ වහාම අවලංගු කිරීමට (Void) අවස්ථාව ලබා දීම
                const voidChoice = await notify.confirm(
                    "ණය ගිණුම සාර්ථකව පියවා වසා දමන ලදී. මෙය වැරදීමකින් සිදු වූවක් නම් අවලංගු (Void) කිරීමට අවශ්‍යද?",
                    "සාර්ථකයි!",
                    { confirmText: 'අවලංගු කරන්න', cancelText: 'අවශ්‍ය නැත' }
                );

                if (voidChoice) {
                    const voidResult = await window.api.payment.voidPayment(result.paymentId);
                    if (voidResult.success) {
                        notify.toast("Settlement එක සාර්ථකව අවලංගු කර ණය ගිණුම නැවත සක්‍රීය කරන ලදී.", "info");
                    } else {
                        notify.toast("අවලංගු කිරීම අසාර්ථකයි: " + voidResult.error, "error");
                    }
                }
                resetSettleUI();
            } else {
                notify.toast("දෝෂයකි: " + result.error, "error");
            }
        } catch (error) {
            console.error(error);
            notify.toast("පද්ධති දෝෂයකි.", "error");
        }
    });

    // Penalty හෝ Discount වෙනස් කරන විට Total එක update වීමට
    $('#txtSettlePenalty, #txtSettleDiscount').on('input', function() {
        calculateFinalSettle();
    });
});


function loadSelectedLoanForSettle(encodedLoan) {
    const loan = JSON.parse(decodeURIComponent(encodedLoan));
    selectedLoanForSettlement = loan;
    
    $('#settleCustomerName').text(loan.CustomerName);
    $('#settleLoanType').text(loan.LoanType + " LOAN");
    $('#settleMainAmount').text(`රු. ${parseFloat(loan.LoanAmount).toLocaleString()}`);
    $('#settleLoanDate').text(new Date(loan.LoanDate).toLocaleDateString());

    const capBalance = parseFloat(loan.CapitalBalance || loan.LoanAmount);
    $('#settleCurrentBalance').text(`රු. ${capBalance.toLocaleString()}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

   
    const lastDueDate = new Date(loan.NextDueDate);
    lastDueDate.setHours(0, 0, 0, 0);

   
    const lastInterestPaidDate = new Date(lastDueDate);
    lastInterestPaidDate.setMonth(lastInterestPaidDate.getMonth() - 1);

    const diffInMs = today.getTime() - lastInterestPaidDate.getTime();
    const daysSinceLastPayment = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    const monthlyInterestRate = (parseFloat(loan.InterestRate) || 0) / 100;
    const monthlyInterest = capBalance * monthlyInterestRate;

    let totalInterest = 0;
    let statusMessage = "";

    // දින 30ක් ඇතුළත නම් කොටස් වශයෙන් පොලිය ගණනය කිරීම
    if (daysSinceLastPayment <= 30) {
        if (daysSinceLastPayment <= 7) {
            totalInterest = monthlyInterest * 0.25;
            statusMessage = `අන්තිම ගෙවීමේ සිට දින ${daysSinceLastPayment} යි (1/4 පොලිය)`;
        } else if (daysSinceLastPayment <= 14) {
            totalInterest = monthlyInterest * 0.50;
            statusMessage = `අන්තිම ගෙවීමේ සිට දින ${daysSinceLastPayment} යි (1/2 පොලිය)`;
        } else if (daysSinceLastPayment <= 21) {
            totalInterest = monthlyInterest * 0.75;
            statusMessage = `අන්තිම ගෙවීමේ සිට දින ${daysSinceLastPayment} යි (3/4 පොලිය)`;
        } else {
            totalInterest = monthlyInterest;
            statusMessage = `අන්තිම ගෙවීමේ සිට දින ${daysSinceLastPayment} යි (සම්පූර්ණ පොලිය)`;
        }
    } else {
        // මාසයකට වඩා වැඩි නම්, සම්පූර්ණ වූ මාස ගණනට පොලිය
        const calculatedMonths = Math.max(1, Math.ceil(daysSinceLastPayment / 30));
        totalInterest = monthlyInterest * calculatedMonths;
        statusMessage = `මාස ${calculatedMonths} ක් සඳහා පොලිය (දින ${daysSinceLastPayment})`;
    }

    // දඩ මුදල ගණනය කිරීම (Next Due Date එක පහු වී ඇත්නම් පමණක්)
    let totalPenalty = 0;
    let overdueDays = 0;
    if (today > lastDueDate) {
        overdueDays = Math.floor((today - lastDueDate) / (1000 * 60 * 60 * 24));
        if (overdueDays > 2) { 
            const penaltyRate = parseFloat(loan.PenaltyRateOnInterest) || 0;
            const dailyPenaltyRate = (monthlyInterest * (penaltyRate / 100)) / 30;
            totalPenalty = dailyPenaltyRate * overdueDays;
        }
    }

    currentInterestToPay = totalInterest;
    
    $('#txtSettleInterestDisplay').val(`රු. ${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    $('#txtSettlePenalty').val(totalPenalty.toFixed(2));
    
    $('#interestLogicNote').html(`
        <i class="bi bi-info-circle-fill me-2"></i> 
        <strong>${statusMessage}</strong> 
        ${overdueDays > 2 ? `<br><small class="text-danger">ප්‍රමාද දින (Next Due Date සිට): ${overdueDays}</small>` : ''}
    `);

    $('#settleDetailsWrapper').removeClass('d-none');
    $('#loanCardsContainer').addClass('d-none'); 

    calculateFinalSettle();
}

/**
 * 4. මුළු එකතුව ගණනය කිරීම
 */
function calculateFinalSettle() {
    if (!selectedLoanForSettlement) return;

    const capital = parseFloat(selectedLoanForSettlement.CapitalBalance || selectedLoanForSettlement.LoanAmount) || 0;
    const penalty = parseFloat($('#txtSettlePenalty').val()) || 0;
    const discount = parseFloat($('#txtSettleDiscount').val()) || 0;
    
    const total = (capital + currentInterestToPay + penalty) - discount;
    
    $('#settleFinalTotal').text(`රු. ${total.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`);
}

function resetSettleUI() {
    $('#settleDetailsWrapper').addClass('d-none');
    $('#loanCardsContainer').empty().removeClass('d-none');
    $('#txtSettleSearchLoan').val('');
    $('#txtSettlePenalty, #txtSettleDiscount').val(0);
    $('#txtSettleRemarks').val('');
    selectedLoanForSettlement = null;
}