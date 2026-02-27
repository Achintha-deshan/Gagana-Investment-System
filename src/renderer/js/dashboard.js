'use strict';

var revenueChartInstance = null;
var portfolioChartInstance = null;

$(document).ready(() => {
    setTimeout(() => {
        loadDashboardData();
    }, 150);

    $("#btnRefreshDashboard").on("click", function() {
        const $icon = $(this).find('i');
        $icon.addClass('fa-spin'); 
        loadDashboardData().finally(() => {
            setTimeout(() => $icon.removeClass('fa-spin'), 600);
        });
    });
});

async function loadDashboardData() {
    try {
        const tableBody = $("#recentLoansTableBody");
        if (tableBody.length) {
            tableBody.html('<tr><td colspan="6" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>දත්ත ලබා ගනිමින් පවතී...</td></tr>');
        }

        const stats = await window.api.dashboard.getDashboardStats();
        if (!stats) return;

        // 1. Update Cards
        updateStatElement("#statTotalCapital", safeFormatCurrency(stats.capitalOut));
        updateStatElement("#statReceivedInterest", safeFormatCurrency(stats.interestReceived));
        updateStatElement("#statTargetInterest", safeFormatCurrency(stats.interestTarget));
        updateStatElement("#statBlacklisted", stats.blacklistedCount || 0);
        updateStatElement("#statTotalCustCount", `Total Customers: ${stats.totalCustomers || 0}`);

        // 2. Collection Rate Badge
        const rate = (stats.interestTarget > 0) 
            ? ((stats.interestReceived / stats.interestTarget) * 100).toFixed(1) 
            : 0;
        updateStatElement("#statCollectionRate", `${rate}% Collected`);

        // 3. Update Recent Loans Table
        if (tableBody.length) {
            tableBody.empty();
            if (stats.recentLoans && stats.recentLoans.length > 0) {
                stats.recentLoans.forEach(loan => {
                    tableBody.append(`
                        <tr>
                            <td class="fw-bold text-primary">#${loan.LoanID}</td>
                            <td>${loan.CustomerName}</td>
                            <td><span class="badge bg-light text-dark border">${loan.LoanType}</span></td>
                            <td class="fw-bold">${safeFormatCurrency(loan.LoanAmount)}</td>
                            <td class="text-center">${loan.InterestRate}%</td>
                            <td class="text-muted small">${new Date(loan.LoanDate).toLocaleDateString()}</td>
                        </tr>
                    `);
                });
            } else {
                tableBody.append('<tr><td colspan="6" class="text-center py-4 text-muted">දත්ත හමු නොවීය.</td></tr>');
            }
        }

        // 4. Render Charts
        renderRevenueChart(stats.interestTarget, stats.interestReceived);
        renderPortfolioDonutChart(stats.portfolio);

    } catch (error) {
        console.error("Dashboard Load Error:", error);
    }
}

function renderRevenueChart(target, received) {
    const canvas = document.getElementById('superRevenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy(); 

    revenueChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Target', 'Received'],
            datasets: [{
                label: 'මුදල (රු.)',
                data: [target, received],
                backgroundColor: ['#f6c23e', '#1cc88a'],
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

function renderPortfolioDonutChart(portfolioData) {
    const canvas = document.getElementById('portfolioDonutChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (portfolioChartInstance) portfolioChartInstance.destroy();

    const labels = portfolioData ? portfolioData.map(item => item.LoanType) : [];
    const dataValues = portfolioData ? portfolioData.map(item => item.totalAmount) : [];

    portfolioChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function updateStatElement(selector, value) {
    const $el = $(selector);
    if ($el.length) $el.text(value);
}

function safeFormatCurrency(num) {
    const val = parseFloat(num) || 0;
    return 'රු. ' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}