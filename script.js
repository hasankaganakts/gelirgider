// Firebase Initialization
// TODO: Replace the below configuration with your Firebase project's configuration
const firebaseConfig = {
    apiKey: "AIzaSyBXyTE29ilYyymRKWa7spqPSQZYNIQAOT8",
            authDomain: "shiftmanagementweb.firebaseapp.com",
            projectId: "shiftmanagementweb",
            storageBucket: "shiftmanagementweb.appspot.com",
            messagingSenderId: "1014015170658",
            appId: "1:1014015170658:web:bf32c89e6b05869aa4593b"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Veri saklama değişkenleri
let departments = [];
let employees = [];
let shifts = []; // Vardiyalar listesi

// Varsayılan Görünüm
let currentView = 'daily'; // 'daily', 'weekly' veya 'monthly'

// Departman Seçeneklerini Güncelleme (Çalışan ve Vardiya Ekleme için)
async function updateDepartmentOptions() {
    const employeeDepartmentSelect = document.getElementById('employee-department');
    if (employeeDepartmentSelect) {
        employeeDepartmentSelect.innerHTML = '<option value="" disabled selected>Departman Seç</option>';
    
        departments.forEach(department => {
            const option = document.createElement('option');
            option.value = department.id;
            option.textContent = department.name;
            employeeDepartmentSelect.appendChild(option);
        });
    }

    // Shift Modalindeki çalışan seçme select öğesini güncelle
    const shiftEmployeeSelect = document.getElementById('shift-employee');
    if (shiftEmployeeSelect) {
        shiftEmployeeSelect.innerHTML = '<option value="" disabled selected>Çalışan Seç</option>';
        employees.forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.id;
            const department = departments.find(dep => dep.id === employee.departmentId);
            option.textContent = `${employee.name} (${department ? department.name : 'Departman Yok'})`;
            shiftEmployeeSelect.appendChild(option);
        });
    }
}

// Gün Adını Formatlama
function formatDay(date) {
    const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    return days[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

// Tarihi YYYY-MM-DD Formatına Getirme
function formatDate(date) {
    const year = date.getFullYear();
    const month = (`0${(date.getMonth() + 1)}`).slice(-2);
    const day = (`0${date.getDate()}`).slice(-2);
    return `${year}-${month}-${day}`;
}

// Haftanın Günlerini Alma
function getWeekDays(selectedDate) {
    const date = new Date(selectedDate);
    const day = date.getDay(); // 0: Pazar, 1: Pazartesi, ..., 6: Cumartesi
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day === 0 ? 7 : day) - 1));
    monday.setHours(0,0,0,0);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(monday);
        currentDay.setDate(monday.getDate() + i);
        weekDays.push({
            label: formatDay(currentDay),
            date: formatDate(currentDay)
        });
    }
    return weekDays;
}

// Haftanın Başlangıç ve Bitiş Tarihlerini Alma
function getWeekRange(selectedDate) {
    const date = new Date(selectedDate);
    const day = date.getDay(); // 0: Pazar, 1: Pazartesi, ..., 6: Cumartesi
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day === 0 ? 7 : day) - 1));
    monday.setHours(0,0,0,0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    return {
        start: formatDate(monday),
        end: formatDate(sunday)
    };
}

// Aylığın Başlangıç ve Bitiş Tarihlerini Alma
function getMonthRange(selectedDate) {
    const date = new Date(selectedDate);
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
        start: formatDate(firstDay),
        end: formatDate(lastDay)
    };
}

// Belirli bir tarihteki vardiyayı alma
function getShift(employeeId, date) {
    return shifts.find(shift => {
        return shift.employeeId === employeeId && shift.date === date;
    });
}

// Departman Renkini Alma
function getDepartmentColor(departmentId) {
    const department = departments.find(dep => dep.id === departmentId);
    if (department && /^#([0-9A-F]{3}){1,2}$/i.test(department.color)) {
        return department.color;
    }
    return '#6c757d'; // Default renk
}

// Departman Adını Alma
function getDepartmentName(departmentId) {
    const department = departments.find(dep => dep.id === departmentId);
    return department ? department.name : 'Departman Yok';
}

