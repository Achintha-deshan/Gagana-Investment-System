document.addEventListener('DOMContentLoaded', () => {
    const txtLookupSearch = document.getElementById('txtLookupSearch');
    const btnLookupSearch = document.getElementById('btnLookupSearch');
    const lookupLoanList = document.getElementById('lookupLoanList');
    const lookupDetailsPane = document.getElementById('lookupDetailsPane');

    if (btnLookupSearch) {
        btnLookupSearch.addEventListener('click', async () => {
            const query = txtLookupSearch.value.trim();
            if (!query) return;

            // 1. පාරිභෝගිකයා සෙවීම
            const customers = await window.api.customer.search(query);

            if (customers && customers.length > 0) {
                const customer = customers[0];

                // 🛑 Blacklist Check
                if (customer.IsBlacklisted === 1) {
                    await notify.confirm(
                        `මෙම පාරිභෝගිකයා (${customer.CustomerName}) අසාදු ලේඛනගත කර ඇත. විස්තර බැලීම සීමා කර ඇත.`,
                        'අවහිර කළ පාරිභෝගිකයෙකි',
                        { confirmText: 'හරි', showCancelButton: false, confirmColor: '#ef4444' }
                    );
                    resetLookupUI();
                    return;
                }
                
                const res = await window.api.loanLookup.getCustomerLoans(customer.CustomerID);
                
                if (res.success) {
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
        });
    }

    function renderLoanList(loans) {
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
                            <div class="fw-bold">${loan.LoanID}</div>
                            <small class="text-muted">${loan.LoanType} - Rs. ${parseFloat(loan.LoanAmount).toLocaleString()}</small>
                        </div>
                        <span class="badge rounded-pill ${isActive ? 'bg-success' : 'bg-secondary'}">${loan.Status}</span>
                    </div>
                </button>`;
        }).join('');
    }
});

// 3. ණය විශ්ලේෂණය පෙන්වීම
async function loadLoanFullAnalysis(loanId) {
    const lookupDetailsPane = document.getElementById('lookupDetailsPane');
    const res = await window.api.loanLookup.getDetails(loanId);

    if (res.success) {
        const d = res.data;

        // දත්ත ලබා ගැනීම
        const arrearsMonths = d.overdue?.months ?? 0;
        const overdueDays = d.overdue?.days ?? 0;
        const penaltyAmount = d.overdue?.penaltyDue ?? 0;
        const totalPayable = d.financials.totalPayableNow ?? 0;

        // UI පිරවීම
        document.getElementById('vLoanAmt').innerText = `Rs. ${parseFloat(d.financials.originalAmount).toLocaleString()}`;
        document.getElementById('vArrearsMonths').innerText = `${arrearsMonths} Months`;
        document.getElementById('vOverdueDays').innerText = `${overdueDays} Days`;
        
        // අලුත් Label එක - දැනට ගෙවිය යුතු මුළු හිඟය (Arrears + Penalty)
        const vTotalPayableLabel = document.getElementById('vTotalPayable');
        vTotalPayableLabel.innerText = `Rs. ${parseFloat(totalPayable).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        
        // Notes කොටස සැකසීම
        const notesArea = document.getElementById('vLoanNotes');
        if(notesArea) {
            if (arrearsMonths > 0 || overdueDays > 0) {
                notesArea.innerHTML = `
                    <div class="alert alert-warning mb-0">
                        <strong>විශේෂ සටහන:</strong> මෙම ණය මුදල මාස ${arrearsMonths} ක් සහ දින ${overdueDays} ක් ප්‍රමාද වී ඇත. 
                        එකතු වී ඇති මුළු දඩ මුදල <strong>Rs. ${penaltyAmount.toLocaleString()}</strong> කි. 
                        අද දිනට ණය පියවීමට නම් අවම වශයෙන් <strong>Rs. ${totalPayable.toLocaleString()}</strong> ක මුදලක් අය කරගත යුතුය.
                    </div>`;
            } else {
                notesArea.innerHTML = `<div class="alert alert-success mb-0">මෙම ණය මුදල නිවැරදිව ගෙවා ඇත. හිඟ මුදල් නොමැත.</div>`;
            }
        }

        // වැඩිදුර තොරතුරු
        document.getElementById('vDueDate').innerText = d.dates.nextDueDate ? new Date(d.dates.nextDueDate).toLocaleDateString() : 'N/A';
        document.getElementById('vLastPaidDate').innerText = d.dates.lastPaymentDate ? new Date(d.dates.lastPaymentDate).toLocaleDateString() : 'No Payments';
        document.getElementById('vGivenDate').innerText = new Date(d.dates.issuedDate).toLocaleDateString();
        document.getElementById('vIntRate').innerText = `Rs. ${parseFloat(d.financials.monthlyInterest).toLocaleString()}`;

        // ගෙවීම් ඉතිහාසය
        const historyTableBody = document.getElementById('vHistoryTable');
        if (d.history && d.history.length > 0) {
            historyTableBody.innerHTML = d.history.map(row => `
                <tr>
                    <td>${new Date(row.PaymentDate).toLocaleDateString()}</td>
                    <td class="fw-bold text-success">Rs. ${parseFloat(row.PaidAmount).toLocaleString()}</td>
                    <td class="text-danger">Rs. ${parseFloat(row.PenaltyPaid).toLocaleString()}</td>
                    <td>Rs. ${parseFloat(row.InterestPaid).toLocaleString()}</td>
                    <td class="fw-bold">Rs. ${parseFloat(row.CapitalPaid).toLocaleString()}</td>
                </tr>
            `).join('');
        } else {
            historyTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">කිසිදු ගෙවීමක් කර නොමැත.</td></tr>';
        }

        lookupDetailsPane.classList.remove('d-none');
        lookupDetailsPane.scrollIntoView({ behavior: 'smooth' });
    } else {
        notify.toast("දත්ත ලබා ගැනීමට නොහැක: " + res.message, "error");
    }
}

function resetLookupUI() {
    document.getElementById('lookupLoanList').innerHTML = '';
    document.getElementById('lookupDetailsPane').classList.add('d-none');
    const notesArea = document.getElementById('vLoanNotes');
    if(notesArea) notesArea.innerHTML = '';
}