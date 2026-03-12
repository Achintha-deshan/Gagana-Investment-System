import db from '../config/db.js';

function getNextAnchorDate(originalDisbursedDate, totalMonthsToAdvance) {
    // ✅ Timezone-safe parsing
    const dateStr = typeof originalDisbursedDate === 'string' 
        ? originalDisbursedDate.split('T')[0] 
        : new Date(originalDisbursedDate).toISOString().split('T')[0];
    
    const [y, m, day] = dateStr.split('-').map(Number);
    const anchorDay = day;
    
    // Target month/year ගණනය
    let targetMonth = (m - 1) + totalMonthsToAdvance; // 0-indexed
    let targetYear = y + Math.floor(targetMonth / 12);
    targetMonth = targetMonth % 12;
    
    // එම මාසයේ max days ගණනය
    const maxDayInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(anchorDay, maxDayInMonth);
    
    // ✅ Pad කරලා return
    const mm = String(targetMonth + 1).padStart(2, '0');
    const dd = String(finalDay).padStart(2, '0');
    return `${targetYear}-${mm}-${dd}`;
}

class PaymentService {

    /**
     * 1. පාරිභෝගිකයා සහ සියලුම Active Sub Loans සෙවීම
     */
    async getLoanWithSubLoans(masterLoanId) {
        try {
            const sql = `
                SELECT 
                    l.LoanID, l.LoanType, l.Status as LoanStatus,
                    c.CustomerID, c.CustomerName, c.NIC, c.CustomerPhone,
                    v.VehicleNumber, p.PromissoryNumber as PRMNo
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                LEFT JOIN vehicle_details v ON l.LoanID = v.LoanID
                LEFT JOIN promissory_details p ON l.LoanID = p.LoanID
                WHERE l.LoanID = ? AND l.Status = 'ACTIVE'
            `;
            const [loanRows] = await db.execute(sql, [masterLoanId]);
            if (loanRows.length === 0) return null;

            const [subRows] = await db.execute(
                `SELECT * FROM loan_disbursements 
                 WHERE LoanID = ? AND DisbursementStatus = 'ACTIVE' 
                 ORDER BY SubLoanNumber ASC`, 
                [masterLoanId]
            );

            return { masterData: loanRows[0], subLoans: subRows };
        } catch (error) {
            console.error("Error in getLoanWithSubLoans:", error);
            throw error;
        }
    }

