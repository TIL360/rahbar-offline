const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');


const userDataPath = app.getPath('userData');
//this line would create db insie appdata
const dbPath = path.join(userDataPath, 'school.db');

// this would create db file inside the root area of the app
// const dbPath = path.join(__dirname, 'school.db');

if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });

// --- INITIALIZATION ---
const initializeDB = () => {
    try {
        // 1. Users
        db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, usertype TEXT CHECK(usertype IN ('Admin', 'User')) DEFAULT 'User')`);
        
        // 2. Classes
        db.exec(`CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY AUTOINCREMENT, class_name TEXT UNIQUE)`);
        
        // 3. Students
        db.exec(`CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_no TEXT UNIQUE, roll_no TEXT, student_name TEXT, 
            student_name_urdu TEXT, father_name TEXT, 
            dob DATE, cnic_bform TEXT, picture_path TEXT, mobile TEXT, whatsapp TEXT, address TEXT, 
            monthly_fee REAL, character_remarks TEXT, admission_class TEXT, 
            current_class TEXT, 
            section TEXT, admission_date DATE, status TEXT DEFAULT 'active'
        )`);

        // 4. Fee Table
        db.exec(`CREATE TABLE IF NOT EXISTS fee_tbl (
            id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, 
            registration_no TEXT, current_class TEXT, 
            monthly_fee REAL DEFAULT 0, adm_fee REAL DEFAULT 0, exam_fee REAL DEFAULT 0, lab_fee REAL DEFAULT 0, 
            security REAL DEFAULT 0, misc_fee REAL DEFAULT 0,
            total_fee REAL GENERATED ALWAYS AS (monthly_fee + adm_fee + exam_fee + lab_fee + security + misc_fee) VIRTUAL,
            collection REAL DEFAULT 0,
            balance REAL GENERATED ALWAYS AS ((monthly_fee + adm_fee + exam_fee + lab_fee + security + misc_fee) - collection) VIRTUAL,
            invoice_month TEXT, invoice_year TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(registration_no, invoice_month, invoice_year) 
        )`);

        // 5. Exams & Results (Fixed better-sqlite3 implementation)
       db.exec(`CREATE TABLE IF NOT EXISTS exams (
    exam_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_name TEXT UNIQUE,
    exp_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    exp_month TEXT,
    exp_year TEXT
)`);

//expense table
  db.exec(`CREATE TABLE IF NOT EXISTS exp_tbl (
        exp_id INTEGER PRIMARY KEY AUTOINCREMENT,
        expence TEXT,
        exp_amount REAL,
        exp_year INTEGER,
        exp_month TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
// Add this to your initializeDB function in database.js
// Inside initializeDB function in database.js
db.exec(`CREATE TABLE IF NOT EXISTS datesheet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT,
    exam_date DATE,
    exam_year TEXT,
    exam_id INTEGER,
    class_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE
)`);


db.exec(`CREATE TABLE IF NOT EXISTS result (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    class TEXT,
    sec TEXT,
    remarks TEXT,
    
    -- Obtained Marks (12 Subjects)
    urdu_obt REAL DEFAULT 0,
    eng_obt REAL DEFAULT 0,
    math_obt REAL DEFAULT 0,
    sst_obt REAL DEFAULT 0,
    islamiat_obt REAL DEFAULT 0,
    science_obt REAL DEFAULT 0,
    physics_obt REAL DEFAULT 0,
    chemistry_obt REAL DEFAULT 0,
    biology_obt REAL DEFAULT 0,
    computer_obt REAL DEFAULT 0,
    drawing_obt REAL DEFAULT 0,
    geography_obt REAL DEFAULT 0,
    total_obt REAL DEFAULT 0,

    -- Set Marks (Total Marks per subject)
    urdu_setmarks REAL DEFAULT 100,
    eng_setmarks REAL DEFAULT 100,
    math_setmarks REAL DEFAULT 100,
    sst_setmarks REAL DEFAULT 100,
    islamiat_setmarks REAL DEFAULT 100,
    science_setmarks REAL DEFAULT 100,
    physics_setmarks REAL DEFAULT 100,
    chemistry_setmarks REAL DEFAULT 100,
    biology_setmarks REAL DEFAULT 100,
    computer_setmarks REAL DEFAULT 100,
    drawing_setmarks REAL DEFAULT 100,
    geography_setmarks REAL DEFAULT 100,
    total_setmarks REAL DEFAULT 1200,

    -- Summary Fields
    percentage REAL,
    grade TEXT,
    position TEXT,
    result_status TEXT, -- Pass/Fail
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (exam_id) REFERENCES exams(exam_id),
    FOREIGN KEY (student_id) REFERENCES students(id)
)`);
        // Views
        db.exec(`CREATE VIEW IF NOT EXISTS student_arrears AS SELECT registration_no, SUM(balance) AS total_arrears FROM fee_tbl GROUP BY registration_no`);
        db.exec(`CREATE VIEW IF NOT EXISTS fee_report AS SELECT f.*, (SELECT SUM(balance) FROM fee_tbl WHERE registration_no = f.registration_no AND id < f.id) AS previous_arrears, (f.balance + COALESCE((SELECT SUM(balance) FROM fee_tbl WHERE registration_no = f.registration_no AND id < f.id), 0)) AS net_payable FROM fee_tbl f`);

        // Staff & Salary
        // 1. Staff Table: Added auth_leaves to store the allowed limit per staff member
db.exec(`CREATE TABLE IF NOT EXISTS staff_tbl (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT, 
    cnic TEXT, 
    contact TEXT, 
    designation TEXT, 
    doj TEXT, 
    salary REAL, 
    auth_leaves REAL DEFAULT 0, 
    allowance REAL, 
    status TEXT DEFAULT 'Active'
)`);

// 2. Salary Table: Added auth_leaves (the limit) and availed_leaves (actual taken)
// Note: 'leaves' column is renamed/replaced by these for clarity
db.exec(`CREATE TABLE IF NOT EXISTS salary_tbl (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    staff_id INTEGER, 
    name TEXT, 
    salary REAL, 
    allowance REAL, 
    auth_leaves REAL DEFAULT 0, 
    availed_leaves REAL DEFAULT 0, 
    salary_month TEXT, 
    salary_year TEXT, 
    status TEXT DEFAULT 'Unpaid', 
    UNIQUE(staff_id, salary_month, salary_year)
)`);

        // Default Admin
        const userCount = db.prepare('SELECT count(*) as count FROM users').get();
        if (userCount.count === 0) {
            db.prepare('INSERT INTO users (username, password, usertype) VALUES (?, ?, ?)').run('Admin', 'admin123', 'Admin');
        }

    } catch (err) { console.error("DB Init Error:", err); }
};