// Document Ready
document.addEventListener('DOMContentLoaded', async () => {
    await fetchData();
    updateDepartmentOptions();
    updateDepartmentTable();
    updateEmployeeTable();
    initializeFlatpickr();
    renderShiftCalendar();

    // Excel'e Aktar Butonu Olayı
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
    }

    // Görünüm Butonları Olayları
    const viewButtons = document.querySelectorAll('.btn-group .btn');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.getAttribute('data-view');
            renderShiftCalendar();
        });
    });

    // Shift Calendar Date Selection
    const selectedDateInput = document.getElementById('selected-date');
    if (selectedDateInput) {
        selectedDateInput.addEventListener('change', renderShiftCalendar);
    }
});

// Firebase'den Verileri Çekme
async function fetchData() {
    // Departmanları Çek
    const departmentsSnapshot = await db.collection('departments').get();
    departments = departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Çalışanları Çek
    const employeesSnapshot = await db.collection('employees').get();
    employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Vardiyaları Çek
    const shiftsSnapshot = await db.collection('shifts').get();
    shifts = shiftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Departman Ekleme/Düzenleme Formu İşlemleri
const departmentForm = document.getElementById('department-form');
if (departmentForm) {
    departmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const departmentId = document.getElementById('department-id').value;
        const name = document.getElementById('department-name').value.trim();
        const color = document.getElementById('department-color').value;

        if (name && color) {
            if (departmentId) {
                // Güncelle
                await db.collection('departments').doc(departmentId).update({
                    name,
                    color
                });
            } else {
                // Yeni ekle
                await db.collection('departments').add({
                    name,
                    color
                });
            }

            await fetchData();
            updateDepartmentTable();
            updateDepartmentOptions();
            updateEmployeeTable();
            renderShiftCalendar();
            departmentForm.reset();
            const departmentModal = bootstrap.Modal.getInstance(document.getElementById('departmentModal'));
            departmentModal.hide();
        } else {
            alert("Lütfen tüm alanları doğru bir şekilde doldurun.");
        }
    });
}

// Departman Tablosunu Güncelleme
function updateDepartmentTable() {
    const departmentTableBody = document.querySelector('#department-table tbody');
    if (!departmentTableBody) return;
    departmentTableBody.innerHTML = '';

    departments.forEach(department => {
        const tr = document.createElement('tr');

        // Departman Adı
        const tdName = document.createElement('td');
        tdName.textContent = department.name || '';
        tr.appendChild(tdName);

        // Renk
        const tdColor = document.createElement('td');
        const colorBox = document.createElement('div');
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = department.color;
        colorBox.style.border = '1px solid #ced4da';
        colorBox.style.borderRadius = '4px';
        tdColor.appendChild(colorBox);
        tr.appendChild(tdColor);

        // İşlemler
        const tdActions = document.createElement('td');

        // Düzenle Butonu
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.classList.add('btn', 'btn-primary', 'btn-sm', 'me-1');
        editBtn.addEventListener('click', () => {
            editDepartment(department.id);
        });
        tdActions.appendChild(editBtn);

        // Sil Butonu
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.addEventListener('click', () => {
            deleteDepartment(department.id);
        });
        tdActions.appendChild(deleteBtn);

        tr.appendChild(tdActions);

        departmentTableBody.appendChild(tr);
    });
}

// Departman Düzenleme Fonksiyonu
async function editDepartment(departmentId) {
    const departmentDoc = await db.collection('departments').doc(departmentId).get();
    if (departmentDoc.exists) {
        const department = departmentDoc.data();
        document.getElementById('department-id').value = departmentId;
        document.getElementById('department-name').value = department.name;
        document.getElementById('department-color').value = department.color;

        document.getElementById('departmentModalLabel').textContent = 'Departman Düzenle';
        const departmentModal = new bootstrap.Modal(document.getElementById('departmentModal'));
        departmentModal.show();
    }
}

