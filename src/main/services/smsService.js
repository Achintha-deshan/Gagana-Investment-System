import db from '../config/db.js';

const API_URL = "https://app.fitsms.lk/api/v4/sms/send";
const API_TOKEN = "371|9km1jftaCr7HPp6WAu7TLoByzvik2LAYFZcWIe8B3591e7bd";

class SMSService {
    
    // 1. තනි SMS එකක් යැවීමේ ශ්‍රිතය
    async sendSMS(recipient, message) {
        try {
            let formattedRecipient = recipient.replace(/\D/g, '');
            if (formattedRecipient.startsWith('0')) {
                formattedRecipient = '94' + formattedRecipient.substring(1);
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
                    sender_id: "The Change",
                    type: 'unicode',
                    message: message
                })
            });

            const result = await response.json();
            console.log("FitSMS API Response:", result);

            // FitSMS v4 එකේ සාර්ථක නම් result.status === true හෝ response.ok වේ
            return { 
                success: response.ok && (result.status === "success" || result.status === true), 
                data: result 
            };
        } catch (error) {
            console.error("SMS Sending Error:", error);
            return { success: false, message: error.message };
        }
    }

  // 2. දිනපතා ස්වයංක්‍රීයව SMS යැවීමේ ක්‍රියාවලිය
 // ... පෙර කොටස් එලෙසම පවතී

async checkAndSendDailyReminders() {
    try {
        console.log("Database query starting for daily reminders...");

        const sql = `
            SELECT l.LoanID, c.CustomerPhone, c.CustomerName, l.NextDueDate 
            FROM loans l 
            JOIN customers c ON l.CustomerID = c.CustomerID 
            WHERE l.NextDueDate = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND (l.SmsDate IS NULL OR DATE(l.SmsDate) != CURDATE())
            AND l.Status = 'ACTIVE'`;

        const [rows] = await db.execute(sql);
        
        if (rows.length === 0) {
            console.log("No customers found for tomorrow's due date.");
            return { success: true, sentCount: 0 }; 
        }

        let sentCount = 0;
        let lastError = null;

        for (let row of rows) {
            const dateObj = new Date(row.NextDueDate);
            const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

            const message = `සිහි කැඳවීමයි! ${row.CustomerName}, ඔබේ ණය වාරිකය හෙට (${formattedDate}) දිනට යෙදී ඇත. කරුණාකර එදිනට ගෙවීම් සිදු කරන්න.\nස්තූතියි!\nGagana Investment`;
            
            const res = await this.sendSMS(row.CustomerPhone, message);

            if (res.success) {
                await db.execute("UPDATE loans SET SmsDate = NOW() WHERE LoanID = ?", [row.LoanID]);
                sentCount++;
            } else {
                // FitSMS API එකෙන් එන දෝෂය හඳුනා ගැනීම
                // සමහර විට message එක එන්නේ res.data.errors.message ලෙස විය හැකියි
                lastError = res.data?.message || res.data?.errors?.[0] || "SMS යැවීමේ දෝෂයකි";
                
                console.error(`Failed to send SMS to ${row.CustomerName}:`, lastError);

                // ලිමිට් එක ඉවර නම් දිගටම යැවීමට උත්සාහ කිරීමෙන් පලක් නැත
                const errLower = lastError.toLowerCase();
                if (errLower.includes("limit") || errLower.includes("balance") || errLower.includes("credit") || errLower.includes("insufficient")) {
                    break; 
                }
            }
        }

        // කිසිවක් යවා නැතිනම් සහ error එකක් තිබේ නම් පමණක් success: false එවන්න
        if (sentCount === 0 && lastError) {
            return { success: false, message: lastError };
        }

        return { success: true, sentCount: sentCount };

    } catch (error) {
        console.error("Detailed SMSService Error:", error);
        return { success: false, message: error.message };
    }
}

    // 3. UI එකේ පෙන්වීමට අද දින යැවූ SMS වාර්තා ලබා ගැනීම (අලුතින් එක් කළ කොටස)
    async getTodayLogs() {
        try {
            const sql = `
                SELECT 
                    l.LoanID as customerId, 
                    c.CustomerName as customerName, 
                    c.CustomerPhone as phone, 
                    l.NextDueDate as dueDate, 
                    DATE_FORMAT(l.SmsDate, '%h:%i %p') as sentTime 
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE DATE(l.SmsDate) = CURDATE()
                ORDER BY l.SmsDate DESC`;

            const [rows] = await db.execute(sql);
            return rows;
        } catch (error) {
            console.error("Error fetching SMS logs:", error);
            throw error;
        }
    }
}

export default new SMSService();