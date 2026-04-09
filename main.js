
// main.js
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
const { app, BrowserWindow, globalShortcut, ipcMain, dialog, protocol, shell, Menu, session } 
= require('electron');
const path = require('path');
const fs = require('fs');
const dbLogic = require('./database.js'); 

// At the very top of main.js, add this to allow the custom protocol
protocol.registerSchemesAsPrivileged([
  { scheme: 'safe-file', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
// 1. Setup the path (Same as your school.db location)
const userDataPath = app.getPath('userData');
const imagesDir = path.join(userDataPath, 'images');

// 2. Create the images folder if it doesn't exist
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// 1. EXPIRY CONFIGURATION
const EXPIRY_DATE = new Date(2026, 5, 31); // May 31, 2026

// 2. IMPORT FROM DATABASE.JS
const { 
    db, 
    checkUser, 
    addUser,
    deleteStudent,deleteFeeRecordsByStudent, deleteResultsByStudent
} = require('./database.js');

let win;

function createWindow() {
    // EXPIRY CHECK
    const today = new Date();
    if (today > EXPIRY_DATE) {
        dialog.showErrorBox(
            "System Lock", 
            "Your license has expired. Please contact the administrator to continue using this software. Contact: 0322-5366745, E-mail: itsmeaamer85@gmail.com"
        );
        app.quit();
        return;
    }

    win = new BrowserWindow({
        width: 1100,
        height: 850,
        titleBarStyle: "default",
        backgroundColor: "#fdf0d5",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), 
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    // --- CSP FIX: ALLOW SAFE-FILE PROTOCOL ---
   // Inside createWindow() function
win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
        responseHeaders: {
            ...details.responseHeaders,
           'Content-Security-Policy': [
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    // MUST include https://ui-avatars.com here
    "img-src 'self' data: safe-file: https://ui-avatars.com;" 
]
        }
    });
});


    win.loadFile(path.join(__dirname, 'components', 'login.html'));
    win.on('closed', () => { win = null; });
}

// --- IPC HANDLERS ---

// Navigation Helper

ipcMain.on('change-page', (event, pageUrl) => {
    if (win) {
        // Use loadURL instead of loadFile
        const fullPath = path.join(__dirname, pageUrl);
        win.loadURL(`file://${fullPath}`);
    }
});




// Licence status
ipcMain.handle('get-license-status', () => {
    const today = new Date();
    const diffTime = EXPIRY_DATE - today;
    if (diffTime <= 0) return "Expired";
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;
    return `(Trial Version ${months} Months, ${days} Days Remaining`;
});
ipcMain.handle('get-image-url', (event, picturePath) => {
    if (picturePath) {
        const fullPath = path.join(imagesDir, picturePath);
        // Check if file exists
        if (fs.existsSync(fullPath)) {
            return `file://${fullPath}`;
        } else {
            console.warn('Image file not found:', fullPath);
            return null;
        }
    } else {
        return null;
    }
});


// Auth
ipcMain.handle('login-attempt', async (event, credentials) => {
    try {
        const user = checkUser(credentials.username, credentials.password);
        return user ? { success: true, user } : { success: false, message: "Invalid credentials" };
    } catch (err) { return { success: false, message: "Database Error" }; }
});

ipcMain.handle('add-user', async (event, userData) => {
    try { addUser(userData); return { success: true }; } 
    catch (err) { return { success: false, error: err.message }; }
});

ipcMain.on('logout-trigger', () => { 
    if (win) win.loadFile(path.join(__dirname, 'components', 'login.html')); 
});

// User Management
ipcMain.handle('get-all-users', async () => {
    try {
        const { getAllUsers } = require('./database.js'); 
        return getAllUsers();
    } catch (err) {
        console.error("Error fetching users:", err);
        return [];
    }
});

