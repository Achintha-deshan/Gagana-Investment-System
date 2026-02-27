

$(document).ready(function () {

    // ── State ─────────────────────────────────────────────────
    let currentCustomerId   = null;   // C0001
    let selectedLoanId      = null;   // VLI00001
    let selectedSubLoanData = null;   // table row click කළ sub loan
    let currentLoanSubCount = 0;

    // ── Boot ──────────────────────────────────────────────────
    _setupListeners();
    _resetDateFields();
    console.log("✅ VehicleLoarn.js loaded with 30-day due date logic");

    // login.js call කරන init function
    window.initVehicleLoanSearch = function () {
        setTimeout(() => {
            const el = document.getElementById('txtSearchLornManagementCustomer');
            if (!el) return;
            el.style.setProperty('color',                '#000', 'important');
            el.style.setProperty('background-color',       '#fff', 'important');
            el.style.setProperty('-webkit-text-fill-color','#000', 'important');
            el.style.setProperty('opacity',                '1',   'important');
            el.focus();
        }, 200);
    };

    // ==========================================================
    // HELPERS
    // ==========================================================

    function _fmtDate(raw) {
        if (!raw) return '';
        try {
            const d = new Date(raw);
            if (isNaN(d)) return String(raw).split('T')[0];
            return d.toISOString().split('T')[0];
        } catch { return ''; }
    }

    function _sriLankaToday() {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Colombo',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date()).split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

   function _calculateNextMonthSameDay(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const currentDay = d.getDate();
        
        // මාසය 1කින් ඉදිරියට ගෙන යන්න
        d.setMonth(d.getMonth() + 1);
        
        // ලබන මාසයේ දින ගණන ඉක්මවා ගියහොත් (උදා: Jan 31 -> Feb 31 නැති නිසා Feb 29/28) 
        // ස්වයංක්‍රීයව එම මාසයේ අවසාන දිනයට සකස් වේ.
        if (d.getDate() !== currentDay) {
            d.setDate(0); 
        }
        
        return d.toISOString().split('T')[0];
    }

   function _resetDateFields() {
        const today = _sriLankaToday();
        $('#txtVehicleLoanDate').val(today);
        $('#txtVehicleNextDue').val(_calculateNextMonthSameDay(today)); // 30 වෙනුවට නව Logic එක
    }

    // ==========================================================
    // EVENT LISTENERS
    // ==========================================================

    function _setupListeners() {

        // Search
        $('#btnSearchLornManagementCustomer')
            .off('click').on('click', _searchCustomer);
        $('#txtSearchLornManagementCustomer')
            .off('keypress').on('keypress', e => { if (e.which === 13) _searchCustomer(); });

    $('#txtVehicleLoanDate').on('change', function () {
    const selectedDate = $(this).val();
    if (selectedDate) {
        // ඊළඟ මාසයේ එම දිනයම ලබා ගැනීමට
        const nextDate = _calculateNextMonthSameDay(selectedDate);
        $('#txtVehicleNextDue').val(nextDate);
    }
});

        // CRUD buttons
        $('#btnAddVehicle').off('click').on('click',     _handleSave);
        $('#btnUpdateVehicle').off('click').on('click', _handleUpdate);
        $('#btnDeleteVehicle').off('click').on('click', _handleDelete);
        $('#btnClearVehicle').off('click').on('click',  _clearForm);

        // Beneficiary add
        $('#btnAddVehicleBeneficiary').off('click').on('click', _addBeneficiary);

        // Table row click - sub loan data fill
        $(document).on('click', '#tblVehicleLoans tr[data-disbid]', function () {
            const sub = $(this).data('subjson');
            if (!sub) return;

            selectedSubLoanData = sub;

            $('#txtVehicleSubAmount').val(sub.TotalAmount);
            $('#txtVehicleGivenAmount').val(sub.GivenAmount);
            $('#txtVehicleInterestRate').val(sub.InterestRate);
            $('#txtVehicleLoanDate').val(_fmtDate(sub.DisbursedDate));
            $('#txtVehicleNextDue').val(_fmtDate(sub.NextDueDate));

            $('#tblVehicleLoans tr').removeClass('table-primary active-edit-row');
            $(this).addClass('table-primary active-edit-row');

            $('#btnDeleteVehicle')
                .html('<i class="bi bi-trash me-1"></i>Delete Sub Loan')
                .removeClass('btn-danger').addClass('btn-outline-danger');
        });
    }

    // ==========================================================
    // 1. CUSTOMER SEARCH
    // ==========================================================

    async function _searchCustomer() {
        const query = $('#txtSearchLornManagementCustomer').val().trim();
        if (!query) return notify.toast('සෙවීමට ID, නම හෝ NIC ඇතුළත් කරන්න.', 'info');

        try {
            const results = await window.api.customer.search(query);

            if (!results || results.length === 0) {
                notify.toast('පාරිභෝගිකයෙකු සොයාගත නොහැකිය.', 'warning');
                return;
            }

            const cust = results[0];

            // Blacklist check
            if (cust.IsBlacklisted == 1 || cust.IsBlacklisted === true) {
                await notify.confirm(
                    `⚠️ මෙම පාරිභෝගිකයා Blacklist ලේඛනයේ සිටී.\nහේතුව: ${cust.BlacklistReason || 'නොදනී'}`,
                    'Blocked!',
                    { confirmText: 'හරි', showCancelButton: false, confirmColor: '#d33' }
                );
                return;
            }

            // Fill customer info bar
            currentCustomerId = cust.CustomerID;
            $('#loanManagementCustomerName').text(cust.CustomerName  || '—');
            $('#loanManagementCustomerId').text(cust.CustomerID      || '—');
            $('#loanManagementCustomerNic').text(cust.NIC             || '—');
            $('#loanManagementCustomerPhone').text(cust.CustomerPhone || '—');
            $('#customerLornmanagementtInfoSection').removeClass('d-none');

            // Load vehicle loan cards
            await _loadVehicleCards(currentCustomerId);

        } catch (err) {
            console.error('❌ _searchCustomer:', err);
            notify.toast('සෙවීමේ දෝෂයකි: ' + err.message, 'error');
        }
    }

    // ==========================================================
    // 2. LOAD VEHICLE ACCOUNT CARDS
    // ==========================================================

    window._loadVehicleCards = async function (customerId) {
        const $scroller = $('#vehicleAccScroller').empty();
        selectedLoanId      = null;
        selectedSubLoanData = null;

        $scroller.append(`
            <div class="account-card" id="btnNewVehicleAcc" style="cursor:pointer;
                 border-style:dashed; border-color:#aaa; background:#f8fafc;">
                <div class="acc-id" style="color:#27ae60;">
                    <i class="bi bi-plus-circle me-1"></i>NEW
                </div>
                <div class="acc-status" style="color:#27ae60;">+ Create</div>
            </div>
        `);

        try {
            const allLoans      = await window.api.vehicleLoan.getAll();
            const customerLoans = allLoans.filter(l => l.CustomerID === customerId);

            customerLoans.forEach(loan => {
                const subCount = loan.SubLoanCount || 0;
                $scroller.append(`
                    <div class="account-card" data-loanid="${loan.LoanID}"
                         style="cursor:pointer;">
                        <div class="acc-id">${loan.LoanID}</div>
                        <div class="acc-number">${loan.VehicleNumber || '—'}</div>
                        <div class="acc-sub small text-muted">${loan.OwnerName || '—'}</div>
                        <div class="acc-status mt-1">
                            <span class="badge ${loan.Status === 'ACTIVE' ? 'bg-success' : 'bg-secondary'} me-1">
                                ${loan.Status}
                            </span>
                            <span class="badge bg-light text-dark border">
                                Sub: ${subCount}/5
                            </span>
                        </div>
                    </div>
                `);
            });

            $('#btnNewVehicleAcc').on('click', _prepareNewLoan);

            $scroller.find('.account-card[data-loanid]').on('click', function () {
                const lid = $(this).data('loanid');
                if (lid) _loadLoanDetails(lid);
            });

            if (customerLoans.length > 0) {
                await _loadLoanDetails(customerLoans[0].LoanID);
            } else {
                await _prepareNewLoan();
            }

        } catch (err) {
            console.error('❌ _loadVehicleCards:', err);
            notify.toast('ගිණුම් ලෝඩ් කිරීමේ දෝෂයකි.', 'error');
        }
    };

    // ==========================================================
    // 3. PREPARE NEW LOAN
    // ==========================================================

    async function _prepareNewLoan() {
        selectedLoanId      = null;
        selectedSubLoanData = null;
        currentLoanSubCount = 0;

        $('.account-card').removeClass('active');
        $('#btnNewVehicleAcc').addClass('active');

        try {
            const nextId = await window.api.vehicleLoan.getNextId();
            $('#txtDisplayVehicleLoanId, #txtVehicleLoanId').val(nextId);
            $('#vehicleSelId').html(
                `<span class="text-muted small">New: <b>${nextId}</b></span>`
            );
        } catch (err) { console.error('❌ getNextId:', err); }

        _clearFormFields();
        _resetDateFields();
        _updateSubDots(0);
        _setSubLoansEmpty('නව ගිණුමේ Sub Loan ඇතුළත් කරන්න');

        $('#btnAddVehicle').prop('disabled', false)
            .html('<i class="bi bi-save me-1"></i>Save Loan');
        $('#btnDeleteVehicle')
            .html('<i class="bi bi-trash me-1"></i>Delete')
            .removeClass('btn-outline-danger').addClass('btn-danger');
    }

    // ==========================================================
    // 4. LOAD EXISTING LOAN DETAILS
    // ==========================================================

    async function _loadLoanDetails(loanId) {
        selectedLoanId      = loanId;
        selectedSubLoanData = null;

        $('.account-card').removeClass('active');
        $(`.account-card[data-loanid="${loanId}"]`).addClass('active');

        try {
            const loan = await window.api.vehicleLoan.getById(loanId);
            if (!loan) return notify.toast('ණය විස්තර ලොඩ් කිරීම අසාර්ථකයි.', 'error');

            currentLoanSubCount = (loan.SubLoans || []).length;
            const remaining     = 5 - currentLoanSubCount;

            $('#vehicleSelId').html(
                `Selected: <b>${loan.LoanID}</b> | 
                 Remaining: <span class="badge ${remaining > 0 ? 'bg-info' : 'bg-danger'}">
                    ${remaining}/5
                 </span>`
            );

            $('#txtDisplayVehicleLoanId, #txtVehicleLoanId').val(loan.LoanID);
            $('#txtVehicleOwnerName').val(loan.OwnerName    || '');
            $('#txtVehicleNumber').val(loan.VehicleNumber   || '');
            $('#txtVehicleType').val(loan.VehicleType       || '');
            $('#txtVehicleCurrentValue').val(loan.CurrentValue || '');
            $('#txtVehicleLoanLimit').val(loan.LoanLimit     || '');
            $('#txtVehicleRegDate').val(_fmtDate(loan.RegistrationDate));
            $('#txtVehicleRegDeadlineDate').val(_fmtDate(loan.Liyapadinchikalayuthudinaya));

            _renderSubLoans(loan.SubLoans || []);
            _updateSubDots(currentLoanSubCount);
            _renderBeneficiaries(loan.Beneficiaries || []);

            $('#txtVehicleSubAmount, #txtVehicleGivenAmount').val('');
            $('#txtVehicleInterestRate').val('5');
            _resetDateFields();

            $('#btnAddVehicle')
                .prop('disabled', currentLoanSubCount >= 5)
                .html(currentLoanSubCount < 5
                    ? '<i class="bi bi-plus-circle me-1"></i>Add Sub Loan'
                    : '<i class="bi bi-slash-circle me-1"></i>Max Reached (5/5)');

            $('#btnDeleteVehicle')
                .html('<i class="bi bi-trash me-1"></i>Delete Account')
                .removeClass('btn-outline-danger').addClass('btn-danger');

        } catch (err) {
            console.error('❌ _loadLoanDetails:', err);
            notify.toast('ණය ලෝඩ් දෝෂයකි.', 'error');
        }
    }

    // ==========================================================
    // 5. SAVE / 6. UPDATE / 7. DELETE (Standard CRUD logic)
    // ==========================================================

 async function _handleSave() {
    if (!currentCustomerId) return notify.toast('කරුණාකර පාරිභෝගිකයෙකු සොයා ගන්න.', 'warning');

    const ownerName    = $('#txtVehicleOwnerName').val().trim();
    const vehicleNum   = $('#txtVehicleNumber').val().trim().toUpperCase();
    
    // parseFloat කිරීමේදී අගයක් නැතිනම් NaN වෙනවා. ඒක වළක්වන්න || 0 දාන්න.
    const loanAmount   = parseFloat($('#txtVehicleSubAmount').val()) || 0;
    const interestRate = parseFloat($('#txtVehicleInterestRate').val()) || 0;
    const givenAmount  = parseFloat($('#txtVehicleGivenAmount').val()) || 0;
    
    const loanDate     = $('#txtVehicleLoanDate').val();
    const nextDueDate  = $('#txtVehicleNextDue').val(); 

    // --- Validation වැඩි දියුණු කිරීම ---
    if (!ownerName) return notify.toast('කරුණාකර හිමිකරුගේ නම ඇතුළත් කරන්න.', 'warning');
    if (!vehicleNum) return notify.toast('කරුණාකර වාහන අංකය ඇතුළත් කරන්න.', 'warning');
    
    if (loanAmount <= 0) {
        return notify.toast('කරුණාකර වලංගු ණය මුදලක් (Sub Amount) ඇතුළත් කරන්න.', 'warning');
    }
    
    // පොලී අනුපාතය 0 වීමට ඉඩ දෙනවාද නැද්ද යන්න මත මෙය තීරණය වේ
    if (isNaN(interestRate)) {
        return notify.toast('කරුණාකර නිවැරදි පොලී අනුපාතයක් ඇතුළත් කරන්න.', 'warning');
    }

    if (!loanDate || !nextDueDate) {
        return notify.toast('දිනයන් (Loan Date / Next Due) ඇතුළත් කිරීම අනිවාර්යයි.', 'warning');
    }

    const payload = {
        CustomerID:         currentCustomerId,
        OwnerName:          ownerName,
        VehicleNumber:      vehicleNum,
        VehicleType:        $('#txtVehicleType').val(),
        CurrentValue:       parseFloat($('#txtVehicleCurrentValue').val()) || 0,
        LoanLimit:          parseFloat($('#txtVehicleLoanLimit').val())    || 0,
        RegistrationDate:   $('#txtVehicleRegDate').val()                  || null,
        RegDeadlineDate:    $('#txtVehicleRegDeadlineDate').val()          || null,
        LoanAmount:         loanAmount,
        // Given amount එක හිස් නම් loan amount එකම ලබා දීම
        GivenAmount:        givenAmount > 0 ? givenAmount : loanAmount,
        InterestRate:       interestRate,
        LateFeePerDay:      0,
        MonthlyPenaltyRate: 0,
        LoanDate:           loanDate,
        NextDueDate:        nextDueDate,
        Beneficiaries:      _getBeneficiaries()
    };

    try {
        // Saving process එක පටන් ගත් බව පෙන්වීමට button එක disable කිරීම හොඳයි
        $('#btnAddVehicle').prop('disabled', true);

        let result = selectedLoanId 
            ? await window.api.vehicleLoan.addSub({ ...payload, LoanID: selectedLoanId })
            : await window.api.vehicleLoan.add({ ...payload, LoanID: $('#txtVehicleLoanId').val() });

        if (result.success) {
            notify.toast('✅ සාර්ථකව ගබඩා කළා!', 'success');
            const targetId = selectedLoanId || result.loanId;
            await _loadVehicleCards(currentCustomerId);
            if (targetId) await _loadLoanDetails(targetId);
        } else {
            notify.toast('❌ ' + result.error, 'error');
        }
    } catch (err) {
        console.error('❌ _handleSave:', err);
        notify.toast('ගබඩා කිරීමේ දෝෂයකි.', 'error');
    } finally {
        // අවසානයේ button එක නැවත enable කිරීම
        $('#btnAddVehicle').prop('disabled', false);
    }
}

async function _handleUpdate() {
    if (!selectedLoanId) return notify.toast('කරුණාකර ණය ගිණුමක් තෝරන්න.', 'warning');

    // --- Validation START ---
    const ownerName = $('#txtVehicleOwnerName').val().trim();
    const vehicleNum = $('#txtVehicleNumber').val().trim().toUpperCase();

    if (!ownerName || !vehicleNum) {
        return notify.toast('හිමිකරුගේ නම සහ වාහන අංකය හිස්ව තැබිය නොහැක.', 'warning');
    }

    // Sub Loan එකක් තෝරාගෙන තිබේ නම් ඒවායේ fields පරීක්ෂා කිරීම
    let subLoanPayload = {};
    if (selectedSubLoanData && selectedSubLoanData.DisbursementID) {
        const subAmount = parseFloat($('#txtVehicleSubAmount').val());
        const interestRate = parseFloat($('#txtVehicleInterestRate').val());
        const disbursedDate = $('#txtVehicleLoanDate').val();
        const nextDueDate = $('#txtVehicleNextDue').val();

        if (!subAmount || subAmount <= 0) {
            return notify.toast('වලංගු සබ් ලෝන් මුදලක් ඇතුළත් කරන්න.', 'warning');
        }
        if (!disbursedDate || !nextDueDate) {
            return notify.toast('ණය ලබාදුන් දිනය සහ ඊළඟ වාරික දිනය අනිවාර්ය වේ.', 'warning');
        }

        subLoanPayload = {
            DisbursementID: selectedSubLoanData.DisbursementID,
            TotalAmount: subAmount,
            RemainingPrincipal: selectedSubLoanData.RemainingPrincipal, // පරණ අගය පවත්වා ගැනීම
            GivenAmount: parseFloat($('#txtVehicleGivenAmount').val()) || subAmount,
            InterestRate: interestRate,
            DisbursedDate: disbursedDate,
            NextDueDate: nextDueDate
        };
    }
    // --- Validation END ---

    const ok = await notify.confirm("මෙම දත්ත යාවත්කාලීන (Update) කිරීමට අවශ්‍යද?", "Update Confirmation");
    if (!ok) return;

    const payload = {
        LoanID: selectedLoanId,
        OwnerName: ownerName,
        VehicleNumber: vehicleNum,
        VehicleType: $('#txtVehicleType').val(),
        CurrentValue: parseFloat($('#txtVehicleCurrentValue').val()) || 0,
        LoanLimit: parseFloat($('#txtVehicleLoanLimit').val()) || 0,
        RegDeadlineDate: $('#txtVehicleRegDeadlineDate').val() || null,
        Beneficiaries: _getBeneficiaries(),
        ...subLoanPayload // Sub loan දත්ත තිබේ නම් ඒවා මෙතැනට එකතු වේ
    };

    try {
        const result = await window.api.vehicleLoan.update(payload);
        if (result.success) {
            notify.toast('✅ සාර්ථකව යාවත්කාලීන කළා!', 'success');
            await _loadVehicleCards(currentCustomerId);
            await _loadLoanDetails(selectedLoanId);
        } else {
            notify.toast('❌ ' + result.error, 'error');
        }
    } catch (err) {
        console.error('❌ _handleUpdate:', err);
        notify.toast('Update කිරීමේදී දෝෂයක් ඇතිවිය.', 'error');
    }
}

  async function _handleDelete() {
    if (!selectedLoanId) return notify.toast('කරුණාකර ණය ගිණුමක් තෝරන්න.', 'warning');

    let msg = "";
    let isSubDelete = false;

    // මොකක්ද මකන්න හදන්නේ කියලා තීරණය කිරීම
    if (selectedSubLoanData && selectedSubLoanData.DisbursementID) {
        msg = `Sub Loan #${selectedSubLoanData.SubLoanNumber} සහ ඊට අදාළ සියලුම ගෙවීම් වාර්තා (Payments) මකා දැමීමට අවශ්‍යද?`;
        isSubDelete = true;
    } else {
        msg = "මෙම සම්පූර්ණ ණය ගිණුමම සහ මෙයට අදාළ සියලුම Sub Loans, Payments මකා දැමීමට අවශ්‍යද?";
        isSubDelete = false;
    }

    // පරිශීලකයාගෙන් අවසරය විමසීම
    const ok = await notify.confirm(msg, 'අවධානයයි!', { confirmColor: '#d33' });
    if (!ok) return;

    try {
        let res;
        if (isSubDelete) {
            // Sub Loan එක පමණක් මැකීම
            res = await window.api.vehicleLoan.deleteSub(selectedLoanId, selectedSubLoanData.DisbursementID);
        } else {
            // සම්පූර්ණ Account එකම මැකීම
            res = await window.api.vehicleLoan.delete(selectedLoanId);
        }

        if (res.success) {
            notify.toast('✅ සාර්ථකව මකා දැමුණා.', 'success');
            
            if (isSubDelete) {
                // Sub loan එකක් මැකුවා නම්, නැවත details load කරන්න
                selectedSubLoanData = null;
                $('#btnDeleteVehicle')
                    .html('<i class="bi bi-trash me-1"></i>Delete Account')
                    .removeClass('btn-outline-danger').addClass('btn-danger');
                await _loadLoanDetails(selectedLoanId);
            } else {
                // මුළු Account එකම මැකුවා නම්, form එක clear කරන්න
                _clearForm();
                await _loadVehicleCards(currentCustomerId);
            }
        } else {
            notify.toast('❌ ' + res.error, 'error');
        }
    } catch (err) {
        console.error('❌ _handleDelete:', err);
        notify.toast('මකා දැමීමේදී දෝෂයක් ඇතිවිය.', 'error');
    }
}

    // ==========================================================
    // 8. BENEFICIARIES / 9. SUB LOANS TABLE / 10. UI UTILS
    // ==========================================================

    async function _addBeneficiary() {
        const name = $('#txtVehicleBeneficiaryName').val().trim();
        const phone = $('#txtVehicleBeneficiaryPhone').val().trim();
        const address = $('#txtVehicleBeneficiaryAddress').val().trim();
        if (!name || !phone) return notify.toast('නම සහ දුරකථනය ඇතුළත් කරන්න.', 'warning');

        try {
            if (await window.api.vehicleLoan.checkBeneficiaryActive(name, phone)) {
                return notify.toast('⚠️ මෙම ඇපකරු වෙනත් සක්‍රීය ණයක ඇත!', 'error');
            }
        } catch (_) {}

        _renderBenItem(name, phone, address);
        $('#txtVehicleBeneficiaryName, #txtVehicleBeneficiaryPhone, #txtVehicleBeneficiaryAddress').val('');
    }

    function _renderBenItem(n, p, a) {
        $('#vehicleBeneficiaryList').append(`
            <div class="beneficiary-item d-flex justify-content-between align-items-center border p-2 mb-1 bg-white rounded">
                <span><strong>${n}</strong> — ${p} ${a ? `<small class="text-muted ms-2">${a}</small>` : ''}</span>
                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="$(this).closest('.beneficiary-item').remove()"><i class="bi bi-trash"></i></button>
                <input type="hidden" class="ben-data" data-name="${n}" data-phone="${p}" data-address="${a || ''}">
            </div>
        `);
    }

    function _renderBeneficiaries(list) {
        $('#vehicleBeneficiaryList').empty();
        (list || []).forEach(b => _renderBenItem(b.Name, b.Phone, b.Address || ''));
    }

    function _getBeneficiaries() {
        const bens = [];
        $('#vehicleBeneficiaryList .ben-data').each(function () {
            bens.push({ Name: $(this).data('name'), Phone: $(this).data('phone'), Address: $(this).data('address') });
        });
        return bens;
    }

    function _renderSubLoans(subs) {
        const $tbody = $('#tblVehicleLoans').empty();
        if (!subs || !subs.length) return _setSubLoansEmpty('Sub Loans නොමැත');
        subs.forEach(sub => {
            const total = parseFloat(sub.TotalAmount || 0).toLocaleString('si-LK');
            const given = parseFloat(sub.GivenAmount || 0).toLocaleString('si-LK');
            const $row = $(`
                <tr style="cursor:pointer;" data-disbid="${sub.DisbursementID}">
                    <td>${sub.SubLoanNumber}</td>
                    <td class="fw-bold">රු. ${total}</td>
                    <td>රු. ${given}</td>
                    <td>${sub.InterestRate}%</td>
                    <td>${_fmtDate(sub.DisbursedDate)}</td>
                    <td>${_fmtDate(sub.NextDueDate)}</td>
                    <td>${sub.DisbursementStatus === 'ACTIVE' ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Closed</span>'}</td>
                </tr>
            `);
            $row.data('subjson', sub);
            $tbody.append($row);
        });
    }

    function _updateSubDots(usedCount) {
        $('#subUsageLabel').text(`(${usedCount}/5 used)`);
        $('#vehicleSubDots').html(Array.from({ length: 5 }, (_, i) => `<span class="sub-dot${i < usedCount ? ' used' : ''}"></span>`).join(''));
    }

    function _setSubLoansEmpty(msg) {
        $('#tblVehicleLoans').html(`<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>${msg}</td></tr>`);
    }

    function _clearFormFields() {
        $('#txtVehicleOwnerName, #txtVehicleNumber, #txtVehicleType, #txtVehicleCurrentValue, #txtVehicleLoanLimit, #txtVehicleRegDate, #txtVehicleRegDeadlineDate, #txtVehicleSubAmount, #txtVehicleGivenAmount').val('');
        $('#txtVehicleInterestRate').val('5');
        $('#vehicleBeneficiaryList').empty();
    }

    function _clearForm() {
        _clearFormFields();
        _resetDateFields();
        selectedLoanId = null;
        selectedSubLoanData = null;
        currentLoanSubCount = 0;
        $('#vehicleSelId').html('<span class="text-muted">— Select a loan —</span>');
        _updateSubDots(0);
        _setSubLoansEmpty('ගිණුමක් තෝරන්න');
        $('.account-card').removeClass('active');
        $('#btnNewVehicleAcc').addClass('active');
    }
});