import db from '../config/db.js';

class LoanLookupService {
    /**
     * පාරිභෝගිකයා සෙවීම
     */
    async getCustomerLoans(customerId) {
        try {
            const sql = `SELECT LoanID, LoanType, LoanAmount, Status, LoanDate FROM loans WHERE CustomerID = ?`;
            const [rows] = await db.execute(sql, [customerId]);
            return { success: true, loans: rows };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * ණය විශ්ලේෂණය සහ Arrears නිවැරදිව ගණනය කිරීම
     */
 async getDetailedBreakdown(loanId) {
    try {
        // 1. දත්ත ලබා ගැනීම (IsVoided නොමැති නිසා එය ඉවත් කර ඇත - ඔබ Column එක හැදුවා නම් එය නැවත එක් කරන්න)
        const sql = `
            SELECT l.*, c.CustomerName, c.NIC, c.CustomerPhone,
            IFNULL((SELECT SUM(CapitalPaid) FROM payment_history WHERE LoanID = l.LoanID), 0) as TotalCapitalPaid
            FROM loans l 
            JOIN customers c ON l.CustomerID = c.CustomerID
            WHERE l.LoanID = ?`;

        const [rows] = await db.execute(sql, [loanId]);
        if (rows.length === 0) return { success: false, message: "ණය විස්තර හමු නොවීය." };

        const loan = rows[0];
        const [history] = await db.execute(
            "SELECT * FROM payment_history WHERE LoanID = ? ORDER BY PaymentDate DESC", 
            [loanId]
        );

        // මූලික අගයන්
        let capitalBalance = parseFloat(loan.LoanAmount) - parseFloat(loan.TotalCapitalPaid);
        let monthlyInterestRate = parseFloat(loan.InterestRate || 5) / 100;
        let monthlyInterestAmount = capitalBalance * monthlyInterestRate;

        let arrearsMonths = 0;
        let overdueDays = 0;
        let penaltyDue = 0;
        let totalInterestDue = 0;

        if (loan.Status === 'ACTIVE') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dueDate = new Date(loan.NextDueDate);
            dueDate.setHours(0, 0, 0, 0);

            if (today >= dueDate) {
                // A. ප්‍රමාද වූ දින ගණන
                const diffTime = today.getTime() - dueDate.getTime();
                overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // B. හිඟ මාස ගණන (Arrears Months)
                // මාස 1ක් පහු වූ සැනින් 1 ලෙස ගණන් ගනී. 
                // උදා: Due Date Jan 1 නම්, Jan 2 වන විට හිඟ මාස 1 කි.
                let monthsDiff = (today.getFullYear() - dueDate.getFullYear()) * 12;
                monthsDiff += today.getMonth() - dueDate.getMonth();
                
                if (today.getDate() < dueDate.getDate()) {
                    // මාසය සම්පූර්ණ වී නැතිනම්
                    arrearsMonths = Math.max(1, monthsDiff); 
                } else {
                    arrearsMonths = monthsDiff + 1;
                }

                // C. පොලිය ගණනය කිරීම
                totalInterestDue = arrearsMonths * monthlyInterestAmount;

                // D. දඩය ගණනය කිරීම (Penalty)
                // පොලිය මත 5% ක දඩයක් (PenaltyRateOnInterest) ප්‍රමාද වූ සෑම දිනකටම
                if (overdueDays > 0) {
                    const penaltyRate = parseFloat(loan.PenaltyRateOnInterest || 5) / 100;
                    // දිනකට දඩය = (මාසික පොලිය * දඩ ප්‍රතිශතය) / 30
                    const dailyPenalty = (monthlyInterestAmount * penaltyRate) / 30;
                    penaltyDue = dailyPenalty * overdueDays;
                }
            } else {
                // තවම Due Date එක පැමිණ නැතිනම්, මේ මාසයේ පොලිය පමණක් පෙන්විය හැක (විකල්ප)
                totalInterestDue = 0; 
            }
        }

        // මුළු ගෙවිය යුතු මුදල = හිඟ පොලිය + දඩය
        // (මූලධනය මෙයට එකතු කරන්නේ නැත, මන්ද මෙය වාරික සේවාවක් බැවින්)
        const totalPayableNow = totalInterestDue + penaltyDue;

        return {
            success: true,
            data: {
                loanId: loan.LoanID,
                customer: { name: loan.CustomerName, nic: loan.NIC },
                dates: {
                    nextDueDate: loan.NextDueDate,
                    issuedDate: loan.LoanDate
                },
                financials: {
                    originalAmount: parseFloat(loan.LoanAmount),
                    capitalBalance: capitalBalance,
                    monthlyInterest: monthlyInterestAmount, // තනි මාසයක පොලිය
                    totalPayableNow: totalPayableNow         // දැනට ගෙවිය යුතු මුළු හිඟය
                },
                overdue: {
                    days: overdueDays,
                    months: arrearsMonths,
                    interestDue: totalInterestDue,
                    penaltyDue: penaltyDue
                },
                history: history
            }
        };
    } catch (error) {
        console.error("Lookup Service Error:", error);
        return { success: false, error: error.message };
    }
}

    async getSpecificDetails(loanId, type) {
        const table = type === 'VEHICLE' ? 'vehicle_details' : (type === 'LAND' ? 'land_details' : null);
        if (!table) return null;
        const [rows] = await db.execute(`SELECT * FROM ${table} WHERE LoanID = ?`, [loanId]);
        return rows[0] || null;
    }
}

export default new LoanLookupService();