initializeDB();

// --- EXAM & RESULT FUNCTIONS ---
// In database.js
// database.js


// --- EXISTING FUNCTIONS ---
function checkUser(username, password) { return db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password); }
function addUser(userData) { return db.prepare('INSERT INTO users (username, password, usertype) VALUES (?, ?, ?)').run(userData.username, userData.password, userData.usertype); }
function getAllUsers() { return db.prepare('SELECT id, username FROM users').all(); }

const addClass = (name) => db.prepare('INSERT INTO classes (class_name) VALUES (?)').run(name);
const getClasses = () => db.prepare('SELECT * FROM classes ORDER BY id ASC').all();
const deleteClass = (id) => db.prepare('DELETE FROM classes WHERE id = ?').run(id);
const updateClass = (id, name) => db.prepare('UPDATE classes SET class_name = ? WHERE id = ?').run(name, id);

const addStudent = (s) => {
    const sql = `INSERT INTO students (registration_no, roll_no, student_name, student_name_urdu, father_name, dob, cnic_bform, picture_path, admission_class, current_class, section, admission_date, status, mobile, whatsapp, address, monthly_fee, character_remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    return db.prepare(sql).run(s.regNo, s.rollNo, s.name, s.nameUrdu, s.fatherName, s.dob, s.cnic, s.pic, s.admClass, s.studyClass, s.section, s.admDate, s.status, s.mobile, s.whatsapp, s.address, s.monthlyFee, s.character);
};
const getStudents = () => db.prepare('SELECT * FROM students ORDER BY id DESC').all();
const getStudentById = (id) => db.prepare('SELECT * FROM students WHERE id = ?').get(id);
const updateStudent = (s) => {
    const sql = `UPDATE students SET registration_no = ?, roll_no = ?, student_name = ?, student_name_urdu = ?, father_name = ?, dob = ?, cnic_bform = ?, picture_path = ?, admission_class = ?, current_class = ?, section = ?, admission_date = ?, status = ?, mobile = ?, whatsapp = ?, address = ?, monthly_fee = ?, character_remarks = ? WHERE id = ?`;
    return db.prepare(sql).run(s.regNo, s.rollNo, s.name, s.nameUrdu, s.fatherName, s.dob, s.cnic, s.pic, s.admClass, s.studyClass, s.section, s.admDate, s.status, s.mobile, s.whatsapp, s.address, s.monthlyFee, s.character, s.id);
};
const deleteStudent = (id) => db.prepare('DELETE FROM students WHERE id = ?').run(id);
// Delete all fee records for a student
function deleteFeeRecordsByStudent(studentId) {
  return db.prepare('DELETE FROM fee_tbl WHERE student_id = ?').run(studentId);
}

// Delete all result records for a student
function deleteResultsByStudent(studentId) {
  return db.prepare('DELETE FROM result WHERE student_id = ?').run(studentId);
}

const generateFee = (studentId) => {
    const student = db.prepare('SELECT registration_no, current_class, monthly_fee FROM students WHERE id = ?').get(studentId);
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear().toString();
    try {
        return db.prepare(`INSERT INTO fee_tbl (student_id, registration_no, current_class, monthly_fee, invoice_month, invoice_year) VALUES (?, ?, ?, ?, ?, ?)`).run(studentId, student.registration_no, student.current_class, student.monthly_fee, month, year);
    } catch (err) { if (err.message.includes('UNIQUE constraint failed')) throw new Error(`Fee for ${month} ${year} already generated.`); throw err; }
};

const generateBulkFees = () => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    const month = months[now.getMonth()];
    const year = now.getFullYear().toString();
    const missingStudents = db.prepare(`SELECT id, registration_no, current_class, monthly_fee FROM students WHERE LOWER(status) = 'active' AND id NOT IN (SELECT student_id FROM fee_tbl WHERE LOWER(invoice_month) = LOWER(?) AND invoice_year = ?)`).all(month, year);
    if (missingStudents.length === 0) return { success: false, message: `Invoices for ${month} ${year} already generated.` };
    const insertStmt = db.prepare(`INSERT INTO fee_tbl (student_id, registration_no, current_class, monthly_fee, invoice_month, invoice_year, collection) VALUES (?, ?, ?, ?, ?, ?, 0)`);
    const transaction = db.transaction((students) => { for (const s of students) insertStmt.run(s.id, s.registration_no, s.current_class, s.monthly_fee, month, year); });
    transaction(missingStudents);
    const allActive = db.prepare("SELECT id FROM students WHERE LOWER(status) = 'active'").all();
    return { success: true, count: missingStudents.length, ids: allActive.map(s => s.id) };
};

const getFeeRecords = () => db.prepare(`SELECT f.*, s.student_name, s.father_name FROM fee_tbl f JOIN students s ON f.student_id = s.id ORDER BY f.id DESC`).all();
function updateCollection(id, amount) { return db.prepare('UPDATE fee_tbl SET collection = collection + ? WHERE id = ?').run(amount, id); }
function updateFeeRecord(id, newCollection) { return db.prepare('UPDATE fee_tbl SET collection = ? WHERE id = ?').run(newCollection, id); }
const deleteFee = (id) => db.prepare('DELETE FROM fee_tbl WHERE id = ?').run(id);
function getFeeRecordById(id) { return db.prepare(`SELECT f.*, s.student_name, s.father_name, s.registration_no, s.section FROM fee_tbl f JOIN students s ON f.student_id = s.id WHERE f.id = ?`).get(id); }

function getFeeRecordsFilters(filters = {}) {
    let query = `SELECT f.*, s.student_name, s.father_name, s.section FROM fee_tbl f JOIN students s ON f.student_id = s.id WHERE 1=1`;
    const params = [];
    if (filters.month) { query += ` AND f.invoice_month = ?`; params.push(filters.month); }
    if (filters.year) { query += ` AND f.invoice_year = ?`; params.push(filters.year); }
    if (filters.className) { query += ` AND f.current_class = ?`; params.push(filters.className); }
    query += ` ORDER BY f.id DESC`;
    return db.prepare(query).all(...params);
}

function getUniqueInvoiceMonths() { return db.prepare('SELECT DISTINCT invoice_month FROM fee_tbl ORDER BY invoice_month DESC').all(); }
function getUniqueInvoiceYears() { return db.prepare('SELECT DISTINCT invoice_year FROM fee_tbl ORDER BY invoice_year DESC').all(); }
function getClassesFee() { return db.prepare('SELECT class_name FROM classes ORDER BY class_name ASC').all(); }

const getStaff = () => db.prepare("SELECT * FROM staff_tbl ORDER BY id DESC").all();
const insertStaff = (data) => db.prepare(`INSERT INTO staff_tbl (name, cnic, contact, designation, doj, salary, allowance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(data.name, data.cnic, data.contact, data.designation, data.doj, data.salary, data.allowance, data.status);
const updateStaff = (id, data) => db.prepare(`UPDATE staff_tbl SET name=?, cnic=?, contact=?, designation=?, doj=?, salary=?, allowance=?, status=? WHERE id=?`).run(data.name, data.cnic, data.contact, data.designation, data.doj, data.salary, data.allowance, data.status, id);
const deleteStaff = (id) => db.prepare("DELETE FROM staff_tbl WHERE id = ?").run(id);

/**
 * Initiates salary records for all 'Active' staff members for a specific month/year.
 * It pulls the current Basic Salary, Allowance, and Authorized Leaves from staff_tbl.
 */
const initiateSalary = (month, year) => {
    try {
        // 1. Find staff members who are 'Active' but don't have a record for this month yet
        const missingStaff = db.prepare(`
            SELECT id, name, salary, allowance, auth_leaves 
            FROM staff_tbl 
            WHERE status = 'Active' 
            AND id NOT IN (
                SELECT staff_id FROM salary_tbl 
                WHERE salary_month = ? AND salary_year = ?
            )
        `).all(month, year);

        // 2. If everyone is already initiated, return early
        if (missingStaff.length === 0) {
            return { 
                success: false, 
                message: `Salary records for ${month} ${year} are already initiated for all active staff.` 
            };
        }

        // 3. Prepare the insert statement with the new auth_leaves column
        const insertStmt = db.prepare(`
            INSERT INTO salary_tbl (
                staff_id, 
                name, 
                salary, 
                allowance, 
                auth_leaves, 
                availed_leaves, 
                salary_month, 
                salary_year, 
                status
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'Unpaid')
        `);

        // 4. Run as a transaction for safety (all or nothing)
        const transaction = db.transaction((staffList) => {
            for (const s of staffList) {
                insertStmt.run(
                    s.id,           // staff_id
                    s.name,         // name
                    s.salary,       // current basic salary
                    s.allowance,    // current allowance
                    s.auth_leaves,  // current authorized leave limit
                    month,          // salary_month
                    year            // salary_year
                );
            }
        });

        transaction(missingStaff);

        return { 
            success: true, 
            count: missingStaff.length 
        };

    } catch (err) {
        console.error("Initiate Salary Error:", err);
        return { success: false, error: err.message };
    }
};

/**
 * Updates the number of leaves actually taken by the staff member.
 * This can only be called from the frontend before the status is changed to 'Paid'.
 */
const updateAvailedLeaves = (id, count) => {
    return db.prepare(`
        UPDATE salary_tbl 
        SET availed_leaves = ? 
        WHERE id = ? AND status = 'Unpaid'
    `).run(count, id);
};
// database.js
const getSalaries = (month, year) => {
    return db.prepare(`
        SELECT 
            s.*, 
            st.designation 
        FROM salary_tbl s
        JOIN staff_tbl st ON s.staff_id = st.id
        WHERE s.salary_month = ? AND s.salary_year = ?
    `).all(month, year);
};

const updateSalaryStatus = (id, status, paidSalary) => {
    // Added 'salary = ?' to the query
    return db.prepare("UPDATE salary_tbl SET status = ?, salary = ? WHERE id = ?")
             .run(status, paidSalary, id);
};

const getDashboardStats = () => {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear().toString();
    const activeStudents = db.prepare("SELECT count(*) as count FROM students WHERE status = 'active'").get().count;
    const receivables = db.prepare("SELECT SUM(total_fee) as total FROM fee_tbl WHERE invoice_month = ? AND invoice_year = ?").get(month, year).total || 0;
    const feeReceived = db.prepare("SELECT SUM(collection) as total FROM fee_tbl WHERE invoice_month = ? AND invoice_year = ?").get(month, year).total || 0;
    const balance = db.prepare("SELECT SUM(balance) as total FROM fee_tbl WHERE invoice_month = ? AND invoice_year = ?").get(month, year).total || 0;
    const salaries = db.prepare("SELECT SUM(salary) as total FROM salary_tbl WHERE salary_month = ? AND salary_year = ?").get(month, year).total || 0;
    const expenses = db.prepare("SELECT SUM(exp_amount) as total FROM exp_tbl WHERE exp_month = ? AND exp_year = ?").get(month, year).total || 0;
    return { activeStudents, receivables, balance, salaries, feeReceived, expenses };
};

// Add these to Database.js
const getActiveClasses = () => {
    // Note: Use SINGLE QUOTES 'active' for the value
    return db.prepare("SELECT DISTINCT current_class FROM students WHERE status = 'active' ORDER BY current_class ASC").all();
};

const initiateExamForClasses = (examId, selectedClasses) => {
    // 1. Create placeholders (?, ?, ?) based on number of selected classes
    const placeholders = selectedClasses.map(() => '?').join(',');
    
    const insertStmt = db.prepare(`
        INSERT INTO result (student_id, exam_id, class, sec)
        SELECT id, ?, current_class, section 
        FROM students 
        WHERE current_class IN (${placeholders}) 
        AND status = 'active'
        AND id NOT IN (
            SELECT student_id FROM result WHERE exam_id = ?
        )
    `);

    // Execute: [exam_id, ...classNames, exam_id_for_check]
    const result = insertStmt.run(examId, ...selectedClasses, examId);
    return { success: true, newlyAdded: result.changes };
};
// Add this inside database.js
const getStudentFeeHistory = (studentId) => {
    // Get Student Basics
    const student = db.prepare('SELECT student_name, registration_no FROM students WHERE id = ?').get(studentId);
    
    // Get Fee Records from fee_tbl
    const history = db.prepare(`
        SELECT * FROM fee_tbl 
        WHERE student_id = ? 
        ORDER BY invoice_year DESC, invoice_month DESC
    `).all(studentId);

    return { student, history };
};

// Add to database.js
const getFeeReportByStatus = (statusType) => {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear().toString();

    let statusFilter = "";
    if (statusType === 'paid') statusFilter = "AND f.balance <= 0";
    else if (statusType === 'unpaid') statusFilter = "AND f.collection = 0";
    else if (statusType === 'partial') statusFilter = "AND f.collection > 0 AND f.balance > 0";

    const sql = `
        SELECT 
            f.registration_no, s.student_name, f.current_class, s.section,
            f.monthly_fee, f.collection, f.balance, f.created_at as paid_on,
            (SELECT SUM(balance) FROM fee_tbl WHERE registration_no = f.registration_no AND id < f.id) as arrears
        FROM fee_tbl f
        JOIN students s ON f.student_id = s.id
        WHERE f.invoice_month = ? AND f.invoice_year = ? ${statusFilter}
        ORDER BY f.current_class ASC, s.section ASC, f.registration_no ASC
    `;
    
    return db.prepare(sql).all(month, year);
};

// Update module.exports to include getFeeReportByStatus
// Add/Update in database.js
// Add to database.js
// Update this in database.js
const getDateWiseReport = (selectedDate) => {
    const sql = `
        SELECT 
            f.registration_no, s.student_name, f.current_class, s.section,
            f.monthly_fee, f.collection, f.balance, f.created_at as paid_on,
            (SELECT SUM(balance) FROM fee_tbl WHERE registration_no = f.registration_no AND id < f.id) as arrears
        FROM fee_tbl f
        JOIN students s ON f.student_id = s.id
        WHERE DATE(f.created_at) = ? 
        AND f.collection > 0  -- This line filters out students with 0 paid amount
        ORDER BY f.current_class ASC, s.section ASC, f.registration_no ASC
    `;
    return db.prepare(sql).all(selectedDate);
};


const addDateSheetPaper = (data) => {
    const sql = `INSERT INTO datesheet (subject, exam_date, exam_year, exam_id, class_id) 
                 VALUES (?, ?, ?, ?, ?)`;
    return db.prepare(sql).run(
        data.subject, 
        data.exam_date, 
        data.exam_year, 
        data.exam_id, 
        data.class_id
    );
};
const updateDateSheetPaper = (data) => {
    const sql = `UPDATE datesheet 
                 SET subject = ?, exam_date = ?, exam_year = ?, exam_id = ?, class_id = ? 
                 WHERE id = ?`;
    return db.prepare(sql).run(
        data.subject, 
        data.exam_date, 
        data.exam_year, 
        data.exam_id, 
        data.class_id,
        data.id
    );
};



// Inside initializeDB function in database.js
db.exec(`CREATE TABLE IF NOT EXISTS datesheet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT,
    exam_date DATE,
    exam_year TEXT,
    exam_name TEXT,
    class_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
)`);

// Function to fetch DateSheet with Class Names joined
// Function to fetch DateSheet with Class Names joined
// Change your query in Database.js to this:
const getDateSheetRecords = (filters = {}) => {
    let sql = `
        SELECT ds.*, c.class_name, e.exam_name 
        FROM datesheet ds
        JOIN classes c ON ds.class_id = c.id
        JOIN exams e ON ds.exam_id = e.exam_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.year) {
        sql += ` AND ds.exam_year = ?`;
        params.push(filters.year);
    }
    if (filters.exam_id) {
        sql += ` AND ds.exam_id = ?`;
        params.push(filters.exam_id);
    }
    if (filters.class_id) {
        sql += ` AND ds.class_id = ?`;
        params.push(filters.class_id);
    }

    sql += ` ORDER BY ds.exam_date ASC`;
    return db.prepare(sql).all(...params);
};


const deleteDateSheetPaper = (id) => {
    const sql = `DELETE FROM datesheet WHERE id = ?`;
    return db.prepare(sql).run(id);
};


module.exports = {
    db, checkUser, addUser, getAllUsers, addClass, getClasses, deleteClass, updateClass, 
    addStudent, getStudents, getStudentById, updateStudent, deleteStudent, 
    generateFee, generateBulkFees, getFeeRecords, updateCollection, updateFeeRecord, 
    deleteFee, getFeeRecordById, getFeeRecordsFilters, getStaff, insertStaff, 
    updateStaff, deleteStaff, initiateSalary, getSalaries, updateSalaryStatus, 
    getDashboardStats, getUniqueInvoiceMonths, getUniqueInvoiceYears, getClassesFee,
    getActiveClasses, initiateExamForClasses, getStudentFeeHistory, updateAvailedLeaves,
    getFeeReportByStatus, getDateWiseReport, deleteFeeRecordsByStudent, deleteResultsByStudent,
    addDateSheetPaper, getDateSheetRecords, updateDateSheetPaper, deleteDateSheetPaper
};