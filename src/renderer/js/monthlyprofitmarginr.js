/**
 * Gagana Investment - Monthly Analysis Controller
 */

$(document).ready(() => {
    initializeAnalysisFilters();

    // දත්ත Load කරන බොත්තම
    $("#btnLoadAnalysis").on('click', async () => {
        await loadMonthlyAnalysisData();
    });

    // PDF Export කරන බොත්තම
    $("#btnExportAnalysisPDF").on('click', async () => {
        await generateAnalysisPDF();
    });
});

/**
 * මුදල් Format කිරීම (Rs. 0.00)
 */
const formatCurrency = (amount) => {
    return "Rs. " + parseFloat(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * වසර සහ මාස Filters සකස් කිරීම
 */
function initializeAnalysisFilters() {
    const yearSelect = $("#selAnalysisYear");
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    yearSelect.empty();
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
        yearSelect.append(`<option value="${i}" ${i === currentYear ? 'selected' : ''}>${i}</option>`);
    }

    $("#selAnalysisMonth").val(currentMonth);
    updatePeriodDisplay(currentYear, currentMonth);
}

/**
 * දත්ත ලබාගෙන Table එකට සහ Cards වලට ඇතුළත් කිරීම
 */
async function loadMonthlyAnalysisData() {
    const year = parseInt($("#selAnalysisYear").val());
    const month = parseInt($("#selAnalysisMonth").val());
    const tbody = $("#tblMonthlyAnalysisBody");

    tbody.html(`<tr><td colspan="7" class="text-center py-5">
        <div class="spinner-border text-primary mb-2" role="status"></div>
        <p class="mb-0">දත්ත විශ්ලේෂණය කරමින්... කරුණාකර රැඳී සිටින්න.</p>
    </td></tr>`);

    updatePeriodDisplay(year, month);

    try {
        const data = await window.api.monthlyAnalysis.getData(year, month);
        tbody.empty();

        let grandTarget = 0, grandPaid = 0, grandCharges = 0, grandPending = 0, grandTotalRev = 0;

        if (data && data.length > 0) {
            data.forEach(item => {
                grandTarget   += item.targetProfit;
                grandPaid     += item.actualInterest;
                grandCharges  += item.extraCharges;
                grandPending  += item.pendingInterest;
                grandTotalRev += item.totalRevenue;

                // ✅ CLOSED loan badge
                const closedBadge = item.loanStatus === 'CLOSED'
                    ? `<span class="badge bg-secondary ms-1" style="font-size:9px;">CLOSED</span>`
                    : '';

                // ✅ Status badge - PAID / SETTLED / PENDING
                const statusHtml = item.status === 'PAID'
                    ? `<span class="badge bg-success-subtle text-success border border-success px-3 rounded-pill">
                           <i class="bi bi-check-circle-fill me-1"></i> PAID
                       </span>`
                    : item.status === 'SETTLED'
                    ? `<span class="badge bg-info-subtle text-info border border-info px-3 rounded-pill">
                           <i class="bi bi-flag-fill me-1"></i> SETTLED
                       </span>`
                    : `<span class="badge bg-danger-subtle text-danger border border-danger px-3 rounded-pill">
                           <i class="bi bi-clock-history me-1"></i> PENDING
                       </span>`;

                tbody.append(`
                    <tr class="${item.loanStatus === 'CLOSED' ? 'table-light' : ''}">
                        <td class="ps-4">
                            <div class="fw-bold text-dark">
                                ${item.customer}
                                ${closedBadge}
                            </div>
                            <small class="text-muted text-uppercase" style="font-size: 10px;">${item.type}</small>
                        </td>
                        <td>
                            <div class="fw-semibold text-primary">${item.loanInfo.split(' (')[0]}</div>
                            <small class="badge bg-light text-dark border">Sub #${item.loanInfo.split('Sub: ')[1].replace(')', '')}</small>
                        </td>
                        <td class="fw-bold">${formatCurrency(item.targetProfit)}</td>
                        <td class="text-success fw-bold">${formatCurrency(item.actualInterest)}</td>
                        <td class="text-warning fw-bold">${formatCurrency(item.extraCharges)}</td>
                        <td class="text-danger fw-bold">${formatCurrency(item.pendingInterest)}</td>
                        <td class="text-center">${statusHtml}</td>
                    </tr>
                `);
            });

            $("#vTargetProfit").text(formatCurrency(grandTarget));
            $("#vActualInterest").text(formatCurrency(grandPaid));
            $("#vTotalCharges").text(formatCurrency(grandCharges));
            $("#vPendingProfit").text(formatCurrency(grandPending));
            $("#vTotalRevenue").text(formatCurrency(grandTotalRev));
            
            $("#analysisCountBadge").text(`${data.length} records`).removeClass('d-none');

        } else {
            showEmptyState();
        }
    } catch (err) {
        console.error("Load Error:", err);
        notify.toast("දත්ත ලබාගැනීමේ දෝෂයකි: " + err.message, "error");
        showEmptyState();
    }
}

/**
 * PDF වාර්තාව සෑදීම
 */
async function generateAnalysisPDF() {
    const year = parseInt($("#selAnalysisYear").val());
    const month = parseInt($("#selAnalysisMonth").val());

    try {
        notify.toast("වාර්තාව සකස් කරමින්...", "info");
        const result = await window.api.monthlyAnalysis.generatePDF(year, month);

        if (result.success) {
            notify.alert(`වාර්තාව සාර්ථකව සුරකින ලදී:\n${result.path}`, "සාර්ථකයි", "success");
        } else {
            notify.alert("දෝෂයකි: " + result.error, "Error", "error");
        }
    } catch (error) {
        notify.alert("පද්ධති දෝෂයකි: " + error.message, "Error", "error");
    }
}

/**
 * පෙන්වන කාලසීමාව යාවත්කාලීන කිරීම
 */
function updatePeriodDisplay(year, month) {
    const monthNames = ["","ජනවාරි","පෙබරවාරි","මාර්තු","අප්‍රේල්","මැයි","ජූනි",
                        "ජූලි","අගෝස්තු","සැප්තැම්බර්","ඔක්තෝබර්","නොවැම්බර්","දෙසැම්බර්"];
    $("#displayAnalysisPeriod").text(`${year} ${monthNames[month]}`);
}

/**
 * දත්ත නැති විට පෙන්වන ආකාරය
 */
function showEmptyState() {
    $("#tblMonthlyAnalysisBody").html(`
        <tr>
            <td colspan="7" class="text-center py-5">
                <div class="opacity-50">
                    <i class="bi bi-database-exclamation fs-1 d-block mb-2"></i>
                    <p class="fw-bold">මෙම කාලසීමාව සඳහා වාර්තා කිසිවක් හමු නොවීය.</p>
                    <small>වෙනත් වසරක් හෝ මාසයක් තෝරා නැවත උත්සාහ කරන්න.</small>
                </div>
            </td>
        </tr>
    `);
    $("#vTargetProfit, #vActualInterest, #vTotalCharges, #vPendingProfit, #vTotalRevenue").text("Rs. 0.00");
    $("#analysisCountBadge").text("0 records");
}