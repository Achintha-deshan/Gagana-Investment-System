// ============================================================
// Loan Settlement Renderer Logic (Full Corrected Code)
// ============================================================

let selectedSubLoanId = null;
let currentSelectedMasterLoanId = null;
let currentCalculation = {};
let lastSearchResults = [];

// 1. ණය සෙවීම (Search Function)
$('#btnSearchSettleLoan').on('click', async () => {
    const query = $('#txtSettleSearchLoan').val().trim();
    if (!query) return;

    $('#loanCardsContainer').empty();
    $('#subLoansWrapper').addClass('d-none');
    $('#settleDetailsWrapper').addClass('d-none');
    $('#noSettleLoanMessage').addClass('d-none');
    $('#settleMasterCardsArea').addClass('d-none');

    try {
        const results = await window.api.settlement.search(query);
        lastSearchResults = results;

        if (results && results.length > 0) {
            $('#settleMasterCardsArea').removeClass('d-none');
            renderMasterLoanCards(results);
            notify.toast('දත්ත සාර්ථකව සොයාගන්නා ලදී', 'success');
        } else {
            $('#noSettleLoanMessage').removeClass('d-none');
            notify.toast('අදාළ දත්ත හමු නොවීය', 'warning');
        }
    } catch (err) {
        console.error("Search Error:", err);
        notify.alert('දත්ත සෙවීමේදී දෝෂයක් සිදුවිය', 'දෝෂයකි', 'error');
    }
});

// 2. Master Loan Cards ඇඳීම
function renderMasterLoanCards(loans) {
    let html = '';
    loans.forEach(loan => {
        html += `
            <div class="col-md-4">
                <div class="card h-100 border-0 shadow-sm settlement-card" 
                     onclick="displaySubLoans('${loan.LoanID}', '${loan.CustomerName}', '${loan.LoanType}')"
                     style="cursor:pointer; border-left: 5px solid #e74c3c !important; transition: 0.3s;">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-danger">${loan.LoanID}</span>
                            <span class="small text-muted fw-bold">${loan.LoanType}</span>
                        </div>
                        <h6 class="fw-bold mb-1">${loan.CustomerName}</h6>
                        <p class="small text-muted mb-0"><i class="bi bi-person-fill"></i> ID: ${loan.CustomerID}</p>
                        <p class="small text-muted mb-0"><i class="bi bi-card-heading"></i> ${loan.NIC || 'N/A'}</p>
                    </div>
                </div>
            </div>`;
    });
    $('#loanCardsContainer').html(html);
}

// 3. Sub Loans පෙන්වීම
window.displaySubLoans = (loanId, customerName, loanType) => {
    currentSelectedMasterLoanId = loanId;
    const loan = lastSearchResults.find(l => l.LoanID === loanId);
    if (!loan || !loan.SubLoans) return;

    let html = '';
    loan.SubLoans.forEach(sub => {
        const isClosed = sub.DisbursementStatus === 'CLOSED';
        html += `
            <button class="btn ${isClosed ? 'btn-secondary disabled' : 'btn-outline-danger'} me-2 mb-2 px-4 fw-bold shadow-sm" 
                    ${isClosed ? '' : `onclick="loadSettlementDetails(${sub.DisbursementID}, '${customerName}', '${loanType}', ${sub.TotalAmount})"`}>
                Sub Loan #${sub.SubLoanNumber} ${isClosed ? '(CLOSED)' : `(Bal: රු. ${sub.RemainingPrincipal})`}
            </button>`;
    });

    $('#settleSubLoansContainer').html(html);
    $('#subLoansWrapper').removeClass('d-none');
    $('#settleDetailsWrapper').addClass('d-none');
    
    $('html, body').animate({ scrollTop: $("#subLoansWrapper").offset().top - 100 }, 200);
};