ipcMain.handle('delete-user', async (event, id) => {
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// UI Fixes
ipcMain.on('fix-focus', (event) => {
    const focusedWindow = BrowserWindow.fromWebContents(event.sender);
    if (focusedWindow) {
        focusedWindow.setIgnoreMouseEvents(false); 
        focusedWindow.blur();
        setTimeout(() => {
            if (!focusedWindow.isDestroyed()) {
                focusedWindow.focus();
                focusedWindow.webContents.focus();
            }
        }, 50);
    }
});

// Classes management
ipcMain.handle('get-classes', async () => {
    return dbLogic.getClasses();
});
ipcMain.handle('add-class', async (event, name) => {
    return dbLogic.addClass(name);
});
ipcMain.handle('delete-class', async (event, id) => {
    return dbLogic.deleteClass(id);
});
ipcMain.handle('update-class', async (event, id, name) => {
    return dbLogic.updateClass(id, name);
});


ipcMain.handle('get-image-folder', () => {
    // 1. Log to the terminal (Main Process console)
    console.log("Attempting to retrieve Image Directory:", imagesDir);

    // 2. Check if the directory actually exists
    if (imagesDir && fs.existsSync(imagesDir)) {
        console.log("✅ Directory confirmed at:", imagesDir);
        return imagesDir;
    } else {
        console.error("❌ Directory NOT found or undefined:", imagesDir);
        return null; // Or return a specific error message
    }
});


// main.js - Update the add-student handler
ipcMain.handle('add-student', async (event, studentData) => {
  try {
    let fileNameForDB = ''; 
    
    if (studentData.pic && fs.existsSync(studentData.pic)) {
      const ext = path.extname(studentData.pic);
      // Create filename: e.g., reg_123.jpg
      const fileName = `reg_${studentData.regNo}${ext}`;
      const destination = path.join(imagesDir, fileName);
      
      // Copy the physical file to AppData/images/
      fs.copyFileSync(studentData.pic, destination);
      
      // Store ONLY the filename in the database string
      fileNameForDB = fileName; 
    }

    const dataToSave = { ...studentData, pic: fileNameForDB };
    return dbLogic.addStudent(dataToSave);
  } catch (error) {
    console.error("Error saving student image:", error);
    throw error;
  }
});


ipcMain.handle('get-students', async () => {
    try {
        return dbLogic.getStudents();
    } catch (err) {
        console.error("Fetch Error:", err);
        return [];
    }
});

ipcMain.handle('deleteStudentAndRelated', async (event, studentId) => {
  try {
    // Wrap in a transaction if your database supports it
    // or just execute sequentially
    // Note: better-sqlite3 supports transactions via db.transaction
    const transaction = db.transaction(() => {
      deleteFeeRecordsByStudent(studentId);
      deleteResultsByStudent(studentId);
      deleteStudent(studentId);
    });
    transaction(); // execute transaction
    return { success: true };
  } catch (err) {
    console.error('Error deleting student and related:', err);
    return { success: false, error: err.message };
  }
});


ipcMain.handle('get-student-by-id', async (event, id) => {
    return dbLogic.getStudentById(id);
});

// main.js - Replace the existing 'update-student' handler
ipcMain.handle('update-student', async (event, studentData) => {
  try {
    let fileNameForDB = studentData.pic; // Default to existing path

    // Check if studentData.pic is a full path to a NEWLY selected file
    // and not just the existing filename (e.g., 'reg_1.jpg')
    if (studentData.pic && fs.existsSync(studentData.pic) && path.isAbsolute(studentData.pic)) {
      const ext = path.extname(studentData.pic);
      const fileName = `reg_${studentData.regNo}${ext}`;
      const destination = path.join(imagesDir, fileName);

      // This overwrites the old image with the new one at the same destination [21]
      fs.copyFileSync(studentData.pic, destination);
      fileNameForDB = fileName;
    }

    const dataToSave = { ...studentData, pic: fileNameForDB };
    return dbLogic.updateStudent(dataToSave);
  } catch (error) {
    console.error("Update Error:", error);
    throw error;
  }
});
ipcMain.handle('bulk-update-fees', async (event, { exam, lab, misc, month, year, className }) => {
    try {
        const sql = `
            UPDATE fee_tbl 
            SET exam_fee = ?, 
                lab_fee = ?, 
                misc_fee = ? 
            WHERE invoice_month = ? 
              AND invoice_year = ? 
              AND current_class = ?
        `;
        const stmt = db.prepare(sql);
        const info = stmt.run(exam, lab, misc, month, year, className);
        return { success: true, count: info.changes };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('update-single-fee-field', async (event, { id, field, value }) => {
    try {
        // Whitelist for security
        const allowedFields = ['adm_fee', 'tuition_fee', 'exam_fee', 'lab_fee', 'misc_fee'];
        if (!allowedFields.includes(field)) throw new Error("Invalid field");

        // ONLY update the specific field. 
        // DO NOT include 'total_fee' or 'balance' in the SET clause.
        const sql = `UPDATE fee_tbl SET ${field} = ? WHERE id = ?`;
        
        const stmt = db.prepare(sql);
        const info = stmt.run(value, id);

        return { success: info.changes > 0 };
    } catch (err) {
        console.error("Database Error:", err);
        return { success: false, error: err.message };
    }
});

// Add this to your main.js
// main.js optimization
// In main.js, replace your existing 'save-to-pdf' handler with this:
ipcMain.handle('save-to-pdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    // This triggers the native system dialog directly
    win.webContents.print({
        silent: false, // This ensures the prompt action happens
        printBackground: true,
        deviceName: ''
    });
    return true;
});





async function saveRemarks(resultId) {
    const newRemarks = document.getElementById(`input-${resultId}`).value;
    try {
        const success = await window.api.updateResultRemarks(resultId, newRemarks);
        if (success) {
            // Check this ID! It must match exactly what is in your <div> or <span>
            const displayElement = document.getElementById(`display-text-${resultId}`); 
            
            if (displayElement) {
                displayElement.innerText = newRemarks || 'No remarks.';
            }
            cancelEdit(resultId);
        }
    } catch (err) {
        console.error("Save error:", err);
    }
}
// Replace this with your actual database update logic
ipcMain.handle('update-result-remarks', async (event, resultId, remarks) => {
    try {
        // This is the SQL execution line that was missing
        const stmt = db.prepare('UPDATE result SET remarks = ? WHERE result_id = ?');
        const info = stmt.run(remarks, resultId);
        
        console.log(`Updated result_id: ${resultId}`);
        return info.changes > 0; // Returns true if save was successful
    } catch (error) {
        console.error("Database update failed:", error);
        return false;
    }
});






// Fee Management
ipcMain.handle('generate-bulk-fees', async () => {
    try {
        return dbLogic.generateBulkFees();
    } catch (error) {
        console.error("Bulk Generation Error:", error);
        throw error;
    }
});

ipcMain.handle('generate-student-fee', async (event, studentId) => {
    try {
        return dbLogic.generateFee(studentId);
    } catch (error) {
        throw error; 
    }
});

ipcMain.handle('get-fee-records-filters', async (event, filters) => { 
    return dbLogic.getFeeRecordsFilters(filters); 
});

ipcMain.handle('get-filter-data', async () => {
    return {
        months: dbLogic.getUniqueInvoiceMonths(),
        years: dbLogic.getUniqueInvoiceYears(),
        classes: dbLogic.getClasses()
    };
});

ipcMain.handle('update-fee-collection', async (event, { id, amount }) => {
    return dbLogic.updateCollection(id, amount);
});

ipcMain.handle('get-fee-record-by-id', async (event, id) => {
    return dbLogic.getFeeRecordById(id);
});

ipcMain.handle('update-fee-submit', async (event, data) => {
    const { id, amount } = data; 
    return dbLogic.updateCollection(id, amount);
});

ipcMain.handle('delete-fee', async (event, id) => {
    return dbLogic.deleteFee(id); 
});

ipcMain.handle('get-student-fee-history', async (event, studentId) => {
    try {
        return dbLogic.getStudentFeeHistory(studentId);
    } catch (error) {
        console.error("Failed to fetch fee history:", error);
        throw error;
    }
});

// Exam Management
ipcMain.handle('get-active-classes', async () => {
    try {
        return dbLogic.getActiveClasses();
    } catch (err) {
        console.error("Database Error:", err);
        return [];
    }
});

ipcMain.handle('create-exam-name', async (event, examName) => {
    try {
        // Check if exam name already exists
        const existing = db.prepare('SELECT 1 FROM exams WHERE exam_name = ?').get(examName);
        if (existing) {
            return { success: false, error: "This Exam Name already exists!" };
        }
        const info = db.prepare('INSERT INTO exams (exam_name) VALUES (?)').run(examName);
        return { success: true, examId: info.lastInsertRowid };
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            // Handle the uniqueness error if constraint is added
            return { success: false, error: "This Exam Name already exists!" };
        }
        return { success: false, error: err.message };
    }
});


ipcMain.handle('initiate-exam-logic', async (event, { examId, selectedClasses }) => {
    try {
        return dbLogic.initiateExamForClasses(examId, selectedClasses);
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-dropdown-data', async () => {
    try {
        const exams = db.prepare('SELECT exam_id, exam_name FROM exams ORDER BY created_at DESC').all();
        const classes = db.prepare('SELECT class_name FROM classes ORDER BY class_name ASC').all();
        return { success: true, exams, classes };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('update-set-marks', async (event, data) => {
    try {
        if (!data) throw new Error("No data received from frontend");
        const sql = `
            UPDATE result 
            SET urdu_setmarks = ?, eng_setmarks = ?, math_setmarks = ?, sst_setmarks = ?, 
            islamiat_setmarks = ?, science_setmarks = ?, physics_setmarks = ?, 
            chemistry_setmarks = ?, biology_setmarks = ?, computer_setmarks = ?, 
            drawing_setmarks = ?, geography_setmarks = ?, total_setmarks = ?
            WHERE exam_id = ? AND class = ?
        `;
        const stmt = db.prepare(sql);
        const info = stmt.run(
            data.urdu, data.eng, data.math, data.sst, data.islamiat, data.science, 
            data.physics, data.chemistry, data.biology, data.computer, data.drawing, 
            data.geography, data.total, data.exam_id, data.current_class
        );
        return { success: true, changes: info.changes };
    } catch (err) {
        console.error("Update Error:", err);
        return { success: false, error: err.message };
    }
});

// Add these handlers in main.js
// In main.js - Replace the existing get-all-student-progress handler
// main.js
ipcMain.handle('get-all-student-progress', async (event, filters = {}) => {
    try {
        const { examId, className } = filters;
        
        // 1. Start with the base query (No WHERE clause yet)
        let sql = `
            SELECT r.*, s.student_name, s.father_name, s.picture_path, s.roll_no, s.registration_no 
            FROM result r 
            JOIN students s ON r.student_id = s.id
        `;
        
        const params = [];

        // 2. Add filtering only if values are provided
        if (examId && className) {
            sql += ` WHERE r.exam_id = ? AND r.class = ?`;
            params.push(examId, className);
        }
        
        // 3. Add ordering
        sql += ` ORDER BY r.total_obt DESC`;
        
        const stmt = db.prepare(sql);

        // 4. Execute with parameters if they exist, otherwise fetch all
        const results = params.length > 0 ? stmt.all(...params) : stmt.all();
        
        console.log(`Found ${results.length} records for Exam: ${examId}, Class: ${className}`);
        return results;

    } catch (err) {
        console.error("Database Error in Progress Reports:", err);
        return [];
    }
});




ipcMain.handle('get-student-progress', async (event, studentId) => {
    return db.prepare('SELECT r.*, s.student_name, s.picture_path, s.registration_no FROM result r JOIN students s ON r.student_id = s.id WHERE r.student_id = ?').get(studentId);
});


ipcMain.handle('get-report-data', async (event, { examId, className }) => {
    try {
        const sql = `
            SELECT r.*, s.student_name, s.registration_no 
            FROM result r
            JOIN students s ON r.student_id = s.id
            WHERE r.exam_id = ? AND r.class = ?
            ORDER BY r.total_obt DESC
        `;
        const data = db.prepare(sql).all(examId, className);
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('recalculate-positions', async (event, { examId, className }) => {
    try {
        const students = db.prepare(`
            SELECT result_id FROM result 
            WHERE exam_id = ? AND class = ? 
            ORDER BY total_obt DESC, percentage DESC
        `).all(examId, className);
        const updateStmt = db.prepare('UPDATE result SET position = ? WHERE result_id = ?');
        const transaction = db.transaction((list) => {
            list.forEach((s, index) => {
                updateStmt.run(index + 1, s.result_id);
            });
        });
        transaction(students);
        return { success: true };
    } catch (err) {
        console.error("Position Error:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('update-student-marks', async (event, s) => {
    try {
        const totalObt = (
            Number(s.urdu_obt) + Number(s.eng_obt) + Number(s.math_obt) +
            Number(s.sst_obt) + Number(s.islamiat_obt) + Number(s.science_obt) +
            Number(s.physics_obt) + Number(s.chemistry_obt) + Number(s.biology_obt) +
            Number(s.computer_obt) + Number(s.drawing_obt) + Number(s.geography_obt)
        );
        const percentage = (totalObt / Number(s.total_setmarks)) * 100;
        let grade = 'F';
        if (percentage >= 90) grade = 'A+';
        else if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B+';
        else if (percentage >= 60) grade = 'B';
        else if (percentage >= 50) grade = 'C';
        else if (percentage >= 40) grade = 'D';
        const status = percentage >= 40 ? 'Pass' : 'Fail';
        const sql = `
            UPDATE result SET 
            urdu_obt=?, eng_obt=?, math_obt=?, sst_obt=?, islamiat_obt=?, science_obt=?, 
            physics_obt=?, chemistry_obt=?, biology_obt=?, computer_obt=?, drawing_obt=?, 
            geography_obt=?, total_obt=?, percentage=?, grade=?, result_status=?
            WHERE result_id = ?
        `;
        db.prepare(sql).run(
            s.urdu_obt, s.eng_obt, s.math_obt, s.sst_obt, s.islamiat_obt, s.science_obt,
            s.physics_obt, s.chemistry_obt, s.biology_obt, s.computer_obt, s.drawing_obt, 
            s.geography_obt, totalObt, percentage, grade, status, s.result_id
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Staff & Salary Management
ipcMain.handle('get-staff', async () => {
    return dbLogic.getStaff();
});
ipcMain.handle('add-staff', async (event, data) => {
    return dbLogic.insertStaff(data);
});
ipcMain.handle('update-staff', async (event, id, data) => {
    return dbLogic.updateStaff(id, data);
});
ipcMain.handle('delete-staff', async (event, id) => {
    return dbLogic.deleteStaff(id);
});
ipcMain.handle('initiate-salary', async (event, month, year) => {
    return dbLogic.initiateSalary(month, year);
});
ipcMain.handle('get-salaries', async (event, { month, year }) => {
    return dbLogic.getSalaries(month, year);
});
ipcMain.handle('update-salary-status', async (event, { id, status, salary }) => {
    return dbLogic.updateSalaryStatus(id, status, salary);
});
ipcMain.handle('get-dashboard-stats', async () => {
    return dbLogic.getDashboardStats();
});
ipcMain.handle('update-availed-leaves', async (event, { id, count }) => {
    try {
        const stmt = db.prepare("UPDATE salary_tbl SET availed_leaves = ? WHERE id = ? AND status = 'Unpaid'");
        const info = stmt.run(count, id);
        return info.changes > 0; 
    } catch (err) {
        console.error("Database Update Error:", err);
        return false;
    }
});

// Reports
ipcMain.handle('get-status-report', async (event, statusType) => {
    return dbLogic.getFeeReportByStatus(statusType);
});
ipcMain.handle('get-date-wise-report', async (event, selectedDate) => {
    return dbLogic.getDateWiseReport(selectedDate);
});

ipcMain.on('open-db-folder', () => {
    const userDataPath = app.getPath('userData');
    shell.openPath(userDataPath); 
});

// --- LIFECYCLE ---
app.whenReady().then(() => {
   protocol.registerFileProtocol('safe-file', (request, callback) => {
  const url = request.url.replace('safe-file://', '');
  try {
    return callback({ path: path.normalize(decodeURIComponent(url)) });
  } catch (error) {
    console.error("Protocol Error:", error);
  }
});
    createWindow();
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});

app.on('will-quit', () => { 
    globalShortcut.unregisterAll(); 
    if (db) db.close(); 
});