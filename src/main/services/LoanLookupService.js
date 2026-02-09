import db from '../config/db.js';

class LoanLookupService {
    
    async getCustomerLoans(customerId) {
        try {
            const sql = `SELECT LoanID, LoanType, LoanAmount, Status, LoanDate FROM loans WHERE CustomerID = ?`;
            const [rows] = await db.execute(sql, [customerId]);
            return { success: true, loans: rows };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getDetailedBreakdown(loanId) {
        try {
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

            const nextDueDate = new Date(loan.NextDueDate);
            const loanAmount = parseFloat(loan.LoanAmount) || 0;
            const interestRate = parseFloat(loan.InterestRate) || 0;
            const monthlyInterest = loanAmount * (interestRate / 100);

            let arrearsMonths = 0;
            let totalInterest = 0;
            let statusMessage = "";

            // --- Arrears Months සහ Interest Logic එක ---
            if (today > nextDueDate) {
                // නියමිත දිනය පහු වී ඇති අවස්ථාව (Overdue)
                let diffMonths = (today.getFullYear() - nextDueDate.getFullYear()) * 12;
                diffMonths += today.getMonth() - nextDueDate.getMonth();

                if (today.getDate() < nextDueDate.getDate()) {
                    diffMonths--;
                }

                arrearsMonths = Math.max(0, diffMonths) + 1;
                totalInterest = monthlyInterest * arrearsMonths;
                statusMessage = `මාස ${arrearsMonths} ක් සඳහා පොලිය ප්‍රමාදයි`;
            } else {
                // නියමිත දිනය පහු වී නැති අවස්ථාව (Not Overdue)
                // මෙහිදී arrearsMonths අනිවාර්යයෙන්ම 0 විය යුතුය
                arrearsMonths = 0; 
                
                // වත්මන් මාසය සඳහා ගෙවිය යුතු පොලිය දින ගණන අනුව බැලීම
                const lastCycleDate = new Date(nextDueDate);
                lastCycleDate.setMonth(lastCycleDate.getMonth() - 1);
                
                const diffInMsCycle = today.getTime() - lastCycleDate.getTime();
                const daysInCurrentCycle = Math.floor(diffInMsCycle / (1000 * 60 * 60 * 24));

                if (daysInCurrentCycle <= 7) {
                    totalInterest = monthlyInterest * 0.25;
                    statusMessage = "දින 7කට අඩු (1/4 පොලිය)";
                } else if (daysInCurrentCycle <= 14) {
                    totalInterest = monthlyInterest * 0.50;
                    statusMessage = "දින 14කට අඩු (1/2 පොලිය)";
                } else if (daysInCurrentCycle <= 21) {
                    totalInterest = monthlyInterest * 0.75;
                    statusMessage = "දින 21කට අඩු (3/4 පොලිය)";
                } else {
                    totalInterest = monthlyInterest;
                    statusMessage = "සම්පූර්ණ වාරික පොලිය";
                }
            }

            // --- දඩ මුදල් ගණනය කිරීම (Penalty) ---
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

            // --- අනෙකුත් විස්තර ලබා ගැනීම ---
            const [beneficiaries] = await db.execute(
                `SELECT Name, Phone, Address FROM loan_beneficiaries WHERE LoanID = ?`, 
                [loanId]
            );

            let specificDetails = null;
            const type = loan.LoanType;
            const detailTables = { 
                'VEHICLE': 'vehicle_details', 
                'LAND': 'land_details', 
                'PROMISSORY': 'promissory_details', 
                'CHECK': 'check_details' 
            };
            
            if (detailTables[type]) {
                const [res] = await db.execute(`SELECT * FROM ${detailTables[type]} WHERE LoanID = ?`, [loanId]);
                specificDetails = res[0] || null;
            }

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
        const tableMap = { 'VEHICLE': 'vehicle_details', 'LAND': 'land_details' };
        const table = tableMap[type] || null;
        if (!table) return null;
        const [rows] = await db.execute(`SELECT * FROM ${table} WHERE LoanID = ?`, [loanId]);
        return rows[0] || null;
    }
}

export default new LoanLookupService();