// Departman Silme
async function deleteDepartment(departmentId) {
    if (confirm('Bu departmanı silmek istediğinize emin misiniz?')) {
        await db.collection('departments').doc(departmentId).delete();

        // Bu departmana bağlı çalışanların departmanını kaldır
        const employeesSnapshot = await db.collection('employees').where('departmentId', '==', departmentId).get();
        const batch = db.batch();
        employeesSnapshot.forEach(doc => {
            batch.update(doc.ref, { departmentId: null });
        });
        await batch.commit();

        await fetchData();
        updateDepartmentTable();
        updateDepartmentOptions();
        updateEmployeeTable();
        renderShiftCalendar();
    }
}

// Çalışan Ekleme/Düzenleme Formu İşlemleri
const employeeForm = document.getElementById('employee-form');
if (employeeForm) {
    employeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('employee-id').value;
        const name = document.getElementById('employee-name').value.trim();
        const departmentId = document.getElementById('employee-department').value;
        const wageInput = document.getElementById('employee-wage').value;
        const wage = parseFloat(wageInput);
        const avatarInput = document.getElementById('employee-avatar');
        let avatarURL = '';

        if (avatarInput.files && avatarInput.files[0]) {
            const storageRef = storage.ref();
            const avatarRef = storageRef.child(`avatars/${Date.now()}_${avatarInput.files[0].name}`);
            await avatarRef.put(avatarInput.files[0]);
            avatarURL = await avatarRef.getDownloadURL();
        }

        if (name && departmentId && !isNaN(wage)) {
            if (employeeId) {
                // Güncelle
                const updateData = {
                    name,
                    departmentId: departmentId,
                    wage
                };
                if (avatarURL) {
                    updateData.avatar = avatarURL;
                } else {
                    updateData.avatar = firebase.firestore.FieldValue.delete();
                }
                await db.collection('employees').doc(employeeId).update(updateData);
            } else {
                // Yeni ekle
                await db.collection('employees').add({
                    name,
                    departmentId: departmentId,
                    wage,
                    avatar: avatarURL || ''
                });
            }

            await fetchData();
            updateEmployeeTable();
            updateDepartmentOptions();
            renderShiftCalendar();
            employeeForm.reset();
            const employeeModal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
            employeeModal.hide();
        } else {
            alert("Lütfen tüm alanları doğru bir şekilde doldurun.");
        }
    });
}

