import path from 'path';
import fs from 'fs';
import { app, BrowserWindow } from 'electron';
import db from '../config/db.js';

class BackupService {
    async runMonthlyBackup(year, month) {
        try {
            year  = parseInt(year);
            month = parseInt(month);

            const formattedMonth = String(month).padStart(2, '0');
            const startDate = `${year}-${formattedMonth}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            const docsPath = app.getPath('documents');
            const backupDir = path.join(docsPath, 'Gagana_Backups', 'Monthly_Reports');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const fileName = `Gagana_Snapshot_${year}_${formattedMonth}.pdf`;
            const finalPath = path.join(backupDir, fileName);

            // ==========================================
            // 1. DATA FETCHING
            // ==========================================

            // A. Financial Summary
            const [finData] = await db.query(`
                SELECT 
                    IFNULL(SUM(InterestPaid), 0)      AS totalInterest,
                    IFNULL(SUM(PenaltyPaid), 0)       AS totalPenalty,
                    IFNULL(SUM(LateFeePaid), 0)       AS totalLateFee,
                    IFNULL(SUM(PrincipalPaid), 0)     AS totalPrincipalRecovered,
                    IFNULL(SUM(TotalPaid), 0)         AS totalCashInflow,
                    IFNULL(SUM(ArrearsSettled), 0)    AS totalArrearsSettled
                FROM payment_history 
                WHERE PaymentDate BETWEEN ? AND ? AND IsVoided = 0
            `, [startDate, endDate]);

            // B. Active Loans Portfolio
            const [activePortfolio] = await db.query(`
                SELECT 
                    c.CustomerName, l.LoanID, l.LoanType,
                    ld.DisbursementID, ld.SubLoanNumber, 
                    ld.TotalAmount AS InitialCapital, 
                    ld.RemainingPrincipal, ld.CurrentArrears,
                    ld.InterestRate, ld.NextDueDate, ld.DisbursedDate,
                    ROUND(ld.RemainingPrincipal * (ld.InterestRate / 100), 2) AS MonthlyInterest,
                    IFNULL(pm.PaidThisMonth, 0)     AS PaidThisMonth,
                    IFNULL(pm.CapitalThisMonth, 0)  AS CapitalThisMonth,
                    IFNULL(pm.InterestThisMonth, 0) AS InterestThisMonth
                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                LEFT JOIN (
                    SELECT DisbursementID, 
                        SUM(TotalPaid)     AS PaidThisMonth,
                        SUM(PrincipalPaid) AS CapitalThisMonth,
                        SUM(InterestPaid)  AS InterestThisMonth
                    FROM payment_history
                    WHERE PaymentDate BETWEEN ? AND ? AND IsVoided = 0
                    GROUP BY DisbursementID
                ) pm ON pm.DisbursementID = ld.DisbursementID
                WHERE ld.DisbursementStatus = 'ACTIVE'
                ORDER BY l.LoanType ASC, c.CustomerName ASC, ld.SubLoanNumber ASC
            `, [startDate, endDate]);

            // C. Loans CLOSED this month
            const [closedThisMonth] = await db.query(`
                SELECT 
                    c.CustomerName, ld.LoanID, ld.SubLoanNumber, l.LoanType,
                    ld.TotalAmount AS InitialCapital,
                    ld.LastPaymentDate AS ClosedDate,
                    IFNULL(pm.CapitalRecoveredThisMonth, 0)  AS CapitalRecoveredThisMonth,
                    IFNULL(pm.InterestRecoveredThisMonth, 0) AS InterestRecoveredThisMonth
                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                LEFT JOIN (
                    SELECT DisbursementID,
                        SUM(PrincipalPaid) AS CapitalRecoveredThisMonth,
                        SUM(InterestPaid)  AS InterestRecoveredThisMonth
                    FROM payment_history
                    WHERE PaymentDate BETWEEN ? AND ? AND IsVoided = 0
                    GROUP BY DisbursementID
                ) pm ON pm.DisbursementID = ld.DisbursementID
                WHERE ld.DisbursementStatus = 'CLOSED'
                AND ld.LastPaymentDate BETWEEN ? AND ?
                ORDER BY ld.LastPaymentDate ASC
            `, [startDate, endDate, startDate, endDate]);

            // D. Monthly Profit Analysis - CLOSED loans correct target interest
            const [profitAnalysis] = await db.query(`
                SELECT 
                    c.CustomerName, l.LoanID, l.LoanType,
                    ld.SubLoanNumber, ld.DisbursementStatus, ld.InterestRate,
                    -- ACTIVE: current RemainingPrincipal * Rate
                    -- CLOSED: (PrincipalPaid + BalancePrincipal) * Rate = pre-payment principal * Rate
                    CASE 
                        WHEN ld.DisbursementStatus = 'ACTIVE' THEN
                            ROUND(ld.RemainingPrincipal * (ld.InterestRate / 100), 2)
                        ELSE
                            IFNULL((
                                SELECT ROUND((ph2.PrincipalPaid + ph2.BalancePrincipal) * (ld.InterestRate / 100), 2)
                                FROM payment_history ph2
                                WHERE ph2.DisbursementID = ld.DisbursementID
                                AND ph2.IsVoided = 0
                                AND ph2.PaymentDate BETWEEN ? AND ?
                                ORDER BY ph2.PaymentDate ASC
                                LIMIT 1
                            ), 0)
                    END AS TargetInterest,
                    IFNULL(pm.PaidInterest, 0) AS PaidInterest,
                    IFNULL(pm.PaidCharges, 0)  AS PaidCharges,
                    IFNULL(pm.PaidCapital, 0)  AS PaidCapital
                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                LEFT JOIN (
                    SELECT DisbursementID,
                        SUM(InterestPaid)               AS PaidInterest,
                        SUM(PenaltyPaid + LateFeePaid)  AS PaidCharges,
                        SUM(PrincipalPaid)              AS PaidCapital
                    FROM payment_history
                    WHERE PaymentDate BETWEEN ? AND ? AND IsVoided = 0
                    GROUP BY DisbursementID
                ) pm ON pm.DisbursementID = ld.DisbursementID
                WHERE (
                    (ld.DisbursementStatus = 'ACTIVE' AND MONTH(ld.NextDueDate) = ? AND YEAR(ld.NextDueDate) = ?)
                    OR pm.DisbursementID IS NOT NULL
                )
                ORDER BY c.CustomerName ASC, l.LoanID ASC, ld.SubLoanNumber ASC
            `, [startDate, endDate, startDate, endDate, month, year]);

            // E. Defaulters
            const [defaulters] = await db.execute(`
                SELECT 
                    c.CustomerName, ld.LoanID, ld.SubLoanNumber, l.LoanType,
                    ld.TotalAmount AS Capital, ld.RemainingPrincipal, 
                    ld.CurrentArrears, ld.NextDueDate,
                    DATEDIFF(?, ld.NextDueDate) AS DaysOverdue
                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE ld.NextDueDate <= ? AND ld.DisbursementStatus = 'ACTIVE' AND ld.CurrentArrears > 0
                ORDER BY ld.CurrentArrears DESC
            `, [endDate, endDate]);

            // F. No Payment This Month
            const [noPayers] = await db.query(`
                SELECT 
                    c.CustomerName, ld.LoanID, ld.SubLoanNumber, l.LoanType,
                    ld.RemainingPrincipal, ld.InterestRate, ld.NextDueDate,
                    ROUND(ld.RemainingPrincipal * (ld.InterestRate / 100), 2) AS ExpectedInterest
                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE ld.DisbursementStatus = 'ACTIVE'
                AND MONTH(ld.NextDueDate) = ? AND YEAR(ld.NextDueDate) = ?
                AND NOT EXISTS (
                    SELECT 1 FROM payment_history ph
                    WHERE ph.DisbursementID = ld.DisbursementID
                    AND ph.PaymentDate BETWEEN ? AND ? AND ph.IsVoided = 0
                )
                ORDER BY c.CustomerName ASC
            `, [month, year, startDate, endDate]);

            // G. Full Audit Log
            const [logs] = await db.execute(`
                SELECT 
                    ph.PaymentDate, ph.LoanID, ld.SubLoanNumber, l.LoanType,
                    c.CustomerName, ph.TotalPaid, ph.PrincipalPaid, ph.InterestPaid, 
                    ph.PenaltyPaid, ph.LateFeePaid, ph.ArrearsSettled,
                    ph.BalancePrincipal, ph.BalanceArrears, ph.CollectedBy
                FROM payment_history ph
                JOIN loan_disbursements ld ON ph.DisbursementID = ld.DisbursementID
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE ph.PaymentDate BETWEEN ? AND ? AND ph.IsVoided = 0
                ORDER BY ph.PaymentDate ASC
            `, [startDate, endDate]);

            // ==========================================
            // 2. CALCULATIONS
            // ==========================================
            const fin = finData[0];
            const netProfit = Number(fin.totalInterest) + Number(fin.totalPenalty) + Number(fin.totalLateFee);
            const totalActiveCapital = activePortfolio.reduce((s, r) => s + Number(r.RemainingPrincipal), 0);
            const totalArrears = activePortfolio.reduce((s, r) => s + Number(r.CurrentArrears), 0);
            const totalClosedCapital = closedThisMonth.reduce((s, r) => s + Number(r.CapitalRecoveredThisMonth), 0);

            let paTotalTarget = 0, paTotalPaidInt = 0, paTotalCharges = 0, paTotalPending = 0, paTotalCapital = 0;
            profitAnalysis.forEach(r => {
                const target  = Number(r.TargetInterest);
                const paidInt = Number(r.PaidInterest);
                const charges = Number(r.PaidCharges);
                const capital = Number(r.PaidCapital);
                const pending = Math.max(0, target - paidInt);
                paTotalTarget  += target;
                paTotalPaidInt += paidInt;
                paTotalCharges += charges;
                paTotalPending += pending;
                paTotalCapital += capital;
            });

            const fmt = (n) => 'Rs.&nbsp;' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-';
            const monthNames = ["","ජනවාරි","පෙබරවාරි","මාර්තු","අප්‍රේල්","මැයි","ජූනි","ජූලි","අගෝස්තු","සැප්තැම්බර්","ඔක්තෝබර්","නොවැම්බර්","දෙසැම්බර්"];

            // ==========================================
            // 3. HTML + PDF DESIGN
            // ==========================================
            const typeBadge = (type) => {
                const styles = {
                    VEHICLE:    'background:#e8f4f8;color:#1a6e8c;',
                    LAND:       'background:#e8f8e8;color:#1a7c1a;',
                    CHECK:      'background:#f8f0e8;color:#8c5c1a;',
                    PROMISSORY: 'background:#f0e8f8;color:#5c1a8c;'
                };
                return `<span style="display:inline-block;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:700;${styles[type]||''}">${type}</span>`;
            };

            const statusBadge = (label, color, bg) =>
                `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:9px;font-weight:700;background:${bg};color:${color};">${label}</span>`;

            const htmlContent = `<!DOCTYPE html>
<html lang="si">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1a1a2e; background:white; }

/* ===== COVER PAGE ===== */
.cover-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, #0f0c29, #1a2a6c, #b21f1f);
    color: white;
    text-align: center;
    padding: 60px 40px;
    page-break-after: always;
}
.cover-logo {
    width: 80px; height: 80px;
    background: rgba(255,255,255,0.15);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; margin: 0 auto 30px;
    border: 3px solid rgba(255,255,255,0.4);
}
.cover-title { font-size: 34px; font-weight: 900; letter-spacing: 3px; margin-bottom: 8px; }
.cover-subtitle { font-size: 16px; opacity: 0.85; margin-bottom: 40px; font-weight: 300; letter-spacing: 1px; }
.cover-period {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 12px;
    padding: 20px 50px;
    margin-bottom: 40px;
    backdrop-filter: blur(10px);
}
.cover-period .period-label { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
.cover-period .period-value { font-size: 28px; font-weight: 800; }
.cover-meta { display: flex; gap: 40px; justify-content: center; margin-top: 20px; }
.cover-meta-item { text-align: center; }
.cover-meta-item .meta-val { font-size: 22px; font-weight: 800; }
.cover-meta-item .meta-lbl { font-size: 9px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }
.cover-footer { margin-top: 50px; font-size: 10px; opacity: 0.5; }

/* ===== REPORT PAGES ===== */
.report-body { padding: 25px 30px; }

.page-header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 3px solid #1a2a6c; padding-bottom: 10px; margin-bottom: 20px;
}
.page-header .ph-title { font-size: 13px; font-weight: 700; color: #1a2a6c; }
.page-header .ph-period { font-size: 10px; color: #888; }

/* Summary Cards */
.cards-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 22px; }
.card {
    border-radius: 10px; padding: 14px 12px; text-align: center;
    border-top: 4px solid; position: relative; overflow: hidden;
}
.card::before {
    content: ''; position: absolute; top: -20px; right: -20px;
    width: 70px; height: 70px; border-radius: 50%;
    background: rgba(255,255,255,0.08);
}
.card.green  { border-color:#27ae60; background:linear-gradient(135deg,#f0faf4,#e8f8ee); }
.card.blue   { border-color:#2980b9; background:linear-gradient(135deg,#f0f7fd,#e4f0fa); }
.card.orange { border-color:#e67e22; background:linear-gradient(135deg,#fdf6ec,#faebd7); }
.card.red    { border-color:#e74c3c; background:linear-gradient(135deg,#fdf0ef,#fde8e7); }
.card.purple { border-color:#8e44ad; background:linear-gradient(135deg,#f9f0fd,#f0e4f8); }
.card .c-val { font-size:16px; font-weight:900; margin-bottom:4px; }
.card .c-lbl { font-size:9px; color:#666; text-transform:uppercase; letter-spacing:0.5px; }
.card.green .c-val  { color:#1e8449; }
.card.blue .c-val   { color:#1a5276; }
.card.orange .c-val { color:#a04000; }
.card.red .c-val    { color:#c0392b; }
.card.purple .c-val { color:#6c3483; }

/* Sections */
.section { margin-bottom: 22px; border-radius: 8px; overflow: hidden; border: 1px solid #e0e4ef; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
.section-hdr {
    background: linear-gradient(135deg, #1a2a6c, #2471a3);
    color: white; padding: 9px 14px;
    display: flex; justify-content: space-between; align-items: center;
}
.section-hdr .sh-title { font-size: 12px; font-weight: 700; }
.section-hdr .sh-sub   { font-size: 9px; opacity: 0.75; }
.section-body { padding: 0; background: white; }

/* Two column layout */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px; }

/* Tables */
table { width: 100%; border-collapse: collapse; }
th {
    background: #f4f6fb; color: #34495e; font-weight: 700;
    padding: 8px 10px; border-bottom: 2px solid #dde3f0;
    font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px;
    white-space: nowrap;
}
td { padding: 7px 10px; border-bottom: 1px solid #eef0f8; font-size: 10.5px; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:nth-child(even) { background: #fafbff; }
.tr-total td { background: #eef1fa !important; font-weight: 800; border-top: 2px solid #c5cce8; }
.tr-closed { background: #f8f9fa !important; }
.text-right  { text-align: right; white-space: nowrap; }
.text-center { text-align: center; }

/* Simple key-value table */
.kv-table td { padding: 8px 14px; }
.kv-table td:first-child { color: #555; width: 55%; }
.kv-table td:last-child  { font-weight: 700; text-align: right; }

.empty-state { text-align:center; padding:20px; color:#aaa; font-style:italic; font-size:11px; }
.page-break  { page-break-after: always; }

footer { text-align:center; font-size:9px; color:#bbb; border-top:1px solid #eee; margin-top:25px; padding-top:8px; }
</style>
</head>
<body>

<!-- ===== COVER PAGE ===== -->
<div class="cover-page">
    <div class="cover-logo">💰</div>
    <div class="cover-title">GAGANA INVESTMENT</div>
    <div class="cover-subtitle">මාසික ව්‍යාපාරික සම්පූර්ණ වාර්තාව</div>

    <div class="cover-period">
        <div class="period-label">Report Period</div>
        <div class="period-value">${year} ${monthNames[month]}</div>
    </div>

    <div class="cover-meta">
        <div class="cover-meta-item">
            <div class="meta-val" style="color:#2ecc71;">Rs.${Number(netProfit).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
            <div class="meta-lbl">Net Profit</div>
        </div>
        <div class="cover-meta-item">
            <div class="meta-val" style="color:#3498db;">${activePortfolio.length}</div>
            <div class="meta-lbl">Active Loans</div>
        </div>
        <div class="cover-meta-item">
            <div class="meta-val" style="color:#f39c12;">${logs.length}</div>
            <div class="meta-lbl">Transactions</div>
        </div>
        <div class="cover-meta-item">
            <div class="meta-val" style="color:#e74c3c;">${closedThisMonth.length}</div>
            <div class="meta-lbl">Loans Closed</div>
        </div>
    </div>

    <div class="cover-footer">
        Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Gagana Investment Management System
    </div>
</div>

<!-- ===== REPORT BODY ===== -->
<div class="report-body">

<div class="page-header">
    <div class="ph-title">📊 මාසික ව්‍යාපාරික සම්පූර්ණ වාර්තාව</div>
    <div class="ph-period">${year} ${monthNames[month]} &nbsp;|&nbsp; ${fmtDate(startDate)} – ${fmtDate(endDate)}</div>
</div>

<!-- Summary Cards -->
<div class="cards-row">
    <div class="card green">
        <div class="c-val">${fmt(netProfit)}</div>
        <div class="c-lbl">Net Profit (ලාභය)</div>
    </div>
    <div class="card blue">
        <div class="c-val">${fmt(fin.totalCashInflow)}</div>
        <div class="c-lbl">Cash Inflow (ලැබීම)</div>
    </div>
    <div class="card orange">
        <div class="c-val">${fmt(totalActiveCapital)}</div>
        <div class="c-lbl">Active Capital</div>
    </div>
    <div class="card red">
        <div class="c-val">${fmt(totalArrears)}</div>
        <div class="c-lbl">Total Arrears</div>
    </div>
</div>

<!-- Section 1 + 2: Revenue & Capital -->
<div class="two-col">
    <div class="section">
        <div class="section-hdr">
            <span class="sh-title">1. ලාභය බෙදී පවතින ආකාරය</span>
            <span class="sh-sub">Revenue Breakdown</span>
        </div>
        <div class="section-body">
            <table class="kv-table">
                <tr><td>සාමාන්‍ය පොලිය (Interest)</td><td style="color:#27ae60;">${fmt(fin.totalInterest)}</td></tr>
                <tr><td>දඩ පොලිය (Penalty)</td><td style="color:#e67e22;">${fmt(fin.totalPenalty)}</td></tr>
                <tr><td>ප්‍රමාද ගාස්තු (Late Fee)</td><td style="color:#e74c3c;">${fmt(fin.totalLateFee)}</td></tr>
                <tr><td>හිඟ මුදල් Settled</td><td>${fmt(fin.totalArrearsSettled)}</td></tr>
                <tr class="tr-total"><td>📊 මුළු ලාභය</td><td style="color:#1a2a6c;">${fmt(netProfit)}</td></tr>
            </table>
        </div>
    </div>
    <div class="section">
        <div class="section-hdr">
            <span class="sh-title">2. Capital Movement</span>
            <span class="sh-sub">ප්‍රාග්ධන චලනය</span>
        </div>
        <div class="section-body">
            <table class="kv-table">
                <tr><td>ඒ මාසේ ලැබුණු Capital</td><td style="color:#2980b9;">${fmt(fin.totalPrincipalRecovered)}</td></tr>
                <tr><td>CLOSED Loans - Capital</td><td style="color:#8e44ad;">${fmt(totalClosedCapital)}</td></tr>
                <tr><td>ඉතිරි Active Capital</td><td style="color:#e67e22;">${fmt(totalActiveCapital)}</td></tr>
                <tr><td>CLOSED Loans (ඒ මාසේ)</td><td>${closedThisMonth.length} ක්</td></tr>
                <tr><td>ගෙවූ Transactions</td><td>${logs.length} ක්</td></tr>
            </table>
        </div>
    </div>
</div>

<!-- Section 3: Profit Analysis per Loan -->
<div class="section">
    <div class="section-hdr">
        <span class="sh-title">3. ලාභ විශ්ලේෂණය – Loan එකින් Loan එකට</span>
        <span class="sh-sub">Monthly Profit Analysis (ACTIVE + CLOSED)</span>
    </div>
    <div class="section-body">
        <table>
            <thead>
                <tr>
                    <th>ගනුදෙනුකරු</th>
                    <th>Loan / Sub</th>
                    <th class="text-right">ඉලක්ක පොලිය</th>
                    <th class="text-right">ගෙවූ පොලිය</th>
                    <th class="text-right">අමතර ගාස්තු</th>
                    <th class="text-right">ගෙවූ Capital</th>
                    <th class="text-right">හිඟ පොලිය</th>
                    <th class="text-center">තත්ත්වය</th>
                </tr>
            </thead>
            <tbody>
                ${profitAnalysis.map(r => {
                    const target  = Number(r.TargetInterest);
                    const paidInt = Number(r.PaidInterest);
                    const charges = Number(r.PaidCharges);
                    const capital = Number(r.PaidCapital);
                    const pending = Math.max(0, target - paidInt);
                    const isClosed = r.DisbursementStatus === 'CLOSED';
                    const badge = isClosed
                        ? statusBadge('SETTLED','#1a5276','#d6eaf8')
                        : pending < 1
                        ? statusBadge('PAID','#1e8449','#d5f5e3')
                        : statusBadge('PENDING','#c0392b','#fde8e8');
                    return `<tr class="${isClosed ? 'tr-closed' : ''}">
                        <td>
                            <b>${r.CustomerName}</b>
                            ${isClosed ? '<br><span style="font-size:9px;background:#eaecee;color:#555;padding:1px 6px;border-radius:10px;">CLOSED</span>' : ''}
                        </td>
                        <td>${typeBadge(r.LoanType)}<br><small style="color:#555;">${r.LoanID} (Sub ${r.SubLoanNumber})</small></td>
                        <td class="text-right">${fmt(target)}</td>
                        <td class="text-right" style="color:#27ae60;font-weight:700;">${fmt(paidInt)}</td>
                        <td class="text-right" style="color:#e67e22;">${fmt(charges)}</td>
                        <td class="text-right" style="color:#8e44ad;font-weight:700;">${fmt(capital)}</td>
                        <td class="text-right" style="color:#e74c3c;font-weight:700;">${fmt(pending)}</td>
                        <td class="text-center">${badge}</td>
                    </tr>`;
                }).join('')}
                <tr class="tr-total">
                    <td colspan="2">📊 එකතුව (${profitAnalysis.length} records)</td>
                    <td class="text-right">${fmt(paTotalTarget)}</td>
                    <td class="text-right" style="color:#27ae60;">${fmt(paTotalPaidInt)}</td>
                    <td class="text-right" style="color:#e67e22;">${fmt(paTotalCharges)}</td>
                    <td class="text-right" style="color:#8e44ad;">${fmt(paTotalCapital)}</td>
                    <td class="text-right" style="color:#e74c3c;">${fmt(paTotalPending)}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<!-- Section 4: No Payment -->
<div class="section">
    <div class="section-hdr">
        <span class="sh-title">4. ඒ මාසේ ගෙවීමක් නොකළ ගනුදෙනුකරුවන්</span>
        <span class="sh-sub">No Payment This Month</span>
    </div>
    <div class="section-body">
        ${noPayers.length === 0
            ? '<div class="empty-state">✅ සියලු ගනුදෙනුකරුවන් ඒ මාසේ ගෙවීම සිදු කර ඇත.</div>'
            : `<table>
                <thead><tr>
                    <th>ගනුදෙනුකරු</th><th>Loan / Sub</th>
                    <th class="text-right">ඉතිරි Capital</th>
                    <th class="text-right">අපේක්ෂිත පොලිය</th>
                    <th class="text-center">Due Date</th>
                </tr></thead>
                <tbody>
                    ${noPayers.map(r => `<tr>
                        <td><b>${r.CustomerName}</b></td>
                        <td>${typeBadge(r.LoanType)} <small>${r.LoanID} (Sub ${r.SubLoanNumber})</small></td>
                        <td class="text-right">${fmt(r.RemainingPrincipal)}</td>
                        <td class="text-right" style="color:#e74c3c;font-weight:700;">${fmt(r.ExpectedInterest)}</td>
                        <td class="text-center">${fmtDate(r.NextDueDate)}</td>
                    </tr>`).join('')}
                    <tr class="tr-total">
                        <td colspan="3">📊 නොගෙවූ අපේක්ෂිත (${noPayers.length} loans)</td>
                        <td class="text-right" style="color:#e74c3c;">${fmt(noPayers.reduce((s,r)=>s+Number(r.ExpectedInterest),0))}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>`}
    </div>
</div>

<div class="page-break"></div>
<div class="page-header">
    <div class="ph-title">📋 ක්‍රියාත්මක ණය කළඹ සහ ගනුදෙනු</div>
    <div class="ph-period">${year} ${monthNames[month]}</div>
</div>

<!-- Section 5: Active Portfolio -->
<div class="section">
    <div class="section-hdr">
        <span class="sh-title">5. ක්‍රියාත්මක ණය කළඹ</span>
        <span class="sh-sub">Active Loan Portfolio (${activePortfolio.length} loans)</span>
    </div>
    <div class="section-body">
        <table>
            <thead><tr>
                <th>ගනුදෙනුකරු</th><th>Loan / Sub</th>
                <th class="text-right">මුල් Capital</th>
                <th class="text-right">ඉතිරි Capital</th>
                <th class="text-center">Rate%</th>
                <th class="text-right">මාසික පොලිය</th>
                <th class="text-right">හිඟ</th>
                <th class="text-right">ඒ මාසේ ගෙවූ</th>
                <th class="text-center">Next Due</th>
            </tr></thead>
            <tbody>
                ${activePortfolio.map(p => `<tr>
                    <td><b>${p.CustomerName}</b></td>
                    <td>${typeBadge(p.LoanType)}<br><small style="color:#555;">${p.LoanID} (Sub ${p.SubLoanNumber})</small></td>
                    <td class="text-right">${fmt(p.InitialCapital)}</td>
                    <td class="text-right" style="font-weight:700;color:#2980b9;">${fmt(p.RemainingPrincipal)}</td>
                    <td class="text-center">${Number(p.InterestRate).toFixed(1)}%</td>
                    <td class="text-right" style="color:#27ae60;">${fmt(p.MonthlyInterest)}</td>
                    <td class="text-right" style="color:${Number(p.CurrentArrears)>0?'#e74c3c':'#27ae60'};font-weight:700;">${fmt(p.CurrentArrears)}</td>
                    <td class="text-right" style="color:${Number(p.PaidThisMonth)>0?'#27ae60':'#aaa'};">${fmt(p.PaidThisMonth)}</td>
                    <td class="text-center" style="font-size:10px;">${fmtDate(p.NextDueDate)}</td>
                </tr>`).join('')}
                <tr class="tr-total">
                    <td colspan="3">📊 Total Active (${activePortfolio.length} loans)</td>
                    <td class="text-right" style="color:#2980b9;">${fmt(totalActiveCapital)}</td>
                    <td></td>
                    <td class="text-right" style="color:#27ae60;">${fmt(activePortfolio.reduce((s,r)=>s+Number(r.MonthlyInterest),0))}</td>
                    <td class="text-right" style="color:#e74c3c;">${fmt(totalArrears)}</td>
                    <td class="text-right">${fmt(activePortfolio.reduce((s,r)=>s+Number(r.PaidThisMonth),0))}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<!-- Section 6: Closed This Month -->
<div class="section">
    <div class="section-hdr">
        <span class="sh-title">6. ඒ මාසේ Settle වූ ණය</span>
        <span class="sh-sub">Loans Closed This Month (${closedThisMonth.length})</span>
    </div>
    <div class="section-body">
        ${closedThisMonth.length === 0
            ? '<div class="empty-state">ඒ මාසේ Settle වූ ණය නොමැත.</div>'
            : `<table>
                <thead><tr>
                    <th>ගනුදෙනුකරු</th><th>Loan / Sub</th>
                    <th class="text-right">මුල් Capital</th>
                    <th class="text-right">ලැබුණු Capital</th>
                    <th class="text-right">ලැබුණු Interest</th>
                    <th class="text-center">Closed Date</th>
                </tr></thead>
                <tbody>
                    ${closedThisMonth.map(r => `<tr>
                        <td><b>${r.CustomerName}</b></td>
                        <td>${typeBadge(r.LoanType)} <small>${r.LoanID} (Sub ${r.SubLoanNumber})</small></td>
                        <td class="text-right">${fmt(r.InitialCapital)}</td>
                        <td class="text-right" style="color:#8e44ad;font-weight:700;">${fmt(r.CapitalRecoveredThisMonth)}</td>
                        <td class="text-right" style="color:#27ae60;font-weight:700;">${fmt(r.InterestRecoveredThisMonth)}</td>
                        <td class="text-center">${fmtDate(r.ClosedDate)}</td>
                    </tr>`).join('')}
                    <tr class="tr-total">
                        <td colspan="3">📊 Total Recovered</td>
                        <td class="text-right" style="color:#8e44ad;">${fmt(closedThisMonth.reduce((s,r)=>s+Number(r.CapitalRecoveredThisMonth),0))}</td>
                        <td class="text-right" style="color:#27ae60;">${fmt(closedThisMonth.reduce((s,r)=>s+Number(r.InterestRecoveredThisMonth),0))}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>`}
    </div>
</div>

<!-- Section 7: Defaulters -->
<div class="section">
    <div class="section-hdr">
        <span class="sh-title">7. වාරික නොගෙවූ ගනුදෙනුකරුවන්</span>
        <span class="sh-sub">Defaulters List</span>
    </div>
    <div class="section-body">
        ${defaulters.length === 0
            ? '<div class="empty-state">✅ හිඟ ගෙවීම් හෝ Defaulters නොමැත.</div>'
            : `<table>
                <thead><tr>
                    <th>ගනුදෙනුකරු</th><th>Loan / Sub</th>
                    <th class="text-right">ඉතිරි Capital</th>
                    <th class="text-right">හිඟ මුදල</th>
                    <th class="text-center">Next Due</th>
                    <th class="text-center">Overdue</th>
                </tr></thead>
                <tbody>
                    ${defaulters.map(d => `<tr>
                        <td><b>${d.CustomerName}</b></td>
                        <td>${typeBadge(d.LoanType)} <small>${d.LoanID} (Sub ${d.SubLoanNumber})</small></td>
                        <td class="text-right">${fmt(d.RemainingPrincipal)}</td>
                        <td class="text-right" style="color:#e74c3c;font-weight:800;">${fmt(d.CurrentArrears)}</td>
                        <td class="text-center">${fmtDate(d.NextDueDate)}</td>
                        <td class="text-center"><span style="background:#fde8e8;color:#c0392b;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">${d.DaysOverdue} days</span></td>
                    </tr>`).join('')}
                    <tr class="tr-total">
                        <td colspan="3">📊 මුළු හිඟ (${defaulters.length} loans)</td>
                        <td class="text-right" style="color:#e74c3c;">${fmt(defaulters.reduce((s,d)=>s+Number(d.CurrentArrears),0))}</td>
                        <td colspan="2"></td>
                    </tr>
                </tbody>
            </table>`}
    </div>
</div>

<div class="page-break"></div>
<div class="page-header">
    <div class="ph-title">📒 සම්පූර්ණ ගනුදෙනු විස්තරය</div>
    <div class="ph-period">${year} ${monthNames[month]} &nbsp;|&nbsp; Transactions: ${logs.length}</div>
</div>

<!-- Section 8: Full Audit Log -->
<div class="section">
    <div class="section-hdr">
        <span class="sh-title">8. ගනුදෙනු සම්පූර්ණ විස්තරය</span>
        <span class="sh-sub">Full Transaction Audit Log</span>
    </div>
    <div class="section-body">
        ${logs.length === 0
            ? '<div class="empty-state">ඒ මාසේ ගනුදෙනු නොමැත.</div>'
            : `<table>
                <thead><tr>
                    <th>දිනය</th><th>ගනුදෙනුකරු</th><th>Loan</th>
                    <th class="text-right">Total Paid</th>
                    <th class="text-right">Capital</th>
                    <th class="text-right">Interest</th>
                    <th class="text-right">Penalty</th>
                    <th class="text-right">Late Fee</th>
                    <th class="text-right">Arrears</th>
                    <th class="text-right">Bal.Capital</th>
                </tr></thead>
                <tbody>
                    ${logs.map(l => `<tr>
                        <td style="white-space:nowrap;">${fmtDate(l.PaymentDate)}</td>
                        <td><b>${l.CustomerName}</b></td>
                        <td>${typeBadge(l.LoanType)}<br><small>${l.LoanID} #${l.SubLoanNumber}</small></td>
                        <td class="text-right" style="font-weight:700;">${fmt(l.TotalPaid)}</td>
                        <td class="text-right" style="color:#2980b9;">${fmt(l.PrincipalPaid)}</td>
                        <td class="text-right" style="color:#27ae60;">${fmt(l.InterestPaid)}</td>
                        <td class="text-right" style="color:#e67e22;">${fmt(l.PenaltyPaid)}</td>
                        <td class="text-right" style="color:#e74c3c;">${fmt(l.LateFeePaid)}</td>
                        <td class="text-right" style="color:#8e44ad;">${fmt(l.ArrearsSettled)}</td>
                        <td class="text-right" style="font-weight:700;color:#1a2a6c;">${fmt(l.BalancePrincipal)}</td>
                    </tr>`).join('')}
                    <tr class="tr-total">
                        <td colspan="3">📊 Totals (${logs.length} transactions)</td>
                        <td class="text-right">${fmt(logs.reduce((s,l)=>s+Number(l.TotalPaid),0))}</td>
                        <td class="text-right" style="color:#2980b9;">${fmt(logs.reduce((s,l)=>s+Number(l.PrincipalPaid),0))}</td>
                        <td class="text-right" style="color:#27ae60;">${fmt(logs.reduce((s,l)=>s+Number(l.InterestPaid),0))}</td>
                        <td class="text-right" style="color:#e67e22;">${fmt(logs.reduce((s,l)=>s+Number(l.PenaltyPaid),0))}</td>
                        <td class="text-right" style="color:#e74c3c;">${fmt(logs.reduce((s,l)=>s+Number(l.LateFeePaid),0))}</td>
                        <td class="text-right" style="color:#8e44ad;">${fmt(logs.reduce((s,l)=>s+Number(l.ArrearsSettled),0))}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>`}
    </div>
</div>

<footer>
    GAGANA INVESTMENT MANAGEMENT SYSTEM &nbsp;|&nbsp; ${year} ${monthNames[month]} Monthly Report &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}
</footer>

</div>
</body>
</html>`;

            // ==========================================
            // 4. PDF GENERATION
            // ==========================================
            const workerWindow = new BrowserWindow({ show: false });
            await workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

            const pdfBuffer = await workerWindow.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                marginsType: 1,
                landscape: false
            });

            fs.writeFileSync(finalPath, pdfBuffer);
            workerWindow.close();

            return { success: true, path: finalPath };

        } catch (err) {
            console.error("Backup Error:", err);
            return { success: false, error: err.message };
        }
    }
}

export default new BackupService();