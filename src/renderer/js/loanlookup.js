/**
 * Gagana Investment - Loan Lookup Renderer (Fully Optimized)
 * Includes: Status-based Styling for Active/Closed loans
 */

// --- DOM Elements ---
const txtSearch = document.getElementById('txtLookupSearch');
const btnSearch = document.getElementById('btnLookupSearch');
const resultsArea = document.getElementById('lookupResultsArea');
const detailsPane = document.getElementById('lookupDetailsPane');
const subLoansList = document.getElementById('lookupSubLoansList');
const historyTable = document.getElementById('vHistoryTable');
const beneficiariesList = document.getElementById('vBeneficiariesList');

// --- Helper Functions ---
const formatDate = (dateStr) => {
    if (!dateStr || dateStr === "0000-00-00" || dateStr === "null") return "තවමත් නැත";
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "තවමත් නැත" : date.toLocaleDateString('si-LK', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
};

const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
};

// --- 1. සෙවුම් ක්‍රියාවලිය (Search) ---
btnSearch.addEventListener('click', async () => {
    const query = txtSearch.value.trim();
    if (!query) return;

    resultsArea.innerHTML = `
        <div class="col-12 text-center p-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">දත්ත සොයමින් පවතී...</p>
        </div>`;
    
    if (detailsPane) detailsPane.classList.add('d-none');

    const response = await window.api.loanLookup.searchMaster(query);

    if (response.success && response.data.length > 0) {
        renderMasterCards(response.data);
    } else {
        resultsArea.innerHTML = `<div class="col-12 text-center p-5 text-muted">ප්‍රතිඵල හමු නොවීය.</div>`;
    }
});

