import db from '../config/db.js';

const API_URL = "https://app.fitsms.lk/api/v4/sms/send";
const API_TOKEN = "371|9km1jftaCr7HPp6WAu7TLoByzvik2LAYFZcWIe8B3591e7bd";
const SENDER_ID = "GAGANA-INVS"; 

class SMSService {
    
    // 1. තනි SMS එකක් යැවීම
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

    // 2. දිනපතා SMS පරීක්ෂාව සහ යැවීම (Gender එකතු කරන ලදී)
    async checkAndSendDailyReminders() {
        try {
            const sql = `
                SELECT 
                    l.LoanID, 
                    c.CustomerPhone, 
                    c.CustomerName, 
                    c.Gender, 
                    l.NextDueDate 
                FROM loans l 
                JOIN customers c ON l.CustomerID = c.CustomerID 
                WHERE l.NextDueDate = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                AND (l.SmsDate IS NULL OR DATE(l.SmsDate) != CURDATE())
                AND l.Status = 'ACTIVE'`;

            const [rows] = await db.execute(sql);
            
            if (rows.length === 0) {
                return { success: true, sentCount: 0 };
            }

            let sentCount = 0;

            for (let row of rows) {
                const dateObj = new Date(row.NextDueDate);
                const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
                
                // නමේ මුල් කෑල්ල ගැනීම
                const firstName = row.CustomerName ? row.CustomerName.split(' ')[0] : 'පාරිභෝගිකයා';
                
                // Gender එක අනුව ගෞරව නාමය තේරීම
                let title = "";
                if (row.Gender === 'Male') {
                    title = "මහතා"; // Mr.
                } else if (row.Gender === 'Female') {
                    title = "මහත්මිය"; // Mrs./Miss
                }

                // මැසේජ් එක සැකසීම
                const message = `සිහි කැඳවීමයි! ${firstName} ${title}, ඔබගේ වාරිකය ${formattedDate} දිනට ගෙවිය යුතුයි. Gagana Investment`;

                // SMS එක යැවීම
                const res = await this.sendSMS(row.CustomerPhone, message);

                if (!res.success) {
                    return { 
                        success: false, 
                        message: res.data?.message || "SMS ශේෂය අවසන් වී ඇති බව පෙනේ.", 
                        statusCode: res.statusCode 
                    };
                }

                // සාර්ථක නම් පමණක් Database update කිරීම
                await db.execute(
                    "UPDATE loans SET SmsDate = NOW(), SmsMessage = ? WHERE LoanID = ?", 
                    [message, row.LoanID]
                );
                sentCount++;
            }

            return { success: true, sentCount: sentCount };

        } catch (error) {
            console.error("Critical Backend Error:", error);
            return { success: false, message: error.message };
        }
    }

    // 3. යැවූ සහ යැවිය යුතු සියලු දෙනාගේ වාර්තාව
    async getLogsByDate(targetDate) {
        try {
            const dateToQuery = targetDate || new Date().toISOString().split('T')[0];

            const sql = `
                SELECT 
                    l.LoanID as customerId, 
                    c.CustomerName as customerName, 
                    c.CustomerPhone as phone, 
                    l.NextDueDate as dueDate, 
                    DATE_FORMAT(l.SmsDate, '%h:%i %p') as sentTime,
                    CASE 
                        WHEN DATE(l.SmsDate) = ? THEN 1 
                        ELSE 0 
                    END as isSent
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE l.NextDueDate = DATE_ADD(?, INTERVAL 1 DAY)
                AND l.Status = 'ACTIVE'
                ORDER BY isSent DESC, l.SmsDate DESC`;

            const [rows] = await db.execute(sql, [dateToQuery, dateToQuery]);
            return rows;
        } catch (error) {
            console.error("SQL Error:", error);
            throw error;
        }
    }
}

export default new SMSService();