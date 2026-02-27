export const createTablesQuery = `
-- ==========================================
-- 1. USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS Users (
    UserID      VARCHAR(50) PRIMARY KEY,
    Username    VARCHAR(50) NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Phone       VARCHAR(20),
    Role        ENUM('admin', 'manager', 'staff') NOT NULL,
    IsActive    BOOLEAN DEFAULT TRUE
);

-- ==========================================
-- 2. CUSTOMERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS customers (
    CustomerID      VARCHAR(50) PRIMARY KEY,
    CustomerName    VARCHAR(100) NOT NULL,
    NIC             VARCHAR(20) UNIQUE,
    CustomerPhone   VARCHAR(20),
    Gender          VARCHAR(10),
    CustomerAddress TEXT,
    IsBlacklisted   BOOLEAN DEFAULT FALSE,
    BlacklistReason TEXT,
    CreatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. MAIN LOANS TABLE (Account Master)
-- ==========================================
CREATE TABLE IF NOT EXISTS loans (
    LoanID      VARCHAR(50) PRIMARY KEY,
    CustomerID  VARCHAR(50) NOT NULL,
    LoanType    ENUM('VEHICLE', 'LAND', 'PROMISSORY', 'CHECK') NOT NULL,
    Status      ENUM('ACTIVE', 'CLOSED', 'DEFAULTED') DEFAULT 'ACTIVE',
    CreatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CustomerID) REFERENCES customers(CustomerID) ON DELETE CASCADE
);

-- ==========================================
-- 4. LOAN DISBURSEMENTS (Sub Loans)
-- ==========================================
CREATE TABLE IF NOT EXISTS loan_disbursements (
    DisbursementID     INT AUTO_INCREMENT PRIMARY KEY,
    LoanID             VARCHAR(50) NOT NULL,
    SubLoanNumber      INT NOT NULL CHECK (SubLoanNumber BETWEEN 1 AND 5),
    TotalAmount        DECIMAL(15, 2) NOT NULL,
    RemainingPrincipal DECIMAL(15, 2) NOT NULL,
    GivenAmount        DECIMAL(15, 2),
    
    -- මෙන්න මේ rates හැම sub loan එකකටම වෙන් වෙන්ව පවතී
    InterestRate       DECIMAL(5, 2) NOT NULL,    -- මාසික පොලිය %
    LateFeePerDay      DECIMAL(10, 2) DEFAULT 0,  -- දිනකට නියමිත දඩය (රු.)
    MonthlyPenaltyRate DECIMAL(5, 2) DEFAULT 0,   -- මාසික දඩ පොලිය %

    CurrentArrears     DECIMAL(15, 2) DEFAULT 0.00,
    DisbursedDate      DATE NOT NULL,
    NextDueDate        DATE NOT NULL,
    LastInterestDate   DATE,
    LastPaymentDate    DATE,
    LastSmsDate DATETIME DEFAULT NULL,
    DisbursementStatus ENUM('ACTIVE', 'CLOSED') DEFAULT 'ACTIVE',
    
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE,
    UNIQUE (LoanID, SubLoanNumber)
);
-- ==========================================
-- 5-8. TYPE SPECIFIC DETAILS (One-to-One)
-- ==========================================
CREATE TABLE IF NOT EXISTS vehicle_details (
    LoanID          VARCHAR(50) PRIMARY KEY,
    OwnerName       VARCHAR(100) NOT NULL,
    VehicleNumber   VARCHAR(20) NOT NULL,
    VehicleType     VARCHAR(50),
    CurrentValue    DECIMAL(15, 2),
    LoanLimit       DECIMAL(15, 2),
    RegistrationDate DATE,
    Liyapadinchikalayuthudinaya DATE NULL,
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS land_details (
    LoanID        VARCHAR(50) PRIMARY KEY,
    LandNumber    VARCHAR(100),
    Location      VARCHAR(255),
    Size          VARCHAR(100),
    CurrentValue  DECIMAL(15, 2),
    LoanLimit     DECIMAL(15, 2),
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

-- Promissory සහ Check tables ඔබේ මුල් ආකාරයටම පවතී...
CREATE TABLE IF NOT EXISTS promissory_details (
    LoanID VARCHAR(50) PRIMARY KEY,
    PromissoryNumber VARCHAR(100),
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS check_details (
    LoanID VARCHAR(50) PRIMARY KEY,
    CheckNumber VARCHAR(50) NOT NULL,
    OwnerName VARCHAR(100),
    CheckDateNumber VARCHAR(100),
    BankAccountDetails VARCHAR(200),
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

-- ==========================================
-- 9. LOAN BENEFICIARIES (Guarantors)
-- ==========================================
CREATE TABLE IF NOT EXISTS loan_beneficiaries (
    BeneficiaryID  INT AUTO_INCREMENT PRIMARY KEY,
    LoanID         VARCHAR(50),
    Name           VARCHAR(100),
    Phone          VARCHAR(20),
    Address        TEXT,
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID) ON DELETE CASCADE
);

-- ==========================================
-- 10. PAYMENT HISTORY (The Ledger)
-- ==========================================
CREATE TABLE IF NOT EXISTS payment_history (
    PaymentID        INT AUTO_INCREMENT PRIMARY KEY,
    DisbursementID   INT NOT NULL,
    LoanID           VARCHAR(50) NOT NULL,
    
    -- ගෙවූ මුදල් විස්තර
    TotalPaid        DECIMAL(15, 2) NOT NULL, -- මුළු ගෙවීම
    PrincipalPaid    DECIMAL(15, 2) DEFAULT 0, -- ප්‍රාග්ධනයට කැපුණු මුදල
    InterestPaid     DECIMAL(15, 2) DEFAULT 0, -- සාමාන්‍ය පොලියට
    LateFeePaid      DECIMAL(15, 2) DEFAULT 0, -- දින 1-29 දඩය (Late Fee)
    PenaltyPaid      DECIMAL(15, 2) DEFAULT 0, -- මාසික දඩ පොලිය (Penalty)

    -- Arrears Logic
    ArrearsAdded     DECIMAL(15, 2) DEFAULT 0, -- අලුතින් හිඟ මුදලට එකතු වූ ගණන
    ArrearsSettled   DECIMAL(15, 2) DEFAULT 0, -- පැරණි හිඟ මුදල් වලින් පියවූ ගණන
    BalanceArrears   DECIMAL(15, 2) NOT NULL,  -- ගෙවීමෙන් පසු ඉතිරි මුළු හිඟ මුදල
    MonthsCovered    INT DEFAULT 0,
    BalancePrincipal DECIMAL(15, 2) NOT NULL, -- ඉතිරි ප්‍රාග්ධනය
    PaymentDate      DATE NOT NULL,
    CollectedBy      VARCHAR(50),             -- ගෙවීම භාරගත් පරිශීලකයා
    IsVoided         BOOLEAN DEFAULT FALSE,
    CreatedAt        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (DisbursementID) REFERENCES loan_disbursements(DisbursementID),
    FOREIGN KEY (LoanID) REFERENCES loans(LoanID),
    FOREIGN KEY (CollectedBy) REFERENCES Users(UserID)
);


`;
