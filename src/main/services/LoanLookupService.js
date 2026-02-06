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
            // 1. මූලික ණය සහ පාරිභෝගික දත්ත ලබා ගැනීම
            const sql = `
                SELECT l.*, c.CustomerName, c.NIC, c.CustomerPhone, c.CustomerAddress,
                IFNULL((SELECT SUM(CapitalPaid) FROM payment_history WHERE LoanID = l.LoanID AND IsVoided = 0), 0) as TotalCapitalPaid,
                (SELECT MAX(PaymentDate) FROM payment_history WHERE LoanID = l.LoanID AND IsVoided = 0) as LastPaymentDate
                FROM loans l 
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE l.LoanID = ?`;

            const [rows] = await db.execute(sql, [loanId]);
            if (rows.length === 0) return { success: false, message: "ණය විස්තර හමු නොවීය." };

            const loan = rows[0];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const loanStartDate = new Date(loan.LoanDate);
            const nextDueDate = new Date(loan.NextDueDate);

            const loanAmount = parseFloat(loan.LoanAmount) || 0;
            const interestRate = parseFloat(loan.InterestRate) || 0;
            const monthlyInterest = loanAmount * (interestRate / 100);

            // --- පොලිය ගණනය කිරීමේ Logic එක ---
            const diffInMsStart = today.getTime() - loanStartDate.getTime();
            const daysSinceLoanStart = Math.floor(diffInMsStart / (1000 * 60 * 60 * 24));

            let totalInterest = 0;
            let statusMessage = "";
            let arrearsMonths = 0;

            if (daysSinceLoanStart <= 31) {
                arrearsMonths = 1;
                if (daysSinceLoanStart <= 7) {
                    totalInterest = monthlyInterest * 0.25;
                    statusMessage = "දින 7කට අඩු (1/4 පොලිය)";
                } else if (daysSinceLoanStart <= 14) {
                    totalInterest = monthlyInterest * 0.50;
                    statusMessage = "දින 14කට අඩු (1/2 පොලිය)";
                } else if (daysSinceLoanStart <= 21) {
                    totalInterest = monthlyInterest * 0.75;
                    statusMessage = "දින 21කට අඩු (3/4 පොලිය)";
                } else {
                    totalInterest = monthlyInterest;
                    statusMessage = "දින 21 ඉක්මවා ඇත (සම්පූර්ණ පොලිය)";
                }
            } else {
                arrearsMonths = Math.max(1, Math.ceil(daysSinceLoanStart / 30));
                totalInterest = monthlyInterest * arrearsMonths;
                statusMessage = `මාස ${arrearsMonths} ක් සඳහා පොලිය`;
            }

            // --- දඩ මුදල් ගණනය කිරීම (සහන දින 2 සහිතව) ---
            let totalPenalty = 0;
            let overdueDays = 0;
            if (today > nextDueDate) {
                overdueDays = Math.floor((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
                if (overdueDays > 2) { 
                    const penaltyRate = parseFloat(loan.PenaltyRateOnInterest) || 0;
                    const dailyPenaltyRate = (monthlyInterest * (penaltyRate / 100)) / 30;
                    totalPenalty = dailyPenaltyRate * overdueDays;
                }
            }

            // 2. ඇපකරුවන්ගේ විස්තර ලබා ගැනීම
            const [beneficiaries] = await db.execute(
                `SELECT Name, Phone, Address FROM loan_beneficiaries WHERE LoanID = ?`, 
                [loanId]
            );

            // 3. ණය වර්ගය අනුව විශේෂිත දත්ත (Asset Details) ලබා ගැනීම
            let specificDetails = null;
            const type = loan.LoanType;
            
            if (type === 'VEHICLE') {
                const [res] = await db.execute(`SELECT * FROM vehicle_details WHERE LoanID = ?`, [loanId]);
                specificDetails = res[0] || null;
            } else if (type === 'LAND') {
                const [res] = await db.execute(`SELECT * FROM land_details WHERE LoanID = ?`, [loanId]);
                specificDetails = res[0] || null;
            } else if (type === 'PROMISSORY') {
                const [res] = await db.execute(`SELECT * FROM promissory_details WHERE LoanID = ?`, [loanId]);
                specificDetails = res[0] || null;
            } else if (type === 'CHECK') {
                const [res] = await db.execute(`SELECT * FROM check_details WHERE LoanID = ?`, [loanId]);
                specificDetails = res[0] || null;
            }

            // 4. ගෙවීම් ඉතිහාසය ලබා ගැනීම (අවසන් ගනුදෙනු 10)
            const [history] = await db.execute(
                `SELECT * FROM payment_history WHERE LoanID = ? AND IsVoided = 0 ORDER BY PaymentDate DESC LIMIT 10`,
                [loanId]
            );

            return {
                success: true,
                data: {
                    loanId: loan.LoanID,
                    customer: {
                        name: loan.CustomerName,
                        nic: loan.NIC,
                        phone: loan.CustomerPhone,
                        address: loan.CustomerAddress
                    },
                    dates: { 
                        issuedDate: loan.LoanDate, 
                        nextDueDate: loan.NextDueDate,
                        lastPaymentDate: loan.LastPaymentDate 
                    },
                    financials: {
                        originalAmount: loanAmount,
                        monthlyInterest: monthlyInterest,
                        totalInterestDue: totalInterest,
                        totalPenaltyDue: totalPenalty,
                        totalPayableNow: loanAmount + totalInterest + totalPenalty
                    },
                    overdue: {
                        days: overdueDays,
                        months: arrearsMonths,
                        statusNote: statusMessage
                    },
                    type: type,
                    specifics: specificDetails,
                    beneficiaries: beneficiaries,
                    history: history
                }
            };
        } catch (error) {
            console.error("Database Error:", error);
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