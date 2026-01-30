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
        const sql = `
            SELECT l.*, c.CustomerName, c.NIC, c.CustomerPhone,
            IFNULL((SELECT SUM(CapitalPaid) FROM payment_history WHERE LoanID = l.LoanID), 0) as TotalCapitalPaid,
            (SELECT MAX(PaymentDate) FROM payment_history WHERE LoanID = l.LoanID) as LastPaymentDate
            FROM loans l 
            JOIN customers c ON l.CustomerID = c.CustomerID
            WHERE l.LoanID = ?`;

        const [rows] = await db.execute(sql, [loanId]);
        if (rows.length === 0) return { success: false, message: "ණය විස්තර හමු නොවීය." };

        const loan = rows[0];
        
        // ගෙවීම් ඉතිහාසය ලබා ගැනීම
        const [history] = await db.execute(
            "SELECT * FROM payment_history WHERE LoanID = ? ORDER BY PaymentDate DESC, PaymentID DESC", 
            [loanId]
        );

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
                const diffTime = today.getTime() - dueDate.getTime();
                overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                let monthsDiff = (today.getFullYear() - dueDate.getFullYear()) * 12;
                monthsDiff += today.getMonth() - dueDate.getMonth();
                
                if (today.getDate() < dueDate.getDate()) {
                    arrearsMonths = Math.max(1, monthsDiff); 
                } else {
                    arrearsMonths = monthsDiff + 1;
                }

                totalInterestDue = arrearsMonths * monthlyInterestAmount;

                if (overdueDays > 0) {
                    const penaltyRate = parseFloat(loan.PenaltyRateOnInterest || 5) / 100;
                    const dailyPenalty = (monthlyInterestAmount * penaltyRate) / 30;
                    penaltyDue = dailyPenalty * overdueDays;
                }
            }
        }

        const totalPayableNow = totalInterestDue + penaltyDue;

        return {
            success: true,
            data: {
                loanId: loan.LoanID,
                customer: { name: loan.CustomerName, nic: loan.NIC },
                dates: {
                    nextDueDate: loan.NextDueDate,
                    issuedDate: loan.LoanDate,
                    lastPaymentDate: loan.LastPaymentDate // මෙන්න අන්තිමට ගෙවපු දවස
                },
                financials: {
                    originalAmount: parseFloat(loan.LoanAmount),
                    capitalBalance: capitalBalance,
                    monthlyInterest: monthlyInterestAmount,
                    totalPayableNow: totalPayableNow
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