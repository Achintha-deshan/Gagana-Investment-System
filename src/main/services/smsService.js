import db from '../config/db.js';

const API_URL = "https://app.fitsms.lk/api/v4/sms/send";
const API_TOKEN = "371|9km1jftaCr7HPp6WAu7TLoByzvik2LAYFZcWIe8B3591e7bd";
const SENDER_ID = "GAGANA-INVS"; 

class SMSService {
    
    async sendSMS(recipient, message) {
        try {
            let formattedRecipient = recipient.replace(/\D/g, '');
            if (formattedRecipient.startsWith('0')) {
                formattedRecipient = '94' + formattedRecipient.substring(1);
            } else if (!formattedRecipient.startsWith('94')) {
                formattedRecipient = '94' + formattedRecipient;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    recipient: formattedRecipient,
                    sender_id: SENDER_ID,
                    type: 'unicode',
                    message: message
                })
            });

            const result = await response.json();
            return { 
                success: response.ok && (result.status === "success" || result.status === true), 
                data: result,
                statusCode: response.status
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async checkAndSendDailyReminders() {
        try {
            const sql = `
                SELECT 
                    ld.DisbursementID,
                    l.LoanID, 
                    l.LoanType,
                    ld.SubLoanNumber,
                    c.CustomerPhone, 
                    c.CustomerName, 
                    c.Gender, 
                    ld.NextDueDate,
                    ld.TotalAmount
                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID 
                WHERE ld.NextDueDate = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                AND (ld.LastSmsDate IS NULL OR DATE(ld.LastSmsDate) != CURDATE())
                AND ld.DisbursementStatus = 'ACTIVE'
                AND l.Status = 'ACTIVE'`;

            const [rows] = await db.execute(sql);
            
            if (rows.length === 0) {
                return { success: true, sentCount: 0 };
            }

            let sentCount = 0;

            for (let row of rows) {
                const dateObj = new Date(row.NextDueDate);
                const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
                const firstName = row.CustomerName ? row.CustomerName.split(' ')[0] : 'පාරිභෝගිකයා';
                
                // ස්ත්‍රී/පුරුෂ භාවය අනුව ගෞරව නාමය
                let title = (row.Gender === 'Male') ? "මහතා" : (row.Gender === 'Female') ? "මහත්මිය" : "";

                // ණය වර්ගය සිංහලට හැරවීම
                let lTypeSinhala = "";
                switch(row.LoanType) {
                    case 'VEHICLE': lTypeSinhala = "වාහන"; break;
                    case 'LAND': lTypeSinhala = "ඉඩම්"; break;
                    case 'PROMISSORY': lTypeSinhala = "ගිවිසුම්"; break;
                    case 'CHECK': lTypeSinhala = "චෙක්පත්"; break;
                    default: lTypeSinhala = "ණය";
                }

                const fullLoanRef = `${row.LoanID}-${row.SubLoanNumber}`;

                // නව පණිවිඩය: ණය වර්ගය (Loan Type) ඇතුළත් කර ඇත
                const message = `සිහි කැඳවීමයි! ${firstName} ${title}, ඔබ ලබාගත් ${lTypeSinhala} (${fullLoanRef}) ණයෙහි වාරිකය ${formattedDate} දිනට ගෙවිය යුතුයි. Gagana Investment`;

                const res = await this.sendSMS(row.CustomerPhone, message);

                if (!res.success) {
                    return { 
                        success: false, 
                        message: res.data?.message || "SMS ශේෂය අවසන් වී ඇති බව පෙනේ.", 
                        statusCode: res.statusCode 
                    };
                }

                await db.execute(
                    "UPDATE loan_disbursements SET LastSmsDate = NOW() WHERE DisbursementID = ?", 
                    [row.DisbursementID]
                );
                sentCount++;
            }

            return { success: true, sentCount: sentCount };

        } catch (error) {
            console.error("Critical SMS Error:", error);
            return { success: false, message: error.message };
        }
    }

    async getLogsByDate(targetDate) {
        try {
            const dateToQuery = targetDate || new Date().toISOString().split('T')[0];

            const sql = `
                SELECT 
                    ld.DisbursementID,
                    l.LoanID as customerId, 
                    c.CustomerName as customerName, 
                    c.CustomerPhone as phone, 
                    ld.NextDueDate as dueDate, 
                    DATE_FORMAT(ld.LastSmsDate, '%h:%i %p') as sentTime,
                    CASE 
                        WHEN DATE(ld.LastSmsDate) = ? THEN 1 
                        ELSE 0 
                    END as isSent
                FROM loan_disbursements ld
                JOIN loans l ON ld.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE ld.NextDueDate = DATE_ADD(?, INTERVAL 1 DAY)
                AND ld.DisbursementStatus = 'ACTIVE'
                ORDER BY isSent DESC, ld.LastSmsDate DESC`;

            const [rows] = await db.execute(sql, [dateToQuery, dateToQuery]);
            return rows;
        } catch (error) {
            console.error("SMS Log SQL Error:", error);
            throw error;
        }
    }
}

export default new SMSService();