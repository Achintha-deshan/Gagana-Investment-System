$(document).ready(function () {

    // ── State ─────────────────────────────────────────────────
    let chkSelectedMasterID = null;
    let chkActiveSubData    = null;
    let chkCountSubLoans    = 0;

    // ── Boot ──────────────────────────────────────────────────
    _setupCheckEventListeners();
    _resetCheckDateInputs();
    console.log("✅ CheckLoan.js loaded");

    // ==========================================================
    // CUSTOMER ID — Global + DOM fallback (same fix as Land/Vehicle)
    // ==========================================================
    function _getCid() {
        // 1. Global variable (set by ANY tab search)
        if (window._currentLoanCustomerId) return window._currentLoanCustomerId;

        // 2. DOM span direct read
        const el  = document.getElementById('loanManagementCustomerId');
        const raw = el ? (el.innerText || el.textContent || '') : '';
        const v   = raw.trim();
        if (v && v.length > 1 && v !== '---' && v !== '—') {
            window._currentLoanCustomerId = v;
            return v;
        }
        return null;
    }

    // ==========================================================
    // HELPERS
    // ==========================================================

    function _chkDateFmt(raw) {
        if (!raw) return '';
        try {
            const d = new Date(raw);
            return isNaN(d) ? String(raw).split('T')[0] : d.toISOString().split('T')[0];
        } catch { return ''; }
    }

    function _getLankaToday() {
        const p = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Colombo',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date()).split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }

function _chkAddNextMonthStandard(startDate) {
        if (!startDate) return '';
        let d = new Date(startDate);
        if (isNaN(d.getTime())) return '';

        let originalDay = d.getDate();
        
        // මාසය 1කින් ඉදිරියට
        d.setMonth(d.getMonth() + 1);

        // වැදගත්: පෙබරවාරි 31 වැනි දින නොමැති විට එම මාසයේ අවසාන දිනට සෙට් කිරීම
        if (d.getDate() !== originalDay) {
            d.setDate(0); 
        }

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

 function _resetCheckDateInputs() {
        const today = _getLankaToday();
        $('#txtCheckLoanDate').val(today);
        // අලුත් logic එක මෙතැනට:
        $('#txtCheckNextDue').val(_chkAddNextMonthStandard(today));
    }
    // ==========================================================
    // EVENT LISTENERS
    // ==========================================================

    function _setupCheckEventListeners() {

        // ── Search Button — Check tab active විට handle කරනවා ──
        $(document).off('click.checkSearch', '#btnSearchLornManagementCustomer')
            .on('click.checkSearch', '#btnSearchLornManagementCustomer', async function () {
                if (!$('button[data-bs-target="#tabCheck"]').hasClass('active')) return;
                await _checkSearchAndLoad();
            });

        $(document).off('keypress.checkSearch', '#txtSearchLornManagementCustomer')
            .on('keypress.checkSearch', '#txtSearchLornManagementCustomer', async function (e) {
                if (e.which !== 13) return;
                if (!$('button[data-bs-target="#tabCheck"]').hasClass('active')) return;
                await _checkSearchAndLoad();
            });

        // ── Tab Switch → cards load ──
        $(document).on('shown.bs.tab', 'button[data-bs-target="#tabCheck"]', async function () {
            const cid = _getCid();
            if (cid) await _loadCheckCards(cid);
        });

   // Date picker එක change කළ විට Due Date එක auto update වීම
        $('#txtCheckLoanDate').off('change').on('change', function () {
            const selectedDate = $(this).val();
            if (selectedDate) {
                const nextDueDate = _chkAddNextMonthStandard(selectedDate); // Updated function
                $('#txtCheckNextDue').val(nextDueDate);
                console.log("📅 Due Date Updated (Standard Logic) to:", nextDueDate);
            }
        });

        // ── CRUD Buttons ──
        $('#btnAddCheck').off('click').on('click',    _handleCheckSaveAction);
        $('#btnUpdateCheck').off('click').on('click', _handleCheckUpdateAction);
        $('#btnDeleteCheck').off('click').on('click', _handleCheckDeleteAction);
        $('#btnClearCheck').off('click').on('click',  _clearCheckFormUI);
        $('#btnAddCheckBeneficiary').off('click').on('click', _addCheckBeneficiaryRow);

        // ── Table Row Click ──
        $(document).on('click', '#tblCheckLoans tr[data-disbid]', function () {
            const sub = $(this).data('subjson');
            if (!sub) return;

            chkActiveSubData = sub;
            $('#txtCheckLoanAmount').val(sub.TotalAmount);
            $('#txtCheckGivenAmount').val(sub.GivenAmount);
            $('#txtCheckInterestRate').val(sub.InterestRate);
            $('#txtCheckLoanDate').val(_chkDateFmt(sub.DisbursedDate));
            $('#txtCheckNextDue').val(_chkDateFmt(sub.NextDueDate));

            $('#tblCheckLoans tr').removeClass('table-primary active-edit-row');
            $(this).addClass('table-primary active-edit-row');

            $('#btnDeleteCheck')
                .html('<i class="bi bi-trash me-1"></i>Delete Sub Loan')
                .removeClass('btn-danger').addClass('btn-outline-danger');
        });
    }

    // ==========================================================
    // CUSTOMER SEARCH (Check Tab Active)
    // ==========================================================

    async function _checkSearchAndLoad() {
        const query = $('#txtSearchLornManagementCustomer').val().trim();
        if (!query) return notify.toast('Customer ID, නම හෝ NIC ඇතුළත් කරන්න.', 'info');

        try {
            const results = await window.api.customer.search(query);
            if (!results || results.length === 0) {
                return notify.toast('පාරිභෝගිකයෙකු සොයාගත නොහැකිය.', 'warning');
            }
            const cust = results[0];

            if (cust.IsBlacklisted == 1 || cust.IsBlacklisted === true) {
                await notify.confirm(
                    '⚠️ Blacklist: ' + (cust.BlacklistReason || 'නොදනී'),
                    'Blocked!',
                    { confirmText: 'හරි', showCancelButton: false, confirmColor: '#d33' }
                );
                return;
            }

            // ── Global share — ALL tabs use this ──
            window._currentLoanCustomerId = cust.CustomerID;

            // Fill shared info bar
            $('#loanManagementCustomerName').text(cust.CustomerName   || '—');
            $('#loanManagementCustomerId').text(cust.CustomerID       || '—');
            $('#loanManagementCustomerNic').text(cust.NIC              || '—');
            $('#loanManagementCustomerPhone').text(cust.CustomerPhone  || '—');
            $('#customerLornmanagementtInfoSection').removeClass('d-none');

            await _loadCheckCards(cust.CustomerID);

        } catch (err) {
            console.error('❌ _checkSearchAndLoad:', err);
            notify.toast('සෙවීමේ දෝෂයකි: ' + err.message, 'error');
        }
    }

    // ==========================================================
    // LOAD CHECK ACCOUNT CARDS
    // ==========================================================

    window._loadCheckCards = async function (customerId) {
        if (customerId) window._currentLoanCustomerId = customerId;
        const cid = _getCid();
        if (!cid) return;

        const $scroller = $('#checkAccScroller').empty();
        chkSelectedMasterID = null;
        chkActiveSubData    = null;

        // NEW card
        $scroller.append(`
            <div class="account-card" id="btnNewCheckAcc" style="cursor:pointer;
                 border-style:dashed; border-color:#27ae60; background:#f0fff4;">
                <div class="acc-id" style="color:#27ae60;">
                    <i class="bi bi-plus-circle me-1"></i>NEW
                </div>
                <div class="acc-status" style="color:#27ae60;">+ Create New</div>
            </div>
        `);

        try {
            const allLoans = await window.api.checkLoan.getAll();
            const loans    = allLoans.filter(l => l.CustomerID === cid);

            loans.forEach(loan => {
                $scroller.append(`
                    <div class="account-card" data-loanid="${loan.LoanID}" style="cursor:pointer;">
                        <div class="acc-id">${loan.LoanID}</div>
                        <div class="acc-number text-truncate">${loan.CheckNumber || '—'}</div>
                        <div class="acc-sub small text-muted">${loan.OwnerName || '—'}</div>
                        <div class="acc-status mt-1">
                            <span class="badge ${loan.Status==='ACTIVE'?'bg-success':'bg-secondary'} me-1">
                                ${loan.Status}
                            </span>
                            <span class="badge bg-light text-dark border">
                                Sub: ${loan.SubLoanCount||0}/5
                            </span>
                        </div>
                    </div>
                `);
            });

            $('#btnNewCheckAcc').on('click', _prepareNewCheckEntry);
            $scroller.find('.account-card[data-loanid]').on('click', function () {
                _loadSpecificCheckDetails($(this).data('loanid'));
            });

            if (loans.length > 0) {
                await _loadSpecificCheckDetails(loans[0].LoanID);
            } else {
                await _prepareNewCheckEntry();
            }

        } catch (err) {
            console.error('❌ _loadCheckCards:', err);
            notify.toast('ගිණුම් ලෝඩ් දෝෂයකි.', 'error');
        }
    };

    // ==========================================================
    // PREPARE NEW CHECK LOAN
    // ==========================================================

  async function _prepareNewCheckEntry() {
    // 1. State Reset කිරීම
    chkSelectedMasterID = null;
    chkActiveSubData    = null;
    chkCountSubLoans    = 0;

    // 2. UI Highlights Reset කිරීම
    $('#checkAccScroller .account-card').removeClass('active');
    $('#btnNewCheckAcc').addClass('active');

    try {
        // 3. API එකෙන් Next ID එක ගැනීම (NaN වීම වැළැක්වීමට check එකක් සහිතව)
        const res = await window.api.checkLoan.getNextId();
        const nextId = (res && typeof res === 'object') ? (res.nextId || res.id) : res;
        
        if (nextId) {
            $('#txtDisplayCheckLoanId').val(nextId);
            $('#txtCheckLoanId').val(nextId);
        } else {
            console.error("❌ Invalid ID received from API:", res);
        }
    } catch (e) { 
        console.error("❌ Error fetching Check ID:", e); 
    }

    // 4. Form එක පිරිසිදු කිරීම
    _clearCheckUIFields();
    
    // 5. දින 30 Logic එක සහිතව Date Inputs Reset කිරීම
    _resetCheckDateInputs(); 
    
    // 6. Table එක Reset කිරීම
    _setCheckSubTableEmpty('නව ගිණුමේ Sub Loan ඇතුළත් කරන්න');

    // 7. Buttons වල පෙනුම සකස් කිරීම
    $('#btnAddCheck')
        .prop('disabled', false)
        .html('<i class="bi bi-save me-1"></i>Save Loan');
        
    $('#btnDeleteCheck')
        .html('<i class="bi bi-trash me-1"></i>Delete')
        .removeClass('btn-outline-danger')
        .addClass('btn-danger');
}

    // ==========================================================
    // LOAD EXISTING CHECK LOAN DETAILS
    // ==========================================================

    async function _loadSpecificCheckDetails(loanId) {
        chkSelectedMasterID = loanId;
        chkActiveSubData    = null;

        $('#checkAccScroller .account-card').removeClass('active');
        $(`#checkAccScroller .account-card[data-loanid="${loanId}"]`).addClass('active');

        try {
            const loan = await window.api.checkLoan.getById(loanId);
            if (!loan) return notify.toast('ගිණුම් ලෝඩ් අසාර්ථකයි.', 'error');

            chkCountSubLoans = (loan.SubLoans || []).length;

            $('#txtDisplayCheckLoanId, #txtCheckLoanId').val(loan.LoanID);
            $('#txtCheckNumber').val(loan.CheckNumber       || '');
            $('#txtCheckOwnerName').val(loan.OwnerName      || '');
            $('#txtCheckDateNumber').val(loan.CheckDateNumber || '');
            $('#txtCheckBankAccount').val(loan.BankAccountDetails || '');

            _renderCheckSubTable(loan.SubLoans       || []);
            _renderCheckBeneficiaryList(loan.Beneficiaries || []);
            _resetCheckDateInputs();

            $('#txtCheckLoanAmount, #txtCheckGivenAmount').val('');
            $('#txtCheckInterestRate').val('5');

            $('#btnAddCheck')
                .prop('disabled', chkCountSubLoans >= 5)
                .html(chkCountSubLoans < 5
                    ? '<i class="bi bi-plus-circle me-1"></i>Add Sub Loan'
                    : '<i class="bi bi-slash-circle me-1"></i>Max Reached (5/5)');

            $('#btnDeleteCheck')
                .html('<i class="bi bi-trash me-1"></i>Delete Account')
                .removeClass('btn-outline-danger').addClass('btn-danger');

        } catch (err) {
            console.error('❌ _loadSpecificCheckDetails:', err);
            notify.toast('ගිණුම ලෝඩ් දෝෂයකි.', 'error');
        }
    }

    // ==========================================================
    // SAVE (New Master OR Add Sub Loan)
    // ==========================================================

    async function _handleCheckSaveAction() {
        const cid = _getCid();
        if (!cid) {
            return notify.toast('කරුණාකර Customer Search කරන්න.', 'warning');
        }

        const checkNumber  = $('#txtCheckNumber').val().trim();
        const loanAmount   = parseFloat($('#txtCheckLoanAmount').val());
        const interestRate = parseFloat($('#txtCheckInterestRate').val());
        const loanDate     = $('#txtCheckLoanDate').val();

        if (!checkNumber)                      return notify.toast('Check අංකය ඇතුළත් කරන්න.', 'warning');
        if (!loanAmount  || loanAmount  <= 0)   return notify.toast('ණය මුදල ඇතුළත් කරන්න.', 'warning');
        if (!interestRate|| interestRate <= 0)   return notify.toast('පොලී % ඇතුළත් කරන්න.', 'warning');
if (!loanDate) return notify.toast('ලබා දුන් දිනය ඇතුළත් කරන්න.', 'warning');
// මෙයද එක් කළ හැකිය:
if (!$('#txtCheckNextDue').val()) return notify.toast('මීළඟ වාරික දිනය ගණනය වී නොමැත.', 'warning');
        const payload = {
            CustomerID:      cid,
            CheckNumber:     checkNumber,
            OwnerName:       $('#txtCheckOwnerName').val().trim()    || null,
            CheckDateNumber: $('#txtCheckDateNumber').val().trim()   || null,
            BankAccount:     $('#txtCheckBankAccount').val().trim()  || null,
            LoanAmount:      loanAmount,
            GivenAmount:     parseFloat($('#txtCheckGivenAmount').val()) || loanAmount,
            InterestRate:    interestRate,
            LateFeePerDay:   0,
            MonthlyPenaltyRate: 0,
            LoanDate:        loanDate,
            NextDueDate: $('#txtCheckNextDue').val() || _chkAddNextMonthStandard(loanDate),
            Beneficiaries:   _getCheckBeneficiaryData()
        };

        try {
            let result;
            if (chkSelectedMasterID) {
                // Add Sub Loan to existing master
                payload.LoanID = chkSelectedMasterID;
                result = await window.api.checkLoan.addSubLoan(payload);
            } else {
                // New master loan
                payload.LoanID = $('#txtCheckLoanId').val();
                result = await window.api.checkLoan.add(payload);
            }

            if (result.success) {
                notify.toast('✅ සාර්ථකව ගබඩා කළා!', 'success');
                const targetId = chkSelectedMasterID || result.loanId;
                await _loadCheckCards(cid);
                if (targetId) await _loadSpecificCheckDetails(targetId);
            } else {
                notify.toast('❌ ' + result.error, 'error');
            }
        } catch (err) {
            console.error('❌ _handleCheckSaveAction:', err);
            notify.toast('ගබඩා කිරීමේ දෝෂයකි.', 'error');
        }
    }

    // ==========================================================
    // UPDATE (Check Details + Beneficiaries)
    // ==========================================================

async function _handleCheckUpdateAction() {
    if (!chkSelectedMasterID) return notify.toast('ගිණුමක් තෝරන්න.', 'warning');

    // --- Validation START ---
    const checkNumber = $('#txtCheckNumber').val().trim();
    if (!checkNumber) return notify.toast('Check අංකය හිස්ව තැබිය නොහැක.', 'warning');

    let subLoanPayload = {};
    // Sub Loan එකක් select කර ඇත්නම් එහි දත්ත ලබා ගැනීම
    if (chkActiveSubData && chkActiveSubData.DisbursementID) {
        const subAmount = parseFloat($('#txtCheckLoanAmount').val());
        const interestRate = parseFloat($('#txtCheckInterestRate').val());
        const loanDate = $('#txtCheckLoanDate').val();
        const nextDueDate = $('#txtCheckNextDue').val();

        if (!subAmount || subAmount <= 0) return notify.toast('වලංගු ණය මුදලක් ඇතුළත් කරන්න.', 'warning');
        if (!loanDate || !nextDueDate) return notify.toast('දිනයන් ඇතුළත් කිරීම අනිවාර්යයි.', 'warning');

        subLoanPayload = {
            SubLoan: {
                DisbursementID: chkActiveSubData.DisbursementID,
                TotalAmount: subAmount,
                GivenAmount: parseFloat($('#txtCheckGivenAmount').val()) || subAmount,
                InterestRate: interestRate,
                DisbursedDate: loanDate,
                NextDueDate: nextDueDate
            }
        };
    }
    // --- Validation END ---

    const ok = await notify.confirm("මෙම Check ගිණුමේ දත්ත යාවත්කාලීන කිරීමට අවශ්‍යද?", "Update Confirmation");
    if (!ok) return;

    const payload = {
        LoanID:          chkSelectedMasterID,
        CheckNumber:     checkNumber,
        OwnerName:       $('#txtCheckOwnerName').val().trim() || null,
        CheckDateNumber: $('#txtCheckDateNumber').val().trim() || null,
        BankAccount:     $('#txtCheckBankAccount').val().trim() || null,
        Beneficiaries:   _getCheckBeneficiaryData(),
        ...subLoanPayload // Sub loan දත්ත තිබේ නම් ඒවා මෙතැනට පැමිණේ
    };

    try {
        const r = await window.api.checkLoan.update(payload);
        if (r.success) {
            notify.toast('✅ සාර්ථකව යාවත්කාලීන කළා!', 'success');
            await _loadCheckCards(_getCid()); // Card List එක refresh කරයි
            await _loadSpecificCheckDetails(chkSelectedMasterID); // Form එක refresh කරයි
        } else {
            notify.toast('❌ ' + r.error, 'error');
        }
    } catch (err) {
        console.error('❌ _handleCheckUpdateAction:', err);
        notify.toast('Update දෝෂයකි.', 'error');
    }
}

    // ==========================================================
    // DELETE (Sub Loan OR Full Account)
    // ==========================================================

async function _handleCheckDeleteAction() {
    if (!chkSelectedMasterID) return notify.toast('ගිණුමක් තෝරන්න.', 'warning');

    let msg = "";
    let isSubDelete = false;

    // මොකක්ද මකන්න හදන්නේ කියලා තීරණය කිරීම (Vehicle logic එකට සමානව)
    if (chkActiveSubData && chkActiveSubData.DisbursementID) {
        msg = `මෙම Sub Loan (${chkActiveSubData.SubLoanNumber}) සහ ඊට අදාළ ගෙවීම් වාර්තා මකා දැමීමට අවශ්‍යද?`;
        isSubDelete = true;
    } else {
        msg = `මෙම සම්පූර්ණ Check ගිණුම (${chkSelectedMasterID}) සහ මෙයට අදාළ සියලුම දත්ත මකා දැමීමට අවශ්‍යද?`;
        isSubDelete = false;
    }

    const ok = await notify.confirm(msg, 'මකා දැමීම තහවුරු කරන්න', { 
        confirmText: 'ඔව්, මකන්න', 
        confirmColor: '#d33' 
    });
    if (!ok) return;

    try {
        let r;
        if (isSubDelete) {
            r = await window.api.checkLoan.deleteSubLoan(chkSelectedMasterID, chkActiveSubData.DisbursementID);
        } else {
            r = await window.api.checkLoan.delete(chkSelectedMasterID);
        }

        if (r.success) {
            notify.toast('✅ මකා දැමීම සාර්ථකයි.', 'success');
            
            if (isSubDelete) {
                chkActiveSubData = null;
                // නැවත බටන් එක default තත්වයට පත් කිරීම
                $('#btnDeleteCheck')
                    .html('<i class="bi bi-trash me-1"></i>Delete Account')
                    .removeClass('btn-outline-danger').addClass('btn-danger');
                await _loadSpecificCheckDetails(chkSelectedMasterID);
            } else {
                _clearCheckFormUI();
                const cid = _getCid();
                if (cid) await _loadCheckCards(cid);
            }
        } else {
            notify.toast('❌ ' + r.error, 'error');
        }
    } catch (err) {
        console.error('❌ _handleCheckDeleteAction:', err);
        notify.toast('මකා දැමීමේ දෝෂයකි.', 'error');
    }
}
    // ==========================================================
    // BENEFICIARY
    // ==========================================================

    function _addCheckBeneficiaryRow() {
        const name  = $('#txtCheckBeneficiaryName').val().trim();
        const phone = $('#txtCheckBeneficiaryPhone').val().trim();
        const addr  = $('#txtCheckBeneficiaryAddress').val().trim();
        if (!name || !phone) return notify.toast('නම සහ දුරකථනය ඇතුළත් කරන්න.', 'warning');
        _renderSingleBenRow(name, phone, addr);
        $('#txtCheckBeneficiaryName, #txtCheckBeneficiaryPhone, #txtCheckBeneficiaryAddress').val('');
    }

    function _renderSingleBenRow(n, p, a) {
        $('#checkBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border p-2 mb-1 bg-white rounded">
                <span class="small">
                    <strong>${n}</strong> — ${p}
                    ${a ? `<small class="text-muted ms-2">${a}</small>` : ''}
                </span>
                <button class="btn btn-sm btn-outline-danger py-0 px-2"
                        onclick="$(this).closest('.beneficiary-item').remove()">
                    <i class="bi bi-trash"></i>
                </button>
                <input type="hidden" class="chk-ben-data"
                       data-name="${n}" data-phone="${p}" data-address="${a || ''}">
            </div>
        `);
    }

    function _renderCheckBeneficiaryList(list) {
        $('#checkBeneficiaryList').empty();
        (list || []).forEach(b => _renderSingleBenRow(b.Name, b.Phone, b.Address || ''));
    }

    function _getCheckBeneficiaryData() {
        const bens = [];
        $('#checkBeneficiaryList .chk-ben-data').each(function () {
            bens.push({
                Name:    $(this).data('name'),
                Phone:   $(this).data('phone'),
                Address: $(this).data('address')
            });
        });
        return bens;
    }

    // ==========================================================
    // SUB LOANS TABLE
    // ==========================================================

    function _renderCheckSubTable(subs) {
        const $t = $('#tblCheckLoans').empty();
        if (!subs || !subs.length) return _setCheckSubTableEmpty('Sub Loans නොමැත');

        subs.forEach(s => {
            const $row = $(`
                <tr style="cursor:pointer" data-disbid="${s.DisbursementID}">
                    <td>${s.SubLoanNumber}</td>
                    <td class="fw-bold">රු. ${parseFloat(s.TotalAmount||0).toLocaleString('si-LK')}</td>
                    <td>රු. ${parseFloat(s.GivenAmount||0).toLocaleString('si-LK')}</td>
                    <td>${s.InterestRate}%</td>
                    <td>${_chkDateFmt(s.DisbursedDate)}</td>
                    <td>${_chkDateFmt(s.NextDueDate)}</td>
                    <td>
                        <span class="badge ${s.DisbursementStatus==='ACTIVE'?'bg-success':'bg-secondary'}">
                            ${s.DisbursementStatus}
                        </span>
                    </td>
                </tr>
            `);
            $row.data('subjson', s);
            $t.append($row);
        });
    }

    // ==========================================================
    // UI UTILITIES
    // ==========================================================

    function _setCheckSubTableEmpty(msg) {
        $('#tblCheckLoans').html(`
            <tr><td colspan="7" class="text-center py-4 text-muted">
                <i class="bi bi-inbox fs-3 d-block mb-2"></i>${msg}
            </td></tr>
        `);
    }

    function _clearCheckUIFields() {
        $('#txtCheckNumber, #txtCheckOwnerName, #txtCheckDateNumber, #txtCheckBankAccount').val('');
        $('#txtCheckLoanAmount, #txtCheckGivenAmount').val('');
        $('#txtCheckInterestRate').val('5');
        $('#checkBeneficiaryList').empty();
        chkActiveSubData = null;
    }

    function _clearCheckFormUI() {
        _clearCheckUIFields();
        _resetCheckDateInputs();
        chkSelectedMasterID = null;
        chkActiveSubData    = null;
        chkCountSubLoans    = 0;
        _setCheckSubTableEmpty('ගිණුමක් තෝරන්න');
        $('#checkAccScroller .account-card').removeClass('active');
        $('#btnNewCheckAcc').addClass('active');
        $('#btnAddCheck').prop('disabled', false)
            .html('<i class="bi bi-save me-1"></i>Save Loan');
        $('#btnDeleteCheck')
            .html('<i class="bi bi-trash me-1"></i>Delete')
            .removeClass('btn-outline-danger').addClass('btn-danger');
    }

});