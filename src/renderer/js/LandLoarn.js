// ============================================================
// LandLoarn.js — Complete Working Version
// FIX: Own customer search + window._currentLoanCustomerId fallback
// ============================================================

$(document).ready(function () {

    let selectedLoanId      = null;
    let selectedSubLoanData = null;
    let currentLoanSubCount = 0;

    _setupListeners();
    _resetDateFields();
    console.log("✅ LandLoarn.js loaded");

    // ── Customer ID: DOM එකෙන් read කරනවා (always correct) ──

    function _getCid() {
        // 1. Global set by any search
        if (window._currentLoanCustomerId) return window._currentLoanCustomerId;

        // 2. DOM span — search result always written here
        const v = ($('#loanManagementCustomerId').text() || '').trim();
        if (v && v !== '---' && v !== '—' && v !== '') {
            window._currentLoanCustomerId = v;
            return v;
        }
        return null;
    }

    // ── Helpers ───────────────────────────────────────────────

    function _fmtDate(raw) {
        if (!raw) return '';
        try {
            const d = new Date(raw);
            return isNaN(d) ? String(raw).split('T')[0] : d.toISOString().split('T')[0];
        } catch { return ''; }
    }

    function _today() {
        const p = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Colombo',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date()).split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }

   function _getNextMonthSameDay(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';

        const currentDay = d.getDate();
        // ඊළඟ මාසයේ මුල් දිනයට සකසන්න
        d.setMonth(d.getMonth() + 1, 1);
        
        // එම මාසයේ තිබෙන උපරිම දින ගණන සොයන්න (Last day of the month)
        const lastDayOfNextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        
        // මුල් දිනය (currentDay) ඊළඟ මාසයේ නැතිනම් (උදා: 31), එම මාසයේ අවසන් දිනය ලබා දෙන්න.
        d.setDate(Math.min(currentDay, lastDayOfNextMonth));
        
        return d.toISOString().split('T')[0];
    }

   function _resetDateFields() {
        const t = _today();
        $('#txtLanLoanDate').val(t);
        // මෙතැනදී අලුත් logic එක භාවිතා කරයි
        $('#txtLanNextDue').val(_getNextMonthSameDay(t));
    }

    // ── Listeners ─────────────────────────────────────────────

    function _setupListeners() {

        // ── Search Button (shared search box — works from ANY tab) ──
        $(document).off('click.landSearch', '#btnSearchLornManagementCustomer')
            .on('click.landSearch', '#btnSearchLornManagementCustomer', async function () {
                // Only handle if Land tab is active
                if (!$('#tabLand').hasClass('active') && 
                    !$('button[data-bs-target="#tabLand"]').hasClass('active')) return;
                await _searchAndLoad();
            });

        $(document).off('keypress.landSearch', '#txtSearchLornManagementCustomer')
            .on('keypress.landSearch', '#txtSearchLornManagementCustomer', async function (e) {
                if (e.which !== 13) return;
                if (!$('button[data-bs-target="#tabLand"]').hasClass('active')) return;
                await _searchAndLoad();
            });

        // Tab switch - reload cards if customer already found
        $(document).on('shown.bs.tab', 'button[data-bs-target="#tabLand"]', async function () {
            const cid = _getCid();
            if (cid) await _loadLandCards(cid);
        });

      $('#txtLanLoanDate').off('change').on('change', function () {
            const selectedDate = $(this).val();
            if (selectedDate) {
                $('#txtLanNextDue').val(_getNextMonthSameDay(selectedDate));
            }
        });

        $('#btnAddLan').off('click').on('click',    _handleSave);
        $('#btnUpdateLan').off('click').on('click', _handleUpdate);
        $('#btnDeleteLan').off('click').on('click', _handleDelete);
        $('#btnClearLan').off('click').on('click',  _clearForm);
        $('#btnAddLanBeneficiary').off('click').on('click', _addBeneficiary);

        $(document).on('click', '#tblLanLoans tr[data-disbid]', function () {
            const sub = $(this).data('subjson');
            if (!sub) return;
            selectedSubLoanData = sub;
            $('#txtLanLoanAmount').val(sub.TotalAmount);
            $('#txtLanGivenAmount').val(sub.GivenAmount);
            $('#txtLanInterestRate').val(sub.InterestRate);
            $('#txtLanLoanDate').val(_fmtDate(sub.DisbursedDate));
            $('#txtLanNextDue').val(_fmtDate(sub.NextDueDate));
            $('#tblLanLoans tr').removeClass('table-primary active-edit-row');
            $(this).addClass('table-primary active-edit-row');
            $('#btnDeleteLan')
                .html('<i class="bi bi-trash me-1"></i>Delete Sub Loan')
                .removeClass('btn-danger').addClass('btn-outline-danger');
                $('#btnUpdateLan').html('<i class="bi bi-pencil-square me-1"></i>Update Sub Loan');
        });
    }

    // ── Customer Search (when Land tab is active) ────────────

    async function _searchAndLoad() {
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
                    'Blocked!', { confirmText: 'හරි', showCancelButton: false, confirmColor: '#d33' }
                );
                return;
            }

            // Set global — shared with ALL tabs
            window._currentLoanCustomerId = cust.CustomerID;

            // Fill shared info bar
            $('#loanManagementCustomerName').text(cust.CustomerName  || '—');
            $('#loanManagementCustomerId').text(cust.CustomerID      || '—');
            $('#loanManagementCustomerNic').text(cust.NIC             || '—');
            $('#loanManagementCustomerPhone').text(cust.CustomerPhone || '—');
            $('#customerLornmanagementtInfoSection').removeClass('d-none');

            await _loadLandCards(cust.CustomerID);

        } catch (err) {
            console.error('❌ _searchAndLoad:', err);
            notify.toast('සෙවීමේ දෝෂයකි: ' + err.message, 'error');
        }
    }

    // ── Cards ─────────────────────────────────────────────────

    window._loadLandCards = async function (customerId) {
        if (customerId) window._currentLoanCustomerId = customerId;
        const cid = _getCid();
        if (!cid) return;

        const $scroller = $('#landAccScroller').empty();
        selectedLoanId = null; selectedSubLoanData = null;

        $scroller.append(`
            <div class="account-card" id="btnNewLandAcc" style="cursor:pointer;
                 border-style:dashed;border-color:#aaa;background:#f8fafc;">
                <div class="acc-id" style="color:#27ae60;"><i class="bi bi-plus-circle me-1"></i>NEW</div>
                <div class="acc-status" style="color:#27ae60;">+ Create</div>
            </div>
        `);

        try {
            const all   = await window.api.lanLoan.getAll();
            const loans = all.filter(l => l.CustomerID === cid);

            loans.forEach(loan => {
                $scroller.append(`
                    <div class="account-card" data-loanid="${loan.LoanID}" style="cursor:pointer;">
                        <div class="acc-id">${loan.LoanID}</div>
                        <div class="acc-number">${loan.LandNumber || '—'}</div>
                        <div class="acc-sub small text-muted">${loan.Location || '—'}</div>
                        <div class="acc-status mt-1">
                            <span class="badge ${loan.Status==='ACTIVE'?'bg-success':'bg-secondary'} me-1">${loan.Status}</span>
                            <span class="badge bg-light text-dark border">Sub: ${loan.SubLoanCount||0}/5</span>
                        </div>
                    </div>
                `);
            });

            $('#btnNewLandAcc').on('click', _prepareNewLoan);
            $scroller.find('.account-card[data-loanid]').on('click', function () {
                _loadLoanDetails($(this).data('loanid'));
            });

            if (loans.length > 0) {
                await _loadLoanDetails(loans[0].LoanID);
            } else {
                await _prepareNewLoan();
            }
        } catch (err) {
            console.error('❌ _loadLandCards:', err);
            notify.toast('ගිණුම් ලෝඩ් දෝෂයකි.', 'error');
        }
    };

