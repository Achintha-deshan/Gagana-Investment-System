/**
 * Gagana Investment - Loan Lookup Controller
 * පාරිභෝගික ණය විශ්ලේෂණ පාලක
 */

document.addEventListener('DOMContentLoaded', () => {
    const txtLookupSearch = document.getElementById('txtLookupSearch');
    const btnLookupSearch = document.getElementById('btnLookupSearch');
    const lookupLoanList = document.getElementById('lookupLoanList');
    const lookupDetailsPane = document.getElementById('lookupDetailsPane');

    // 1. සෙවුම් බොත්තම ක්‍රියාත්මක කිරීම
    if (btnLookupSearch) {
        btnLookupSearch.addEventListener('click', async () => {
            const query = txtLookupSearch.value.trim();
            if (!query) return;

            // සෙවීමේදී පාලකය සක්‍රීය කිරීම
            btnLookupSearch.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btnLookupSearch.disabled = true;

            try {
                const customers = await window.api.customer.search(query);
                
                if (customers && customers.length > 0) {
                    const customer = customers[0];

                    // පාරිභෝගිකයා Blacklist ද කියා බැලීම
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
 * 2. වම්පස ඇති ණය ලැයිස්තුව (Loan List) පෙන්වීම
 */
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

            // ප්‍රධාන සංඛ්‍යාලේඛන
            document.getElementById('vLoanAmt').innerText = `Rs. ${d.financials.originalAmount.toLocaleString()}`;
            
            // Arrears (හිඟ) මාස ගණන පෙන්වීම සහ වර්ණය වෙනස් කිරීම
            const arrearsLbl = document.getElementById('vArrearsMonths');
            arrearsLbl.innerText = `${d.overdue.months} Months`;
            arrearsLbl.className = d.overdue.months > 0 ? 'fw-bold mb-0 text-danger' : 'fw-bold mb-0 text-success';

            // පරක්කු දින ගණන
            document.getElementById('vOverdueDays').innerText = `${d.overdue.days} Days`;
            
            // මුළු හිඟ මුදල
            document.getElementById('vTotalPayable').innerText = `Rs. ${d.financials.totalPayableNow.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

            // දින වකවානු සහ පොලිය
            document.getElementById('vDueDate').innerText = d.dates.nextDueDate ? formatDateOnly(d.dates.nextDueDate) : 'N/A';
            document.getElementById('vGivenDate').innerText = formatDateOnly(d.dates.issuedDate);
            document.getElementById('vIntRate').innerText = `Rs. ${d.financials.monthlyInterest.toLocaleString()}`;
            
            const lastPaidLabel = document.getElementById('vLastPaidDate');
            lastPaidLabel.innerText = d.dates.lastPaymentDate ? formatDateOnly(d.dates.lastPaymentDate) : 'No Payments Yet';

            // Alert Notes කොටස
            const notesArea = document.getElementById('vLoanNotes');
            if (d.overdue.days > 0 || d.overdue.months > 0) {
                notesArea.innerHTML = `
                    <div class="alert alert-danger border-0 shadow-sm rounded-4">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <strong>අවධානයට:</strong> මෙම ණය මුදල මාස ${d.overdue.months} ක් සහ දින ${d.overdue.days} ක් ප්‍රමාද වී ඇත.
                    </div>`;
            } else {
                notesArea.innerHTML = `<div class="alert alert-success border-0 shadow-sm rounded-4"><i class="bi bi-check-circle-fill me-2"></i> මෙම ණය මුදල නිවැරදිව පවත්වාගෙන යයි.</div>`;
            }

            // ගෙවීම් ඉතිහාසය Table එක (දිනය විතරක් පෙන්වයි)
            const historyTableBody = document.getElementById('vHistoryTable');
            if (d.history && d.history.length > 0) {
                historyTableBody.innerHTML = d.history.map(row => `
                    <tr>
                        <td><span class="badge bg-light text-dark border">${formatDateOnly(row.PaymentDate)}</span></td>
                        <td class="fw-bold text-success">Rs. ${parseFloat(row.PaidAmount).toLocaleString()}</td>
                        <td class="text-danger">Rs. ${parseFloat(row.PenaltyPaid).toLocaleString()}</td>
                        <td>Rs. ${parseFloat(row.InterestPaid).toLocaleString()}</td>
                        <td class="fw-bold bg-light">Rs. ${parseFloat(row.CapitalPaid).toLocaleString()}</td>
                    </tr>
                `).join('');
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

/**
 * දිනය සහ වෙලාවෙන් දිනය පමනක් (YYYY-MM-DD) වෙන් කර ගැනීම
 */
function formatDateOnly(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    // en-CA format එකෙන් YYYY-MM-DD ලෙස දිනය ලැබේ
    return date.toLocaleDateString('en-CA');
}

/**
 * UI එක මුල් තත්වයට පත් කිරීම
 */
function resetLookupUI() {
    document.getElementById('lookupLoanList').innerHTML = '';
    document.getElementById('lookupDetailsPane').classList.add('d-none');
    const notesArea = document.getElementById('vLoanNotes');
    if(notesArea) notesArea.innerHTML = '';
}