    /**
     * 2. ගාස්තු ගණනය කිරීම (Breakdown) - නිවැරදි කරන ලදී
     */
   async getSubLoanBreakdown(disbursementId, customDate = null) {
    try {
        const [rows] = await db.execute(`SELECT * FROM loan_disbursements WHERE DisbursementID = ?`, [disbursementId]);
        if (rows.length === 0) return null;

        const sub = rows[0];
        const principal = parseFloat(sub.RemainingPrincipal) || 0;
        const monthlyInterestRate = (parseFloat(sub.InterestRate) || 0) / 100;
        const monthlyInterest = principal * monthlyInterestRate;
        const penaltyUnit = monthlyInterest * monthlyInterestRate;
        console.log("Current Interest Rate:", sub.InterestRate);
        console.log("Calculated Penalty Unit:", penaltyUnit);

        // ✅ FIX: Timezone-safe date helper
        function toSafeDateStr(val) {
            if (!val) return null;
            if (val instanceof Date) {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, '0');
                const d = String(val.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return String(val).split('T')[0];
        }

        // ✅ FIX: String parse කරලා Date object හදනවා (timezone shift නෑ)
        function parseLocalDate(str) {
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        const nextDueDateStr = toSafeDateStr(sub.NextDueDate);   // "2024-01-31"
        const disbursedDateStr = toSafeDateStr(sub.DisbursedDate); // "2024-01-01"

        // calcDate
        const calcDate = customDate 
            ? parseLocalDate(customDate.split('T')[0]) 
            : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();

        const dueDate = parseLocalDate(nextDueDateStr);

        const diffTime = calcDate.getTime() - dueDate.getTime();
        const totalOverdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const safeOverdueDays = Math.max(0, totalOverdueDays);

        let fullMonthsOverdue = Math.floor(safeOverdueDays / 30);
        let X = fullMonthsOverdue + 1;

        // ✅ FIX: string split කරලා month diff ගනී (timezone issue නෑ)
        const [sy, sm] = disbursedDateStr.split('-').map(Number);
        const [ny, nm] = nextDueDateStr.split('-').map(Number);
        let monthsFromStart = (ny - sy) * 12 + (nm - sm);

        let installments = [];
        for (let i = 0; i < X; i++) {
            let nextDate = getNextAnchorDate(disbursedDateStr, monthsFromStart + i);
            installments.push({
                dateName: nextDate,
                amount: Number(monthlyInterest.toFixed(2))
            });
        }

        let lateDaysInCurrentMonth = safeOverdueDays % 30;
        let currentMonthLateFee = 0;
        if (lateDaysInCurrentMonth > 0) {
            currentMonthLateFee = (penaltyUnit / 30) * lateDaysInCurrentMonth;
        }

        let totalPastPenalty = 0;
        if (X > 1) {
            totalPastPenalty = penaltyUnit * (X / 2) * (X - 1);
        }

        return {
            disbursementId: sub.DisbursementID,
            dbNextDueDate: nextDueDateStr, 
            principal: principal,
            installments: installments,
            pastMonthsPenalty: Number(totalPastPenalty.toFixed(2)),
            currentMonthLateFee: Number(currentMonthLateFee.toFixed(2)),
            lateDays: lateDaysInCurrentMonth,
            fullMonths: fullMonthsOverdue,
            arrearsAmount: parseFloat(sub.CurrentArrears) || 0
        };

    } catch (error) {
        console.error("Error in getSubLoanBreakdown:", error);
        throw error;
    }
}

   
    async processPayment(paymentData) {
        const DisbursementID = paymentData.DisbursementID || null;
        const LoanID = paymentData.LoanID || null;
        const TotalPaid = parseFloat(paymentData.TotalPaid) || 0;
const InterestPaid = parseFloat(paymentData.InterestRequired) || 0; 
const LateFeePaid = parseFloat(paymentData.LateFeeRequired) || 0;   
const PenaltyPaid = parseFloat(paymentData.PenaltyRequired) || 0;   
const ArrearsPaid = parseFloat(paymentData.ArrearsRequired) || 0;  
        const MonthsCovered = parseInt(paymentData.MonthsCovered) || 0;
        const PaymentDate = paymentData.PaymentDate || new Date().toISOString().split('T')[0];
        const CollectedBy = paymentData.CollectedBy || "SYSTEM";

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            let cashToDistribute = TotalPaid;
            const totalChargesToPay = Number((InterestPaid + LateFeePaid + PenaltyPaid + ArrearsPaid).toFixed(2));

            let settledCharges = Math.min(cashToDistribute, totalChargesToPay);
            cashToDistribute -= settledCharges;
            let newArrearsForThisSub = Math.max(0, Number((totalChargesToPay - settledCharges).toFixed(2)));

            let totalPrincipalPaid = 0;
            if (cashToDistribute > 0 && newArrearsForThisSub <= 0.01) {
                const [activeSubs] = await conn.execute(
                    `SELECT DisbursementID, RemainingPrincipal 
                     FROM loan_disbursements 
                     WHERE LoanID = ? AND DisbursementStatus = 'ACTIVE' 
                     ORDER BY SubLoanNumber ASC`, [LoanID]
                );

                for (let sub of activeSubs) {
                    if (cashToDistribute <= 0.01) break;
                    let subPrincipal = parseFloat(sub.RemainingPrincipal);
                    let deduction = Math.min(subPrincipal, cashToDistribute);
                    let updatedPrincipal = Number((subPrincipal - deduction).toFixed(2));
                    totalPrincipalPaid += deduction;
                    let subStatus = updatedPrincipal <= 0.05 ? 'CLOSED' : 'ACTIVE';

                    await conn.execute(
                        `UPDATE loan_disbursements 
                         SET RemainingPrincipal = ?, DisbursementStatus = ? 
                         WHERE DisbursementID = ?`,
                        [updatedPrincipal, subStatus, sub.DisbursementID]
                    );
                    cashToDistribute -= deduction;
                }
            }

          const [dates] = await conn.execute(
    `SELECT DisbursedDate, NextDueDate FROM loan_disbursements WHERE DisbursementID = ?`, 
    [DisbursementID]
);

let finalNextDueDate = dates[0].NextDueDate;
if (MonthsCovered > 0) {
    // ✅ Timezone-safe helper
    function toSafeDateStr(val) {
        if (val instanceof Date) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return String(val).split('T')[0];
    }

    const disbursedStr = toSafeDateStr(dates[0].DisbursedDate); // "2026-01-31"
    const nddStr = toSafeDateStr(dates[0].NextDueDate);         // "2026-02-28"

    // ✅ String split කරලා elapsed months ගනී (timezone issue නෑ)
    const [sy, sm] = disbursedStr.split('-').map(Number);
    const [ny, nm] = nddStr.split('-').map(Number);
    let elapsedMonths = (ny - sy) * 12 + (nm - sm); // Feb-Jan = 1

    // ✅ DisbursedDate anchor (31) use කරයි — Mar31 ✅
    finalNextDueDate = getNextAnchorDate(disbursedStr, elapsedMonths + MonthsCovered);
}

            await conn.execute(
                `UPDATE loan_disbursements 
                 SET CurrentArrears = ?, 
                     LastPaymentDate = ?, 
                     NextDueDate = ? 
                 WHERE DisbursementID = ?`,
                [newArrearsForThisSub, PaymentDate, finalNextDueDate, DisbursementID]
            );

            const [remainingActive] = await conn.execute(
                `SELECT COUNT(*) as activeCount FROM loan_disbursements 
                 WHERE LoanID = ? AND DisbursementStatus = 'ACTIVE'`, [LoanID]
            );
            if (remainingActive[0].activeCount === 0) {
                await conn.execute(`UPDATE loans SET Status = 'CLOSED' WHERE LoanID = ?`, [LoanID]);
            }

            const historySql = `
                INSERT INTO payment_history 
                (DisbursementID, LoanID, TotalPaid, PrincipalPaid, InterestPaid, LateFeePaid, PenaltyPaid, 
                 ArrearsSettled, MonthsCovered, BalancePrincipal, BalanceArrears, PaymentDate, CollectedBy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 
                        (SELECT IFNULL(SUM(RemainingPrincipal), 0) FROM loan_disbursements WHERE LoanID = ?), 
                        ?, ?, ?)`;
            
            await conn.execute(historySql, [
                DisbursementID, LoanID, TotalPaid, totalPrincipalPaid, InterestPaid, 
                LateFeePaid, PenaltyPaid, ArrearsPaid, MonthsCovered, LoanID, 
                newArrearsForThisSub, PaymentDate, CollectedBy
            ]);

            await conn.commit();
            return { success: true };
        } catch (error) {
            await conn.rollback();
            console.error("Payment Processing Error:", error);
            return { success: false, error: error.message };
        } finally {
            conn.release();
        }
    }

  /**
 * 4. ගෙවීම් අවලංගු කිරීම (Void Payment)
 */
async voidPayment(paymentId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. පවතින ගෙවීම් වාර්තාව පරීක්ෂා කිරීම
        const [payRows] = await conn.execute(
            'SELECT * FROM payment_history WHERE PaymentID = ? AND IsVoided = 0', 
            [paymentId]
        );
        
        if (!payRows.length) {
            throw new Error("ගෙවීම් වාර්තාව හමු නොවීය හෝ දැනටමත් අවලංගු කර ඇත.");
        }
        
        const p = payRows[0];
        
        // 2. ප්‍රාග්ධනය (Principal) ආපසු හැරවීම
        if (parseFloat(p.PrincipalPaid) > 0) {
            let principalToRestore = parseFloat(p.PrincipalPaid);
            // අන්තිමට පියවපු Sub Loan එකේ සිට ආපස්සට (DESC) එකතු කිරීම
            const [subs] = await conn.execute(
                `SELECT DisbursementID, RemainingPrincipal, TotalAmount FROM loan_disbursements 
                 WHERE LoanID = ? ORDER BY SubLoanNumber DESC`, [p.LoanID]
            );

            for (let sub of subs) {
                if (principalToRestore <= 0) break;
                let currentRem = parseFloat(sub.RemainingPrincipal);
                let maxCapacity = parseFloat(sub.TotalAmount) - currentRem;
                
                let restoreAmount = Math.min(maxCapacity, principalToRestore);
                if (restoreAmount > 0) {
                    await conn.execute(
                        `UPDATE loan_disbursements 
                         SET RemainingPrincipal = ROUND(RemainingPrincipal + ?, 2), 
                             DisbursementStatus = 'ACTIVE' 
                         WHERE DisbursementID = ?`, 
                        [restoreAmount, sub.DisbursementID]
                    );
                    principalToRestore -= restoreAmount;
                }
            }
        }

        // 3. ලෝන් එකේ තත්ත්වය නැවත ACTIVE කිරීම
        await conn.execute(`UPDATE loans SET Status = 'ACTIVE' WHERE LoanID = ?`, [p.LoanID]);

        // 4. Due Date එක සහ හිඟ මුදල් (Arrears) ආපසු හැරවීම
        const [vSub] = await conn.execute(
            "SELECT DisbursedDate, NextDueDate FROM loan_disbursements WHERE DisbursementID = ?", 
            [p.DisbursementID]
        );

       if (vSub.length > 0) {
    // ✅ Timezone-safe
    function toSafeDateStr(val) {
        if (val instanceof Date) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return String(val).split('T')[0];
    }

    const anchorStr = toSafeDateStr(vSub[0].DisbursedDate);
    const nddStr = toSafeDateStr(vSub[0].NextDueDate);

    const [sy, sm] = anchorStr.split('-').map(Number);
    const [ny, nm] = nddStr.split('-').map(Number);
    let currentGap = (ny - sy) * 12 + (nm - sm);

    const restoredNextDueDate = getNextAnchorDate(anchorStr, currentGap - p.MonthsCovered);

    await conn.execute(
        `UPDATE loan_disbursements 
         SET CurrentArrears = ROUND(CurrentArrears + ?, 2), 
             NextDueDate = ? 
         WHERE DisbursementID = ?`,
        [parseFloat(p.ArrearsSettled || 0), restoredNextDueDate, p.DisbursementID]
    );
}

        // 5. Payment record එක voided ලෙස සලකුණු කිරීම
        await conn.execute('UPDATE payment_history SET IsVoided = 1 WHERE PaymentID = ?', [paymentId]);

        await conn.commit();
        return { success: true };

    } catch (error) {
        await conn.rollback();
        console.error("Void Payment Error:", error);
        return { success: false, error: error.message };
    } finally { 
        conn.release(); 
    }
}

