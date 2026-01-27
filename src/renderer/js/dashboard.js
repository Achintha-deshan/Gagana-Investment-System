/**
 * Dashboard Controller - English & Sinhala Mixed UI
 */

let incomeChart = null;
let portfolioChart = null;

async function initDashboard() {
    console.log("✅ Dashboard Initialized...");
    await loadSuperDashboard();
    setInterval(loadSuperDashboard, 300000); // Auto-refresh every 5 mins
}

async function loadSuperDashboard() {
    try {
        const data = await window.api.dashboard.getDashboardStats();

        // Stats Update (English Titles in HTML)
        $('#statTotalCapital').text(formatLKR(data.capitalOut));
        $('#statReceivedInterest').text(formatLKR(data.interestReceived));
        $('#statTargetInterest').text(formatLKR(data.interestTarget));
        $('#statBlacklisted').text(data.blacklistedCount);
        $('#statTotalCustCount').text(`Total Customers: ${data.totalCustomers}`);

        // Collection Rate Update
        const rate = data.interestTarget > 0 ? (data.interestReceived / data.interestTarget) * 100 : 0;
        $('#statCollectionRate').text(`${rate.toFixed(1)}% Collected`);

        // Recent Loans Table (English Types)
        const tableHtml = data.recentLoans.map(loan => `
            <tr>
                <td><span class="badge bg-light text-dark border">${loan.LoanID}</span></td>
                <td><i class="fas fa-user-circle me-2 text-primary"></i>${loan.CustomerName}</td>
                <td class="text-uppercase small fw-bold text-muted">${loan.LoanType}</td>
                <td class="fw-bold text-dark">${formatLKR(loan.LoanAmount)}</td>
                <td><span class="badge bg-soft-danger text-danger">${loan.InterestRate}%</span></td>
                <td><small class="text-muted">${new Date(loan.LoanDate).toLocaleDateString('en-GB')}</small></td>
            </tr>
        `).join('');
        
        $('#recentLoansTableBody').html(tableHtml || '<tr><td colspan="6" class="text-center">No Data Available</td></tr>');

        // Update Charts with English Labels
        updateIncomeChart(data.interestTarget, data.interestReceived);
        updatePortfolioChart(data.portfolio);

    } catch (error) {
        console.error("Dashboard Loading Error:", error);
    }
}

// 💹 Revenue Chart
function updateIncomeChart(target, received) {
    const ctx = document.getElementById('superRevenueChart').getContext('2d');
    if (incomeChart) incomeChart.destroy();

    incomeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Target Interest', 'Received Interest'],
            datasets: [{
                label: 'Amount (LKR)',
                data: [target, received],
                backgroundColor: ['#ffc107', '#198754'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            plugins: { 
                legend: { display: false },
                title: { display: true, text: 'Revenue Analysis (Monthly)' }
            }
        }
    });
}

// 🍩 Portfolio Chart
function updatePortfolioChart(portfolioData) {
    const ctx = document.getElementById('portfolioDonutChart').getContext('2d');
    if (portfolioChart) portfolioChart.destroy();

    portfolioChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: portfolioData.map(d => d.LoanType), // English labels from DB
            datasets: [{
                data: portfolioData.map(d => d.count),
                backgroundColor: ['#0d6efd', '#fd7e14', '#6f42c1', '#20c997'],
                hoverOffset: 15
            }]
        },
        options: {
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Loan Portfolio Mix' }
            }
        }
    });
}

function formatLKR(val) {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2
    }).format(val || 0).replace('LKR', 'Rs.');
}

$(document).ready(() => {
    initDashboard();
    $('#btnRefreshDashboard').click(loadSuperDashboard);
});