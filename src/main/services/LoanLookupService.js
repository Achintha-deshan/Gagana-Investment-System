import db from '../config/db.js';

class LoanLookupService {

    async searchMasterLoans(query) {
        try {
            const like = `%${query}%`;
            const sql = `
                SELECT l.LoanID, l.LoanType, l.Status, l.CreatedAt,
                       c.CustomerID, c.CustomerName, c.NIC, c.CustomerPhone
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE c.CustomerName LIKE ? OR c.NIC LIKE ? OR c.CustomerID = ? OR l.LoanID = ?
                ORDER BY l.CreatedAt DESC`;
            
            const [rows] = await db.execute(sql, [like, like, query, query]);
            return { success: true, data: rows };
        } catch (error) {
            console.error("Search Error:", error);
            return { success: false, error: error.message };
        }
    }

    async getFullLoanAnalysis(loanId) {
        try {
            const [loanRows] = await db.execute(`
                SELECT l.*, c.CustomerName, c.NIC, c.CustomerPhone, c.CustomerAddress
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE l.LoanID = ?`, [loanId]);

            if (loanRows.length === 0) throw new Error("ණය තොරතුරු හමු නොවීය.");
            const loanMaster = loanRows[0];

            const [subLoans] = await db.execute(`
                SELECT * FROM loan_disbursements 
                WHERE LoanID = ? 
                ORDER BY SubLoanNumber ASC`, [loanId]);

            const analyzedSubLoans = subLoans.map(sub => this._calculateSubLoanAnalytics(sub));

            const assetDetails = await this._getAssetDetails(loanId, loanMaster.LoanType);

            const [beneficiaries] = await db.execute(
                `SELECT Name, Phone, Address FROM loan_beneficiaries WHERE LoanID = ?`, [loanId]
            );

            // ✅ නිවැරදි කිරීම: Payment History එකේ DisbursementID එකත් ලබා ගැනීම
            const [history] = await db.execute(`
                SELECT * FROM payment_history 
                WHERE LoanID = ? AND IsVoided = 0 
                ORDER BY PaymentDate DESC LIMIT 15`, [loanId]);

            // ✅ නිවැරදි කිරීම: මුළු ගෙවිය යුතු එකතුව = (හිඟ මුදල් එකතුව + ඉතිරි මූලධනය)
            const grandTotalPayable = analyzedSubLoans.reduce((sum, sub) => {
                const principal = parseFloat(sub.RemainingPrincipal) || 0;
                return sum + sub.totalArrearsToPay + principal;
            }, 0);

            return {
                success: true,
                data: {
                    master: loanMaster,
                    subLoans: analyzedSubLoans,
                    assets: assetDetails,
                    beneficiaries: beneficiaries,
                    history: history,
                    summary: {
                        grandTotalPayable: Number(grandTotalPayable.toFixed(2)),
                        activeSubLoansCount: analyzedSubLoans.filter(s => s.DisbursementStatus === 'ACTIVE').length,
                        closedSubLoansCount: analyzedSubLoans.filter(s => s.DisbursementStatus === 'CLOSED').length
                    }
                }
            };
        } catch (error) {
            console.error("Analysis Error:", error);
            return { success: false, error: error.message };
        }
    }

    _calculateSubLoanAnalytics(sub) {
        if (sub.DisbursementStatus === 'CLOSED') {
            return { 
                ...sub, 
                subLoanIdDisplay: sub.DisbursementID,
                interestDue: 0, 
                penaltyDue: 0, 
                pastArrears: 0,
                totalArrearsToPay: 0,
                statusNote: "පියවා අවසන්"
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextDueDate = new Date(sub.NextDueDate);
        
        const principal = parseFloat(sub.RemainingPrincipal) || 0;
        const monthlyRate = parseFloat(sub.InterestRate) || 0;
        const penaltyRatePerMonth = parseFloat(sub.MonthlyPenaltyRate) || 0;

        const monthlyInterest = principal * (monthlyRate / 100);
        
        let interestDue = 0;
        let penaltyDue = 0;
        let overdueDays = 0;

        if (today > nextDueDate) {
            overdueDays = Math.floor((today - nextDueDate) / (1000 * 60 * 60 * 24));
            
            let diffMonths = (today.getFullYear() - nextDueDate.getFullYear()) * 12;
            diffMonths += today.getMonth() - nextDueDate.getMonth();
            if (today.getDate() < nextDueDate.getDate()) diffMonths--; 

            const monthsCount = Math.max(0, diffMonths) + 1; 
            interestDue = monthlyInterest * monthsCount;
            
            const dailyPenaltyRate = (penaltyRatePerMonth / 100) / 30;
            penaltyDue = principal * dailyPenaltyRate * overdueDays;
        } else {
            interestDue = monthlyInterest; 
            penaltyDue = 0;
        }

        const pastArrears = parseFloat(sub.CurrentArrears) || 0;

        return {
            ...sub,
            subLoanIdDisplay: sub.DisbursementID,
            interestDue: Number(interestDue.toFixed(2)),
            penaltyDue: Number(penaltyDue.toFixed(2)),
            pastArrears: Number(pastArrears.toFixed(2)),
            totalArrearsToPay: Number((interestDue + penaltyDue + pastArrears).toFixed(2)),
            overdueDays: overdueDays
        };
    }

    async _getAssetDetails(loanId, type) {
        const tableMap = { 'VEHICLE': 'vehicle_details', 'LAND': 'land_details', 'PROMISSORY': 'promissory_details', 'CHECK': 'check_details' };
        const table = tableMap[type];
        if (!table) return null;
        const [rows] = await db.execute(`SELECT * FROM ${table} WHERE LoanID = ?`, [loanId]);
        return rows[0] || null;
    }
}

export default new LoanLookupService();