async function _prepareNewLoan() {
    selectedLoanId = null; 
    selectedSubLoanData = null; 
    currentLoanSubCount = 0;

    // UI පිරිසිදු කිරීම
    $('#landAccScroller .account-card').removeClass('active');
    $('#btnNewLandAcc').addClass('active');
    
    // Input fields කලින් තිබූ අගයන් මකා දැමීම (Reset)
    $('#txtDisplayLanLoanId').val('Loading...');
    $('#txtLanLoanId').val('');

    try {
        // 1. API එකෙන් අලුත් ID එක ලබා ගැනීම
        // Cache ප්‍රශ්න මගහැරීමට අවශ්‍ය නම් API එකට Timestamp එකක් යැවිය හැක
        const res = await window.api.lanLoan.getNextId();
        
        console.log("Full API Response:", res); 

        // 2. Response එක handle කිරීම
        let nextId = "";
        if (res && typeof res === 'object') {
            nextId = res.nextId || res.id || ""; 
        } else {
            nextId = res;
        }

        if (nextId) {
            // 3. UI එකට අලුත් ID එක ඇතුළත් කිරීම
            $('#txtDisplayLanLoanId').val(nextId);
            $('#txtLanLoanId').val(nextId);
            console.log("✅ ID Successfully set:", nextId);
        } else {
            console.error("❌ API returned empty ID", res);
            $('#txtDisplayLanLoanId').val('ERROR');
        }

    } catch (e) { 
        console.error("❌ Error fetching next ID:", e);
        notify.toast('අලුත් ණය අංකය ලබා ගැනීමට නොහැකි විය.', 'error');
        $('#txtDisplayLanLoanId').val('ERROR');
    }

    // Form එකේ අනෙක් fields හිස් කිරීම
    _clearFormFields();
    _resetDateFields();
    _setSubEmpty('නව ගිණුමේ Sub Loan ඇතුළත් කරන්න');
    
    // Buttons වල පෙනුම වෙනස් කිරීම
    $('#btnAddLan')
        .prop('disabled', false)
        .html('<i class="bi bi-save me-1"></i>Save Loan');
        
    $('#btnDeleteLan')
        .html('<i class="bi bi-trash me-1"></i>Delete')
        .removeClass('btn-outline-danger')
        .addClass('btn-danger');
}

    async function _loadLoanDetails(loanId) {
        selectedLoanId = loanId; selectedSubLoanData = null;
        $('#landAccScroller .account-card').removeClass('active');
        $(`#landAccScroller .account-card[data-loanid="${loanId}"]`).addClass('active');

        try {
            const loan = await window.api.lanLoan.getById(loanId);
            if (!loan) return notify.toast('ණය ලෝඩ් අසාර්ථකයි.', 'error');

            currentLoanSubCount = (loan.SubLoans||[]).length;
            $('#txtDisplayLanLoanId,#txtLanLoanId').val(loan.LoanID);
            $('#txtLanNumber').val(loan.LandNumber  || '');
            $('#txtLanLocation').val(loan.Location  || '');
            $('#txtLanSize').val(loan.Size           || '');
            $('#txtLanCurrentValue').val(loan.CurrentValue || '');
            $('#txtLanLoanLimit').val(loan.LoanLimit || '');

            _renderSubLoans(loan.SubLoans || []);
            _renderBeneficiaries(loan.Beneficiaries || []);
            _resetDateFields();
            $('#txtLanLoanAmount,#txtLanGivenAmount').val('');
            $('#txtLanInterestRate').val('5');

            $('#btnAddLan')
                .prop('disabled', currentLoanSubCount >= 5)
                .html(currentLoanSubCount < 5
                    ? '<i class="bi bi-plus-circle me-1"></i>Add Sub Loan'
                    : '<i class="bi bi-slash-circle me-1"></i>Max Reached (5/5)');
            $('#btnDeleteLan').html('<i class="bi bi-trash me-1"></i>Delete Account').removeClass('btn-outline-danger').addClass('btn-danger');
        } catch (err) {
            console.error('❌ _loadLoanDetails:', err);
            notify.toast('ණය ලෝඩ් දෝෂයකි.', 'error');
        }
    }

    // ── Save ──────────────────────────────────────────────────

    async function _handleSave() {
        const cid = _getCid();

        if (!cid) {
            return notify.toast('කරුණාකර Search කර Customer ID Select කරන්න.', 'warning');
        }

        const landNumber   = $('#txtLanNumber').val().trim();
        const location     = $('#txtLanLocation').val().trim();
        const loanAmount   = parseFloat($('#txtLanLoanAmount').val());
        const interestRate = parseFloat($('#txtLanInterestRate').val());
        const loanDate     = $('#txtLanLoanDate').val();

        if (!landNumber)                       return notify.toast('Land අංකය ඇතුළත් කරන්න.', 'warning');
        if (!location)                         return notify.toast('ස්ථානය ඇතුළත් කරන්න.', 'warning');
        if (!loanAmount   || loanAmount  <= 0)  return notify.toast('ණය මුදල ඇතුළත් කරන්න.', 'warning');
        if (!interestRate || interestRate <= 0)  return notify.toast('පොලී % ඇතුළත් කරන්න.', 'warning');
        if (!loanDate)                          return notify.toast('ලබා දුන් දිනය ඇතුළත් කරන්න.', 'warning');

        const payload = {
            CustomerID:         cid,
            LandNumber:         landNumber,
            Location:           location,
            Size:               $('#txtLanSize').val().trim()             || null,
            CurrentValue:       parseFloat($('#txtLanCurrentValue').val()) || 0,
            LoanLimit:          parseFloat($('#txtLanLoanLimit').val())    || 0,
            LoanAmount:         loanAmount,
            GivenAmount:        parseFloat($('#txtLanGivenAmount').val())  || loanAmount,
            InterestRate:       interestRate,
            LateFeePerDay:      0,
            MonthlyPenaltyRate: 0,
            LoanDate:           loanDate,
            NextDueDate:        $('#txtLanNextDue').val() || _getNextMonthSameDay($('#txtLanLoanDate').val()),
            Beneficiaries:      _getBeneficiaries()
        };

        try {
            let result;
            if (selectedLoanId) {
                payload.LoanID = selectedLoanId;
                result = await window.api.lanLoan.addSub(payload);
            } else {
                payload.LoanID = $('#txtLanLoanId').val();
                result = await window.api.lanLoan.add(payload);
            }

            if (result.success) {
                notify.toast('✅ සාර්ථකව ගබඩා කළා!', 'success');
                const tid = selectedLoanId || result.loanId;
                await window._loadLandCards(cid);
                if (tid) await _loadLoanDetails(tid);
            } else {
                notify.toast('❌ ' + result.error, 'error');
            }
        } catch (err) {
            console.error('❌ _handleSave:', err);
            notify.toast('ගබඩා කිරීමේ දෝෂයකි.', 'error');
        }
    }

    // ── Update ────────────────────────────────────────────────

 // ── Update Function එක මේ විදිහට වෙනස් කරන්න ──────────────────
