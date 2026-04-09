const { contextBridge, ipcRenderer, webUtils  } = require('electron');

// --- Authentication & User Management ---
contextBridge.exposeInMainWorld('authAPI', {
    attemptLogin: (credentials) => ipcRenderer.invoke('login-attempt', credentials),
    logout: () => ipcRenderer.send('logout-trigger'), 
    addUser: (userData) => ipcRenderer.invoke('add-user', userData),
    getAllUsers: () => ipcRenderer.invoke('get-all-users'),
    deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
    send: (channel, data) => ipcRenderer.send(channel, data),
    openDBFolder: () => ipcRenderer.send('open-db-folder'),

});

// --- Main Application Logic ---
contextBridge.exposeInMainWorld('api', {
    // ADD THIS NEW FUNCTION
    getFilePath: (file) => {
        return webUtils.getPathForFile(file);
    },
         getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),

      getImageUrl: async (picturePath) => {
    return await ipcRenderer.invoke('get-image-url', picturePath);
},
updateResultRemarks: (resultId, remarks) => ipcRenderer.invoke('update-result-remarks', resultId, remarks),

     getImageFolder: () => ipcRenderer.invoke('get-image-folder'), 
    // Navigation
    changePage: (page) => ipcRenderer.send('change-page', page),
// In Preload.js
updateAvailedLeaves: (id, count) => ipcRenderer.invoke('update-availed-leaves', { id, count }),


    // Class Management
    addClass: (name) => ipcRenderer.invoke('add-class', name),
    getClasses: () => ipcRenderer.invoke('get-classes'),
    deleteClass: (id) => ipcRenderer.invoke('delete-class', id),
    updateClass: (id, name) => ipcRenderer.invoke('update-class', id, name),
getDateWiseReport: (date) => ipcRenderer.invoke('get-date-wise-report', date),
    // Student Management
    addStudent: (studentData) => ipcRenderer.invoke('add-student', studentData),
    getStudents: () => ipcRenderer.invoke('get-students'),
    getStudentById: (id) => ipcRenderer.invoke('get-student-by-id', id),
    updateStudent: (studentData) => ipcRenderer.invoke('update-student', studentData),
    deleteStudent: (id) => ipcRenderer.invoke('deleteStudentAndRelated', id),

    // Fee Management & Filters
    generateStudentFee: (id) => ipcRenderer.invoke('generate-student-fee', id),
    getFeeRecords: () => ipcRenderer.invoke('get-fee-records'),
    getFeeRecordsFilters: (filters) => ipcRenderer.invoke('get-fee-records-filters', filters),
    getFilterData: () => ipcRenderer.invoke('get-filter-data'), // Fetches unique months/years/classes
    getFeeRecordById: (id) => ipcRenderer.invoke('get-fee-record-by-id', id),

    // Fee Actions
    updateFeeCollection: (id, amount) => ipcRenderer.invoke('update-fee-collection', id, amount),
    
    updateFeeSubmit: (id, amount) => ipcRenderer.invoke('update-fee-submit', id, amount),
     deleteFee: (id) => ipcRenderer.invoke('delete-fee', id), 
 
      // Staff Functions
    getStaff: () => ipcRenderer.invoke('get-staff'),
    addStaff: (data) => ipcRenderer.invoke('add-staff', data),
    updateStaff: (id, data) => ipcRenderer.invoke('update-staff', id, data),
    deleteStaff: (id) => ipcRenderer.invoke('delete-staff', id),
    initiateSalary: (month, year) => ipcRenderer.invoke('initiate-salary', month, year),
 getSalaries: (month, year) => ipcRenderer.invoke('get-salaries', { month, year }),
    updateSalaryStatus: (id, status, salary) => ipcRenderer.invoke('update-salary-status', { id, status, salary }),

     getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
       getStudentFeeHistory: (id) => ipcRenderer.invoke('get-student-fee-history', id),
       // Add this inside the contextBridge.exposeInMainWorld('api', { ... }) block
generateBulkFees: () => ipcRenderer.invoke('generate-bulk-fees'),
 generateExamSheet: (data) => ipcRenderer.invoke('generate-exam-logic', data),
    getDropdownData: () => ipcRenderer.invoke('get-dropdown-data'),
    // FIXED: added 'data' as the second argument below
    updateSetMarks: (data) => ipcRenderer.invoke('update-set-marks', data),
     getDropdownData: () => ipcRenderer.invoke('get-dropdown-data'),
    getReportData: (data) => ipcRenderer.invoke('get-report-data', data),
     // 5. Saving Individual Student Marks (The missing function)
    updateStudentMarks: (data) => ipcRenderer.invoke('update-student-marks', data),
    // Add this inside your contextBridge
recalculatePositions: (data) => ipcRenderer.invoke('recalculate-positions', data),
// Add this inside the 'api' block in preload.js
// Inside preload.js
getAllStudentProgress: (filters) => ipcRenderer.invoke('get-all-student-progress', filters),

getStudentProgress: (id) => ipcRenderer.invoke('get-student-progress', id),
bulkUpdateFees: (data) => ipcRenderer.invoke('bulk-update-fees', data),
// Inside your contextBridge.exposeInMainWorld('api', { ... })
updateSingleFeeField: (data) => ipcRenderer.invoke('update-single-fee-field', data),
  // Inside your preload.js
saveToPdf: () => ipcRenderer.invoke('save-to-pdf'), 


///exam related
getActiveClasses: () => ipcRenderer.invoke('get-active-classes'),
createExamName: (name) => ipcRenderer.invoke('create-exam-name', name),
initiateExamLogic: (data) => ipcRenderer.invoke('initiate-exam-logic', data),
getStudentFeeHistory: (id) => ipcRenderer.invoke('get-student-fee-history', id),
getStatusReport: (type) => ipcRenderer.invoke('get-status-report', type),





});