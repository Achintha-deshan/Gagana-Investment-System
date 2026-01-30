export const createTablesQuery = `


CREATE TABLE IF NOT EXISTS Users (
    UserID VARCHAR(50) PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Phone VARCHAR(20),
    Role ENUM('admin', 'manager', 'staff') NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    CustomerID VARCHAR(50) PRIMARY KEY,
    CustomerName VARCHAR(100) NOT NULL,
    NIC VARCHAR(20) UNIQUE,
    CustomerPhone VARCHAR(20),
    CustomerAddress TEXT,
    IsBlacklisted TINYINT(1) DEFAULT 0,
    BlacklistReason TEXT  -- අලුතින් එක් කළ කොටස
);

CREATE TABLE IF NOT EXISTS employee (
    EmployeeID VARCHAR(50) PRIMARY KEY,
    EmployeeName VARCHAR(100) NOT NULL,
    EmployeePhone VARCHAR(20),
    position VARCHAR(50)
);

-- 3. පොදු ණය වගුව (සියලුම ණය වර්ග සඳහා පොදු Logic මෙහි පවතී)
CREATE TABLE IF NOT EXISTS loans (
    LoanID VARCHAR(50) PRIMARY KEY,
    CustomerID VARCHAR(50),
    LoanType ENUM('VEHICLE', 'LAND', 'PROMISSORY', 'CHECK') NOT NULL,
    LoanAmount DECIMAL(15, 2) NOT NULL,
    GivenAmount DECIMAL(15, 2),
    LoanDate DATE NOT NULL,
    InterestRate DECIMAL(5, 2) NOT NULL,
    PenaltyRateOnInterest DECIMAL(5, 2), 
    NextDueDate DATE NOT NULL, -- Alert එක පෙන්වීමට මීළඟ වාරික දිනය
    LastInterestDate DATE, 
    Status ENUM('ACTIVE', 'CLOSED') DEFAULT 'ACTIVE',
    SmsDate DATE,
    SmsMessage TEXT,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CustomerID) REFERENCES customers(CustomerID) ON DELETE CASCADE
);

-- 4. වාහන ණය වලටම පමණක් අදාළ දත්ත
CREATE TABLE IF NOT EXISTS vehicle_details (
    LoanID VARCHAR(50) PRIMARY KEY,
    OwnerName VARCHAR(100) NOT NULL,
    VehicleNumber VARCHAR(20) NOT NULL,
    VehicleType VARCHAR(50),
    CurrentValue DECIMAL(15, 2),
    LoanLimit DECIMAL(15, 2),
    RegistrationDate DATE,
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

-- 5. ඉඩම් ණය වලටම පමණක් අදාළ දත්ත
CREATE TABLE IF NOT EXISTS land_details (
    LoanID VARCHAR(50) PRIMARY KEY,
    LanNumber VARCHAR(100),
    Location VARCHAR(255),
    Size VARCHAR(100),
    CurrentValue DECIMAL(15, 2),
    LoanLimit DECIMAL(15, 2),
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

-- 6. පොරොන්දු නෝට්ටු ණය විස්තර
CREATE TABLE IF NOT EXISTS promissory_details (
    LoanID VARCHAR(50) PRIMARY KEY,
    PromissoryNumber VARCHAR(100),
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

-- 7. චෙක්පත් ණය විස්තර
CREATE TABLE IF NOT EXISTS check_details (
    LoanID VARCHAR(50) PRIMARY KEY,
    CheckNumber VARCHAR(50) NOT NULL,
    OwnerName VARCHAR(100),
    CheckDateNumber VARCHAR(100),
    BankAccountDetails VARCHAR(200),
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

-- 8. ඇපකරුවන්ගේ වගුව (LoanID එක හරහා ඕනෑම වර්ගයකට සම්බන්ධ කළ හැක)
CREATE TABLE IF NOT EXISTS loan_beneficiaries (
    BeneficiaryID INT AUTO_INCREMENT PRIMARY KEY,
    LoanID VARCHAR(50),
    Name VARCHAR(100),
    Phone VARCHAR(20),
    Address TEXT,
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);


-- 9. ගෙවීම් වාර්තා (IsVoided Column එක සමඟ)
CREATE TABLE IF NOT EXISTS payment_history (
    PaymentID INT AUTO_INCREMENT PRIMARY KEY,
    LoanID VARCHAR(50),
    PaidAmount DECIMAL(15, 2) NOT NULL, 
    PenaltyPaid DECIMAL(15, 2) DEFAULT 0, 
    InterestPaid DECIMAL(15, 2) DEFAULT 0, 
    CapitalPaid DECIMAL(15, 2) DEFAULT 0, 
    MonthsPaid INT DEFAULT 1,            -- ගෙවූ මාස ගණන ගබඩා කිරීමට
    PaymentDate DATE NOT NULL,
    IsVoided TINYINT(1) DEFAULT 0,       -- ගෙවීම අවලංගු කර ඇත්දැයි බැලීමට (අවශ්‍යයි!)
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);


`;