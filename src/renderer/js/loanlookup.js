/**
 * Gagana Investment - Loan Lookup Controller
 * පාරිභෝගික ණය විශ්ලේෂණ පාලක
 */

document.addEventListener('DOMContentLoaded', () => {
    const txtLookupSearch = document.getElementById('txtLookupSearch');
    const btnLookupSearch = document.getElementById('btnLookupSearch');

    if (btnLookupSearch) {
        btnLookupSearch.addEventListener('click', async () => {
            const query = txtLookupSearch.value.trim();
            if (!query) return;

            btnLookupSearch.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btnLookupSearch.disabled = true;

            try {
                const customers = await window.api.customer.search(query);
                
                if (customers && customers.length > 0) {
                    const customer = customers[0];

                    if (customer.IsBlacklisted === 1) {
                        await notify.confirm(
                            `මෙම පාරිභෝගිකයා (${customer.CustomerName}) අසාදු ලේඛනගත කර ඇත. විස්තර බැලීම තහනම්ය.`,
                            'අවහිර කළ පාරිභෝගිකයෙකි',
                            { confirmText: 'හරි', showCancelButton: false, confirmColor: '#ef4444' }
                        );
                        resetLookupUI();
                        return;
                    }
                    
                    const res = await window.api.loanLookup.getCustomerLoans(customer.CustomerID);
                    
                    if (res.success) {
                        // පාරිභෝගික විස්තර පිරවීම
                        document.getElementById('vCustName').innerText = customer.CustomerName || '-';
                        document.getElementById('vCustNic').innerText = customer.NIC || '-';
                        document.getElementById('vCustPhone').innerText = customer.CustomerPhone || '-';
                        document.getElementById('vCustAddress').innerText = customer.CustomerAddress || '-';

                        renderLoanList(res.loans);
                    }
                } else {
                    notify.toast("පාරිභෝගිකයා හමු නොවීය.", "error");
                    resetLookupUI();
                }
            } catch (err) {
                console.error("Search Error:", err);
                notify.toast("සෙවීමේදී දෝෂයක් සිදු විය.", "error");
            } finally {
                btnLookupSearch.innerHTML = 'සොයන්න';
                btnLookupSearch.disabled = false;
            }
        });
    }
});

/**
 * දිනය සහ වෙලාව සකසන ශ්‍රිතය (Format: 2025.01.12 10.30 a.m)
 */
function formatCustomDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);

    // දිනය: YYYY.MM.DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // වෙලාව: HH.MM a.m/p.m
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m' : 'a.m';

    hours = hours % 12;
    hours = hours ? hours : 12; // පැය 0 නම් 12 ලෙස පෙන්වන්න

    return `${year}.${month}.${day} ${hours}.${minutes} ${ampm}`;
}

function renderLoanList(loans) {
    const lookupLoanList = document.getElementById('lookupLoanList');
    if (!loans || loans.length === 0) {
        lookupLoanList.innerHTML = '<div class="p-4 text-center text-muted">ණය කිසිවක් හමු නොවීය.</div>';
        return;
    }

    lookupLoanList.innerHTML = loans.map(loan => {
        const isActive = loan.Status === 'ACTIVE';
        return `
            <button class="list-group-item list-group-item-action py-3 border-start border-4 ${isActive ? 'border-success' : 'border-secondary'}" 
                    onclick="loadLoanFullAnalysis('${loan.LoanID}')">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">ID: ${loan.LoanID}</div>
                        <small class="text-muted">${loan.LoanType} - Rs. ${parseFloat(loan.LoanAmount).toLocaleString()}</small>
                    </div>
                    <span class="badge rounded-pill ${isActive ? 'bg-success' : 'bg-secondary'}">${loan.Status}</span>
                </div>
            </button>`;
    }).join('');
}

/**
 * 3. තෝරාගත් ණයේ සම්පූර්ණ විශ්ලේෂණය පෙන්වීම
 */
