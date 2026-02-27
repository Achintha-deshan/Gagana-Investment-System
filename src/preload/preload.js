const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    auth: {
        login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
        logout: () => ipcRenderer.invoke('auth:logout')
    },

    user: {
        getAll: () => ipcRenderer.invoke('users:get-all'),
        add: (userData) => ipcRenderer.invoke('users:add', userData),
        update: (userData) => ipcRenderer.invoke('users:update', userData),
        delete: (userId) => ipcRenderer.invoke('users:delete', userId)
    },
    customer: {
        getAll: () => ipcRenderer.invoke('customers:get-all'),
        getNextId: () => ipcRenderer.invoke('customers:get-next-id'),
        add: (data) => ipcRenderer.invoke('customers:add', data),
        update: (data) => ipcRenderer.invoke('customers:update', data),
        delete: (id) => ipcRenderer.invoke('customers:delete', id),
        search: (query) => ipcRenderer.invoke('customers:search', query)
    },

vehicleLoan: {
    getAll: () => ipcRenderer.invoke('vehicle-loans:get-all'),
    getById: (loanId) => ipcRenderer.invoke('vehicle-loans:get-by-id', loanId),
    getNextId: () => ipcRenderer.invoke('vehicle-loans:get-next-id'),
    add: (data) => ipcRenderer.invoke('vehicle-loans:add', data),
    addSub: (data) => ipcRenderer.invoke('vehicle-loans:add-sub', data),
    update: (data) => ipcRenderer.invoke('vehicle-loans:update', data),
    delete: (loanId) => ipcRenderer.invoke('vehicle-loans:delete', loanId),
    deleteSub: (loanId, disbursementId) => ipcRenderer.invoke('vehicle-loans:delete-sub', loanId, disbursementId),
    checkBeneficiaryActive: (name, phone) => 
        ipcRenderer.invoke('vehicle-loans:check-beneficiary-active', { name, phone }),
    getBeneficiaries: (loanId) => ipcRenderer.invoke('vehicle-loans:get-beneficiaries', loanId),
    deleteBeneficiary: (beneficiaryId) => ipcRenderer.invoke('vehicle-loans:delete-beneficiary', beneficiaryId),
},
   promissoryLoan: {
    getAll: () => ipcRenderer.invoke('prm-loans:get-all'),
    getById: (loanId) => ipcRenderer.invoke('prm-loans:get-by-id', loanId), 
    getNextId: () => ipcRenderer.invoke('prm-loans:get-next-id'),
    add: (data) => ipcRenderer.invoke('prm-loans:add', data),
    addSubLoan: (data) => ipcRenderer.invoke('prm-loans:add-sub-loan', data),
    update: (data) => ipcRenderer.invoke('prm-loans:update', data),
    delete: (loanId) => ipcRenderer.invoke('prm-loans:delete', loanId),
    deleteSubLoan: (loanId, disbursementId) => 
        ipcRenderer.invoke('prm-loans:delete-sub-loan', { loanId, disbursementId }),
    checkBeneficiaryActive: (name, phone) => 
        ipcRenderer.invoke('prm-loans:check-beneficiary-active', { name, phone }),
    addSubLoan: (data) => ipcRenderer.invoke('prm-loans:add-sub-loan', data),
    deleteSubLoan: (loanId, disbursementId) => 
        ipcRenderer.invoke('prm-loans:delete-sub-loan', { loanId, disbursementId })
},
   checkLoan: {
    getNextId: () => ipcRenderer.invoke('check-loan:get-next-id'),
    getById: (loanId) => ipcRenderer.invoke('check-loan:get-by-id', loanId),
    add: (data) => ipcRenderer.invoke('check-loan:add', data),
    addSubLoan: (data) => ipcRenderer.invoke('check-loan:add-sub-loan', data),
    getAll: () => ipcRenderer.invoke('check-loan:get-all'),
    update: (data) => ipcRenderer.invoke('check-loan:update', data),
    delete: (loanId) => ipcRenderer.invoke('check-loan:delete', loanId),
    deleteSubLoan: (loanId, disbursementId) => ipcRenderer.invoke('check-loan:delete-sub-loan', loanId, disbursementId),
    getBeneficiaries: (loanId) => ipcRenderer.invoke('check-loan:get-beneficiaries', loanId),
    deleteBeneficiary: (benId) => ipcRenderer.invoke('check-loan:delete-beneficiary', benId),
    checkBeneficiaryActive: (name, phone) => ipcRenderer.invoke('check-loan:check-active', { name, phone })
},
   lanLoan: {
    getAll:   () => ipcRenderer.invoke('land-loans:get-all'),
    getNextId:() => ipcRenderer.invoke('land-loans:get-next-id'),
    getById:  (loanId) => ipcRenderer.invoke('land-loans:get-by-id', loanId),
    add:      (data)   => ipcRenderer.invoke('land-loans:add', data),
    addSub:   (data)   => ipcRenderer.invoke('land-loans:add-sub', data),          // ← NEW
    update:   (data)   => ipcRenderer.invoke('land-loans:update', data),
    deleteSub:(loanId, disbursementId) =>                                          // ← NEW
        ipcRenderer.invoke('land-loans:delete-sub', loanId, disbursementId),
    delete:   (loanId) => ipcRenderer.invoke('land-loans:delete', loanId),
    checkBeneficiaryActive: (name, phone) =>
        ipcRenderer.invoke('land-loans:check-beneficiary-active', { name, phone }),
    getBeneficiaries:  (loanId)        => ipcRenderer.invoke('land-loans:get-beneficiaries', loanId),
    deleteBeneficiary: (beneficiaryId) => ipcRenderer.invoke('land-loans:delete-beneficiary', beneficiaryId),
},
payment: {
    getLoanWithSubLoans: (masterLoanId) => ipcRenderer.invoke('payment:getLoanWithSubLoans', masterLoanId),
    getSubLoanBreakdown: (disbursementId, customDate) => 
        ipcRenderer.invoke('payment:getSubLoanBreakdown', { disbursementId, customDate }),
    getPaymentHistory: (disbursementId) => ipcRenderer.invoke('payment:getHistory', disbursementId),
    process: (paymentData) => ipcRenderer.invoke('payment:process', paymentData),
    voidPayment: (paymentId) => ipcRenderer.invoke('payment:void', paymentId), 
    searchSettlement: (searchText) => ipcRenderer.invoke('settlement:searchLoan', searchText),
        getActiveLoans: (customerId) => ipcRenderer.invoke('payment:getActiveLoans', customerId),
    processSettlement: (settleData) => ipcRenderer.invoke('settlement:process', settleData)
},
   loanLookup: {
    // සෙවුම් පියවර (නම, NIC හෝ ID අනුව Master Loans සෙවීමට)
    searchMaster: (query) => ipcRenderer.invoke('lookup:search-master', query),
    
    // තෝරාගත් ණයක සම්පූර්ණ විශ්ලේෂණය (Sub loans, History, Assets සියල්ල) ලබා ගැනීමට
    getFullAnalysis: (loanId) => ipcRenderer.invoke('lookup:get-full-analysis', loanId)
},
  sms: {
       runAutoCheck: () => ipcRenderer.invoke('sms:runAutoCheck'), 
       sendManual: (data) => ipcRenderer.invoke('sms:sendManual', data),
getLogsByDate: (date) => ipcRenderer.invoke('sms:getLogsByDate', date)    },
   dashboard: {
getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),   } ,
system: {
        checkStatus: () => ipcRenderer.invoke('db:check-status'),
        runBackup: (year, month) => ipcRenderer.invoke('system:run-backup', { year, month })
    },
   migration: {
        insertOldLoan: (payload) => ipcRenderer.invoke('migration:insertOldLoan', payload),
    },
monthlyAnalysis: {
    getData: (year, month) => ipcRenderer.invoke('monthly-analysis:get-data', { year, month }),
    generatePDF: (year, month) => ipcRenderer.invoke('monthly-analysis:generate-pdf', { year, month })
},
settlement: {
    // සෙවීම සඳහා (Handlers එකේ නමට ගැලපෙන ලෙස)
    search: (query) => ipcRenderer.invoke('settlement:search', query), 
    
    // දින අනුව පොලිය ගණනය කර ලබා ගැනීමට (අලුතින් එක් කළා)
    getBreakdown: (disbursementId) => ipcRenderer.invoke('settlement:get-breakdown', disbursementId),

    // පියවීම සිදු කිරීමට
    process: (data) => ipcRenderer.invoke('settlement:process', data),
    
    // අවලංගු කිරීමට
    voidPayment: (paymentId) => ipcRenderer.invoke('settlement:void', paymentId), 
}

});