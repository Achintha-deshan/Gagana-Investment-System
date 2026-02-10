// Migration Section එකට අදාළ දත්ත තබා ගැනීමට
let selectedMigrationLoanId = null;

document.addEventListener('DOMContentLoaded', () => {
    const txtMigrateSearch = document.getElementById('txtMigrateSearch');
    const btnMigrateSearch = document.getElementById('btnMigrateSearch');
    const migrateLoansList = document.getElementById('migrateLoansList');
    const migrationFormArea = document.getElementById('migrationFormArea');
    const btnSubmitMigration = document.getElementById('btnSubmitMigration');

    // 1. ණය සෙවීමේ Logic එක (Vehicle, Land, etc. සියල්ලම සෙවේ)
    if (btnMigrateSearch) {
        btnMigrateSearch.addEventListener('click', async () => {
            const query = txtMigrateSearch.value.trim();
            if (!query) return;

            btnMigrateSearch.disabled = true;
            btnMigrateSearch.innerHTML = '<span class="spinner-border spinner-border-sm"></span> සෙවුම් කරමින්...';

            try {
                // Migration Service එකේ getActiveLoansForMigration කැඳවීම
                const res = await window.api.migration.searchLoans(query);
                
                if (res.success && res.loans.length > 0) {
                    renderMigrateLoanCards(res.loans);
                    migrationFormArea.classList.add('d-none'); 
                } else {
                    migrateLoansList.innerHTML = '<div class="col-12 text-center py-4 text-muted">සක්‍රීය ණය කිසිවක් හමු නොවීය.</div>';
                    notify.toast("පාරිභෝගිකයා හෝ ණය හමු නොවීය.", "info");
                }
            } catch (err) {
                console.error("Migration Search Error:", err);
                notify.toast("සෙවීමේදී දෝෂයක් සිදු විය.", "error");
            } finally {
                btnMigrateSearch.disabled = false;
                btnMigrateSearch.innerHTML = '<i class="bi bi-search"></i> සොයන්න';
            }
        });
    }

    // 2. දත්ත පද්ධතියට එක් කිරීමේ (Process) Logic එක
    if (btnSubmitMigration) {
        btnSubmitMigration.addEventListener('click', async () => {
            
            // අගයන් ලබා ගැනීම
            const pDate = document.getElementById('mLastPaidDate').value;
            const pAmount = document.getElementById('mPaidAmount').value;
            const iPaid = document.getElementById('mInterestPaid').value;
            const cBalance = document.getElementById('mCurrentLoanBalance').value;

            // --- වැදගත්ම කොටස: Validation ---
            // දිනය, ගෙවූ මුදල, පොලිය සහ ඉතිරි මූලධනය අනිවාර්යයි
            if (!pDate || pAmount === "" || iPaid === "" || cBalance === "") {
                notify.toast("දිනය, ගෙවූ මුදල, පොලී මුදල සහ ඉතිරි මූලධනය ඇතුළත් කිරීම අනිවාර්යයි.", "warning");
                return;
            }

            const migrationData = {
                LoanID: selectedMigrationLoanId,
                PaymentDate: pDate,
                PaidAmount: parseFloat(pAmount) || 0,
                InterestPaid: parseFloat(iPaid) || 0,
                MonthsPaid: parseInt(document.getElementById('mMonthsPaid').value) || 1,
                PenaltyPaid: parseFloat(document.getElementById('mPenaltyPaid').value) || 0,
                CapitalPaid: parseFloat(document.getElementById('mCapitalPaid').value) || 0,
                ArrearsRemaining: parseFloat(document.getElementById('mArrearsRemaining').value) || 0,
                CurrentLoanBalance: parseFloat(cBalance) || 0
            };

            const confirm = await notify.confirm(
                "මෙම පරණ දත්ත පද්ධතියට එක් කිරීමට ඔබට විශ්වාසද? මෙයින් පසු මීළඟ වාරික දිනය ස්වයංක්‍රීයව සැකසේ.",
                "දත්ත තහවුරු කිරීම"
            );

            if (confirm) {
                try {
                    btnSubmitMigration.disabled = true;
                    btnSubmitMigration.innerHTML = '<span class="spinner-border spinner-border-sm"></span> සුරකිමින්...';

                    const result = await window.api.migration.process(migrationData);
                    
                    if (result.success) {
                        notify.toast("දත්ත සාර්ථකව පද්ධතියට එක් කරන ලදී!", "success");
                        resetMigrationUI();
                    } else {
                        notify.toast("දෝෂයකි: " + result.error, "error");
                    }
                } catch (err) {
                    console.error("Migration Error:", err);
                    notify.toast("සේව් කිරීමේදී දෝෂයක් සිදු විය.", "error");
                } finally {
                    btnSubmitMigration.disabled = false;
                    btnSubmitMigration.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> දත්ත පද්ධතියට ඇතුළත් කරන්න';
                }
            }
        });
    }
});

// 3. ණය ලිස්ට් එක Cards විදිහට පෙන්වීම
function renderMigrateLoanCards(loans) {
    const migrateLoansList = document.getElementById('migrateLoansList');
    migrateLoansList.innerHTML = loans.map(loan => `
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 border-start border-4 border-warning shadow-sm hover-shadow" 
                 style="cursor:pointer;" onclick="selectLoanForMigration('${loan.LoanID}', '${loan.CustomerName}')">
                <div class="card-body">
                    <div class="d-flex justify-content-between mb-2">
                        <span class="badge bg-warning text-dark">${loan.LoanType}</span>
                        <span class="fw-bold text-muted">#${loan.LoanID}</span>
                    </div>
                    <h5 class="card-title mb-1">${loan.CustomerName}</h5>
                    <p class="text-muted small mb-0"><i class="bi bi-card-text"></i> ${loan.NIC || 'N/A'}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <span class="text-primary fw-bold">Rs. ${parseFloat(loan.LoanAmount).toLocaleString()}</span>
                        <button class="btn btn-sm btn-outline-warning">තෝරන්න</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 4. කාඩ් එකක් ක්ලික් කළ විට Form එක පෙන්වීම
function selectLoanForMigration(loanId, customerName) {
    selectedMigrationLoanId = loanId;
    document.getElementById('targetLoanIdDisplay').innerText = `${customerName} (${loanId})`;
    document.getElementById('migrationFormArea').classList.remove('d-none');
    
    // Form එක පෙනෙන තැනට Scroll කරන්න
    document.getElementById('migrationFormArea').scrollIntoView({ behavior: 'smooth' });
}

// 5. UI එක Reset කිරීම
function resetMigrationUI() {
    document.getElementById('migrateLoansList').innerHTML = '';
    document.getElementById('migrationFormArea').classList.add('d-none');
    document.getElementById('txtMigrateSearch').value = '';
    // Form එකේ input fields reset කිරීම
    const fields = ['mLastPaidDate', 'mMonthsPaid', 'mPaidAmount', 'mPenaltyPaid', 'mInterestPaid', 'mCapitalPaid', 'mArrearsRemaining', 'mCurrentLoanBalance'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = (id === 'mMonthsPaid') ? "1" : "";
    });
    selectedMigrationLoanId = null;
}