// Çalışan Tablosunu Güncelleme
function updateEmployeeTable() {
    const employeeTableBody = document.querySelector('#employee-table tbody');
    if (!employeeTableBody) return;
    employeeTableBody.innerHTML = '';

    const selectedDate = document.getElementById('selected-date').value;
    const weekRange = getWeekRange(selectedDate);
    const monthRange = getMonthRange(selectedDate);

    employees.forEach(employee => {
        const tr = document.createElement('tr');

        // Çalışan Adı
        const tdName = document.createElement('td');
        if (employee.avatar) {
            const img = document.createElement('img');
            img.src = employee.avatar;
            img.alt = `${employee.name} Avatar`;
            img.classList.add('avatar');
            tr.appendChild(img);

            const nameDiv = document.createElement('div');
            nameDiv.classList.add('employee-info');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('employee-name');
            nameSpan.textContent = employee.name || '';
            const deptSpan = document.createElement('span');
            deptSpan.classList.add('department-name');
            const department = departments.find(dep => dep.id === employee.departmentId);
            deptSpan.textContent = ` (${department ? department.name : 'Departman Yok'})`;
            nameDiv.appendChild(nameSpan);
            nameDiv.appendChild(deptSpan);
            tdName.appendChild(nameDiv);
        } else {
            tdName.textContent = employee.name || '';
        }
        tr.appendChild(tdName);

        // Departman
        const tdDepartment = document.createElement('td');
        const department = departments.find(dep => dep.id === employee.departmentId);
        tdDepartment.textContent = department ? department.name : 'Departman Yok';
        tr.appendChild(tdDepartment);

        // Saatlik Ücret
        const tdWage = document.createElement('td');
        const wage = employee.wage || 0;
        tdWage.textContent = wage.toFixed(2);
        tr.appendChild(tdWage);

        // Toplam Çalışma Saati
        const totalHours = calculateTotalHours(employee.id);
        const tdTotalHours = document.createElement('td');
        tdTotalHours.textContent = totalHours.toFixed(2);
        tr.appendChild(tdTotalHours);

        // Toplam Ödeme
        const totalPayment = totalHours * wage;
        const tdTotalPayment = document.createElement('td');
        tdTotalPayment.textContent = totalPayment.toFixed(2);
        tr.appendChild(tdTotalPayment);

        // Haftalık Çalışma Saati
        const weeklyHours = calculateHoursInRange(employee.id, weekRange.start, weekRange.end);
        const tdWeeklyHours = document.createElement('td');
        tdWeeklyHours.textContent = weeklyHours.toFixed(2);
        tr.appendChild(tdWeeklyHours);

        // Haftalık Ödeme
        const weeklyPayment = weeklyHours * wage;
        const tdWeeklyPayment = document.createElement('td');
        tdWeeklyPayment.textContent = weeklyPayment.toFixed(2);
        tr.appendChild(tdWeeklyPayment);

        // Aylık Çalışma Saati
        const monthlyHours = calculateHoursInRange(employee.id, monthRange.start, monthRange.end);
        const tdMonthlyHours = document.createElement('td');
        tdMonthlyHours.textContent = monthlyHours.toFixed(2);
        tr.appendChild(tdMonthlyHours);

        // Aylık Ödeme
        const monthlyPayment = monthlyHours * wage;
        const tdMonthlyPayment = document.createElement('td');
        tdMonthlyPayment.textContent = monthlyPayment.toFixed(2);
        tr.appendChild(tdMonthlyPayment);

        // İşlemler
        const tdActions = document.createElement('td');

        // Düzenle Butonu
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.classList.add('btn', 'btn-primary', 'btn-sm', 'me-1');
        editBtn.addEventListener('click', () => {
            editEmployee(employee.id);
        });
        tdActions.appendChild(editBtn);

        // Sil Butonu
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.addEventListener('click', () => {
            deleteEmployee(employee.id);
        });
        tdActions.appendChild(deleteBtn);

        tr.appendChild(tdActions);

        employeeTableBody.appendChild(tr);
    });
}

// Çalışan Düzenleme Fonksiyonu
async function editEmployee(employeeId) {
    const employeeDoc = await db.collection('employees').doc(employeeId).get();
    if (employeeDoc.exists) {
        const employee = employeeDoc.data();
        document.getElementById('employee-id').value = employeeId;
        document.getElementById('employee-name').value = employee.name;
        document.getElementById('employee-department').value = employee.departmentId;
        document.getElementById('employee-wage').value = employee.wage;
        // Avatar handling can be added here if necessary

        document.getElementById('employeeModalLabel').textContent = 'Çalışan Düzenle';
        const employeeModal = new bootstrap.Modal(document.getElementById('employeeModal'));
        employeeModal.show();
    }
}

// Çalışan Silme
async function deleteEmployee(employeeId) {
    if (confirm('Bu çalışanı silmek istediğinize emin misiniz?')) {
        await db.collection('employees').doc(employeeId).delete();

        // İlgili vardiyaları da sil
        const shiftsSnapshot = await db.collection('shifts').where('employeeId', '==', employeeId).get();
        const batch = db.batch();
        shiftsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        await fetchData();
        updateEmployeeTable();
        updateDepartmentOptions();
        renderShiftCalendar();
    }
}

