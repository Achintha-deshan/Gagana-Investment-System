import db from '../config/db.js';

class LoanService {
    /**
     * පරණ දත්ත පද්ධතියට ඇතුළත් කිරීම (Migration)
     * UI එකෙන් එවන සියලුම දත්ත එලෙසම සුරැකීමට සකසා ඇත.
     */
    async insertOldLoan(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const { 
                loanID, 
                customerID, 
                loanType, 
                status, 
                subLoan, 
                typeDetails 
            } = data;

            // 1. Loans Table එකට මූලික දත්ත ඇතුළත් කිරීම
            await connection.execute(
                `INSERT INTO loans (LoanID, CustomerID, LoanType, Status) VALUES (?, ?, ?, ?)`,
                [loanID, customerID, loanType, status]
            );

            // 2. Loan Type එක අනුව අදාළ Details Table එකට දත්ත ඇතුළත් කිරීම
            if (loanType === 'VEHICLE') {
                await connection.execute(
                    `INSERT INTO vehicle_details 
                    (LoanID, OwnerName, VehicleNumber, VehicleType, CurrentValue, Liyapadinchikalayuthudinaya) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        loanID, 
                        typeDetails.OwnerName, 
                        typeDetails.VehicleNumber, 
                        typeDetails.VehicleType, 
                        typeDetails.CurrentValue || 0,
                        typeDetails.Liyapadinchikalayuthudinaya || null
                    ]
                );
            } else if (loanType === 'LAND') {
                await connection.execute(
                    `INSERT INTO land_details (LoanID, LandNumber, Location, Size, CurrentValue) 
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        loanID, 
                        typeDetails.LandNumber, 
                        typeDetails.Location, 
                        typeDetails.Size, 
                        typeDetails.CurrentValue || 0
                    ]
                );
            } else if (loanType === 'PROMISSORY') {
                await connection.execute(
                    `INSERT INTO promissory_details (LoanID, PromissoryNumber) VALUES (?, ?)`,
                    [loanID, typeDetails.PromissoryNumber]
                );
            } else if (loanType === 'CHECK') {
                await connection.execute(
                    `INSERT INTO check_details (LoanID, CheckNumber, OwnerName, BankAccountDetails) 
                    VALUES (?, ?, ?, ?)`,
                    [
                        loanID, 
                        typeDetails.CheckNumber, 
                        typeDetails.OwnerName, 
                        typeDetails.BankAccountDetails
                    ]
                );
            }

            // 3. Sub-Loan (loan_disbursements) ඇතුළත් කිරීම
            // මෙහිදී UI එකෙන් එවන NextDueDate එක කෙලින්ම සේව් කරනු ලබයි.
            // LastInterestDate එක ලෙස 'අවසන් වරට පොලී ගෙවූ දිනය' (LastPaymentDate) සේව් කරයි.
            
            await connection.execute(
                `INSERT INTO loan_disbursements (
                    LoanID, 
                    SubLoanNumber, 
                    TotalAmount, 
                    RemainingPrincipal, 
                    InterestRate, 
                    DisbursedDate, 
                    LastPaymentDate, 
                    NextDueDate, 
                    LastInterestDate,
                    DisbursementStatus
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    loanID,
                    subLoan.subLoanNumber || 1, 
                    subLoan.totalAmount,
                    subLoan.remainingPrincipal,
                    subLoan.interestRate,
                    subLoan.disbursedDate,      // UI එකෙන් එන දිනය
                    subLoan.lastPaymentDate,    // UI එකෙන් එන දිනය
                    subLoan.nextDueDate,        // UI එකෙන් Manual දෙන දිනය
                    subLoan.lastPaymentDate,    // පද්ධතිය පොලී හදන්න පටන් ගන්න ඕනෙ මේ දිනයේ සිටයි
                    status                      // ACTIVE or CLOSED
                ]
            );

            await connection.commit();
            return { success: true, loanID: loanID };

        } catch (error) {
            if (connection) await connection.rollback();
            console.error("Migration Service Error:", error);
            return { success: false, error: error.message };
        } finally {
            if (connection) connection.release();
        }
    }
}

export default new LoanService();