// ============================================================
// PromissoryLoan.js — Optimized with 30-Day Auto-Date Logic
// FIX: Global search handler + DOM fallback (same pattern as Land/Check)
// HTML IDs: document 11 exact match | IPC: document 12 preload exact match
// ============================================================

$(document).ready(function () {

    // ── State ─────────────────────────────────────────────────
    let prmSelectedMasterID = null;
    let prmActiveSubData    = null;
    let prmCountSubLoans    = 0;

    // ── Boot ──────────────────────────────────────────────────
    _setupPrmEventListeners();
    _resetPrmDateInputs();
    console.log("✅ PromissoryLoan.js loaded with 30-day logic");

    // ==========================================================
    // CUSTOMER ID — Global + DOM fallback
    // ==========================================================
    function _getCid() {
        if (window._currentLoanCustomerId) return window._currentLoanCustomerId;

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
    // HELPERS (DATE LOGIC)
    // ==========================================================

    function _prmDateFmt(raw) {
        if (!raw) return '';
        try {
            const d = new Date(raw);
            return isNaN(d) ? String(raw).split('T')[0] : d.toISOString().split('T')[0];
        } catch { return ''; }
    }

    function _getPrmToday() {
        const p = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Colombo',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date()).split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }

   function _prmGetNextMonthSameDay(d) {
        if (!d) return '';
        const dt = new Date(d);
        const currentDay = dt.getDate();
        
        // මාසය 1කින් ඉදිරියට ගෙන යන්න
        dt.setMonth(dt.getMonth() + 1);

        // පෙබරවාරි වැනි මාසවලදී දින ගණන ඉක්මවා ගියහොත් (උදා: ජනවාරි 31 -> පෙබරවාරි 28)
        if (dt.getDate() < currentDay) {
            dt.setDate(0); // එම මාසයේ අවසාන දිනයට සකසයි
        }
        
        return dt.toISOString().split('T')[0];
    }

   function _resetPrmDateInputs() {
        const today = _getPrmToday();
        $('#txtPromissoryLoanDate').val(today);
        // ✅ දින 30 වෙනුවට මාසික චක්‍රය භාවිතා කරයි
        $('#txtPromissoryNextDue').val(_prmGetNextMonthSameDay(today));
    }

    // ==========================================================
    // EVENT LISTENERS
    // ==========================================================

    function _setupPrmEventListeners() {

        // ── Search — Promissory tab active විට පමණි ──
        $(document).off('click.prmSearch', '#btnSearchLornManagementCustomer')
            .on('click.prmSearch', '#btnSearchLornManagementCustomer', async function () {
                const active = $('button[data-bs-toggle="tab"].active').data('bs-target');
                if (active !== '#tabPromissory') return;
                await _prmSearchAndLoad();
            });

        $(document).off('keypress.prmSearch', '#txtSearchLornManagementCustomer')
            .on('keypress.prmSearch', '#txtSearchLornManagementCustomer', async function (e) {
                if (e.which !== 13) return;
                const active = $('button[data-bs-toggle="tab"].active').data('bs-target');
                if (active !== '#tabPromissory') return;
                await _prmSearchAndLoad();
            });

        // ── Tab Switch → cards auto-load ──
        $(document).on('shown.bs.tab', 'button[data-bs-target="#tabPromissory"]', async function () {
            const cid = _getCid();
            if (cid) await _loadPromissoryCards(cid);
        });

        // ── Date auto-fill (දින 30 Logic එක ක්‍රියාත්මක වීම) ──
      $('#txtPromissoryLoanDate').on('change', function () {
            const newDate = $(this).val();
            if (newDate) {
                // ✅ මෙතැනදීත් මාසික චක්‍රය භාවිතා කරයි
                $('#txtPromissoryNextDue').val(_prmGetNextMonthSameDay(newDate));
            }
        });

        // ── CRUD Buttons ──
        $('#btnAddPromissory').off('click').on('click',     _handlePrmSaveAction);
        $('#btnUpdatePromissory').off('click').on('click', _handlePrmUpdateAction);
        $('#btnDeletePromissory').off('click').on('click', _handlePrmDeleteAction);
        $('#btnClearPromissory').off('click').on('click',  _clearPrmFormUI);
        $('#btnAddPromissoryBeneficiary').off('click').on('click', _addPrmBeneficiaryRow);

        // ── Table Row Click ──
        $(document).on('click', '#tblPromissoryLoans tr[data-disbid]', function () {
            const sub = $(this).data('subjson');
            if (!sub) return;

            prmActiveSubData = sub;
            $('#txtPromissoryLoanAmount').val(sub.TotalAmount);
            $('#txtPromissoryGivenAmount').val(sub.GivenAmount);
            $('#txtPromissoryInterestRate').val(sub.InterestRate);
            $('#txtPromissoryLoanDate').val(_prmDateFmt(sub.DisbursedDate));
            $('#txtPromissoryNextDue').val(_prmDateFmt(sub.NextDueDate));

            $('#tblPromissoryLoans tr').removeClass('table-primary active-edit-row');
            $(this).addClass('table-primary active-edit-row');
            // Save button එක disable කර Update එකට අවධානය යොමු කරවන්න
    $('#btnAddPromissory').prop('disabled', true).addClass('opacity-50');
    $('#btnUpdatePromissory').addClass('btn-primary shadow-sm');

            $('#btnDeletePromissory')
                .html('<i class="bi bi-trash me-1"></i>Delete Sub Loan')
                .removeClass('btn-danger').addClass('btn-outline-danger');
        });
    }

    // ==========================================================
    // CUSTOMER SEARCH (Promissory Tab Active)
    // ==========================================================

    async function _prmSearchAndLoad() {
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

            window._currentLoanCustomerId = cust.CustomerID;

            $('#loanManagementCustomerName').text(cust.CustomerName   || '—');
            $('#loanManagementCustomerId').text(cust.CustomerID       || '—');
            $('#loanManagementCustomerNic').text(cust.NIC               || '—');
            $('#loanManagementCustomerPhone').text(cust.CustomerPhone  || '—');
            $('#customerLornmanagementtInfoSection').removeClass('d-none');

            await _loadPromissoryCards(cust.CustomerID);

        } catch (err) {
            console.error('❌ _prmSearchAndLoad:', err);
            notify.toast('සෙවීමේ දෝෂයකි: ' + err.message, 'error');
        }
    }

    // ==========================================================
    // LOAD PROMISSORY ACCOUNT CARDS
    // ==========================================================

    window._loadPromissoryCards = async function (customerId) {
        if (customerId) window._currentLoanCustomerId = customerId;
        const cid = _getCid();
        if (!cid) return;

        const $scroller = $('#promissoryAccScroller').empty();
        prmSelectedMasterID = null;
        prmActiveSubData    = null;

        $scroller.append(`
            <div class="account-card" id="btnNewPrmAcc" style="cursor:pointer; border-style:dashed; border-color:#27ae60; background:#f0fff4;">
                <div class="acc-id" style="color:#27ae60;"><i class="bi bi-plus-circle me-1"></i>NEW</div>
                <div class="acc-status" style="color:#27ae60;">+ Create New</div>
            </div>
        `);

        try {
            const allLoans = await window.api.promissoryLoan.getAll();
            const loans    = allLoans.filter(l => l.CustomerID === cid);

            loans.forEach(loan => {
                $scroller.append(`
                    <div class="account-card" data-prmid="${loan.LoanID}" style="cursor:pointer;">
                        <div class="acc-id">${loan.LoanID}</div>
                        <div class="acc-number text-truncate">${loan.PromissoryNumber || '—'}</div>
                        <div class="acc-status mt-1">
                            <span class="badge ${loan.Status==='ACTIVE'?'bg-success':'bg-secondary'} me-1">${loan.Status}</span>
                            <span class="badge bg-light text-dark border">Sub: ${loan.SubLoanCount||0}/5</span>
                        </div>
                    </div>
                `);
            });

            $('#btnNewPrmAcc').on('click', _prepareNewPrmEntry);
            $scroller.find('.account-card[data-prmid]').on('click', function () {
                _loadSpecificPrmDetails($(this).data('prmid'));
            });

            if (loans.length > 0) await _loadSpecificPrmDetails(loans[0].LoanID);
            else await _prepareNewPrmEntry();

        } catch (err) { console.error('❌ _loadPromissoryCards:', err); }
    };

    // ==========================================================
    // PREPARE NEW / LOAD EXISTING
    // ==========================================================

    async function _prepareNewPrmEntry() {
        prmSelectedMasterID = null;
        prmActiveSubData    = null;
        prmCountSubLoans    = 0;

        $('#promissoryAccScroller .account-card').removeClass('active');
        $('#btnNewPrmAcc').addClass('active');

        try {
            const nextId = await window.api.promissoryLoan.getNextId();
            $('#txtDisplayPromissoryLoanId, #txtPromissoryLoanId').val(nextId);
        } catch (e) { console.error(e); }

        _clearPrmUIFields();
        _resetPrmDateInputs();
        _setPrmSubTableEmpty('නව ගිණුමේ Sub Loan ඇතුළත් කරන්න');

        $('#btnAddPromissory').prop('disabled', false).html('<i class="bi bi-save me-1"></i>Save Loan');
        $('#btnDeletePromissory').html('<i class="bi bi-trash me-1"></i>Delete').removeClass('btn-outline-danger').addClass('btn-danger');
    }

    async function _loadSpecificPrmDetails(loanId) {
        prmSelectedMasterID = loanId;
        prmActiveSubData    = null;

        $('#promissoryAccScroller .account-card').removeClass('active');
        $(`#promissoryAccScroller .account-card[data-prmid="${loanId}"]`).addClass('active');

        try {
            const loan = await window.api.promissoryLoan.getById(loanId);
            if (!loan) return;

            prmCountSubLoans = (loan.SubLoans || []).length;
            $('#txtDisplayPromissoryLoanId, #txtPromissoryLoanId').val(loan.LoanID);
            $('#txtPromissoryNumber').val(loan.PromissoryNumber || '');

            _renderPrmSubTable(loan.SubLoans || []);
            _renderPrmBeneficiaryList(loan.Beneficiaries || []);
            _resetPrmDateInputs();

            $('#txtPromissoryLoanAmount, #txtPromissoryGivenAmount').val('');
            $('#txtPromissoryInterestRate').val('5');

            $('#btnAddPromissory').prop('disabled', prmCountSubLoans >= 5)
                .html(prmCountSubLoans < 5 ? '<i class="bi bi-plus-circle me-1"></i>Add Sub Loan' : '<i class="bi bi-slash-circle me-1"></i>Max (5/5)');

            $('#btnDeletePromissory').html('<i class="bi bi-trash me-1"></i>Delete Account').removeClass('btn-outline-danger').addClass('btn-danger');

        } catch (err) { console.error(err); }
    }

    // ==========================================================
    // SAVE / UPDATE / DELETE
    // ==========================================================

    async function _handlePrmSaveAction() {
        const cid = _getCid();
        if (!cid) return notify.toast('කරුණාකර Customer Search කරන්න.', 'warning');

        const payload = {
            CustomerID: cid,
            PromissoryNumber: $('#txtPromissoryNumber').val().trim(),
            LoanAmount: parseFloat($('#txtPromissoryLoanAmount').val()),
            GivenAmount: parseFloat($('#txtPromissoryGivenAmount').val()) || parseFloat($('#txtPromissoryLoanAmount').val()),
            InterestRate: parseFloat($('#txtPromissoryInterestRate').val()),
            LoanDate: $('#txtPromissoryLoanDate').val(),
            NextDueDate: $('#txtPromissoryNextDue').val(),
            Beneficiaries: _getPrmBeneficiaryData()
        };

if (!payload.PromissoryNumber || !payload.LoanAmount || !payload.NextDueDate) {
    return notify.toast('අත්‍යවශ්‍ය දත්ත (දිනය ඇතුළුව) ඇතුළත් කරන්න.', 'warning');
}
        try {
            let res;
            if (prmSelectedMasterID) {
                payload.LoanID = prmSelectedMasterID;
                res = await window.api.promissoryLoan.addSubLoan(payload);
            } else {
                payload.LoanID = $('#txtPromissoryLoanId').val();
                res = await window.api.promissoryLoan.add(payload);
            }

            if (res.success) {
                notify.toast('✅ සාර්ථකයි!', 'success');
                await _loadPromissoryCards(cid);
                if (prmSelectedMasterID || res.loanId) await _loadSpecificPrmDetails(prmSelectedMasterID || res.loanId);
            } else {
                notify.toast('❌ ' + res.error, 'error');
            }
        } catch (err) { console.error(err); }
    }

  async function _handlePrmUpdateAction() {
    if (!prmSelectedMasterID) return notify.toast('ගිණුමක් තෝරන්න.', 'warning');

    const payload = {
        LoanID: prmSelectedMasterID,
        PromissoryNumber: $('#txtPromissoryNumber').val().trim(),
        Beneficiaries: _getPrmBeneficiaryData()
    };

    // ✅ තෝරාගෙන ඇති Sub Loan එකේ දත්තත් ඇතුළත් කිරීම
    if (prmActiveSubData && prmActiveSubData.DisbursementID) {
        payload.SubLoan = {
            DisbursementID: prmActiveSubData.DisbursementID,
            TotalAmount: parseFloat($('#txtPromissoryLoanAmount').val()),
            GivenAmount: parseFloat($('#txtPromissoryGivenAmount').val()),
            InterestRate: parseFloat($('#txtPromissoryInterestRate').val()),
            DisbursedDate: $('#txtPromissoryLoanDate').val(),
            NextDueDate: $('#txtPromissoryNextDue').val()
        };
    }

    try {
        const r = await window.api.promissoryLoan.update(payload);
        if (r.success) {
            notify.toast('✅ සාර්ථකව යාවත්කාලීන කළා!', 'success');
            await _loadSpecificPrmDetails(prmSelectedMasterID);
        } else {
            notify.toast('❌ ' + r.error, 'error');
        }
    } catch (err) { console.error(err); }
}
async function _handlePrmDeleteAction() {
    if (!prmSelectedMasterID) return notify.toast('ගිණුමක් තෝරන්න.', 'warning');
    
    if (prmActiveSubData && prmActiveSubData.DisbursementID) {
        // Sub Loan Delete
        const ok = await notify.confirm(`Sub Loan #${prmActiveSubData.SubLoanNumber} මකන්නද?`, 'Delete Sub Loan');
        if (!ok) return;

        const r = await window.api.promissoryLoan.deleteSubLoan(prmSelectedMasterID, prmActiveSubData.DisbursementID);
        if (r.success) {
            notify.toast('✅ Sub Loan මකා දැමුණා.', 'success');
            await _loadSpecificPrmDetails(prmSelectedMasterID);
        } else {
            // ✅ ගෙවීම් තිබේ නම් මෙතැනින් Error එක පෙන්වයි
            notify.toast('❌ ' + r.error, 'error');
        }
    } else {
        // සම්පූර්ණ ගිණුමම මකා දැමීම (Manual Cascade logic එක ක්‍රියාත්මක වේ)
        const ok = await notify.confirm(`සම්පූර්ණ ගිණුම සහ එහි ඇති සියලු ගෙවීම් වාර්තා මකන්නද?`, 'Delete Full Account');
        if (!ok) return;

        const r = await window.api.promissoryLoan.delete(prmSelectedMasterID);
        if (r.success) {
            notify.toast('✅ ගිණුම සම්පූර්ණයෙන්ම මකා දැමුණා.', 'success');
            _clearPrmFormUI();
            const cid = _getCid();
            if (cid) await _loadPromissoryCards(cid);
        }
    }
}
    // ==========================================================
    // BENEFICIARY & TABLE RENDERING
    // ==========================================================

    function _addPrmBeneficiaryRow() {
        const n = $('#txtPromissoryBeneficiaryName').val().trim();
        const p = $('#txtPromissoryBeneficiaryPhone').val().trim();
        const a = $('#txtPromissoryBeneficiaryAddress').val().trim();
        if (!n || !p) return notify.toast('නම සහ දුරකථනය ඇතුළත් කරන්න.', 'warning');
        _renderSinglePrmBenRow(n, p, a);
        $('#txtPromissoryBeneficiaryName, #txtPromissoryBeneficiaryPhone, #txtPromissoryBeneficiaryAddress').val('');
    }

    function _renderSinglePrmBenRow(n, p, a) {
        $('#promissoryBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border p-2 mb-1 bg-white rounded">
                <span class="small"><strong>${n}</strong> — ${p} ${a ? `<br><small class="text-muted">${a}</small>` : ''}</span>
                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="$(this).closest('.beneficiary-item').remove()"><i class="bi bi-trash"></i></button>
                <input type="hidden" class="prm-ben-data" data-name="${n}" data-phone="${p}" data-address="${a || ''}">
            </div>
        `);
    }

    function _renderPrmBeneficiaryList(list) {
        $('#promissoryBeneficiaryList').empty();
        (list || []).forEach(b => _renderSinglePrmBenRow(b.Name, b.Phone, b.Address || ''));
    }

    function _getPrmBeneficiaryData() {
        const bens = [];
        $('#promissoryBeneficiaryList .prm-ben-data').each(function () {
            bens.push({ Name: $(this).data('name'), Phone: $(this).data('phone'), Address: $(this).data('address') });
        });
        return bens;
    }

    function _renderPrmSubTable(subs) {
        const $t = $('#tblPromissoryLoans').empty();
        if (!subs || !subs.length) return _setPrmSubTableEmpty('Sub Loans නොමැත');
        subs.forEach(s => {
            const $row = $(`
                <tr style="cursor:pointer" data-disbid="${s.DisbursementID}">
                    <td>${s.SubLoanNumber}</td>
                    <td class="fw-bold">රු. ${parseFloat(s.TotalAmount||0).toLocaleString('si-LK')}</td>
                    <td>රු. ${parseFloat(s.GivenAmount||0).toLocaleString('si-LK')}</td>
                    <td>${s.InterestRate}%</td>
                    <td>${_prmDateFmt(s.DisbursedDate)}</td>
                    <td>${_prmDateFmt(s.NextDueDate)}</td>
                    <td><span class="badge ${s.DisbursementStatus==='ACTIVE'?'bg-success':'bg-secondary'}">${s.DisbursementStatus}</span></td>
                </tr>
            `);
            $row.data('subjson', s);
            $t.append($row);
        });
    }

    function _setPrmSubTableEmpty(msg) {
        $('#tblPromissoryLoans').html(`<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>${msg}</td></tr>`);
    }

    function _clearPrmUIFields() {
        $('#txtPromissoryNumber, #txtPromissoryLoanAmount, #txtPromissoryGivenAmount').val('');
        $('#txtPromissoryInterestRate').val('5');
        $('#promissoryBeneficiaryList').empty();
        $('#btnAddPromissory').prop('disabled', false).removeClass('opacity-50');
    $('#btnUpdatePromissory').removeClass('btn-primary shadow-sm');
    }

    function _clearPrmFormUI() {
        _clearPrmUIFields();
        _resetPrmDateInputs();
        prmSelectedMasterID = null;
        prmActiveSubData = null;
        _setPrmSubTableEmpty('ගිණුමක් තෝරන්න');
        $('#promissoryAccScroller .account-card').removeClass('active');
        $('#btnAddPromissory').prop('disabled', false).html('<i class="bi bi-save me-1"></i>Save Loan');
    }

});