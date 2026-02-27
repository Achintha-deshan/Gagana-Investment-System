import db from '../config/db.js';

class MonthlyAnalysisService {
    async getMonthlyProfitData(year, month) {
        try {
            const sql = `
                SELECT 
                    c.CustomerName, 
                    l.LoanID, 
                    l.LoanType,
                    ld.DisbursementID, 
                    ld.SubLoanNumber,
                    ld.DisbursementStatus,
                    ld.NextDueDate,

                    -- 1. ඉලක්කගත මාසික පොලිය
                    --    ACTIVE නම්: RemainingPrincipal * Rate
                    --    CLOSED නම් / ඒ මාසේ close වූ නම්: ඒ මාසේ ඇත්තෙන්ම ගෙවූ InterestPaid ම target
                    CASE 
                        WHEN ld.DisbursementStatus = 'ACTIVE' THEN
                            ROUND(ld.RemainingPrincipal * (ld.InterestRate / 100), 2)
                        ELSE
                            -- CLOSED loan: target = ඒ මාසේ ගෙවූ interest (අඩු කරගත නොහැකි)
                            IFNULL((
                                SELECT SUM(ph2.InterestPaid)
                                FROM payment_history ph2
                                WHERE ph2.DisbursementID = ld.DisbursementID
                                AND ph2.IsVoided = 0
                                AND MONTH(ph2.PaymentDate) = ? AND YEAR(ph2.PaymentDate) = ?
                            ), 0)
                    END AS MonthlyInterestTarget,

                    -- 2. ඒ මාසේ ගෙවූ පොලිය
                    IFNULL((
                        SELECT SUM(ph.InterestPaid) 
                        FROM payment_history ph 
                        WHERE ph.DisbursementID = ld.DisbursementID 
                        AND ph.IsVoided = 0 
                        AND MONTH(ph.PaymentDate) = ? AND YEAR(ph.PaymentDate) = ?
                    ), 0) AS PaidInterestThisMonth,

                    -- 3. ඒ මාසේ ගෙවූ අමතර ගාස්තු
                    IFNULL((
                        SELECT SUM(ph.PenaltyPaid + ph.LateFeePaid + ph.ArrearsSettled) 
                        FROM payment_history ph 
                        WHERE ph.DisbursementID = ld.DisbursementID 
                        AND ph.IsVoided = 0 
                        AND MONTH(ph.PaymentDate) = ? AND YEAR(ph.PaymentDate) = ?
                    ), 0) AS PaidChargesThisMonth,

                    -- 4. ඒ මාසේ ගෙවූ Capital (Principal)
                    IFNULL((
                        SELECT SUM(ph.PrincipalPaid)
                        FROM payment_history ph
                        WHERE ph.DisbursementID = ld.DisbursementID
                        AND ph.IsVoided = 0
                        AND MONTH(ph.PaymentDate) = ? AND YEAR(ph.PaymentDate) = ?
                    ), 0) AS PaidPrincipalThisMonth

                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE (
                    -- Case 1: ACTIVE loans - Due Date ඒ මාසේ
                    (
                        ld.DisbursementStatus = 'ACTIVE'
                        AND MONTH(ld.NextDueDate) = ? AND YEAR(ld.NextDueDate) = ?
                    )
                    OR
                    -- Case 2: ඕනෑම loan (ACTIVE හෝ CLOSED) - ඒ මාසේ payment සිදු කළ
                    EXISTS (
                        SELECT 1 FROM payment_history ph 
                        WHERE ph.DisbursementID = ld.DisbursementID 
                        AND MONTH(ph.PaymentDate) = ? AND YEAR(ph.PaymentDate) = ?
                        AND ph.IsVoided = 0
                    )
                )
                ORDER BY c.CustomerName ASC, l.LoanID ASC`;

            // Parameters order: target(month,year), paid_int(month,year), paid_charges(month,year), paid_principal(month,year), active_due(month,year), exists_payment(month,year)
            const params = [
                month, year,   // CLOSED target calculation
                month, year,   // PaidInterestThisMonth
                month, year,   // PaidChargesThisMonth
                month, year,   // PaidPrincipalThisMonth
                month, year,   // ACTIVE NextDueDate filter
                month, year    // EXISTS payment filter
            ];

            const [rows] = await db.execute(sql, params);

            return rows.map(row => {
                const target    = parseFloat(row.MonthlyInterestTarget || 0);
                const paidInt   = parseFloat(row.PaidInterestThisMonth || 0);
                const paidExtra = parseFloat(row.PaidChargesThisMonth || 0);
                const paidPrin  = parseFloat(row.PaidPrincipalThisMonth || 0);

                // Pending = target වලින් ගෙවූ interest අඩු කළාට පස්සේ ඉතිරි
                const pending = Math.max(0, target - paidInt);

                // Total Revenue = Interest + Charges (Capital ගණන් ගන්නේ නෑ - ඒක profit නෙමෙයි)
                const totalReceived = paidInt + paidExtra;

                // Status:
                // CLOSED loan = ඒ මාසේ close වූ → SETTLED label
                // ACTIVE + fully paid → PAID
                // ACTIVE + pending ඇත → PENDING
                let status;
                if (row.DisbursementStatus === 'CLOSED') {
                    status = 'SETTLED';
                } else if (pending < 1.0) {
                    status = 'PAID';
                } else {
                    status = 'PENDING';
                }

                return {
                    customer:       row.CustomerName,
                    loanInfo:       `${row.LoanID} (Sub: ${row.SubLoanNumber})`,
                    type:           row.LoanType,
                    loanStatus:     row.DisbursementStatus,
                    targetProfit:   target,
                    actualInterest: paidInt,
                    extraCharges:   paidExtra,
                    principalPaid:  paidPrin,
                    pendingInterest: pending,
                    totalRevenue:   totalReceived,
                    status:         status
                };
            });

        } catch (error) {
            console.error("Monthly Analysis Error:", error);
            throw error;
        }
    }
}

export default new MonthlyAnalysisService();