async function loadLoanFullAnalysis(loanId) {
    const lookupDetailsPane = document.getElementById('lookupDetailsPane');
    
    try {
        const res = await window.api.loanLookup.getDetails(loanId);

        if (res.success) {
            const d = res.data;

            // --- 1. මූල්‍ය දත්ත (Financial Stats) ---
            document.getElementById('vLoanAmt').innerText = `Rs. ${d.financials.originalAmount.toLocaleString()}`;
            
            const arrearsLbl = document.getElementById('vArrearsMonths');
            arrearsLbl.innerText = `${d.overdue.months} Months`;
            arrearsLbl.className = d.overdue.months > 0 ? 'fw-bold mb-0 text-danger' : 'fw-bold mb-0 text-success';

            document.getElementById('vOverdueDays').innerText = `${d.overdue.days} Days`;
            document.getElementById('vTotalPayable').innerText = `Rs. ${d.financials.totalPayableNow.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

            // දින වකවානු යාවත්කාලීන කිරීම (New Format)
            document.getElementById('vDueDate').innerText = d.dates.nextDueDate ? formatCustomDateTime(d.dates.nextDueDate) : 'N/A';
            document.getElementById('vGivenDate').innerText = formatCustomDateTime(d.dates.issuedDate);
            document.getElementById('vIntRate').innerText = `Rs. ${d.financials.monthlyInterest.toLocaleString()}`;
            
            const lastPaidLabel = document.getElementById('vLastPaidDate');
            lastPaidLabel.innerText = d.dates.lastPaymentDate ? formatCustomDateTime(d.dates.lastPaymentDate) : 'No Payments Yet';

            // --- 2. ඇප වත්කම් විස්තර (Asset Specifics) ---
            const assetArea = document.getElementById('vAssetDetailsArea');
            const assetContent = document.getElementById('vAssetDetailsContent');
            
            if (d.specifics) {
                assetArea.classList.remove('d-none');
                let html = '<div class="row">';
                for (const [key, value] of Object.entries(d.specifics)) {
                    if (key !== 'LoanID' && key !== 'ID' && value) {
                        html += `
                            <div class="col-md-4 mb-2">
                                <small class="text-muted d-block text-capitalize">${key.replace(/([A-Z])/g, ' $1')}</small>
                                <span class="fw-bold">${value}</span>
                            </div>`;
                    }
                }
                html += '</div>';
                assetContent.innerHTML = html;
            } else {
                assetArea.classList.add('d-none');
            }

            // --- 3. ඇපකරුවන්ගේ විස්තර (Beneficiaries) ---
            const benArea = document.getElementById('vBeneficiaryArea');
            const benTable = document.getElementById('vBeneficiaryTable');
            
            if (d.beneficiaries && d.beneficiaries.length > 0) {
                benArea.classList.remove('d-none');
                benTable.innerHTML = d.beneficiaries.map(b => `
                    <tr>
                        <td class="ps-3 fw-bold">${b.Name}</td>
                        <td>${b.Phone || '-'}</td>
                        <td><small>${b.Address || '-'}</small></td>
                    </tr>
                `).join('');
            } else {
                benArea.classList.add('d-none');
            }

            // --- 4. Alert Notes ---
            const notesArea = document.getElementById('vLoanNotes');
            if (d.overdue.days > 0 || d.overdue.months > 0) {
                notesArea.innerHTML = `
                    <div class="alert alert-danger border-0 shadow-sm rounded-4">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <strong>ප්‍රමාද දැනුම්දීම:</strong> මෙම ණය මුදල සඳහා ${d.overdue.statusNote} ඇත. (ප්‍රමාද දින: ${d.overdue.days})
                    </div>`;
            } else {
                notesArea.innerHTML = `<div class="alert alert-success border-0 shadow-sm rounded-4"><i class="bi bi-check-circle-fill me-2"></i> මෙම ණය මුදල නිවැරදිව පවත්වාගෙන යයි.</div>`;
            }

           // --- 5. ගෙවීම් ඉතිහාසය (History Table - Improved) ---
const historyTableBody = document.getElementById('vHistoryTable');

if (d.history && d.history.length > 0) {
    historyTableBody.innerHTML = d.history.map(row => {
        // අගයන් තිබේදැයි පරීක්ෂා කර නොමැති නම් 0 ලෙස ගැනීම (Error වැලැක්වීමට)
        const paid = parseFloat(row.PaidAmount || 0);
        const penalty = parseFloat(row.PenaltyPaid || 0);
        const interest = parseFloat(row.InterestPaid || 0);
        const capital = parseFloat(row.CapitalPaid || 0);
        
        // පේළියේ වර්ණය: පියවීමක් (Settlement) නම් වෙනස් පැහැයක් දීමට අවශ්‍ය නම්
        const rowClass = (row.PaymentType === 'SETTLEMENT') ? 'table-info' : '';

        return `
            <tr class="${rowClass}">
                <td>
                    <span class="badge bg-light text-dark border">
                        ${formatCustomDateTime(row.PaymentDate)}
                    </span>
                    ${row.PaymentType === 'SETTLEMENT' ? '<br><small class="badge bg-danger">Settled</small>' : ''}
                </td>
                <td class="fw-bold text-success">Rs. ${paid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-danger">Rs. ${penalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>Rs. ${interest.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="fw-bold bg-light">Rs. ${capital.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    }).join('');
} else {
    historyTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">ගෙවීම් ඉතිහාසයක් නොමැත.</td></tr>';
}

            lookupDetailsPane.classList.remove('d-none');
            lookupDetailsPane.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        console.error("Analysis Error:", err);
        notify.toast("විශ්ලේෂණ දත්ත ලබා ගැනීමේ දෝෂයකි.", "error");
    }
}

// පැරණි function එක නව format එකට map කිරීම
function formatDateOnly(dateString) {
    return formatCustomDateTime(dateString);
}

function resetLookupUI() {
    document.getElementById('lookupLoanList').innerHTML = '';
    document.getElementById('lookupDetailsPane').classList.add('d-none');
    const notesArea = document.getElementById('vLoanNotes');
    if(notesArea) notesArea.innerHTML = '';
}