// Vardiya Ekleme/Düzenleme Formu İşlemleri
const shiftForm = document.getElementById('shift-form');
if (shiftForm) {
    shiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const shiftId = document.getElementById('shift-id').value;
        const employeeId = document.getElementById('shift-employee').value;
        const date = document.getElementById('shift-date').value;
        const start = document.getElementById('shift-start').value;
        const end = document.getElementById('shift-end').value;

        if (employeeId && date && start && end) {
            // Vardiya Çakışması Kontrolü
            const shiftsSnapshot = await db.collection('shifts')
                .where('employeeId', '==', employeeId)
                .where('date', '==', date)
                .get();

            let isOverlapping = false;
            shiftsSnapshot.forEach(doc => {
                if (shiftId && doc.id === shiftId) return; // Aynı vardiya
                const existingShift = doc.data();
                const existingStart = parseTime(existingShift.start);
                const existingEnd = parseTime(existingShift.end) <= parseTime(existingShift.start) ? parseTime(existingShift.end) + 24 : parseTime(existingShift.end);
                const newStart = parseTime(start);
                const newEnd = parseTime(end) <= parseTime(start) ? parseTime(end) + 24 : parseTime(end);

                if (
                    (newStart >= existingStart && newStart < existingEnd) ||
                    (newEnd > existingStart && newEnd <= existingEnd) ||
                    (newStart <= existingStart && newEnd >= existingEnd)
                ) {
                    isOverlapping = true;
                }
            });

            if (isOverlapping) {
                alert("Seçilen çalışan için bu saat aralığında zaten bir vardiya bulunmaktadır.");
                return;
            }

            if (shiftId) {
                // Vardiyayı güncelle
                await db.collection('shifts').doc(shiftId).update({
                    employeeId: employeeId,
                    date: date,
                    start: start,
                    end: end
                });
            } else {
                // Yeni vardiya ekle
                await db.collection('shifts').add({
                    employeeId: employeeId,
                    date: date,
                    start: start,
                    end: end
                });
            }

            await fetchData();
            updateEmployeeTable();
            renderShiftCalendar();
            shiftForm.reset();
            document.getElementById('shift-id').value = '';

            const shiftModal = bootstrap.Modal.getInstance(document.getElementById('shiftModal'));
            shiftModal.hide();
        } else {
            alert("Lütfen tüm alanları doğru bir şekilde doldurun.");
        }
    });
}

// Vardiya Düzenleme Fonksiyonu
async function editShift(shiftId) {
    const shiftDoc = await db.collection('shifts').doc(shiftId).get();
    if (shiftDoc.exists) {
        const shift = shiftDoc.data();
        document.getElementById('shift-id').value = shiftId;
        document.getElementById('shift-employee').value = shift.employeeId;
        document.getElementById('shift-date').value = shift.date;
        document.getElementById('shift-start').value = shift.start;
        document.getElementById('shift-end').value = shift.end;

        document.getElementById('shiftModalLabel').textContent = 'Vardiya Düzenle';
        const shiftModal = new bootstrap.Modal(document.getElementById('shiftModal'));
        shiftModal.show();
    }
}

// Saatleri Hesaplama Fonksiyonları
function calculateHours(startTimeStr, endTimeStr) {
    if (!startTimeStr || !endTimeStr) return 0;
    const start = parseTime(startTimeStr);
    let end = parseTime(endTimeStr);
    if (end <= start) end += 24; // Gece yarısını geçiyorsa

    let hours = end - start;
    return hours;
}

function calculateTotalHours(employeeId) {
    const employeeShifts = shifts.filter(shift => shift.employeeId === employeeId);
    let totalHours = 0;
    employeeShifts.forEach(shift => {
        totalHours += calculateHours(shift.start, shift.end);
    });
    return totalHours;
}

function calculateHoursInRange(employeeId, startDate, endDate) {
    const employeeShifts = shifts.filter(shift => 
        shift.employeeId === employeeId &&
        shift.date >= startDate &&
        shift.date <= endDate
    );

    let totalHours = 0;
    employeeShifts.forEach(shift => {
        totalHours += calculateHours(shift.start, shift.end);
    });
    return totalHours;
}

function parseTime(timeStr) {
    if (!timeStr) return NaN;
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (isNaN(hours) || isNaN(minutes)) return NaN;

    return hours + minutes / 60;
}