// --- 2. Master Loan Cards Render කිරීම (සෙවුම් ප්‍රතිඵල) ---
function renderMasterCards(loans) {
    resultsArea.innerHTML = loans.map(loan => {
        const isClosed = loan.Status === 'CLOSED';
        
        // CSS Styles for Closed Loans
        const cardOpacity = isClosed ? 'opacity: 0.75; filter: grayscale(0.8);' : '';
        const borderStyle = isClosed ? 'border-left: 6px solid #64748b !important;' : 'border-left: 6px solid #1e293b !important;';
        const badgeClass = isClosed ? 'bg-secondary' : 'bg-success';

        return `
            <div class="col-md-4 mb-3">
                <div class="card border-0 shadow-sm h-100 hover-card animate__animated animate__fadeIn" 
                     onclick="loadFullAnalysis('${loan.LoanID}')" 
                     style="cursor:pointer; ${borderStyle} ${cardOpacity} transition: all 0.2s; position: relative; overflow: hidden;">
                    
                    ${isClosed ? '<div class="closed-ribbon">CLOSED</div>' : ''}

                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="badge bg-dark">${loan.LoanID}</span>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle">${loan.LoanType}</span>
                        </div>
                        
                        <h6 class="fw-bold mb-1 text-uppercase ${isClosed ? 'text-muted' : 'text-dark'}">${loan.CustomerName}</h6>
                        <div class="small text-muted mb-2">NIC: ${loan.NIC}</div>
                        
                        <div class="p-2 bg-light rounded-3 small">
                            <div class="d-flex justify-content-between">
                                <span class="text-muted">ලබාදුන් දිනය:</span>
                                <span class="fw-bold">${formatDate(loan.CreatedAt)}</span>
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="badge ${badgeClass} rounded-pill px-3">
                                ${loan.Status}
                            </span>
                            <i class="bi bi-arrow-right-circle-fill text-primary fs-5"></i>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// --- 3. සම්පූර්ණ විශ්ලේෂණය (Full Analysis) ලබා ගැනීම ---
window.loadFullAnalysis = async (loanId) => {
    if (detailsPane) detailsPane.classList.add('d-none');
    
    const response = await window.api.loanLookup.getFullAnalysis(loanId);

    if (response.success) {
        const data = response.data;
        
        // Summary Cards Update
        setVal('vTotalPayable', `Rs. ${data.summary.grandTotalPayable.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
        setVal('vLoanTypeDisplay', data.master.LoanType);
        setVal('vSubLoanCount', data.subLoans.length);
        
        // Customer Info
        setVal('vCustName', data.master.CustomerName);
        setVal('vCustNic', data.master.NIC);
        setVal('vCustPhone', data.master.CustomerPhone);
        setVal('vCustAddress', data.master.CustomerAddress);

        // Date Info
        const firstSub = data.subLoans[0];
        setVal('vLoanStartDate', formatDate(firstSub ? firstSub.DisbursedDate : data.master.CreatedAt));
        setVal('vLastPayDate', formatDate(data.master.LastPaymentDate));
        
        // Next Due Date (Logic to handle closed/active)
        const activeSub = data.subLoans.find(s => s.DisbursementStatus === 'ACTIVE');
        setVal('vNextDueDate', activeSub ? formatDate(activeSub.NextDueDate) : 'සියල්ල පියවා ඇත');

        // Render Lists
        renderSubLoanCards(data.subLoans);
        renderHistoryTable(data.history);
        renderAssetDetails(data.assets, data.master.LoanType);
        renderBeneficiaries(data.beneficiaries); 

        if (detailsPane) {
            detailsPane.classList.remove('d-none');
            detailsPane.scrollIntoView({ behavior: 'smooth' });
        }
    } else {
        alert("දත්ත ලබාගැනීම අසාර්ථකයි: " + response.error);
    }
};

function renderSubLoanCards(subs) {
    if (!subLoansList) return;
    subLoansList.innerHTML = subs.map(sub => {
        const isClosed = sub.DisbursementStatus === 'CLOSED';
        const isOverdue = sub.overdueDays > 0;

        return `
            <div class="col-md-6 mb-3">
                <div class="card border-0 shadow-sm rounded-4 h-100 border-start border-5 ${isClosed ? 'border-secondary' : (isOverdue ? 'border-danger' : 'border-warning')}">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge bg-dark mb-1">ID: ${sub.DisbursementID}</span>
                                <h6 class="fw-bold mb-0">වාරිකය #${sub.SubLoanNumber}</h6>
                            </div>
                            <span class="badge ${isClosed ? 'bg-secondary' : (isOverdue ? 'bg-danger' : 'bg-success')}">
                                ${isClosed ? 'CLOSED' : (isOverdue ? 'OVERDUE' : 'ACTIVE')}
                            </span>
                        </div>

                        <div class="row g-2 mt-2">
                            <div class="col-6">
                                <small class="text-muted d-block">මූලධන ශේෂය</small>
                                <span class="fw-bold text-primary">Rs. ${parseFloat(sub.RemainingPrincipal).toLocaleString()}</span>
                            </div>
                            <div class="col-6 text-end">
                                <small class="text-muted d-block">මුළු හිඟය</small>
                                <span class="fw-bold text-danger">Rs. ${sub.totalArrearsToPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <hr class="my-2 opacity-25">

                        <div class="p-2 bg-light rounded-3 small">
                            <div class="d-flex justify-content-between mb-1">
                                <span>වත්මන් පොළිය:</span>
                                <span class="fw-bold">Rs. ${sub.interestDue.toFixed(2)}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1 text-danger">
                                <span>ප්‍රමාද ගාස්තු:</span>
                                <span>Rs. ${sub.penaltyDue.toFixed(2)}</span>
                            </div>
                            <div class="d-flex justify-content-between border-top pt-1 mt-1 text-dark">
                                <span>පසුගිය හිඟ (Arrears):</span>
                                <span class="fw-bold">Rs. ${sub.pastArrears.toFixed(2)}</span>
                            </div>
                        </div>

                        <div class="mt-2 small text-muted">
                            <i class="bi bi-calendar-event me-1"></i> මීළඟ වාරික දිනය: <b>${formatDate(sub.NextDueDate)}</b>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// --- 5. ඇපකරුවන් පෙන්වීම (Beneficiaries) ---
function renderBeneficiaries(benefs) {
    if (!beneficiariesList) return;
    if (!benefs || benefs.length === 0) {
        beneficiariesList.innerHTML = '<div class="small text-muted p-3 text-center border rounded-3">ඇපකරුවන් සඳහන් කර නැත.</div>';
        return;
    }
    beneficiariesList.innerHTML = benefs.map(b => `
        <div class="d-flex align-items-center p-3 mb-2 border rounded-3 bg-white shadow-sm">
            <div class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                <i class="bi bi-person-check-fill fs-5"></i>
            </div>
            <div class="flex-grow-1">
                <div class="fw-bold text-dark">${b.Name}</div>
                <div class="text-muted small">
                    <i class="bi bi-phone me-1"></i>${b.Phone} 
                    <span class="mx-2">|</span>
                    <i class="bi bi-geo-alt me-1"></i>${b.Address || 'ලිපිනයක් නැත'}
                </div>
            </div>
        </div>
    `).join('');
}

function renderHistoryTable(history) {
    if (!historyTable) return;

    if (!history || history.length === 0) {
        historyTable.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-muted">ගෙවීම් වාර්තා වී නොමැත.</td></tr>`;
        return;
    }

    historyTable.innerHTML = history.map(h => {
        const totalPaid = parseFloat(h.TotalPaid) || 0;
        const arrearsSettled = parseFloat(h.ArrearsSettled) || 0;
        const totalPenalty = (parseFloat(h.PenaltyPaid) || 0) + (parseFloat(h.LateFeePaid) || 0);
        const interestPaid = parseFloat(h.InterestPaid) || 0;
        const principalPaid = parseFloat(h.PrincipalPaid) || 0;
        
        // Sub Loan ID eka (Me nama obe database column name ekata anuwa wenas karanna)
        const subLoanId = h.DisbursementID || h.SubLoanID || 'N/A';

        return `
            <tr>
                <td class="ps-3 fw-bold text-muted">${formatDate(h.PaymentDate)}</td>
                <td><span class="badge bg-light text-dark border">${subLoanId}</span></td> <td class="fw-bold text-dark">Rs. ${totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-warning text-end">Rs. ${arrearsSettled.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-danger text-end">Rs. ${totalPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-info text-end">Rs. ${interestPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="bg-light fw-bold text-end text-success">Rs. ${principalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    }).join('');
}

// --- 7. ඇප විස්තර (Asset Details) ---
function renderAssetDetails(asset, type) {
    const area = document.getElementById('vAssetDetailsArea');
    const content = document.getElementById('vAssetDetailsContent');
    if (!asset || !area) { if(area) area.classList.add('d-none'); return; }

    area.classList.remove('d-none');
    let html = '';
    if (type === 'VEHICLE') {
        html = `
            <div class="d-flex align-items-center gap-3">
                <div class="bg-dark text-white p-2 rounded-3 text-center" style="min-width: 100px;">
                    <small class="d-block opacity-75">Vehicle No</small>
                    <span class="fw-bold">${asset.VehicleNumber}</span>
                </div>
                <div>
                    <div class="fw-bold text-dark small">${asset.OwnerName}</div>
                    <div class="text-muted small">${asset.VehicleType} | Limit: Rs. ${parseFloat(asset.LoanLimit || 0).toLocaleString()}</div>
                </div>
            </div>`;
    } else if (type === 'LAND') {
        html = `<div class="fw-bold text-dark">${asset.LandNumber}</div><div class="small text-muted">${asset.Location} | Size: ${asset.Size}</div>`;
    } else {
        html = `<div class="small text-muted"><i class="bi bi-shield-lock-fill me-2"></i>ඇප විස්තර පද්ධතියේ සුරක්ෂිතව පවතී.</div>`;
    }
    content.innerHTML = html;
}