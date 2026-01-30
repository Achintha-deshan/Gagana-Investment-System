/**
 * Dashboard Controller - ප්‍රධාන දත්ත සහ ප්‍රස්ථාර පාලනය
 */

let revenueChart = null;
let portfolioChart = null;

$(document).ready(() => {
    // Dashboard එක මුලින්ම load වන විට දත්ත ගෙන එන්න
    loadDashboardStats();

    // Refresh බොත්තම සඳහා event එක
    $("#btnRefreshDashboard").on("click", function() {
        $(this).find('i').addClass('fa-spin'); // කරකැවෙන animation එකක්
        loadDashboardStats();
    });
});

/**
 * Backend එකෙන් දත්ත ගෙනවිත් UI එක Update කිරීම
 */
async function loadDashboardStats() {
    try {
        // 1. IPC හරහා දත්ත ලබා ගැනීම
        const stats = await window.api.dashboard.getDashboardStats();
        
        if (!stats) return;

        // 2. ප්‍රධාන සංඛ්‍යාලේඛන (Stats Cards) Update කිරීම
        $("#statTotalCapital").text(`රු. ${formatNumber(stats.capitalOut)}`);
        $("#statReceivedInterest").text(`රු. ${formatNumber(stats.interestReceived)}`);
        $("#statTargetInterest").text(`රු. ${formatNumber(stats.interestTarget)}`);
        $("#statBlacklisted").text(stats.blacklistedCount);
        $("#statTotalCustCount").text(`Total Customers: ${stats.totalCustomers}`);

        // Collection Rate එක ගණනය කිරීම (Received / Target * 100)
        const rate = stats.interestTarget > 0 
            ? ((stats.interestReceived / stats.interestTarget) * 100).toFixed(1) 
            : 0;
        $("#statCollectionRate").text(`${rate}% Collected`);

        // 3. මෑතකාලීන ණය වගුව (Table) පිරවීම
        const tableBody = $("#recentLoansTableBody");
        tableBody.empty();

        if (stats.recentLoans && stats.recentLoans.length > 0) {
            stats.recentLoans.forEach(loan => {
                tableBody.append(`
                    <tr>
                        <td class="fw-bold text-primary">#${loan.LoanID}</td>
                        <td>${loan.CustomerName}</td>
                        <td><span class="badge bg-light text-dark border">${loan.LoanType}</span></td>
                        <td class="fw-bold">රු. ${formatNumber(loan.LoanAmount)}</td>
                        <td>${loan.InterestRate}%</td>
                        <td class="text-muted small">${new Date(loan.LoanDate).toLocaleDateString()}</td>
                    </tr>
                `);
            });
        } else {
            tableBody.append('<tr><td colspan="6" class="text-center py-4">දත්ත කිසිවක් හමු නොවීය.</td></tr>');
        }

        // 4. ප්‍රස්ථාර (Charts) ඇඳීම
        updateRevenueChart(stats.interestTarget, stats.interestReceived);
        updatePortfolioChart(stats.portfolio);

        // Refresh icon එක නැවත සාමාන්‍ය තත්වයට පත් කිරීම
        $("#btnRefreshDashboard i").removeClass('fa-spin');

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        notify.toast("Dashboard එක යාවත්කාලීන කිරීමේ දෝෂයකි", "error");
    }
}

/**
 * ලැබුණු සහ අපේක්ෂිත පොලිය සසඳන Bar Chart එක
 */
function updateRevenueChart(target, received) {
    const ctx = document.getElementById('superRevenueChart').getContext('2d');
    
    if (revenueChart) revenueChart.destroy(); // පරණ Chart එක අයින් කරන්න

    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Target Interest', 'Received Interest'],
            datasets: [{
                label: 'Amount (රු.)',
                data: [target, received],
                backgroundColor: ['#f6c23e', '#1cc88a'], // Warning (Yellow) and Success (Green)
                borderRadius: 8,
                barThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

/**
 * ණය වර්ගීකරණය පෙන්වන Donut Chart එක
 */
function updatePortfolioChart(portfolio) {
    const ctx = document.getElementById('portfolioDonutChart').getContext('2d');
    
    if (portfolioChart) portfolioChart.destroy();

    const labels = portfolio.map(item => item.LoanType);
    const data = portfolio.map(item => item.totalAmount);

    portfolioChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    });
}

/**
 * මුදල් අගයන් ලස්සනට පෙන්වීමට (උදා: 1,500.00)
 */
function formatNumber(num) {
    return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}