    // searchSettlement සහ voidPayment නොවෙනස්ව පවතී...
    async searchSettlement(query) {
        const sql = `
            SELECT l.LoanID, l.LoanType, l.Status, c.CustomerID, c.CustomerName, c.NIC, c.CustomerPhone,
            v.VehicleNumber, p.PromissoryNumber AS PRMNo
            FROM loans l
            JOIN customers c ON l.CustomerID = c.CustomerID
            LEFT JOIN (SELECT LoanID, VehicleNumber FROM vehicle_details GROUP BY LoanID) v ON l.LoanID = v.LoanID
            LEFT JOIN (SELECT LoanID, PromissoryNumber FROM promissory_details GROUP BY LoanID) p ON l.LoanID = p.LoanID
            WHERE (l.LoanID LIKE ? OR c.NIC LIKE ? OR c.CustomerName LIKE ? OR c.CustomerID LIKE ?)
            AND l.Status = 'ACTIVE'`;
        try {
            const term = `%${query}%`;
            const [rows] = await db.execute(sql, [term, term, term, term]);
            return rows;
        } catch (error) { return []; }
    }

    async getPaymentHistory(disbursementId) {
        try {
            // පසුව කරන ලද ගෙවීම් මුලට එන සේ (DESC) දත්ත ලබා ගනී
            const sql = `
                SELECT 
                    PaymentID,
                    DisbursementID,
                    LoanID,
                    TotalPaid,
                    PrincipalPaid,
                    InterestPaid,
                    LateFeePaid,
                    PenaltyPaid,
                    ArrearsSettled,
                    MonthsCovered,
                    BalancePrincipal,
                    BalanceArrears,
                    PaymentDate,
                    IsVoided,
                    CollectedBy,
                    CreatedAt
                FROM payment_history
                WHERE DisbursementID = ?
                ORDER BY PaymentDate DESC, CreatedAt DESC
                LIMIT 15
            `;
            
            const [rows] = await db.execute(sql, [disbursementId]);
            
            // UI එකේ පෙන්වීමට පෙර දත්ත සැකසීම (උදා: null අගයන් 0 කිරීම)
            return rows.map(row => ({
                ...row,
                TotalPaid: parseFloat(row.TotalPaid) || 0,
                InterestPaid: parseFloat(row.InterestPaid) || 0,
                PenaltyPaid: (parseFloat(row.PenaltyPaid) || 0) + (parseFloat(row.LateFeePaid) || 0), // Penalty සහ Late Fee එකතු කර පෙන්වීමට
                PrincipalPaid: parseFloat(row.PrincipalPaid) || 0,
                BalanceArrears: parseFloat(row.BalanceArrears) || 0,
                BalancePrincipal: parseFloat(row.BalancePrincipal) || 0
            }));

        } catch (error) {
            console.error("Error in getPaymentHistory service:", error);
            throw error;
        }
    }
    /**
 * 🎯 Master Loan ID එකක් ලබා දුන් විට ඒ යටතේ ඇති සියලුම 
 * Active Sub Loans වල අද දිනට මුළු හිඟය ගණනය කරයි.
 */
async getTotalOutstandingForMaster(masterLoanId) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // 1. එම Master Loan එකට අදාළ සියලුම Active Sub Loans ලබා ගැනීම
        const [subLoans] = await db.execute(
            `SELECT * FROM loan_disbursements 
             WHERE LoanID = ? AND DisbursementStatus = 'ACTIVE'`, 
            [masterLoanId]
        );

        let grandTotalDue = 0;

        // 2. සෑම Sub Loan එකකටම අදාළ Breakdown එක ගණනය කිරීම
        for (const sub of subLoans) {
            // අපි කලින් හදපු getSubLoanBreakdown logic එකම මෙහිදී භාවිතා කරයි
            const breakdown = await this.getSubLoanBreakdown(sub.DisbursementID, today);
            
            if (breakdown) {
                // වාරිකවල එකතුව
                const installmentsSum = breakdown.installments.reduce((sum, inst) => sum + inst.amount, 0);
                
                // හිඟය + පොලිය + දඩ + ප්‍රමාද ගාස්තු
                const subTotal = 
                    breakdown.arrearsAmount + 
                    installmentsSum + 
                    breakdown.pastMonthsPenalty + 
                    breakdown.currentMonthLateFee;

                grandTotalDue += subTotal;
            }
        }

        return { 
            success: true, 
            masterLoanId: masterLoanId, 
            totalOutstanding: Number(grandTotalDue.toFixed(2)) 
        };

    } catch (error) {
        console.error("Error in getTotalOutstandingForMaster:", error);
        return { success: false, error: error.message };
    }
}
}

export default new PaymentService();