// Excel'e Aktarma Fonksiyonu
async function exportToExcel() {
    const exportData = [];
    const shiftsSnapshot = await db.collection('shifts').get();

    for (const shiftDoc of shiftsSnapshot.docs) {
        const shift = shiftDoc.data();
        const employeeDoc = await db.collection('employees').doc(shift.employeeId).get();
        const employee = employeeDoc.exists ? employeeDoc.data() : null;
        const departmentDoc = employee ? await db.collection('departments').doc(employee.departmentId).get() : null;
        const department = departmentDoc && departmentDoc.exists ? departmentDoc.data() : null;

        exportData.push({
            'Çalışan Adı': employee ? employee.name : 'Çalışan Yok',
            'Departman': department ? department.name : 'Departman Yok',
            'Tarih': shift.date,
            'Başlangıç Saati': shift.start,
            'Bitiş Saati': shift.end,
            'Çalışılan Saat': calculateHours(shift.start, shift.end).toFixed(2)
        });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vardiyalar");
    XLSX.writeFile(workbook, "vardiyalar.xlsx");
}

// Flatpickr Başlatma
function initializeFlatpickr() {
    // Vardiya Ekleme/Düzenleme Modalındaki Tarih Seçici
    flatpickr("#shift-date", {
        dateFormat: "Y-m-d",
        locale: "tr",
        minDate: "today"
    });

    // Vardiya Başlangıç Saati
    flatpickr("#shift-start", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        locale: "tr"
    });

    // Vardiya Bitiş Saati
    flatpickr("#shift-end", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        locale: "tr"
    });

    // Shift Calendar için Tarih Seçici
    flatpickr("#selected-date", {
        dateFormat: "Y-m-d",
        locale: "tr",
        defaultDate: "today",
        onChange: renderShiftCalendar
    });
}

// Vardiya Takvimi Tablosu Render Etme
async function renderShiftCalendar() {
    const selectedDate = document.getElementById('selected-date').value;
    const calendarHead = document.querySelector('#shift-calendar thead');
    const calendarBody = document.querySelector('#shift-calendar tbody');
    if (calendarHead) calendarHead.innerHTML = '';
    if (calendarBody) calendarBody.innerHTML = '';

    if (!selectedDate) return;

    if (currentView === 'daily') {
        renderDailyView(selectedDate);
    } else if (currentView === 'weekly') {
        renderWeeklyView(selectedDate);
    } else if (currentView === 'monthly') {
        renderMonthlyView(selectedDate);
    }
}

// Günlük Görünüm Render Etme (Saatlik Tablo)
function renderDailyView(selectedDate) {
    const calendarHead = document.querySelector('#shift-calendar thead');
    const calendarBody = document.querySelector('#shift-calendar tbody');
    if (!calendarHead || !calendarBody) return;

    // Saat Dilimleri (09:00 - 01:00)
    const startHour = 9; // 09:00
    const endHour = 25;  // 01:00 (next day)

    const timeSlots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
        const displayHour = hour % 24;
        const formattedHour = displayHour < 10 ? `0${displayHour}:00` : `${displayHour}:00`;
        timeSlots.push(formattedHour);
    }

    // Başlıkları Oluşturma
    const headerRow = document.createElement('tr');
    const thName = document.createElement('th');
    thName.textContent = 'Çalışan Adı';
    headerRow.appendChild(thName);

    timeSlots.forEach(time => {
        const th = document.createElement('th');
        th.textContent = time;
        headerRow.appendChild(th);
    });

    calendarHead.appendChild(headerRow);

    // Çalışanlar ve Vardiyalar
    employees.forEach(employee => {
        const tr = document.createElement('tr');

        // Çalışan Adı
        const tdName = document.createElement('td');
        if (employee.avatar) {
            const avatarImg = document.createElement('img');
            avatarImg.src = employee.avatar;
            avatarImg.alt = `${employee.name} Avatar`;
            avatarImg.classList.add('avatar');
            tr.appendChild(avatarImg);

            const nameDiv = document.createElement('div');
            nameDiv.classList.add('employee-info');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('employee-name');
            nameSpan.textContent = employee.name || '';
            const deptSpan = document.createElement('span');
            deptSpan.classList.add('department-name');
            const department = departments.find(dep => dep.id === employee.departmentId);
            deptSpan.textContent = ` (${department ? department.name : 'Departman Yok'})`;
            nameDiv.appendChild(nameSpan);
            nameDiv.appendChild(deptSpan);
            tdName.appendChild(nameDiv);
        } else {
            tdName.textContent = employee.name || '';
        }
        tr.appendChild(tdName);

        // Saatlik Hücreler
        for (let i = startHour; i <= endHour; i++) {
            const td = document.createElement('td');
            const currentHour = i % 24;
            const currentTime = currentHour < 10 ? `0${currentHour}:00` : `${currentHour}:00`;

            // Çalışanın vardiyası bu saatte mi?
            const isWorking = shifts.some(shift => {
                if (shift.employeeId !== employee.id || shift.date !== selectedDate) return false;
                let shiftStart = parseTime(shift.start);
                let shiftEnd = parseTime(shift.end);
                if (shiftEnd <= shiftStart) shiftEnd += 24; // Gece yarısını geçiyorsa

                return i >= shiftStart && i < shiftEnd;
            });

            if (isWorking) {
                td.classList.add('working-cell');
                const department = departments.find(dep => dep.id === employee.departmentId);
                td.style.backgroundColor = department ? department.color : '#6c757d';

                // Find the corresponding shift for tooltip
                const shift = shifts.find(shift => {
                    if (shift.employeeId !== employee.id || shift.date !== selectedDate) return false;
                    let shiftStart = parseTime(shift.start);
                    let shiftEnd = parseTime(shift.end);
                    if (shiftEnd <= shiftStart) shiftEnd += 24;
                    return i >= shiftStart && i < shiftEnd;
                });
                if (shift) {
                    td.title = `Departman: ${getDepartmentName(employee.departmentId)}\nBaşlangıç: ${shift.start}\nBitiş: ${shift.end}`;
                    td.style.cursor = 'pointer';
                    td.addEventListener('click', () => {
                        editShift(shift.id);
                    });
                }
            } else {
                td.textContent = '';
            }

            tr.appendChild(td);
        }

        calendarBody.appendChild(tr);
    });
}

