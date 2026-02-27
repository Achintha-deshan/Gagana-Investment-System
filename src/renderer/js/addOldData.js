/**
 * Gagana Investment - Old Loan Migration Renderer
 */

$(document).ready(() => {
    // ආරම්භක සැකසුම්
    toggleTypeSpecificDetails($("#oldLoanType").val());

    $("#oldLoanType").on('change', function() {
        toggleTypeSpecificDetails($(this).val());
    });

    // --- පාරිභෝගිකයා සෙවීම ---
    $("#btnFindCustomer").on('click', async () => {
        await performCustomerSearch();
    });

    $("#oldCustomerSearch").on('keypress', async (e) => {
        if (e.which === 13) {
            e.preventDefault();
            await performCustomerSearch();
        }
    });

    // --- දත්ත සුරැකීම (Submit) ---
    $("#oldLoanEntryForm").on('submit', async (e) => {
        e.preventDefault();

        const customerID = $("#selectedCustomerID").val();
        if (!customerID) {
            return await notify.alert("කරුණාකර පළමුව ගනුදෙනුකරුවෙකු තෝරාගන්න.", "අවධානයයි", "warning");
        }

        const loanID = $("#oldLoanID").val().trim();
        const remainingPrincipal = parseFloat($("#subRemainingPrincipal").val() || 0);
        const status = (remainingPrincipal <= 0) ? 'CLOSED' : 'ACTIVE';

        // Backend එකට යවන දත්ත පැකේජය (Payload)
        const payload = {
            loanID: loanID,
            customerID: customerID,
            loanType: $("#oldLoanType").val(),
            status: status,
            subLoan: {
                subLoanNumber: 1, 
                totalAmount: parseFloat($("#subTotalAmount").val() || 0),
                remainingPrincipal: remainingPrincipal,
                interestRate: parseFloat($("#subInterestRate").val() || 0),
                disbursedDate: $("#subDisbursedDate").val(),
                lastPaymentDate: $("#subLastPaymentDate").val(),
                nextDueDate: $("#subNextDueDate").val() // Manual ලබාදෙන දිනය
            },
            typeDetails: getFormattedTypeDetails($("#oldLoanType").val())
        };

        try {
            const confirmAction = await notify.confirm(
                `මෙම ${payload.loanType} ණය දත්ත ඇතුළත් කිරීම ස්ථිරද?`,
                "තහවුරු කිරීම"
            );

            if (!confirmAction) return;

            const result = await window.api.migration.insertOldLoan(payload);

            if (result.success) {
                await notify.alert("පැරණි දත්ත සාර්ථකව ඇතුළත් කරන ලදී.", "සාර්ථකයි", "success");
                resetMigrationForm();
            } else {
                await notify.alert("දෝෂයකි: " + result.error, "Error", "error");
            }
        } catch (error) {
            await notify.alert("පද්ධති දෝෂයකි: " + error.message, "Error", "error");
        }
    });
});

// --- සහායක Function එකක්: Customer Search ---
async function performCustomerSearch() {
    const query = $("#oldCustomerSearch").val().trim();
    const feedback = $("#searchFeedback");
    const display = $("#customerDetailsDisplay");
    
    if (query.length < 1) return;

    try {
        feedback.html('<span class="text-muted small">සොයමින්...</span>');
        const customers = await window.api.customer.search(query);

        if (customers && customers.length > 0) {
            const selected = customers[0];
            $("#selectedCustomerID").val(selected.CustomerID);
            $("#selectedMemberName").text(`${selected.CustomerID} - ${selected.CustomerName}`);
            display.removeClass('d-none');
            feedback.html('<span class="text-success small">ගනුදෙනුකරු හමු විය.</span>');
        } else {
            display.addClass('d-none');
            feedback.html('<span class="text-danger small">හමු නොවීය.</span>');
        }
    } catch (err) {
        console.error(err);
    }
}

function toggleTypeSpecificDetails(type) {
    $(".loan-detail-row").addClass('d-none');
    $(`#details_${type}`).removeClass('d-none');
}

function getFormattedTypeDetails(type) {
    const details = {};
    if (type === 'VEHICLE') {
        details.OwnerName = $("input[name='v_owner']").val();
        details.VehicleNumber = $("input[name='v_number']").val();
        details.VehicleType = $("input[name='v_type']").val();
        details.CurrentValue = $("input[name='v_value']").val() || 0;
        details.Liyapadinchikalayuthudinaya = $("input[name='v_reg_due']").val() || null;
    } else if (type === 'LAND') {
        details.LandNumber = $("input[name='l_number']").val();
        details.Location = $("input[name='l_location']").val();
        details.Size = $("input[name='l_size']").val();
        details.CurrentValue = $("input[name='l_value']").val() || 0;
    } else if (type === 'PROMISSORY') {
        details.PromissoryNumber = $("input[name='p_number']").val();
    } else if (type === 'CHECK') {
        details.CheckNumber = $("input[name='c_number']").val();
        details.OwnerName = $("input[name='c_owner']").val();
        details.BankAccountDetails = $("input[name='c_bank']").val();
    }
    return details;
}

function resetMigrationForm() {
    $("#oldLoanEntryForm")[0].reset();
    $("#selectedCustomerID").val('');
    $("#customerDetailsDisplay").addClass('d-none');
}