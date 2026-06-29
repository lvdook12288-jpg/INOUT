import React, { useState, useEffect } from 'react';
import { 
  MapPin, CheckCircle2, Navigation, User, Loader2, RefreshCw, List, Settings, Save, Calendar, Users, FileText, Search
} from 'lucide-react';

// ⚠️⚠️⚠️ บรรทัดที่ 7: ใส่ LIFF ID ระบบเช็คอินของคุณตรงนี้ ⚠️⚠️⚠️
const liffId = '2010517750-FOY5M3CN'; 

export default function App() {
  const [users, setUsers] = useState([]);
  const [officeConfig, setOfficeConfig] = useState({ latitude: 13.7563, longitude: 100.5018, radius: 100 });
  const [allLogs, setAllLogs] = useState([]);
  
  // สถานะผู้ใช้และตำแหน่ง
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUserId, setLoginUserId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [liffUser, setLiffUser] = useState(null);
  const [myCoords, setMyCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [geoError, setGeoError] = useState('');
  
  // การทำงานของเมนูและ UI
  const [activeTab, setActiveTab] = useState('checkin'); // checkin, history, report, settings
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState({ text: '', type: 'info' });

  // ฟิลเตอร์หน้ารายงานสำหรับ Admin
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterDept, setFilterDept] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  // ค่าสำหรับการอัปเดตพิกัดออฟฟิศ
  const [adminLat, setAdminLat] = useState('');
  const [adminLng, setAdminLng] = useState('');
  const [adminRadius, setAdminRadius] = useState('');

  // ⚠️⚠️⚠️ บรรทัดที่ 42: ลิงก์ API สำหรับเช็คอิน (เปลี่ยนเป็น URL ของ Apps Script ตัวใหม่) ⚠️⚠️⚠️
  const sheetApiUrl = 'https://script.google.com/macros/s/AKfycbx0IAOnguzrP_0E2jo2BZS5mGaxPvXu5ptoIllRMOEKIk0xoMM6X_eCq6bzNHeCh5Be/exec';

  const showToast = (text, type = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: 'info' }), 3000);
  };

  // คำนวณระยะห่างทางภูมิศาสตร์
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); 
  };

  // ดึงตำแหน่งพิกัด GPS อุปกรณ์ในปัจจุบัน
  const getDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('อุปกรณ์ไม่รองรับระบบระบุพิกัด GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setMyCoords(coords);
        setGeoError('');
        if (officeConfig) {
          const dist = calculateDistance(coords.latitude, coords.longitude, officeConfig.latitude, officeConfig.longitude);
          setDistance(dist);
        }
      },
      (error) => {
        let msg = 'ไม่สามารถดึงตำแหน่ง GPS ได้';
        if (error.code === 1) msg = 'โปรดอนุญาตสิทธิ์เข้าถึง GPS บนเบราว์เซอร์หรือมือถือของคุณ';
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // เริ่มใช้งานระบบ LINE LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (window.liff) {
          await window.liff.init({ liffId: liffId });
          if (window.liff.isLoggedIn()) {
            const profile = await window.liff.getProfile();
            setLiffUser(profile);
          }
        }
      } catch (err) {
        console.warn('LIFF failed to init:', err.message);
      }
    };
    if (!window.liff) {
      const script = document.createElement('script');
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      script.onload = initLiff;
      document.body.appendChild(script);
    } else {
      initLiff();
    }
  }, []);

  // ดึงข้อมูลทั้งหมดจากระบบหลังบ้าน
  const fetchData = async () => {
    try {
      const res = await fetch(sheetApiUrl);
      const result = await res.json();
      if (result.status === 'success') {
        setUsers(result.data.users);
        setOfficeConfig(result.data.config);
        setAllLogs(result.data.logs || []);
        
        setAdminLat(result.data.config.latitude);
        setAdminLng(result.data.config.longitude);
        setAdminRadius(result.data.config.radius);

        if (liffUser) {
          const matched = result.data.users.find(u => u.lineUserId === liffUser.userId);
          if (matched && matched.status === 'active') {
            setCurrentUser(matched);
            setIsLoggedIn(true);
            setActiveTab('checkin'); // 🔥 เพิ่มบรรทัดนี้: เพื่อสั่งให้เด้งเข้าหน้าตอกบัตรทันที
            showToast(`เข้าสู่ระบบอัตโนมัติสำเร็จ: ${matched.name}`, 'success'); // 🔥 เพิ่มบรรทัดนี้: แสดงแจ้งเตือน
          }
        }
      }
    } catch (err) {
      showToast('ดึงข้อมูลระบบล้มเหลว', 'error');
    } finally {
      setIsAppLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    getDeviceLocation();
  }, [liffUser]);

  useEffect(() => {
    if (myCoords && officeConfig) {
      const dist = calculateDistance(myCoords.latitude, myCoords.longitude, officeConfig.latitude, officeConfig.longitude);
      setDistance(dist);
    }
  }, [myCoords, officeConfig]);

  // การดำเนินการเช็คอิน / เช็คเอาท์
  const handleCheckInOut = async (type) => {
    if (!myCoords) return showToast('ไม่พบสัญญาณพิกัด GPS ของคุณในขณะนี้', 'error');
    if (distance > officeConfig.radius) return showToast('คุณอยู่นอกพื้นที่เช็คอินที่กำหนด', 'error');

    setIsProcessing(true);
    const dataRow = {
      id: `ATT-${Date.now()}`,
      userId: currentUser.id,
      name: currentUser.name,
      type: type,
      latitude: myCoords.latitude,
      longitude: myCoords.longitude,
      distance: `${distance} เมตร`,
      status: 'In Range'
    };

    try {
      const response = await fetch(sheetApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'checkInOut', data: dataRow })
      });
      const result = await response.json();
      if (result.status === 'success') {
        showToast(`บันทึกเวลา ${type === 'Check-In' ? 'เข้างาน' : 'ออกงาน'} สำเร็จ!`, 'success');
        const todayStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toLocaleTimeString('th-TH', { hour12: false });
        const newLog = { ...dataRow, timestamp: `${todayStr} ${timeStr}` };
        setAllLogs([newLog, ...allLogs]);
      } else {
        throw new Error();
      }
    } catch (err) {
      showToast('ระบบบันทึกล้มเหลว กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // แอดมินเซฟการตั้งค่าพิกัดออฟฟิศ
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    const updatedConfig = {
      latitude: parseFloat(adminLat),
      longitude: parseFloat(adminLng),
      radius: parseInt(adminRadius)
    };

    try {
      const response = await fetch(sheetApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSettings', data: updatedConfig })
      });
      const result = await response.json();
      if (result.status === 'success') {
        setOfficeConfig(updatedConfig);
        showToast('บันทึกการตั้งค่าพิกัดใหม่เรียบร้อย!', 'success');
        setActiveTab('checkin');
      } else {
        throw new Error();
      }
    } catch (err) {
      showToast('อัปเดตข้อมูลล้มเหลว', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualLogin = (e) => {
    e.preventDefault();
    if (!loginUserId) return;
    const matched = users.find(u => u.id === loginUserId && u.status === 'active');
    if (matched) {
      setCurrentUser(matched);
      setIsLoggedIn(true);
      showToast(`ยินดีต้อนรับ ${matched.name}`, 'success');
    } else {
      showToast('ไม่พบรหัสพนักงานนี้ หรือ พนักงานพ้นสภาพแล้ว', 'error');
    }
  };

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-600">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="font-medium">กำลังโหลดข้อมูลระบบเช็คอิน...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">ระบบลงเวลาทำงาน</h2>
          <p className="text-slate-500 text-xs mt-1 mb-6">กรุณาระบุรหัสพนักงานเพื่อดำเนินการ</p>
          
          <form onSubmit={handleManualLogin} className="space-y-4">
            <input 
              required
              type="text" 
              className="w-full border p-3 rounded-xl outline-none focus:border-blue-500 text-center font-mono" 
              placeholder="กรอกรหัสพนักงานของคุณ"
              value={loginUserId}
              onChange={(e) => setLoginUserId(e.target.value)}
            />
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold transition">
              เข้าสู่ระบบเช็คอิน
            </button>
          </form>

          {liffUser && (
            <div className="mt-6 p-4 bg-slate-50 border rounded-xl text-center">
              <p className="text-xs text-slate-500">LINE User ID ของคุณคือ:</p>
              <code className="block bg-white p-2 mt-1 rounded border text-xs text-blue-700 select-all font-mono">
                {liffUser.userId}
              </code>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isWithinRange = distance !== null && distance <= officeConfig.radius;
  const todayStr = new Date().toISOString().split('T')[0];
  const myLogsToday = allLogs.filter(log => log.userId === currentUser.id && log.timestamp && log.timestamp.split(' ')[0] === todayStr);

  const reportLogs = allLogs.filter(log => {
    if (!log.timestamp) return false;
    const logDate = log.timestamp.split(' ')[0];
    if (logDate !== filterDate) return false;

    const emp = users.find(u => u.id === log.userId);
    if (filterDept !== 'all' && (!emp || emp.dept !== filterDept)) return false;
    if (filterUser !== 'all' && log.userId !== filterUser) return false;

    return true;
  });

  const totalCheckInsReport = reportLogs.filter(l => l.type === 'Check-In').length;
  const totalCheckOutsReport = reportLogs.filter(l => l.type === 'Check-Out').length;

  const departments = [...new Set(users.map(u => u.dept).filter(Boolean))];
  const usersInSelectedDept = filterDept === 'all' ? users : users.filter(u => u.dept === filterDept);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      {toastMsg.text && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl shadow-xl text-white font-medium z-50 flex items-center gap-2 ${toastMsg.type === 'success' ? 'bg-green-600' : toastMsg.type === 'error' ? 'bg-red-500' : 'bg-slate-800'}`}>
          <CheckCircle2 className="w-5 h-5"/>
          {toastMsg.text}
        </div>
      )}

      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-30 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <MapPin className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-base sm:text-lg">Check-In System</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-300 font-medium">{currentUser.name}</p>
          <p className="text-[10px] text-blue-400">{currentUser.dept} | {currentUser.role === 'admin' ? 'แอดมิน' : 'พนักงาน'}</p>
        </div>
      </nav>

      <div className="max-w-md mx-auto p-4 space-y-6">

        {/* 1. แท็บตอกบัตรเช็คอิน */}
        {activeTab === 'checkin' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-slate-50 relative">
                <Navigation className={`w-8 h-8 ${isWithinRange ? 'text-green-500 animate-pulse' : 'text-amber-500'}`} />
              </div>
              
              <div>
                <h3 className="font-bold text-lg">ตรวจสอบขอบเขตลงเวลา</h3>
                {geoError ? (
                  <p className="text-red-500 text-sm mt-1 font-medium">{geoError}</p>
                ) : distance !== null ? (
                  <p className="text-sm mt-1">
                    ระยะห่างจากที่ทำงาน: <b className="text-lg text-blue-600 font-bold">{distance}</b> เมตร
                    <span className="text-xs text-slate-500 block">(ต้องไม่เกิน {officeConfig.radius} เมตร)</span>
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm mt-1 animate-pulse">กำลังตรวจสอบสัญญาณ GPS...</p>
                )}
              </div>

              {distance !== null && (
                <div className={`p-3 rounded-xl font-bold text-sm ${isWithinRange ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {isWithinRange ? '🟢 คุณอยู่ในพื้นที่สำนักงานแล้ว' : '🔴 คุณอยู่นอกพื้นที่ลงเวลาทำงาน'}
                </div>
              )}

              <button onClick={getDeviceLocation} className="text-blue-600 text-xs font-semibold hover:underline flex items-center justify-center gap-1 mx-auto">
                <RefreshCw className="w-3.5 h-3.5" /> รีเฟรชตำแหน่ง GPS ใหม่
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                disabled={isProcessing || !isWithinRange}
                onClick={() => handleCheckInOut('Check-In')}
                className="bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-2xl font-bold text-lg shadow-md transition flex flex-col items-center justify-center gap-1"
              >
                <span className="text-2xl">📥</span>
                <span>บันทึกเข้างาน</span>
              </button>
              <button 
                disabled={isProcessing || !isWithinRange}
                onClick={() => handleCheckInOut('Check-Out')}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-2xl font-bold text-lg shadow-md transition flex flex-col items-center justify-center gap-1"
              >
                <span className="text-2xl">📤</span>
                <span>บันทึกออกงาน</span>
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-3">
              <h4 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center gap-1.5">
                <List className="w-4 h-4 text-slate-500" /> บันทึกของคุณในวันนี้
              </h4>
              <div className="space-y-2">
                {myLogsToday.length > 0 ? myLogsToday.map(log => (
                  <div key={log.id} className="flex justify-between items-center text-sm p-2 rounded bg-slate-50 border border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.type === 'Check-In' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {log.type === 'Check-In' ? 'เข้างาน' : 'ออกงาน'}
                    </span>
                    <span className="font-mono text-slate-600">{log.timestamp ? log.timestamp.split(' ')[1] : ''}</span>
                    <span className="text-xs text-slate-400">ห่าง {log.distance}</span>
                  </div>
                )) : (
                  <p className="text-center text-slate-400 text-xs py-4">วันนี้คุณยังไม่มีประวัติเช็คอิน/เช็คเอาท์</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. แท็บประวัติของตัวเอง */}
        {activeTab === 'history' && (
          <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
            <h3 className="font-bold text-lg text-slate-800">ประวัติเวลาเข้างานของฉัน</h3>
            <div className="space-y-3">
              {allLogs.filter(l => l.userId === currentUser.id).length > 0 ? (
                allLogs.filter(l => l.userId === currentUser.id).map(log => (
                  <div key={log.id} className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        {log.type === 'Check-In' ? '📥 บันทึกเข้างาน' : '📤 บันทึกออกงาน'}
                      </p>
                      <p className="text-xs text-slate-400">{log.timestamp}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-white border px-2 py-1 rounded">
                      ห่าง {log.distance}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 text-sm py-8">คุณไม่มีข้อมูลประวัติเวลาทำงาน</p>
              )}
            </div>
          </div>
        )}

        {/* 3. แท็บรายงานประจำวัน (แอดมิน) */}
        {activeTab === 'report' && currentUser.role === 'admin' && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" /> หน้ารายงานลงเวลาทำงาน
              </h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">เลือกวันที่ที่ต้องการดู</label>
                  <input 
                    type="date" 
                    className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เลือกแผนก</label>
                    <select 
                      className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 bg-white"
                      value={filterDept}
                      onChange={(e) => {
                        setFilterDept(e.target.value);
                        setFilterUser('all');
                      }}
                    >
                      <option value="all">ทั้งหมด ทุกแผนก</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เลือกรายบุคคล</label>
                    <select 
                      className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 bg-white"
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                    >
                      <option value="all">ทุกคน</option>
                      {usersInSelectedDept.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-green-50 border border-green-100 p-3 rounded-xl text-center">
                  <span className="text-xs text-green-700 block font-medium">เข้างาน (Check-In)</span>
                  <span className="text-xl font-bold text-green-800">{totalCheckInsReport}</span> คน
                </div>
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center">
                  <span className="text-xs text-amber-700 block font-medium">ออกงาน (Check-Out)</span>
                  <span className="text-xl font-bold text-amber-800">{totalCheckOutsReport}</span> คน
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">รายการประวัติเวลางาน ({reportLogs.length})</h4>
              <div className="space-y-3">
                {reportLogs.length > 0 ? reportLogs.map(log => {
                  const emp = users.find(u => u.id === log.userId);
                  return (
                    <div key={log.id} className="p-3 bg-slate-50 border rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700 text-sm">{log.name || 'พนักงาน'}</span>
                        <span className="font-mono text-slate-500">{log.timestamp ? log.timestamp.split(' ')[1] : ''} น.</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'Check-In' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {log.type === 'Check-In' ? 'เข้างาน' : 'ออกงาน'}
                        </span>
                        <span className="text-slate-400">แผนก: {emp ? emp.dept : 'ไม่ระบุ'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-100">
                        <span>ระยะ: {log.distance}</span>
                        <span>สถานะ: {log.status}</span>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-center text-slate-400 text-xs py-8">ไม่พบประวัติการลงเวลาในเงื่อนไขดังกล่าว</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. แท็บปรับแต่งพิกัด GPS ออฟฟิศ (แอดมิน) */}
        {activeTab === 'settings' && currentUser.role === 'admin' && (
          <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-600" /> ปรับตั้งพิกัดบริษัท
            </h3>
            
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ละติจูด (Latitude)</label>
                <input 
                  required
                  type="number" 
                  step="any"
                  className="w-full border p-2.5 rounded-xl outline-none font-mono text-sm" 
                  value={adminLat}
                  onChange={(e) => setAdminLat(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ลองจิจูด (Longitude)</label>
                <input 
                  required
                  type="number" 
                  step="any"
                  className="w-full border p-2.5 rounded-xl outline-none font-mono text-sm" 
                  value={adminLng}
                  onChange={(e) => setAdminLng(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">รัศมีการอนุญาตบันทึก (เมตร)</label>
                <input 
                  required
                  type="number" 
                  className="w-full border p-2.5 rounded-xl outline-none text-sm" 
                  value={adminRadius}
                  onChange={(e) => setAdminRadius(e.target.value)}
                />
              </div>

              {myCoords && (
                <button 
                  type="button"
                  onClick={() => {
                    setAdminLat(myCoords.latitude);
                    setAdminLng(myCoords.longitude);
                    showToast('บันทึกค่า GPS ปัจจุบันของคุณแล้ว', 'success');
                  }}
                  className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-200"
                >
                  📍 ตั้งตำแหน่งพิกัดของฉัน ณ ตอนนี้เป็นพิกัดออฟฟิศ
                </button>
              )}

              <button 
                disabled={isProcessing}
                type="submit" 
                className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition flex justify-center items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> อัปเดตและบันทึกข้อมูล
              </button>
            </form>
          </div>
        )}
      </div>

      {/* แถบเมนูด้านล่างจอ */}
      <div className="bg-white border-t border-slate-200 p-2.5 fixed bottom-0 left-0 right-0 z-40 flex justify-around shadow-lg">
        <button onClick={() => setActiveTab('checkin')} className={`flex flex-col items-center gap-1 text-xs font-medium ${activeTab === 'checkin' ? 'text-blue-600' : 'text-slate-400'}`}>
          <MapPin className="w-5 h-5" /> ลงเวลางาน
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 text-xs font-medium ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'}`}>
          <List className="w-5 h-5" /> ประวัติฉัน
        </button>
        {currentUser.role === 'admin' && (
          <>
            <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center gap-1 text-xs font-medium ${activeTab === 'report' ? 'text-blue-600' : 'text-slate-400'}`}>
              <FileText className="w-5 h-5" /> รายงานเวลา
            </button>
            <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 text-xs font-medium ${activeTab === 'settings' ? 'text-blue-600' : 'text-slate-400'}`}>
              <Settings className="w-5 h-5" /> ตั้งค่าพิกัด
            </button>
          </>
        )}
      </div>
    </div>
  );
}