// Haftalık Görünüm Render Etme
function renderWeeklyView(selectedDate) {
    const weekDays = getWeekDays(selectedDate);
    const calendarHead = document.querySelector('#shift-calendar thead');
    const calendarBody = document.querySelector('#shift-calendar tbody');
    if (!calendarHead || !calendarBody) return;

    // Haftalık Görünüm Başlıkları
    const headerRow = document.createElement('tr');
    const thName = document.createElement('th');
    thName.textContent = 'Çalışan Adı';
    headerRow.appendChild(thName);

    weekDays.forEach(day => {
        const th = document.createElement('th');
        th.textContent = `${day.label} (${day.date})`;
        headerRow.appendChild(th);
    });

    calendarHead.appendChild(headerRow);

    // Çalışanlar ve Vardiyalar
    employees.forEach(employee => {
        const tr = document.createElement('tr');

        // Çalışan Adı
        const tdName = document.createElement('td');
        if (employee.avatar) {
            const avatarImg = document.createElement('img');
            avatarImg.src = employee.avatar;
            avatarImg.alt = `${employee.name} Avatar`;
            avatarImg.classList.add('avatar');
            tr.appendChild(avatarImg);

            const nameDiv = document.createElement('div');
            nameDiv.classList.add('employee-info');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('employee-name');
            nameSpan.textContent = employee.name || '';
            const deptSpan = document.createElement('span');
            deptSpan.classList.add('department-name');
            const department = departments.find(dep => dep.id === employee.departmentId);
            deptSpan.textContent = ` (${department ? department.name : 'Departman Yok'})`;
            nameDiv.appendChild(nameSpan);
            nameDiv.appendChild(deptSpan);
            tdName.appendChild(nameDiv);
        } else {
            tdName.textContent = employee.name || '';
        }
        tr.appendChild(tdName);

        // Haftanın Her Günü için Vardiyalar
        weekDays.forEach(day => {
            const td = document.createElement('td');
            const shift = getShift(employee.id, day.date);
            if (shift) {
                const shiftDiv = document.createElement('div');
                shiftDiv.classList.add('shift-cell');
                shiftDiv.dataset.shiftId = shift.id;
                shiftDiv.innerHTML = `<span class="shift-label">${shift.start} - ${shift.end}</span>`;
                const department = departments.find(dep => dep.id === employee.departmentId);
                shiftDiv.style.backgroundColor = department ? department.color : '#6c757d';
                shiftDiv.title = `Departman: ${getDepartmentName(employee.departmentId)}\nBaşlangıç: ${shift.start}\nBitiş: ${shift.end}`;
                shiftDiv.style.cursor = 'pointer';
                shiftDiv.addEventListener('click', () => {
                    editShift(shift.id);
                });
                td.appendChild(shiftDiv);
            } else {
                td.textContent = '—';
                td.style.color = '#6c757d';
            }
            tr.appendChild(td);
        });

        calendarBody.appendChild(tr);
    });
}

