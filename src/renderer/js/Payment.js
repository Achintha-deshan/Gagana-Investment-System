$(document).ready(function () {
    let selectedSubLoanId = null;
    let currentMasterLoanId = null;

    // 1. අද දිනය default ලෙස ඇතුළත් කිරීම
    const today = new Date().toISOString().split('T')[0];
    $('#txtPaymentManualDate').val(today);

    // --- HELPER FUNCTIONS ---

    // වාරික අනුපිළිවෙලට පමණක් තේරීමට ඉඩ ලබා දීම
$(document).on('change', '.chk-item[data-type="interest"]', function() {
    const allInterestChecks = $('.chk-item[data-type="interest"]');
    const currentIndex = allInterestChecks.index(this);

    if (this.checked) {
        // මේ මාසය තේරූ විට, මීට පෙර ඇති සියලුම මාස auto-check කරන්න
        for (let i = 0; i < currentIndex; i++) {
            $(allInterestChecks[i]).prop('checked', true);
        }
    } else {
        // මේ මාසය අත්හළ විට, මීට පසු ඇති සියලුම මාස auto-uncheck කරන්න
        for (let i = currentIndex + 1; i < allInterestChecks.length; i++) {
            $(allInterestChecks[i]).prop('checked', false);
        }
    }
    calculateTotal();
});

    function getLoanSpecificInfo(loan) {
        let content = "";
        const noDataText = "---";
        switch (loan.LoanType) {
            case 'VEHICLE':
                content = `<div class="detail-box p-2 bg-light rounded-3 mb-2 border">
                            <small class="text-muted d-block" style="font-size: 0.7rem;">Vehicle No | වාහන අංකය</small>
                            <span class="fw-bold text-dark"><i class="bi bi-truck me-2 text-primary"></i>${loan.VehicleNumber || noDataText}</span>
                          </div>`;
                break;
            case 'LAND':
                content = `<div class="detail-box p-2 bg-light rounded-3 mb-2 border">
                            <small class="text-muted d-block" style="font-size: 0.7rem;">Location | ස්ථානය</small>
                            <span class="fw-bold text-dark"><i class="bi bi-geo-alt me-2 text-success"></i>${loan.LandNumber || loan.Location || noDataText}</span>
                          </div>`;
                break;
            case 'PROMISSORY':
                content = `<div class="detail-box p-2 bg-light rounded-3 mb-2 border">
                            <small class="text-muted d-block" style="font-size: 0.7rem;">Note No | පොරොන්දු පත්‍ර අංකය</small>
                            <span class="fw-bold text-dark"><i class="bi bi-file-earmark-text me-2 text-warning"></i>${loan.PRMNo || noDataText}</span>
                          </div>`;
                break;
            case 'CHECK':
                content = `<div class="detail-box p-2 bg-light rounded-3 mb-2 border">
                            <small class="text-muted d-block" style="font-size: 0.7rem;">Cheque No | චෙක්පත් අංකය</small>
                            <span class="fw-bold text-dark"><i class="bi bi-card-checklist me-2 text-info"></i>${loan.CheckNumber || noDataText}</span>
                          </div>`;
                break;
            default:
                content = `<div class="detail-box p-2 bg-light rounded-3 mb-2"><span class="text-muted">No details available</span></div>`;
        }
        return content;
    }

// totalDue අගය පෙන්වීම සඳහා renderMasterLoanCard වෙනස් කිරීම
function renderMasterLoanCard(loan, totalDue = 0) {
    let badgeClass = "bg-primary-subtle text-primary";
    let borderSideColor = "#6366f1";
    if(loan.LoanType === 'VEHICLE') { borderSideColor = "#0d6efd"; }
    if(loan.LoanType === 'LAND') { badgeClass = 'bg-success-subtle text-success'; borderSideColor = "#198754"; }
    if(loan.LoanType === 'PROMISSORY') { badgeClass = 'bg-warning-subtle text-warning'; borderSideColor = "#ffc107"; }
    if(loan.LoanType === 'CHECK') { badgeClass = 'bg-info-subtle text-info'; borderSideColor = "#0dcaf0"; }

    return `<div class="col-md-4 mb-3">
            <div class="card h-100 border-0 shadow-sm master-loan-select-card animate__animated animate__fadeIn" 
                 style="cursor: pointer; border-left: 5px solid ${borderSideColor} !important; border-radius: 12px;"
                 data-id="${loan.LoanID}">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <small class="text-muted d-block" style="font-size: 10px;">LOAN ID | ණය අංකය</small>
                            <span class="fw-bold text-dark" style="font-size: 1.1rem;">${loan.LoanID}</span>
                        </div>
                        <span class="badge ${badgeClass} px-3 py-2 rounded-pill shadow-sm" style="font-size: 0.7rem;">${loan.LoanType}</span>
                    </div>
                    ${getLoanSpecificInfo(loan)}
                    
                    <div class="mt-2 p-2 rounded-3 bg-danger-subtle border border-danger border-opacity-25">
                         <small class="text-danger d-block fw-bold" style="font-size: 10px;">TOTAL OUTSTANDING | මුළු හිඟය</small>
                         <span class="text-danger fw-bold" style="font-size: 1rem;">Rs. ${totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>

                    <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <div>
                            <small class="text-muted d-block" style="font-size: 10px;">PRM NO</small>
                            <span class="fw-bold small">${loan.PRMNo || '---'}</span>
                        </div>
                        <div class="text-primary fw-bold" style="font-size: 0.8rem;">Select <i class="bi bi-arrow-right"></i></div>
                    </div>
                </div>
            </div>
        </div>`;
}

    // 2. SEARCH LOANS
    $('#btnSearchPaymentByLoanId').on('click', async function () {
        const searchText = $('#txtSearchPaymentLoanId').val().trim();
        if (!searchText) { notify.toast('Please enter ID/Name/NIC.', 'warning'); return; }

        try {
            const btn = $(this);
            btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');
            const results = await window.api.payment.searchSettlement(searchText);
            btn.prop('disabled', false).html('<i class="bi bi-search"></i>');

            if (results && results.length > 0) {
                resetUI();
                $('#noLoansMessage').addClass('d-none');
                const customer = results[0];
                $('#paymentCustomerName').text(customer.CustomerName);
                $('#paymentCustomerNic').text(customer.NIC);
                $('#paymentCustomerPhone').text(customer.CustomerPhone || '---');
                $('#customerPaymentInfoSection').removeClass('d-none');
                const masterContainer = $('#masterLoansContainer').empty();
                $('#masterLoansListArea').removeClass('d-none');
                const seenLoans = new Set();

                for (const loan of results) {
                if (!seenLoans.has(loan.LoanID)) {
                    seenLoans.add(loan.LoanID);

                    // API Call එක හරහා අදාළ Master Loan එකේ Total එක ගන්නවා
                    const res = await window.api.payment.getTotalOutstandingForMaster(loan.LoanID);
                    const totalDue = res.success ? res.totalOutstanding : 0;

                    // දැන් totalDue අගයත් සමඟ කාඩ් එක ඇඩ් කරනවා
                    masterContainer.append(renderMasterLoanCard(loan, totalDue));
                }
            }
                // results.forEach(loan => {
                //     if (!seenLoans.has(loan.LoanID)) {
                //         seenLoans.add(loan.LoanID);
                //         masterContainer.append(renderMasterLoanCard(loan));
                //     }
                // });
            } else {
                notify.alert('No active loans found.', 'Search Failed', 'error');
                resetUI();
            }
        } catch (error) {
            $('#btnSearchPaymentByLoanId').prop('disabled', false).html('<i class="bi bi-search"></i>');
            notify.alert('Error fetching data.', 'Error', 'error');
        }
    });

    // 3. SELECT MASTER LOAN
    $(document).on('click', '.master-loan-select-card', async function () {
        $('.master-loan-select-card').removeClass('shadow-lg border-primary').css('background', 'white');
        $(this).addClass('shadow-lg').css('background', '#f0f4ff');
        currentMasterLoanId = $(this).data('id');
        $('#paymentMasterLoanId').text(currentMasterLoanId);
        await loadSubLoans(currentMasterLoanId);
        $('#subLoansListSection').removeClass('d-none');
        $('#paymentProcessingArea, #paymentHistorySection').addClass('d-none');
    });

    // 4. LOAD SUB LOANS
    async function loadSubLoans(masterLoanId) {
        const container = $('#activeSubLoansContainer').empty();
        try {
            const response = await window.api.payment.getLoanWithSubLoans(masterLoanId);
            if (response && response.subLoans) {
                response.subLoans.forEach(sub => {
                    const arrearsVal = parseFloat(sub.CurrentArrears) || 0;
                    const isClosed = sub.DisbursementStatus === 'CLOSED';
                    const card = `<div class="col-md-6 mb-2">
                            <div class="list-group-item ${isClosed ? '' : 'list-group-item-action sub-loan-card'} p-3 border rounded-4 shadow-sm" 
                                 style="cursor: ${isClosed ? 'default' : 'pointer'}; border-right: 5px solid ${isClosed ? '#6c757d' : '#3b82f6'} !important; opacity: ${isClosed ? '0.7' : '1'};" 
                                 data-id="${sub.DisbursementID}" data-arrears="${arrearsVal}">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="fw-bold ${isClosed ? 'text-muted' : 'text-primary'}">SUB LOAN: ${sub.SubLoanNumber}</span>
                                    <span class="badge ${isClosed ? 'bg-secondary' : 'bg-success-subtle text-success'} rounded-pill">${sub.DisbursementStatus}</span>
                                </div>
                                <div class="row mt-3 g-2">
                                    <div class="col-6">
                                        <div class="small text-muted" style="font-size: 10px;">PRINCIPAL</div>
                                        <div class="fw-bold">Rs. ${parseFloat(sub.RemainingPrincipal).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                    </div>
                                    <div class="col-6 text-end">
                                        <div class="small text-muted" style="font-size: 10px;">ARREARS</div>
                                        <div class="fw-bold ${arrearsVal > 0 ? 'text-danger' : 'text-success'}">Rs. ${arrearsVal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    container.append(card);
                });
            }
        } catch (error) { notify.toast('Error loading sub loans.', 'error'); }
    }

    // 5. SELECT SUB LOAN
    $(document).on('click', '.sub-loan-card', function () {
        $('.sub-loan-card').removeClass('border-primary bg-light shadow active');
        $(this).addClass('border-primary bg-light shadow');
        selectedSubLoanId = $(this).data('id');
        if(!selectedSubLoanId) return;

        // Ensure arrearsVal is captured correctly from data attribute
        const currentArrears = parseFloat($(this).data('arrears')) || 0;
        fetchBreakdown(currentArrears);
        
        loadPaymentHistory(selectedSubLoanId);
        $('#paymentProcessingArea, #paymentHistorySection').removeClass('d-none');
        $('html, body').animate({ scrollTop: $("#paymentProcessingArea").offset().top - 100 }, 500);
    });

    // 6. FETCH BREAKDOWN
   async function fetchBreakdown(arrearsVal) {
    if (!selectedSubLoanId) return;
    
    // arrearsVal අංකයක් බව තහවුරු කර ගැනීම
    const currentArrears = parseFloat(arrearsVal) || 0;
    const customDate = $('#txtPaymentManualDate').val();
    
    $('#paymentChecklistBody').html('<tr><td colspan="3" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Calculating...</td></tr>');
    
    try {
        const data = await window.api.payment.getSubLoanBreakdown(selectedSubLoanId, customDate);
        if (data) {
            // මෙහිදී data object එකට arrearsAmount ඇතුළත් කිරීම
            data.arrearsAmount = currentArrears;
            renderChecklist(data);
        }
    } catch (error) { 
        console.error("Breakdown Error:", error);
        notify.toast('ගණනය කිරීමේ දෝෂයකි.', 'error'); 
        $('#paymentChecklistBody').empty();
    }
}
 // 7. RENDER CHECKLIST (Corrected Version)
function renderChecklist(data) {
    const tbody = $('#paymentChecklistBody').empty();
    let rows = "";
let formattedDate = '---';
    if (data.dbNextDueDate) {
        try {
            const dateVal = data.dbNextDueDate;
            // String නම් කෙලින්ම split, Date object නම් toISOString() කරලා split
            const rawStr = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
            formattedDate = rawStr.split('T')[0]; // "2024-01-31" විතරක් ගනී
        } catch (e) {
            formattedDate = 'Invalid Date';
        }
    }

    // Next Due Date පේළිය
    rows += `<tr class="table-dark">
                <td class="text-center"><i class="bi bi-calendar-event"></i></td>
                <td><span class="fw-bold text-white">Next Due Date | නියමිත දිනය</span></td>
                <td class="text-end fw-bold text-white">${formattedDate}</td>
              </tr>`;

    // 2. Past Arrears පේළිය
    if (data.arrearsAmount > 0) {
        rows += `<tr class="table-danger border-start border-danger border-5">
            <td class="text-center"><input type="checkbox" class="form-check-input chk-item" data-type="arrears" data-amount="${parseFloat(data.arrearsAmount).toFixed(2)}" checked></td>
            <td><span class="fw-bold">Past Arrears | පසුගිය හිඟය</span></td>
            <td class="text-end fw-bold text-danger">Rs. ${data.arrearsAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
        </tr>`;
    }

    // 3. Fixed Penalty පේළිය
    if (data.pastMonthsPenalty > 0) {
        rows += `<tr class="table-warning border-start border-warning border-5">
            <td class="text-center"><input type="checkbox" class="form-check-input chk-item" data-type="penalty" data-amount="${parseFloat(data.pastMonthsPenalty).toFixed(2)}" checked></td>
            <td><span class="fw-bold">Fixed Penalty | ස්ථාවර දඩය</span> <small class="text-muted">(${data.fullMonths} m)</small></td>
            <td class="text-end fw-bold text-warning">Rs. ${data.pastMonthsPenalty.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
        </tr>`;
    }

    // 4. Late Fee පේළිය
    if (data.currentMonthLateFee > 0) {
        rows += `<tr class="table-warning border-start border-warning border-5">
            <td class="text-center"><input type="checkbox" class="form-check-input chk-item" data-type="latefee" data-amount="${parseFloat(data.currentMonthLateFee).toFixed(2)}" checked></td>
            <td><span class="fw-bold">Late Fee | ප්‍රමාද ගාස්තුව</span> <small class="text-muted">(${data.lateDays} days)</small></td>
            <td class="text-end fw-bold text-warning">Rs. ${data.currentMonthLateFee.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
        </tr>`;
    }

    // 5. Interest Installments (වාරික)
    if (data.installments && Array.isArray(data.installments)) {
        data.installments.forEach(item => {
            rows += `<tr class="table-info border-start border-info border-5">
                <td class="text-center"><input type="checkbox" class="form-check-input chk-item" data-type="interest" data-amount="${parseFloat(item.amount).toFixed(2)}" checked></td>
                <td><span class="fw-bold">Interest Payment</span> <small class="text-muted">(${item.dateName})</small></td>
                <td class="text-end fw-bold text-primary">Rs. ${parseFloat(item.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
            </tr>`;
        });
    }

    tbody.append(rows);
    calculateTotal();
}

   // DATE CHANGE AUTO UPDATE
$('#txtPaymentManualDate').on('change', function() {
    if(selectedSubLoanId) {
        // sub-loan-card එකේ data-arrears ලෙස ගබඩා කර ඇති අගය ලබා ගැනීම
        const currentArrears = parseFloat($(`.sub-loan-card[data-id="${selectedSubLoanId}"]`).data('arrears')) || 0;
        
        // අලුත් දිනය සමඟ Breakdown එක නැවත Fetch කිරීම
        fetchBreakdown(currentArrears);
    }
});

    // 8. TOTAL CALCULATION (Fixed for Extra Payments)
    $(document).on('change', '.chk-item', calculateTotal);
    
    $('#txtPaymentAmount').on('input', function() {
        const val = parseFloat($(this).val()) || 0;
        $('#lblSelectedTotal').text(`Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    });

   function calculateTotal() {
    let totalRequired = 0;
    $('.chk-item:checked').each(function () { 
        totalRequired += (parseFloat($(this).data('amount')) || 0); 
    });
    
    totalRequired = Number(Math.round(totalRequired+'e2')+'e-2');
    $('#lblSelectedTotal').text(`Rs. ${totalRequired.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    
    // සැමවිටම තෝරාගත් වාරිකවල මුළු එකතුව input box එකට දමන්න
    // එවිට user ට අමතර මුදලක් (Extra Principal) එකතු කිරීමට අවශ්‍ය නම් පමණක් එය වෙනස් කළ හැක
    $('#txtPaymentAmount').val(totalRequired.toFixed(2));
}
  // 9. PAYMENT HISTORY LOAD
async function loadPaymentHistory(subLoanId) {
    const historyTableBody = $('#paymentHistoryTableBody');
    historyTableBody.html('<tr><td colspan="9" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Loading...</td></tr>');
    
    try {
        // preload.js හි ඇති නිවැරදි නම: getPaymentHistory
        const history = await window.api.payment.getPaymentHistory(subLoanId);
        historyTableBody.empty();

        if (history && history.length > 0) {
            history.forEach(row => {
                const isVoided = row.IsVoided === 1;
                const tr = `<tr class="${isVoided ? 'table-danger opacity-75' : ''}">
                    <td>${new Date(row.PaymentDate).toLocaleDateString()}</td>
                    <td class="fw-bold text-success">Rs. ${parseFloat(row.TotalPaid).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td><span class="badge bg-info text-dark">${row.MonthsCovered || 0}</span></td>
                    <td>${parseFloat(row.InterestPaid || 0).toLocaleString()}</td>
                    <td>${parseFloat((row.PenaltyPaid || 0) + (row.LateFeePaid || 0)).toLocaleString()}</td>
                    <td class="fw-bold text-primary">${parseFloat(row.PrincipalPaid || 0).toLocaleString()}</td>
                    <td class="text-danger">${parseFloat(row.BalanceArrears || 0).toLocaleString()}</td>
                    <td class="fw-bold">${parseFloat(row.BalancePrincipal || 0).toLocaleString()}</td>
                    <td>
                        <div class="d-flex justify-content-center gap-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.printReceipt('${row.PaymentID}')">
                                <i class="bi bi-printer"></i>
                            </button>
                            ${!isVoided ? `
                                <button class="btn btn-sm btn-outline-danger" onclick="voidPayment('${row.PaymentID}', '${subLoanId}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            ` : '<span class="badge bg-danger">VOIDED</span>'}
                        </div>
                    </td>
                </tr>`;
                historyTableBody.append(tr);
            });
        } else {
            historyTableBody.html('<tr><td colspan="9" class="text-center py-4 text-muted">No history found.</td></tr>');
        }
    } catch (error) {
        historyTableBody.html('<tr><td colspan="9" class="text-center text-danger">Error loading history.</td></tr>');
    }
}



$('#btnProcessPayment').on('click', async function () {
    const actualPaid = parseFloat($('#txtPaymentAmount').val()); 
    if (isNaN(actualPaid) || actualPaid <= 0) { 
        notify.toast('කරුණාකර වලංගු මුදලක් ඇතුළත් කරන්න.', 'warning'); 
        return; 
    }

    const confirmed = await notify.confirm(
        `රු. ${actualPaid.toLocaleString(undefined, {minimumFractionDigits: 2})} ක මුදලක් ගෙවීමට ඔබට අවශ්‍යද?`, 
        'ගෙවීම තහවුරු කරන්න'
    );
    if (!confirmed) return;

    try {
        const btn = $(this);
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>මතක තබා ගනිමින්...');

        const paymentData = {
            DisbursementID: selectedSubLoanId,
            LoanID: currentMasterLoanId,
            TotalPaid: actualPaid,
            InterestRequired: getCheckedAmount('interest'),
            ArrearsRequired: getCheckedAmount('arrears'),
            PenaltyRequired: getCheckedAmount('penalty'),
            LateFeeRequired: getCheckedAmount('latefee'),
            MonthsCovered: $(`.chk-item[data-type="interest"]:checked`).length,
            PaymentDate: $('#txtPaymentManualDate').val(),
            CollectedBy: localStorage.getItem('userId') || "U001"
        };

        const result = await window.api.payment.process(paymentData);
        
        if (result.success) {
            notify.toast('ගෙවීම සාර්ථකයි! ✅', 'success');
            btn.prop('disabled', false).html('Confirm Payment');
            
            // ✅ UI එක පමණක් refresh — page reload නෑ
            const refreshSubLoanId = selectedSubLoanId;
            
            // Sub loans නැවත load (updated arrears සමඟ)
            await loadSubLoans(currentMasterLoanId);
            
            // ටිකක් wait කරලා same card auto-select
            setTimeout(async () => {
                const card = $(`.sub-loan-card[data-id="${refreshSubLoanId}"]`);
                if (card.length) {
                    $('.sub-loan-card').removeClass('border-primary bg-light shadow');
                    card.addClass('border-primary bg-light shadow');
                    selectedSubLoanId = refreshSubLoanId;
                    const newArrears = parseFloat(card.data('arrears')) || 0;
                    await fetchBreakdown(newArrears);
                    await loadPaymentHistory(refreshSubLoanId);
                }
            }, 300);

        } else {
            btn.prop('disabled', false).html('Confirm Payment');
            notify.alert('දෝෂයකි: ' + result.error, 'Error', 'error');
        }
    } catch (err) {
        $(this).prop('disabled', false).html('Confirm Payment');
        notify.toast('පද්ධති දෝෂයකි.', 'error');
    }
});
    function getCheckedAmount(type) {
        let amt = 0;
        $(`.chk-item[data-type="${type}"]:checked`).each(function () { 
            amt += parseFloat($(this).data('amount')); 
        });
        return Number(Math.round(amt+'e2')+'e-2');
    }

    function resetUI() {
        $('#customerPaymentInfoSection, #masterLoansListArea, #subLoansListSection, #paymentProcessingArea, #paymentHistorySection').addClass('d-none');
        $('#noLoansMessage').removeClass('d-none');
        selectedSubLoanId = null;
        currentMasterLoanId = null;
        $('#txtPaymentAmount').val('');
    }

    $('#btnClearPayment').on('click', resetUI);
});

window.printReceipt = function(paymentId) {
    notify.toast('Printing... ID: ' + paymentId, 'info');
};

// 10. VOID PAYMENT (Updated Version)
async function voidPayment(paymentId, subLoanId) {
    const confirmed = await notify.confirm("මෙම ගෙවීම අවලංගු කිරීමට ඔබට සහතිකද?", "Confirm Void");
    if (!confirmed) return;

    try {
        // API call එකට පෙර notify එකක් පෙන්වීම අවශ්‍ය නම් පමණක්
        const result = await window.api.payment.voidPayment(paymentId);
        
        if (result && result.success) {
            notify.toast('ගෙවීම සාර්ථකව අවලංගු කරන ලදී. ✅', 'success');

            // 1. Master loan එක යටතේ ඇති sub loans නැවත load කරන්න (Arrears update කර ගැනීමට)
            const response = await window.api.payment.getLoanWithSubLoans(currentMasterLoanId);
            
            if (response && response.subLoans) {
                const updatedSubLoan = response.subLoans.find(s => s.DisbursementID == subLoanId);
                if (updatedSubLoan) {
                    const newArrears = parseFloat(updatedSubLoan.CurrentArrears) || 0;
                    
                    // Card එකේ data attribute එක සහ UI එක update කිරීම
                    const card = $(`.sub-loan-card[data-id="${subLoanId}"]`);
                    card.data('arrears', newArrears);
                    
                    // Arrears ගණන පෙන්වන UI label එක තිබේ නම් එයද update කරන්න
                    card.find('.text-danger').text(`Rs. ${newArrears.toLocaleString(undefined, {minimumFractionDigits: 2})}`);

                    // 2. අලුත් Arrears අගය සමඟ Checklist එක update කිරීම
                    await fetchBreakdown(newArrears);
                }
            }

            // 3. වගුව (History Table) Refresh කිරීම
            await loadPaymentHistory(subLoanId); 
            
        } else {
            // මෙහිදී result.error පවතී නම් පමණක් alert එක පෙන්වයි
            const errorMsg = result && result.error ? result.error : 'මෙම ගෙවීම අවලංගු කළ නොහැක. (මෙය අවසාන ගෙවීම නොවනවා විය හැක)';
            notify.alert(errorMsg, 'Void Failed', 'error');
        }
    } catch (err) {
        console.error("Void Error:", err);
        // ඇත්තටම code crash එකක් වුණොත් පමණක් මෙය පෙන්වයි
        notify.toast('පද්ධති දෝෂයකි. කරුණාකර නැවත උත්සාහ කරන්න.', 'error');
    }
}