// 4. පියවීමේ විස්තර ලෝඩ් කිරීම
window.loadSettlementDetails = async (disbursementId, name, type, originalAmount) => {
    try {
        const response = await window.api.settlement.getBreakdown(disbursementId);
        
        if (response.success) {
            const data = response.data;
            selectedSubLoanId = disbursementId;
            currentCalculation = data; // මෙහි interestRate අඩංගු වේ

            $('#settleCustomerName').text(name);
            $('#settleLoanType').text(type);
            $('#settleSubIdDisplay').text(`Sub ID: #${disbursementId}`);
            $('#settleMainAmount').text(`රු. ${parseFloat(originalAmount).toLocaleString('en-US', {minimumFractionDigits: 2})}`);
            $('#settleCurrentBalance').text(`රු. ${data.principal.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
            $('#settleLastPaidDate').text(new Date(data.lastInterestDate).toLocaleDateString());
            
            // UI මුලින් සැකසීම
            $('#settleDaysCount').text(`ගතවූ දින: ${data.daysPassed}`);
            $('#tdSettleCapital').text(data.principal.toFixed(2));
            $('#tdSettleInterest').text(data.interest.toFixed(2));
            $('#tdSettleArrears').text(data.arrears.toFixed(2));

            $('#txtSettlePenalty').val(0);
            $('#txtSettleDiscount').val(0);
            $('#settlePaymentDate').val(new Date().toISOString().split('T')[0]);

            $('#settleDetailsWrapper').removeClass('d-none');
            updateSettleTotal();
            
            $('html, body').animate({ scrollTop: $("#settleDetailsWrapper").offset().top - 50 }, 200);
        } else {
            notify.alert(response.error, 'දෝෂයකි', 'error');
        }
    } catch (err) {
        notify.alert('පද්ධතියේ දෝෂයක් සිදුවිය', 'Error', 'error');
    }
};

// 5. දින වෙනස් වන විට පොලිය ගණනය කිරීමේ Logic එක
$(document).on('change', '#settlePaymentDate', function() {
    if (!currentCalculation.lastInterestDate) return;

    const selectedDate = new Date($(this).val());
    const lastPaidDate = new Date(currentCalculation.lastInterestDate);
    
    // දින අතර පරතරය සෙවීම
    const diffTime = selectedDate - lastPaidDate;
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    $('#settleDaysCount').text(`ගතවූ දින: ${diffDays}`);
    
    const principal = parseFloat(currentCalculation.principal || 0);
    const rate = parseFloat(currentCalculation.interestRate || 0);
    const monthlyInterest = (principal * rate) / 100;
    
    let newInterest = 0;
    if (diffDays <= 2) {
        newInterest = 0;
    } else if (diffDays <= 7) {
        newInterest = monthlyInterest / 4;
    } else if (diffDays <= 14) {
        newInterest = monthlyInterest / 2;
    } else {
        newInterest = monthlyInterest;
    }

    // අගයන් යාවත්කාලීන කිරීම
    currentCalculation.interest = newInterest;
    currentCalculation.daysPassed = diffDays;
    
    $('#tdSettleInterest').text(newInterest.toFixed(2));
    updateSettleTotal();
});

// 6. මුළු මුදල (Final Total) Update කිරීම
window.updateSettleTotal = () => {
    const capital = parseFloat(currentCalculation.principal || 0);
    const interest = parseFloat(currentCalculation.interest || 0);
    const arrears = parseFloat(currentCalculation.arrears || 0);
    const penalty = parseFloat($('#txtSettlePenalty').val() || 0);
    const discount = parseFloat($('#txtSettleDiscount').val() || 0);

    const finalTotal = (capital + interest + arrears + penalty) - discount;
    $('#settleFinalTotal').text(`රු. ${finalTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
};

// Penalty සහ Discount වෙනස් වන විට මුළු මුදල Update කිරීම
$(document).on('input', '#txtSettlePenalty, #txtSettleDiscount', () => {
    updateSettleTotal();
});

// 7. පියවීම තහවුරු කිරීම
$('#btnConfirmSettlement').on('click', async () => {
    if (!selectedSubLoanId || !currentSelectedMasterLoanId) {
        notify.toast('කරුණාකර ණය ගිණුමක් තෝරාගන්න', 'warning');
        return;
    }

    let loggedUserID = 'U001'; 
    try {
        const userData = sessionStorage.getItem('loggedUser');
        if (userData) {
            const parsed = JSON.parse(userData);
            loggedUserID = parsed.UserID || parsed.userid || 'U001';
        }
    } catch (e) { console.error(e); }

    const isConfirmed = await notify.confirm(
        'මෙම ණය ගිණුම සම්පූර්ණයෙන්ම පියවා වසා දැමීමට ඔබ සහතිකද?',
        'ගිණුම පියවීම තහවුරු කරන්න',
        { confirmText: 'ඔව්, වසා දමන්න', confirmColor: '#c0392b' }
    );

    if (isConfirmed) {
        const totalRaw = $('#settleFinalTotal').text().replace('රු. ', '').replace(/,/g, '');

        const settlementData = {
            DisbursementID: selectedSubLoanId,
            LoanID: currentSelectedMasterLoanId,
            CapitalPaid: currentCalculation.principal,
            InterestPaid: currentCalculation.interest,
            PenaltyPaid: parseFloat($('#txtSettlePenalty').val() || 0),
            TotalPaid: parseFloat(totalRaw),
            PaymentDate: $('#settlePaymentDate').val(),
            CollectedBy: loggedUserID 
        };

        try {
            const result = await window.api.settlement.process(settlementData);
            if (result.success) {
                await notify.alert('ණය ගිණුම සාර්ථකව පියවා වසා දමන ලදී.', 'සාර්ථකයි', 'success');
                $('#settleDetailsWrapper').addClass('d-none');
                $('#subLoansWrapper').addClass('d-none');
                $('#btnSearchSettleLoan').click(); 
            } else {
                notify.alert(result.error, 'දෝෂයකි', 'error');
            }
        } catch (err) {
            notify.alert('දත්ත සමුදායේ දෝෂයක් සිදුවිය.', 'Error', 'error');
        }
    }
});