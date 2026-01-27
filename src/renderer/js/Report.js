/**
 * 📊 Report Management Logic
 * පියවීම් සහ හිඟ මුදල් වාර්තා මෙහෙයවීම
 */

// 1. පිටුව Load වන විට Summary Cards update කිරීම
async function updateReportSummary() {
    try {
        const summary = await window.api.reports.getSummary();
        
        // UI එකේ ඇති ID සමඟ ගැලපේදැයි බලන්න
        const arrearsEl = document.getElementById('lblTotalArrears');
        const collectionEl = document.getElementById('lblTodayCollection');
        const activeCountEl = document.getElementById('lblActiveLoansCount');

        if (arrearsEl) arrearsEl.innerText = `රු. ${parseFloat(summary.totalArrears).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        if (collectionEl) collectionEl.innerText = `රු. ${parseFloat(summary.todayCollection).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        if (activeCountEl) activeCountEl.innerText = summary.activeLoansCount;
    } catch (error) {
        console.error("Summary Update Error:", error);
    }
}

// 2. වාර්තා ජනනය කිරීමේ ප්‍රධාන ශ්‍රිතය
async function handleGenerateReport() {
    const reportType = document.getElementById('cmbReportType').value;
    const fromDate = document.getElementById('dtpFromDate').value;
    const toDate = document.getElementById('dtpToDate').value;
    const tableBody = document.getElementById('tblReportContent');
    const headerRow = document.getElementById('reportHeader');

    // Loading එකක් පෙන්වීම
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2 text-muted">දත්ත සකසමින් පවතී, කරුණාකර රැඳී සිටින්න...</p>
            </td>
        </tr>`;

    try {
        let reportData = [];

        // --- A. හිඟ වාරික වාර්තාව (Arrears) ---
        if (reportType === 'arrears') {
            headerRow.innerHTML = `
                <th class="py-3 px-4">Loan ID</th>
                <th class="py-3 px-4">Customer Name</th>
                <th class="py-3 px-4 text-end">Loan Amount</th>
                <th class="py-3 px-4">Next Due Date</th>
                <th class="py-3 px-4 text-center">Delay Days</th>
                <th class="py-3 px-4 text-center">Action</th>`;

            reportData = await window.api.reports.getArrears();

            tableBody.innerHTML = reportData.map(item => `
                <tr>
                    <td class="px-4"><span class="badge bg-light text-dark border">${item.LoanID}</span></td>
                    <td class="px-4">
                        <div class="fw-bold text-dark">${item.CustomerName}</div>
                        <small class="text-muted"><i class="fas fa-phone-alt me-1 small"></i>${item.CustomerPhone || 'N/A'}</small>
                    </td>
                    <td class="px-4 text-end fw-bold text-danger">Rs. ${parseFloat(item.LoanAmount).toLocaleString()}</td>
                    <td class="px-4 text-muted">${new Date(item.NextDueDate).toLocaleDateString()}</td>
                    <td class="px-4 text-center">
                        <span class="badge bg-danger rounded-pill px-3">${item.DelayDays} Days</span>
                    </td>
                    <td class="px-4 text-center">
                        <button class="btn btn-sm btn-primary rounded-pill px-3" onclick="viewLoanDetails('${item.LoanID}')">
                            <i class="fas fa-eye me-1"></i> View
                        </button>
                    </td>
                </tr>
            `).join('');
        } 

        // --- B. මුදල් එකතු කිරීමේ වාර්තාව (Collection) ---
        else if (reportType === 'collection') {
            if (!fromDate || !toDate) {
                alert("කරුණාකර ආරම්භක සහ අවසාන දිනයන් තෝරන්න!");
                return;
            }

            headerRow.innerHTML = `
                <th class="py-3 px-4">Payment Date</th>
                <th class="py-3 px-4">Loan ID</th>
                <th class="py-3 px-4">Customer</th>
                <th class="py-3 px-4 text-end">Paid Amount</th>
                <th class="py-3 px-4 text-center">Breakdown</th>
                <th class="py-3 px-4 text-center">Action</th>`;

            reportData = await window.api.reports.getCollection({ start: fromDate, end: toDate });

            tableBody.innerHTML = reportData.map(item => `
                <tr>
                    <td class="px-4">${new Date(item.PaymentDate).toLocaleDateString()}</td>
                    <td class="px-4"><span class="text-primary fw-bold">${item.LoanID}</span></td>
                    <td class="px-4 text-dark">${item.CustomerName}</td>
                    <td class="px-4 text-end fw-bold text-success">Rs. ${parseFloat(item.PaidAmount).toLocaleString()}</td>
                    <td class="px-4 text-center small">
                        <span class="text-muted">Int: ${item.InterestPaid}</span> | 
                        <span class="text-muted">Cap: ${item.CapitalPaid}</span>
                    </td>
                    <td class="px-4 text-center">
                        <button class="btn btn-sm btn-outline-secondary" title="Print Receipt">
                            <i class="fas fa-print"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // --- C. පියවා අවසන් කළ ණය (Settled) ---
        else if (reportType === 'settled') {
             if (!fromDate || !toDate) {
                alert("කරුණාකර දින පරාසය තෝරන්න!");
                return;
            }

            headerRow.innerHTML = `
                <th class="py-3 px-4">Settled Date</th>
                <th class="py-3 px-4">Loan ID</th>
                <th class="py-3 px-4">Customer</th>
                <th class="py-3 px-4">Type</th>
                <th class="py-3 px-4 text-end">Final Amount</th>
                <th class="py-3 px-4 text-center">Status</th>`;

            reportData = await window.api.reports.getSettled({ start: fromDate, end: toDate });

            tableBody.innerHTML = reportData.map(item => `
                <tr>
                    <td class="px-4">${new Date(item.SettledAt).toLocaleDateString()}</td>
                    <td class="px-4 text-dark fw-bold">${item.LoanID}</td>
                    <td class="px-4">${item.CustomerName}</td>
                    <td class="px-4"><span class="badge bg-info text-white">${item.LoanType}</span></td>
                    <td class="px-4 text-end">Rs. ${parseFloat(item.LoanAmount).toLocaleString()}</td>
                    <td class="px-4 text-center">
                        <span class="text-success fw-bold text-uppercase small">Closed</span>
                    </td>
                </tr>
            `).join('');
        }

        // දත්ත නොමැති නම්
        if (reportData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">නියමිත කාලසීමාව තුළ දත්ත කිසිවක් හමු නොවීය.</td></tr>`;
        }

    } catch (error) {
        console.error("Report Generation Error:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">වාර්තාව ලබා ගැනීමේදී දෝෂයක් සිදුවිය!</td></tr>`;
    }
}

/**
 * 📅 Loan Aging Report එක Load කිරීමේ ශ්‍රිතය
 */
async function loadAgingReport(testDate = null) {
    try {
        // 1. Loading Spinner එක පෙන්වීම
        const tbody = document.getElementById('tblAgingReport');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="spinner-border text-primary" role="status"></div>
                        <p class="mt-3 text-muted">දත්ත විශ්ලේෂණය කරමින් පවතී...</p>
                    </td>
                </tr>`;
        }

        // 2. API එක හරහා Backend එකෙන් දත්ත ලබා ගැනීම
        // testDate එක txtTestDate input එකෙන් හෝ කෙලින්ම parameter එකෙන් ලබාගත හැක
        const finalDate = testDate || document.getElementById('txtTestDate')?.value || null;
        const result = await window.api.reports.getAging(finalDate);

        if (!result.success) {
            console.error("Aging Data Fetch Error:", result.error);
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">දත්ත ලබා ගැනීමේදී දෝෂයක් සිදුවිය!</td></tr>`;
            return;
        }

        // 3. Summary Cards Update කිරීම (ID හරියටම ගැලපිය යුතුය)
        document.getElementById('summary30Days').innerText = `Rs. ${result.summary.days30.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('summary90Days').innerText = `Rs. ${result.summary.days90.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('summaryOver90').innerText = `Rs. ${result.summary.over90.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        
        // සටහන: summaryCurrent එක දැනට 0.00 ලෙස පෙන්වයි (Backend එකේ එම අගය ගණනය නොකරන නිසා)

        // 4. Table එකට දත්ත ඇතුළත් කිරීම
        tbody.innerHTML = ''; // Loading spinner එක ඉවත් කරයි

        if (result.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">පසුගිය ණය (Overdue) කිසිවක් හමු නොවීය.</td></tr>`;
            return;
        }

        result.data.forEach(loan => {
            let badgeClass = '';
            let riskText = '';

            // දින ගණන අනුව Risk Status තීරණය කිරීම
            if (loan.DaysOverdue <= 30) {
                badgeClass = 'bg-warning text-dark';
                riskText = 'Low Risk';
            } else if (loan.DaysOverdue <= 90) {
                badgeClass = 'bg-danger';
                riskText = 'High Risk';
            } else {
                badgeClass = 'bg-dark text-white';
                riskText = 'Critical (NPL)';
            }

            const row = `
                <tr>
                    <td class="px-3"><span class="fw-bold text-dark">${loan.LoanID}</span><br><small class="text-muted">${loan.LoanType}</small></td>
                    <td class="px-3">
                        <div class="fw-bold">${loan.CustomerName}</div>
                        <small class="text-muted">${loan.CustomerPhone || ''}</small>
                    </td>
                    <td class="px-3 fw-bold text-primary">Rs. ${parseFloat(loan.RemainingBalance).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td class="px-3 text-muted">${new Date(loan.NextDueDate).toLocaleDateString()}</td>
                    <td class="px-3 text-center">
                        <span class="fs-5 fw-bold text-danger">${loan.DaysOverdue}</span>
                    </td>
                    <td class="px-3 text-center">
                        <span class="badge rounded-pill ${badgeClass} px-3">${riskText}</span>
                    </td>
                    <td class="px-3 text-center">
                        <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="viewLoanDetails('${loan.LoanID}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>`;
            tbody.insertAdjacentHTML('beforeend', row);
        });

    } catch (error) {
        console.error("Renderer Error:", error);
    }
}