// Aylık Görünüm Render Etme
function renderMonthlyView(selectedDate) {
    const firstDayOfMonth = new Date(selectedDate);
    firstDayOfMonth.setDate(1);
    const lastDayOfMonth = new Date(firstDayOfMonth);
    lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
    lastDayOfMonth.setDate(0);

    const totalDays = lastDayOfMonth.getDate();

    // Aylık Görünüm Başlıkları (Pazartesi - Pazar)
    const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const calendarHead = document.querySelector('#shift-calendar thead');
    const calendarBody = document.querySelector('#shift-calendar tbody');
    if (!calendarHead || !calendarBody) return;

    const headerRow = document.createElement('tr');
    const thName = document.createElement('th');
    thName.textContent = 'Çalışan Adı';
    headerRow.appendChild(thName);

    weekDays.forEach(day => {
        const th = document.createElement('th');
        th.textContent = day;
        headerRow.appendChild(th);
    });

    calendarHead.appendChild(headerRow);

    // Çalışanlar ve Vardiyalar
    employees.forEach(employee => {
        const tr = document.createElement('tr');

        // Çalışan Adı
        const tdName = document.createElement('td');
        if (employee.avatar) {
            const avatarImg = document.createElement('img');
            avatarImg.src = employee.avatar;
            avatarImg.alt = `${employee.name} Avatar`;
            avatarImg.classList.add('avatar');
            tr.appendChild(avatarImg);

            const nameDiv = document.createElement('div');
            nameDiv.classList.add('employee-info');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('employee-name');
            nameSpan.textContent = employee.name || '';
            const deptSpan = document.createElement('span');
            deptSpan.classList.add('department-name');
            const department = departments.find(dep => dep.id === employee.departmentId);
            deptSpan.textContent = ` (${department ? department.name : 'Departman Yok'})`;
            nameDiv.appendChild(nameSpan);
            nameDiv.appendChild(deptSpan);
            tdName.appendChild(nameDiv);
        } else {
            tdName.textContent = employee.name || '';
        }
        tr.appendChild(tdName);

        // Haftanın Her Günü için Vardiyalar
        for (let i = 1; i <= 7; i++) {
            const td = document.createElement('td');
            const currentDay = i;
            if (currentDay > totalDays) {
                td.textContent = '';
            } else {
                const currentDate = formatDate(new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), currentDay));
                const shift = getShift(employee.id, currentDate);
                if (shift) {
                    const shiftDiv = document.createElement('div');
                    shiftDiv.classList.add('shift-cell');
                    shiftDiv.dataset.shiftId = shift.id;
                    shiftDiv.innerHTML = `<span class="shift-label">${shift.start} - ${shift.end}</span>`;
                    const department = departments.find(dep => dep.id === employee.departmentId);
                    shiftDiv.style.backgroundColor = department ? department.color : '#6c757d';
                    shiftDiv.title = `Departman: ${getDepartmentName(employee.departmentId)}\nBaşlangıç: ${shift.start}\nBitiş: ${shift.end}`;
                    shiftDiv.style.cursor = 'pointer';
                    shiftDiv.addEventListener('click', () => {
                        editShift(shift.id);
                    });
                    td.appendChild(shiftDiv);
                } else {
                    td.textContent = '—';
                    td.style.color = '#6c757d';
                }
            }
            tr.appendChild(td);
        }

        calendarBody.appendChild(tr);
    });
}
