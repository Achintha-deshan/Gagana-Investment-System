const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Authentication කෑල්ල
    auth: {
        login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
        logout: () => ipcRenderer.invoke('auth:logout')
    },

    // ඔයා ඉල්ලපු api.user කෑල්ල (User Management CRUD)
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
        update: (data) => ipcRenderer.invoke('vehicle-loans:update', data),
        delete: (loanId) => ipcRenderer.invoke('vehicle-loans:delete', loanId),
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
    update: (data) => ipcRenderer.invoke('prm-loans:update', data),
    delete: (loanId) => ipcRenderer.invoke('prm-loans:delete', loanId),
    checkBeneficiaryActive: (name, phone) => 
        ipcRenderer.invoke('prm-loans:check-beneficiary-active', { name, phone })
    },
    checkLoan: {
        getNextId: () => ipcRenderer.invoke('check-loan:get-next-id'),
        getById: (loanId) => ipcRenderer.invoke('check-loan:get-by-id', loanId),
        add: (data) => ipcRenderer.invoke('check-loan:add', data),
        getAll: () => ipcRenderer.invoke('check-loan:get-all'),
        update: (data) => ipcRenderer.invoke('check-loan:update', data),
        delete: (loanId) => ipcRenderer.invoke('check-loan:delete', loanId),
        getBeneficiaries: (loanId) => ipcRenderer.invoke('check-loan:get-beneficiaries', loanId),
        deleteBeneficiary: (benId) => ipcRenderer.invoke('check-loan:delete-beneficiary', benId),
        checkBeneficiaryActive: (name, phone) => ipcRenderer.invoke('check-loan:check-active', { name, phone })
    },
    lanLoan: {
        getAll: () => ipcRenderer.invoke('land-loans:get-all'),
        getNextId: () => ipcRenderer.invoke('land-loans:get-next-id'),
        getById: (loanId) => ipcRenderer.invoke('land-loans:get-by-id', loanId), 
        add: (data) => ipcRenderer.invoke('land-loans:add', data),
        update: (data) => ipcRenderer.invoke('land-loans:update', data),
        delete: (loanId) => ipcRenderer.invoke('land-loans:delete', loanId),
        checkBeneficiaryActive: (name, phone) =>
        ipcRenderer.invoke('land-loans:check-beneficiary-active', { name, phone }),
        getBeneficiaries: (loanId) => ipcRenderer.invoke('land-loans:get-beneficiaries', loanId),
        deleteBeneficiary: (beneficiaryId) => ipcRenderer.invoke('land-loans:delete-beneficiary', beneficiaryId),
    },
    payment: {
        getActiveLoans: (customerId) => ipcRenderer.invoke('payment:getActiveLoans', customerId),
        process: (paymentData) => ipcRenderer.invoke('payment:process', paymentData),
        getHistory: (loanId) => ipcRenderer.invoke('payment:getHistory', loanId),
        voidPayment: (paymentId) => ipcRenderer.invoke('payment:void', paymentId), 
        processSettlement: (settleData) => ipcRenderer.invoke('settlement:process', settleData),
        searchSettlement: (searchText) => ipcRenderer.invoke('settlement:searchLoan', searchText),
    },

    loanLookup: {
        getDetails: (loanId) => ipcRenderer.invoke('lookup:get-details', loanId),
        getCustomerLoans: (customerId) => ipcRenderer.invoke('lookup:get-customer-loans', customerId)
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
    }

});