async function _handleUpdate() {
    if (!selectedLoanId) return notify.toast('ණය ගිණුමක් තෝරන්න.', 'warning');

    const payload = {
        LoanID:       selectedLoanId,
        LandNumber:   $('#txtLanNumber').val().trim()   || null,
        Location:     $('#txtLanLocation').val().trim() || null,
        Size:         $('#txtLanSize').val().trim()     || null,
        CurrentValue: parseFloat($('#txtLanCurrentValue').val()) || 0,
        LoanLimit:    parseFloat($('#txtLanLoanLimit').val())    || 0,
        Beneficiaries: _getBeneficiaries()
    };

    // විශේෂයි: යම් හෙයකින් Sub Loan එකක් Select කරලා තියෙනවා නම් ඒකත් payload එකට දාන්න
    if (selectedSubLoanData && selectedSubLoanData.DisbursementID) {
        payload.SubLoan = {
            DisbursementID: selectedSubLoanData.DisbursementID,
            TotalAmount:    parseFloat($('#txtLanLoanAmount').val()),
            GivenAmount:    parseFloat($('#txtLanGivenAmount').val()) || parseFloat($('#txtLanLoanAmount').val()),
            InterestRate:   parseFloat($('#txtLanInterestRate').val()),
            DisbursedDate:  $('#txtLanLoanDate').val(),
            NextDueDate:    $('#txtLanNextDue').val()
        };
    }

    try {
        const r = await window.api.lanLoan.update(payload);
        if (r.success) {
            notify.toast('✅ සාර්ථකව යාවත්කාලීන කළා!', 'success');
            const cid = _getCid();
            if (cid) await window._loadLandCards(cid);
            await _loadLoanDetails(selectedLoanId);
            selectedSubLoanData = null; // Update එකෙන් පසු Selection එක අයින් කරන්න
        } else { 
            notify.toast('❌ ' + r.error, 'error'); 
        }
    } catch (err) { 
        notify.toast('Update දෝෂයකි.', 'error'); 
    }
}

    // ── Delete ────────────────────────────────────────────────

    async function _handleDelete() {
        if (!selectedLoanId) return notify.toast('ණය ගිණුමක් තෝරන්න.', 'warning');

        if (selectedSubLoanData && selectedSubLoanData.DisbursementID) {
            const ok = await notify.confirm(`Sub Loan #${selectedSubLoanData.SubLoanNumber} මකන්නද?`, 'Delete', { confirmText: 'Delete', confirmColor: '#e74c3c' });
            if (!ok) return;
            const r = await window.api.lanLoan.deleteSub(selectedLoanId, selectedSubLoanData.DisbursementID);
            if (r.success) { notify.toast('✅ Sub Loan මකා දැමුණා.', 'success'); selectedSubLoanData = null; await _loadLoanDetails(selectedLoanId); }
            else { notify.toast('❌ ' + r.error, 'error'); }
        } else {
            const ok = await notify.confirm(`${selectedLoanId} — සම්පූර්ණ ඉඩම් ගිණුම මකන්නද?`, 'Delete', { confirmText: 'Delete All', confirmColor: '#e74c3c' });
            if (!ok) return;
            const r = await window.api.lanLoan.delete(selectedLoanId);
            if (r.success) {
                notify.toast('✅ ගිණුම මකා දැමුණා.', 'success');
                const cid = _getCid();
                selectedLoanId = null;
                if (cid) await window._loadLandCards(cid);
                _clearFormFields(); _setSubEmpty('ගිණුමක් තෝරන්න');
            } else { notify.toast('❌ ' + r.error, 'error'); }
        }
    }

    // ── Beneficiaries ─────────────────────────────────────────

    async function _addBeneficiary() {
        const name  = $('#txtLanBeneficiaryName').val().trim();
        const phone = $('#txtLanBeneficiaryPhone').val().trim();
        const addr  = $('#txtLanBeneficiaryAddress').val().trim();
        if (!name || !phone) return notify.toast('නම සහ දුරකථනය ඇතුළත් කරන්න.', 'warning');
        try {
            const active = await window.api.lanLoan.checkBeneficiaryActive(name, phone);
            if (active) return notify.toast('⚠️ මෙම ඇපකරු වෙනත් ණයක ඇත!', 'error');
        } catch (_) {}
        _renderBenItem(name, phone, addr);
        $('#txtLanBeneficiaryName,#txtLanBeneficiaryPhone,#txtLanBeneficiaryAddress').val('');
    }

    function _renderBenItem(n, p, a) {
        $('#lanBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border p-2 mb-1 bg-white rounded">
                <span><strong>${n}</strong> — ${p}${a?`<small class="text-muted ms-2">${a}</small>`:''}</span>
                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="$(this).closest('.beneficiary-item').remove()"><i class="bi bi-trash"></i></button>
                <input type="hidden" class="ben-data" data-name="${n}" data-phone="${p}" data-address="${a||''}">
            </div>`);
    }

    function _renderBeneficiaries(list) {
        $('#lanBeneficiaryList').empty();
        (list||[]).forEach(b => _renderBenItem(b.Name, b.Phone, b.Address||''));
    }

    function _getBeneficiaries() {
        const b = [];
        $('#lanBeneficiaryList .ben-data').each(function () {
            b.push({ Name: $(this).data('name'), Phone: $(this).data('phone'), Address: $(this).data('address') });
        });
        return b;
    }

    // ── Sub Loans Table ───────────────────────────────────────

    function _renderSubLoans(subs) {
        const $t = $('#tblLanLoans').empty();
        if (!subs || !subs.length) return _setSubEmpty('Sub Loans නොමැත');
        subs.forEach(s => {
            const $r = $(`
                <tr style="cursor:pointer" data-disbid="${s.DisbursementID}">
                    <td>${s.SubLoanNumber}</td>
                    <td class="fw-bold">රු. ${parseFloat(s.TotalAmount||0).toLocaleString('si-LK')}</td>
                    <td>රු. ${parseFloat(s.GivenAmount||0).toLocaleString('si-LK')}</td>
                    <td>${s.InterestRate}%</td>
                    <td>${_fmtDate(s.DisbursedDate)}</td>
                    <td>${_fmtDate(s.NextDueDate)}</td>
                    <td>${s.DisbursementStatus==='ACTIVE'?'<span class="badge bg-success">Active</span>':'<span class="badge bg-secondary">Closed</span>'}</td>
                </tr>`);
            $r.data('subjson', s);
            $t.append($r);
        });
    }

    // ── UI Helpers ────────────────────────────────────────────

    function _setSubEmpty(msg) {
        $('#tblLanLoans').html(`<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>${msg}</td></tr>`);
    }

    function _clearFormFields() {
        $('#txtLanNumber,#txtLanLocation,#txtLanSize').val('');
        $('#txtLanCurrentValue,#txtLanLoanLimit').val('');
        $('#txtLanLoanAmount,#txtLanGivenAmount').val('');
        $('#txtLanInterestRate').val('5');
        $('#lanBeneficiaryList').empty();
        $('#btnUpdateLan').html('<i class="bi bi-pencil-square me-1"></i>Update Details');
        selectedSubLoanData = null;
    }

    function _clearForm() {
        _clearFormFields(); _resetDateFields();
        selectedLoanId = null; selectedSubLoanData = null; currentLoanSubCount = 0;
        _setSubEmpty('ගිණුමක් තෝරන්න');
        $('#landAccScroller .account-card').removeClass('active');
        $('#btnNewLandAcc').addClass('active');
        $('#btnAddLan').prop('disabled', false).html('<i class="bi bi-save me-1"></i>Save Loan');
        $('#btnDeleteLan').html('<i class="bi bi-trash me-1"></i>Delete').removeClass('btn-outline-danger').addClass('btn-danger');
        _prepareNewLoan();
    }

});