import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import './AdminPanel.css';

const IMGBB_API_KEY = "28db43729f369058eef4ea048ddcb99b";
const ADMIN_PASSWORD = "areejmaka";

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function uploadImageToImgBB(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("image", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText).data.url);
      } else {
        reject(new Error("فشل الرفع"));
      }
    };
    xhr.onerror = () => reject(new Error("خطأ في الاتصال"));
    xhr.send(fd);
  });
}

export function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function AdminPanel({ onClose }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [formData, setFormData] = useState({
    title: '', type: 'بيع', price: '', location: '',
    bedrooms: 3, bathrooms: 1, area: '', description: '', youtubeUrl: ''
  });
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('كلمة السر غير صحيحة');
    }
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setProperties(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLoggedIn) fetchProperties();
  }, [isLoggedIn]);

  const handleInput = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleImageSelect = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    const newImgs = selected.map(file => ({
      id: generateId(), file, preview: URL.createObjectURL(file),
      progress: 0, url: null, uploading: false, error: null
    }));
    setImages(prev => [...prev, ...newImgs]);
    e.target.value = '';
  };

  const removeImage = (id) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.preview) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (images.length === 0) { alert('يرجى إضافة صورة واحدة على الأقل'); return; }
    setSubmitting(true);

    const updated = [...images];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].url) continue;
      try {
        updated[i] = { ...updated[i], uploading: true };
        setImages([...updated]);
        const url = await uploadImageToImgBB(updated[i].file, (p) => {
          updated[i] = { ...updated[i], progress: p };
          setImages([...updated]);
        });
        updated[i] = { ...updated[i], url, uploading: false, progress: 100 };
        setImages([...updated]);
      } catch {
        updated[i] = { ...updated[i], error: 'فشل الرفع', uploading: false };
        setImages([...updated]);
      }
    }

    const imageUrls = updated.filter(i => i.url).map(i => i.url);
    if (imageUrls.length === 0) { setSubmitting(false); return; }

    try {
      await addDoc(collection(db, "properties"), {
        title: formData.title, type: formData.type, price: formData.price,
        location: formData.location, bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms), area: formData.area,
        description: formData.description, images: imageUrls,
        youtubeUrl: formData.youtubeUrl || null, createdAt: serverTimestamp()
      });
      setSubmitSuccess(true);
      setFormData({ title: '', type: 'بيع', price: '', location: '', bedrooms: 3, bathrooms: 1, area: '', description: '', youtubeUrl: '' });
      setImages([]);
      fetchProperties();
      setTimeout(() => { setShowAddForm(false); setSubmitSuccess(false); }, 2000);
    } catch (error) {
      console.error("Error:", error);
      alert('حدث خطأ في الحفظ. تأكد من إعداد Firebase.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العقار؟')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "properties", id));
      fetchProperties();
    } catch (error) {
      console.error("Delete error:", error);
      alert('خطأ في الحذف');
    }
    setDeleting(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="admin-overlay">
        <div className="admin-login-box">
          <button className="admin-close-btn" onClick={onClose}>×</button>
          <div className="admin-login-icon">🔐</div>
          <h2>لوحة التحكم</h2>
          <p>أريج مكة للتطوير العقاري</p>
          <form onSubmit={handleLogin}>
            <input type="password" placeholder="كلمة السر" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="admin-login-btn">دخول</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overlay">
      <div className="admin-dashboard">
        <div className="admin-topbar">
          <h2>🏠 لوحة التحكم</h2>
          <div className="admin-topbar-actions">
            <button onClick={() => setShowAddForm(!showAddForm)} className="admin-add-btn">
              {showAddForm ? '✕ إلغاء' : '➕ إضافة عقار جديد'}
            </button>
            <button onClick={onClose} className="admin-exit-btn">خروج ↗</button>
          </div>
        </div>

        <div className="admin-content">
          {showAddForm && (
            <div className="admin-add-form-container">
              <h3>إضافة عقار جديد</h3>
              {submitSuccess ? (
                <div className="admin-success">✅ تم إضافة العقار بنجاح!</div>
              ) : (
                <form onSubmit={handleAddProperty} className="admin-form">
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label>عنوان العقار</label>
                      <input name="title" value={formData.title} onChange={handleInput} required placeholder="مثال: شقة للبيع - كورنيش النيل" />
                    </div>
                    <div className="admin-form-group">
                      <label>نوع العقار</label>
                      <select name="type" value={formData.type} onChange={handleInput}>
                        <option value="بيع">للبيع (تمليك)</option>
                        <option value="إيجار مفروش">إيجار مفروش</option>
                        <option value="إيجار على البلاط">إيجار على البلاط</option>
                      </select>
                    </div>
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label>السعر</label>
                      <input name="price" value={formData.price} onChange={handleInput} required placeholder="مثال: 1,500,000 ج.م" />
                    </div>
                    <div className="admin-form-group">
                      <label>الموقع</label>
                      <input name="location" value={formData.location} onChange={handleInput} required placeholder="مثال: كورنيش النيل، أسوان" />
                    </div>
                  </div>
                  <div className="admin-form-row three-cols">
                    <div className="admin-form-group">
                      <label>غرف النوم</label>
                      <input name="bedrooms" type="number" value={formData.bedrooms} onChange={handleInput} min="1" />
                    </div>
                    <div className="admin-form-group">
                      <label>الحمامات</label>
                      <input name="bathrooms" type="number" value={formData.bathrooms} onChange={handleInput} min="1" />
                    </div>
                    <div className="admin-form-group">
                      <label>المساحة</label>
                      <input name="area" value={formData.area} onChange={handleInput} required placeholder="150 متر مربع" />
                    </div>
                  </div>
                  <div className="admin-form-group">
                    <label>تفاصيل العقار</label>
                    <textarea name="description" value={formData.description} onChange={handleInput} rows="3" required placeholder="وصف مفصل للعقار..." />
                  </div>
                  <div className="admin-form-group">
                    <label>🎬 رابط فيديو YouTube (اختياري)</label>
                    <input name="youtubeUrl" value={formData.youtubeUrl} onChange={handleInput} placeholder="https://www.youtube.com/watch?v=..." dir="ltr" />
                    {formData.youtubeUrl && getYouTubeId(formData.youtubeUrl) && (
                      <div className="youtube-preview">
                        <iframe src={`https://www.youtube.com/embed/${getYouTubeId(formData.youtubeUrl)}`} title="Preview" allowFullScreen />
                      </div>
                    )}
                  </div>
                  <div className="admin-form-group">
                    <label>📸 صور العقار</label>
                    <div className="admin-dropzone" onClick={() => fileInputRef.current?.click()}>
                      <span>📁</span>
                      <p>اضغط لاختيار الصور</p>
                      <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                    </div>
                  </div>
                  {images.length > 0 && (
                    <div className="admin-images-preview">
                      {images.map(img => (
                        <div key={img.id} className="admin-image-item">
                          <img src={img.preview} alt="" />
                          {img.uploading && <div className="admin-img-progress"><div style={{ width: `${img.progress}%` }} /><span>{img.progress}%</span></div>}
                          {img.url && <div className="admin-img-done">✅</div>}
                          {img.error && <div className="admin-img-error">❌</div>}
                          <button type="button" onClick={() => removeImage(img.id)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="submit" className="admin-submit-btn" disabled={submitting}>
                    {submitting ? '⏳ جاري الرفع والحفظ...' : '🚀 إضافة العقار'}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="admin-properties-section">
            <h3>العقارات الحالية ({properties.length})</h3>
            {loading ? (
              <div className="admin-loading">جاري التحميل...</div>
            ) : properties.length === 0 ? (
              <div className="admin-empty">لا توجد عقارات بعد. اضغط "إضافة عقار جديد" للبدء.</div>
            ) : (
              <div className="admin-properties-grid">
                {properties.map(prop => (
                  <div key={prop.id} className="admin-property-card">
                    <img src={prop.images?.[0]} alt={prop.title} />
                    <div className="admin-card-info">
                      <h4>{prop.title}</h4>
                      <span className="admin-card-type">{prop.type}</span>
                      <p className="admin-card-price">{prop.price}</p>
                      <p className="admin-card-location">📍 {prop.location}</p>
                    </div>
                    <button className="admin-delete-btn" onClick={() => handleDelete(prop.id)} disabled={deleting === prop.id}>
                      {deleting === prop.id ? '⏳' : '🗑️ حذف'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