// 3. Print Functionality
function printCurrentReport() {
    window.print();
}

// 4. Event Listeners සම්බන්ධ කිරීම
/**
 * 📊 Event Listeners සහ Page Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. මුලින්ම Summary සහ Aging Report Load කිරීම
    updateReportSummary();
    loadAgingReport();

    // 2. Generate Button එක Click කළ විට (Dropdown එක අනුව)
    const btnGen = document.getElementById('btnGenerateReport');
    if (btnGen) {
        btnGen.addEventListener('click', async () => {
            const reportType = document.getElementById('cmbReportType').value;
            
            // ඔබ Aging Report එක තෝරා ඇත්නම් එය Refresh කරන්න
            if (reportType === 'aging') {
                const testDate = document.getElementById('dtpFromDate')?.value; // Report filter එකේ ඇති දිනය
                await loadAgingReport(testDate);
            } else {
                handleGenerateReport(); // අනෙක් වාර්තා (Arrears, Collection etc.) සඳහා
            }
        });
    }

    // 3. Aging Report එකේ ඇති Refresh Button එක
    const btnRefresh = document.getElementById('btnRefreshAging');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            // txtTestDate යනු Aging Section එකේ ඇති Date Picker එකයි
            const testDate = document.getElementById('txtTestDate')?.value;
            loadAgingReport(testDate);
        });
    }

    // 4. Print Buttons
    const btnPrint = document.getElementById('btnPrintReport');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());

    const btnPrintAging = document.getElementById('btnPrintAging'); // Aging Report එකට වෙනම print button එකක් තිබේ නම්
    if (btnPrintAging) btnPrintAging.addEventListener('click', () => window.print());
});

// Helper function: වෙනත් section එකකට යාමට (උදා: View Loan)
function viewLoanDetails(loanId) {
    console.log("Viewing Loan:", loanId);
    // මෙහිදී ඔබට අදාළ ණය විස්තර පෙන්වන Tab එකට මාරු වීමේ logic එක ලිවිය හැක
}
